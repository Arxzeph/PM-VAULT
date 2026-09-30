import 'package:supabase_flutter/supabase_flutter.dart';
import '../models/encrypted_envelope.dart';

class RemoteVaultMeta {
  final String masterSalt;
  final String encryptedDek;
  final String dekNonce;
  final int dekWrapVersion;
  final int keyGeneration;

  const RemoteVaultMeta({
    required this.masterSalt,
    required this.encryptedDek,
    required this.dekNonce,
    this.dekWrapVersion = 1,
    this.keyGeneration = 1,
  });
}

class SupabaseService {
  static const String supabaseUrl = 'https://fdavvijioofchmkgmihg.supabase.co';
  static const String supabaseAnonKey =
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZkYXZ2aWppb29mY2hta2dtaWhnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA1ODQzMDIsImV4cCI6MjEwNjE2MDMwMn0.8c3urWFa1v1_JZkl-xElT4Pq77qvKGp-hAw6oROrNiQ';

  static SupabaseClient get client => Supabase.instance.client;

  static Future<void> initialize() async {
    await Supabase.initialize(
      url: supabaseUrl,
      anonKey: supabaseAnonKey,
      authOptions: const FlutterAuthClientOptions(
        authFlowType: AuthFlowType.pkce,
      ),
    );
  }

  /// Fetches the user's master salt from Supabase RPC function
  static Future<String?> fetchUserSalt(String email) async {
    try {
      final res = await client.rpc(
        'get_vault_salt',
        params: {'user_email': email.trim().toLowerCase()},
      );
      if (res != null && res.toString().isNotEmpty) {
        return res.toString();
      }
    } catch (_) {}
    return null;
  }

  /// Signs in to an existing Supabase account
  static Future<User?> signIn(String email, String authVerifier) async {
    final cleanEmail = email.trim().toLowerCase();
    try {
      final res = await client.auth.signInWithPassword(
        email: cleanEmail,
        password: authVerifier,
      );
      return res.user;
    } on AuthException catch (e) {
      if (e.message.toLowerCase().contains('invalid login credentials') ||
          e.code == 'invalid_credentials') {
        throw Exception(
            "Incorrect Master Password. Please check your password and try again.");
      }
      rethrow;
    }
  }

  /// Registers a brand new Supabase account
  static Future<User?> signUp(String email, String authVerifier) async {
    final cleanEmail = email.trim().toLowerCase();
    final res = await client.auth.signUp(
      email: cleanEmail,
      password: authVerifier,
    );
    return res.user;
  }

  /// Authenticates using email and client-derived auth verifier
  static Future<User?> signUpOrSignIn(String email, String authVerifier) async {
    final cleanEmail = email.trim().toLowerCase();

    // 1. Try signing in
    try {
      final res = await client.auth.signInWithPassword(
        email: cleanEmail,
        password: authVerifier,
      );
      if (res.user != null) {
        return res.user;
      }
    } catch (_) {}

    // 2. If sign in fails, attempt sign up
    final res = await client.auth.signUp(
      email: cleanEmail,
      password: authVerifier,
    );
    return res.user;
  }

  static Future<RemoteVaultMeta?> fetchRemoteVaultMeta(String userId) async {
    final res = await client
        .from('vault_metadata')
        .select(
            'master_salt, encrypted_dek, dek_nonce, dek_wrap_version, key_generation')
        .eq('id', userId)
        .maybeSingle();

    if (res == null) return null;

    return RemoteVaultMeta(
      masterSalt: res['master_salt'] as String,
      encryptedDek: res['encrypted_dek'] as String,
      dekNonce: res['dek_nonce'] as String,
      dekWrapVersion: (res['dek_wrap_version'] as int?) ?? 1,
      keyGeneration: (res['key_generation'] as int?) ?? 1,
    );
  }

  static Future<void> saveRemoteVaultMeta({
    required String userId,
    required String masterSalt,
    required String encryptedDek,
    required String dekNonce,
    int dekWrapVersion = 2,
    int keyGeneration = 1,
  }) async {
    await client.from('vault_metadata').upsert({
      'id': userId,
      'master_salt': masterSalt,
      'encrypted_dek': encryptedDek,
      'dek_nonce': dekNonce,
      'dek_wrap_version': dekWrapVersion,
      'key_generation': keyGeneration,
      'updated_at': DateTime.now().toUtc().toIso8601String(),
    });
  }

  /// Pushes an EncryptedEnvelope using optimistic concurrency RPC
  static Future<Map<String, dynamic>> pushEnvelope({
    required String userId,
    required EncryptedEnvelope envelope,
    int? expectedPreviousRevision,
  }) async {
    // 1. Try RPC with optimistic concurrency
    try {
      final res = await client.rpc(
        'upsert_vault_envelope',
        params: {
          'p_id': envelope.id,
          'p_crypto_version': envelope.cryptoVersion,
          'p_payload_schema_version': envelope.payloadSchemaVersion,
          'p_nonce': envelope.nonce,
          'p_ciphertext': envelope.ciphertext,
          'p_revision': envelope.revision,
          'p_is_deleted': envelope.isDeleted,
          'p_client_updated_at': envelope.clientUpdatedAt,
          'p_expected_previous_revision': expectedPreviousRevision,
        },
      );

      if (res is List && res.isNotEmpty) {
        final row = Map<String, dynamic>.from(res.first as Map);
        return {
          'success': row['success'] == true,
          'status': row['status'] as String? ?? 'unknown',
          'current_revision': row['current_revision'],
          'server_updated_at': row['server_updated_at'] as String?,
        };
      }
    } catch (_) {
      // Fallback to direct table upsert if RPC is unavailable
    }

    // Direct table upsert fallback
    final direct = await client
        .from('vault_entries')
        .upsert(envelope.toRemoteMap())
        .select('server_updated_at')
        .single();

    return {
      'success': true,
      'status': 'updated',
      'current_revision': envelope.revision,
      'server_updated_at': direct['server_updated_at'] as String?,
    };
  }

  /// Fetches all remote envelopes strictly validating user ownership
  static Future<List<EncryptedEnvelope>> fetchAllRemoteEnvelopes(
      String userId) async {
    final res =
        await client.from('vault_entries').select('*').eq('user_id', userId);

    final envelopes = <EncryptedEnvelope>[];
    for (final row in res) {
      final map = Map<String, dynamic>.from(row);
      try {
        envelopes.add(EncryptedEnvelope.fromRemoteMap(
          map,
          authenticatedUserId: userId,
        ));
      } catch (_) {
        // Untrusted/malformed envelope is quarantined and skipped
      }
    }
    return envelopes;
  }
}
