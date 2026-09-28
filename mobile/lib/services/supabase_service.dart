import 'package:supabase_flutter/supabase_flutter.dart';
import '../models/vault_entry.dart';

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
    } catch (e) {
      print('[SupabaseService] fetchUserSalt notice: $e');
    }
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
        throw Exception("Incorrect Master Password. Please check your password and try again.");
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

  /// Authenticates using email and the client-derived auth verifier
  static Future<User?> signUpOrSignIn(String email, String authVerifier) async {
    final cleanEmail = email.trim().toLowerCase();

    // 1. Try signing in
    try {
      final res = await client.auth.signInWithPassword(
        email: cleanEmail,
        password: authVerifier,
      );
      if (res.user != null) {
        print('[SupabaseService] Signed in as ${res.user!.id}');
        return res.user;
      }
    } catch (signInErr) {
      print('[SupabaseService] signInWithPassword notice: $signInErr');
    }

    // 2. If sign in fails, attempt sign up
    try {
      final res = await client.auth.signUp(
        email: cleanEmail,
        password: authVerifier,
      );
      print('[SupabaseService] Signed up as ${res.user?.id}');
      return res.user;
    } catch (e) {
      print('[SupabaseService] SignUp error: $e');
      rethrow;
    }
  }

  static Future<Map<String, dynamic>?> fetchRemoteVaultMeta(String userId) async {
    try {
      final res = await client
          .from('vault_metadata')
          .select('master_salt, encrypted_dek, dek_nonce')
          .eq('id', userId)
          .maybeSingle();
      return res;
    } catch (e) {
      print('[SupabaseService] fetchRemoteVaultMeta error: $e');
      return null;
    }
  }

  static Future<void> saveRemoteVaultMeta({
    required String userId,
    required String masterSalt,
    required String encryptedDek,
    required String dekNonce,
  }) async {
    try {
      await client.from('vault_metadata').upsert({
        'id': userId,
        'master_salt': masterSalt,
        'encrypted_dek': encryptedDek,
        'dek_nonce': dekNonce,
        'updated_at': DateTime.now().toUtc().toIso8601String(),
      });
    } catch (e) {
      print('[SupabaseService] saveRemoteVaultMeta error: $e');
    }
  }

  static Future<String?> pushEntry(String userId, VaultEntry entry) async {
    try {
      final res = await client
          .from('vault_entries')
          .upsert({
            'id': entry.id,
            'user_id': userId,
            'ciphertext': entry.ciphertext,
            'nonce': entry.nonce,
            'version': entry.version,
            'is_deleted': entry.isDeleted,
            'client_updated_at': entry.clientUpdatedAt,
          })
          .select('server_updated_at')
          .single();

      return res['server_updated_at'] as String?;
    } catch (e) {
      print('[SupabaseService] pushEntry error: $e');
      return null;
    }
  }

  static Future<List<Map<String, dynamic>>> fetchAllRemoteEntries(String userId) async {
    try {
      final res = await client
          .from('vault_entries')
          .select('*')
          .eq('user_id', userId);
      return List<Map<String, dynamic>>.from(res);
    } catch (e) {
      print('[SupabaseService] fetchAllRemoteEntries error: $e');
      return [];
    }
  }
}
