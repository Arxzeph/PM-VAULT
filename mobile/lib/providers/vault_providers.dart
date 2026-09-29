import 'dart:convert';
import 'dart:typed_data';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:uuid/uuid.dart';
import '../models/vault_entry.dart';
import '../db/vault_database.dart';
import '../crypto/crypto_service.dart';
import '../services/supabase_service.dart';
import '../services/sync_engine.dart';

class VaultState {
  final bool isInitialized;
  final bool isUnlocked;
  final bool hasBiometricKey;
  final String? email;
  final String? ownerId;
  final Uint8List? masterKey;
  final Uint8List? dek;
  final SyncStatus syncStatus;
  final List<VaultEntry> entries;
  final bool isLoading;
  final String? errorMessage;

  VaultState({
    this.isInitialized = false,
    this.isUnlocked = false,
    this.hasBiometricKey = false,
    this.email,
    this.ownerId,
    this.masterKey,
    this.dek,
    this.syncStatus = SyncStatus.offline,
    this.entries = const [],
    this.isLoading = false,
    this.errorMessage,
  });

  VaultState copyWith({
    bool? isInitialized,
    bool? isUnlocked,
    bool? hasBiometricKey,
    String? email,
    String? ownerId,
    Uint8List? masterKey,
    Uint8List? dek,
    SyncStatus? syncStatus,
    List<VaultEntry>? entries,
    bool? isLoading,
    String? errorMessage,
  }) {
    return VaultState(
      isInitialized: isInitialized ?? this.isInitialized,
      isUnlocked: isUnlocked ?? this.isUnlocked,
      hasBiometricKey: hasBiometricKey ?? this.hasBiometricKey,
      email: email ?? this.email,
      ownerId: ownerId ?? this.ownerId,
      masterKey: masterKey ?? this.masterKey,
      dek: dek ?? this.dek,
      syncStatus: syncStatus ?? this.syncStatus,
      entries: entries ?? this.entries,
      isLoading: isLoading ?? this.isLoading,
      errorMessage: errorMessage,
    );
  }
}

class VaultNotifier extends StateNotifier<VaultState> {
  static const _storage = FlutterSecureStorage();
  static const _bioKeyName = 'pm_vault_master_key_v1';

  VaultNotifier() : super(VaultState()) {
    checkStatus();
  }

  Future<void> checkStatus() async {
    state = state.copyWith(isLoading: true);
    final salt = await VaultDatabase.getMeta('master_salt');
    final email = await VaultDatabase.getMeta('user_email');
    final bioKey = await _storage.read(key: _bioKeyName);

    state = state.copyWith(
      isInitialized: salt != null,
      hasBiometricKey: bioKey != null,
      email: email,
      isLoading: false,
    );
  }

  /// Logs in to an existing cloud account or creates a new vault
  Future<void> loginOrInitVault({
    required String email,
    required String password,
    String? manualSalt,
  }) async {
    state = state.copyWith(isLoading: true, errorMessage: null);
    try {
      final cleanEmail = email.trim().toLowerCase();

      // 1. Try to fetch salt from Supabase RPC or use manual salt
      var saltB64 = await SupabaseService.fetchUserSalt(cleanEmail);
      if (saltB64 == null && manualSalt != null && manualSalt.trim().isNotEmpty) {
        saltB64 = manualSalt.trim();
      }

      if (saltB64 != null) {
        // --- EXISTING CLOUD ACCOUNT ---
        print('[VaultNotifier] Connecting to existing account with salt: $saltB64');
        final salt = base64Decode(saltB64);
        final mk = CryptoService.deriveMasterKey(password, salt);
        final authVerifier = await CryptoService.deriveAuthVerifier(mk, cleanEmail);

        // Sign in to Supabase (Existing Account)
        final user = await SupabaseService.signIn(cleanEmail, authVerifier);
        if (user == null) {
          throw Exception("Incorrect Master Password or account authentication failed.");
        }

        // Fetch remote vault metadata (encrypted DEK + nonce)
        final remoteMeta = await SupabaseService.fetchRemoteVaultMeta(user.id);
        if (remoteMeta == null ||
            remoteMeta['encrypted_dek'] == null ||
            remoteMeta['dek_nonce'] == null) {
          throw Exception("Could not retrieve vault metadata from cloud.");
        }

        final encDekB64 = remoteMeta['encrypted_dek'] as String;
        final dekNonceB64 = remoteMeta['dek_nonce'] as String;

        // Decrypt DEK using Master Key
        final dek = await CryptoService.decryptDek(encDekB64, dekNonceB64, mk);

        // Save locally to SQLite
        await VaultDatabase.setMeta('user_email', cleanEmail);
        await VaultDatabase.setMeta('owner_id', user.id);
        await VaultDatabase.setMeta('master_salt', saltB64);
        await VaultDatabase.setMeta('encrypted_dek', encDekB64);
        await VaultDatabase.setMeta('dek_nonce', dekNonceB64);

        // Blocking migration check if legacy local_entries exists
        if (await VaultDatabase.hasLegacyTable()) {
          await VaultDatabase.migrateLegacyToEncrypted(dek, user.id);
        }

        // Store Master Key in Hardware Keystore for Biometrics
        await _storage.write(key: _bioKeyName, value: base64Encode(mk));

        // Start Realtime Sync Engine
        SyncEngine.start(
          userId: user.id,
          dek: dek,
          statusCallback: (s) => state = state.copyWith(syncStatus: s),
          updatedCallback: () => loadEntries(),
        );

        state = state.copyWith(
          isInitialized: true,
          isUnlocked: true,
          hasBiometricKey: true,
          email: cleanEmail,
          ownerId: user.id,
          masterKey: mk,
          dek: dek,
          isLoading: false,
        );
        await loadEntries();
      } else {
        // --- BRAND NEW VAULT REGISTRATION ---
        print('[VaultNotifier] Creating brand new zero-knowledge vault for: $cleanEmail');
        final newSalt = CryptoService.generateSalt();
        final mk = CryptoService.deriveMasterKey(password, newSalt);
        final dek = CryptoService.generateDek();

        final encDekMap = await CryptoService.encryptDek(dek, mk);
        final newSaltB64 = base64Encode(newSalt);
        final encDekB64 = encDekMap['encryptedDek']!;
        final dekNonceB64 = encDekMap['nonce']!;
        final authVerifier = await CryptoService.deriveAuthVerifier(mk, cleanEmail);

        String ownerId = const Uuid().v4();

        // Save locally
        await VaultDatabase.setMeta('user_email', cleanEmail);
        await VaultDatabase.setMeta('owner_id', ownerId);
        await VaultDatabase.setMeta('master_salt', newSaltB64);
        await VaultDatabase.setMeta('encrypted_dek', encDekB64);
        await VaultDatabase.setMeta('dek_nonce', dekNonceB64);

        // Save to Secure Storage for Biometrics
        await _storage.write(key: _bioKeyName, value: base64Encode(mk));

        // Cloud Registration
        try {
          final user = await SupabaseService.signUpOrSignIn(cleanEmail, authVerifier);
          if (user != null) {
            ownerId = user.id;
            await VaultDatabase.setMeta('owner_id', ownerId);
            await SupabaseService.saveRemoteVaultMeta(
              userId: user.id,
              masterSalt: newSaltB64,
              encryptedDek: encDekB64,
              dekNonce: dekNonceB64,
            );
            SyncEngine.start(
              userId: user.id,
              dek: dek,
              statusCallback: (s) => state = state.copyWith(syncStatus: s),
              updatedCallback: () => loadEntries(),
            );
          }
        } catch (cloudErr) {
          print('[VaultNotifier] Cloud sync init warning: $cloudErr');
        }

        state = state.copyWith(
          isInitialized: true,
          isUnlocked: true,
          hasBiometricKey: true,
          email: cleanEmail,
          ownerId: ownerId,
          masterKey: mk,
          dek: dek,
          isLoading: false,
        );
        await loadEntries();
      }
    } catch (e) {
      state = state.copyWith(isLoading: false, errorMessage: e.toString());
      rethrow;
    }
  }

  Future<void> unlockVault(String password) async {
    state = state.copyWith(isLoading: true, errorMessage: null);
    try {
      final saltB64 = await VaultDatabase.getMeta('master_salt');
      final encDekB64 = await VaultDatabase.getMeta('encrypted_dek');
      final dekNonceB64 = await VaultDatabase.getMeta('dek_nonce');
      final email = await VaultDatabase.getMeta('user_email');
      var ownerId = await VaultDatabase.getMeta('owner_id');

      if (saltB64 == null || encDekB64 == null || dekNonceB64 == null) {
        throw Exception('Vault not initialized');
      }

      final salt = base64Decode(saltB64);
      final mk = CryptoService.deriveMasterKey(password, salt);
      final dek = await CryptoService.decryptDek(encDekB64, dekNonceB64, mk);

      if (ownerId == null || ownerId.isEmpty) {
        ownerId = await VaultDatabase.getOrCreateOwnerId();
      }

      // Blocking migration if legacy local_entries exists
      if (await VaultDatabase.hasLegacyTable()) {
        await VaultDatabase.migrateLegacyToEncrypted(dek, ownerId);
      }

      // Save for Biometric Unlock
      await _storage.write(key: _bioKeyName, value: base64Encode(mk));

      // Connect to cloud sync if email present
      if (email != null) {
        final authVerifier = await CryptoService.deriveAuthVerifier(mk, email);
        try {
          final user = await SupabaseService.signUpOrSignIn(email, authVerifier);
          if (user != null) {
            ownerId = user.id;
            await VaultDatabase.setMeta('owner_id', ownerId);
            SyncEngine.start(
              userId: user.id,
              dek: dek,
              statusCallback: (s) => state = state.copyWith(syncStatus: s),
              updatedCallback: () => loadEntries(),
            );
          }
        } catch (authErr) {
          print('[VaultNotifier] Sync start warning: $authErr');
        }
      }

      state = state.copyWith(
        isUnlocked: true,
        hasBiometricKey: true,
        email: email,
        ownerId: ownerId,
        masterKey: mk,
        dek: dek,
        isLoading: false,
      );
      await loadEntries();
    } catch (e) {
      state = state.copyWith(
        isLoading: false,
        errorMessage: 'Incorrect master password. Please try again.',
      );
      rethrow;
    }
  }

  Future<void> unlockWithBiometrics() async {
    state = state.copyWith(isLoading: true, errorMessage: null);
    try {
      final bioKeyB64 = await _storage.read(key: _bioKeyName);
      if (bioKeyB64 == null) {
        throw Exception('Biometrics not registered. Please enter master password once.');
      }

      final encDekB64 = await VaultDatabase.getMeta('encrypted_dek');
      final dekNonceB64 = await VaultDatabase.getMeta('dek_nonce');
      final email = await VaultDatabase.getMeta('user_email');
      var ownerId = await VaultDatabase.getMeta('owner_id');

      if (encDekB64 == null || dekNonceB64 == null) {
        throw Exception('Vault metadata missing.');
      }

      final mk = base64Decode(bioKeyB64);
      final dek = await CryptoService.decryptDek(encDekB64, dekNonceB64, mk);

      if (ownerId == null || ownerId.isEmpty) {
        ownerId = await VaultDatabase.getOrCreateOwnerId();
      }

      if (await VaultDatabase.hasLegacyTable()) {
        await VaultDatabase.migrateLegacyToEncrypted(dek, ownerId);
      }

      if (email != null) {
        final authVerifier = await CryptoService.deriveAuthVerifier(mk, email);
        try {
          final user = await SupabaseService.signUpOrSignIn(email, authVerifier);
          if (user != null) {
            ownerId = user.id;
            await VaultDatabase.setMeta('owner_id', ownerId);
            SyncEngine.start(
              userId: user.id,
              dek: dek,
              statusCallback: (s) => state = state.copyWith(syncStatus: s),
              updatedCallback: () => loadEntries(),
            );
          }
        } catch (authErr) {
          print('[VaultNotifier] Biometric sync start notice: $authErr');
        }
      }

      state = state.copyWith(
        isUnlocked: true,
        hasBiometricKey: true,
        email: email,
        ownerId: ownerId,
        masterKey: mk,
        dek: dek,
        isLoading: false,
      );
      await loadEntries();
    } catch (e) {
      state = state.copyWith(isLoading: false, errorMessage: e.toString());
      rethrow;
    }
  }

  Future<void> resetLocalVault() async {
    SyncEngine.stop();
    await VaultDatabase.clearDatabase();
    await _storage.deleteAll();
    state = VaultState();
  }

  void lockVault() {
    SyncEngine.stop();
    // Zero memory buffers
    if (state.masterKey != null) {
      state.masterKey!.fillRange(0, state.masterKey!.length, 0);
    }
    if (state.dek != null) {
      state.dek!.fillRange(0, state.dek!.length, 0);
    }

    state = state.copyWith(
      isUnlocked: false,
      masterKey: null,
      dek: null,
      ownerId: null,
      entries: const [],
      syncStatus: SyncStatus.offline,
    );
  }

  Future<void> loadEntries() async {
    if (state.dek == null) return;
    final ownerId = state.ownerId ?? await VaultDatabase.getOrCreateOwnerId();
    final list = await VaultDatabase.listActiveEntries(dek: state.dek!, ownerId: ownerId);
    state = state.copyWith(entries: list);
  }

  Future<void> saveEntry({
    String? id,
    required String title,
    String? username,
    String? password,
    String? url,
    String? notes,
    List<SecurityQuestion> securityQuestions = const [],
    List<String> tags = const [],
    bool favorite = false,
  }) async {
    if (state.dek == null) throw Exception("Vault is locked");
    final ownerId = state.ownerId ?? await VaultDatabase.getOrCreateOwnerId();

    final entryId = id ?? const Uuid().v4();
    final now = DateTime.now().toUtc().toIso8601String();

    final existing = await VaultDatabase.getEncryptedRow(entryId);
    final revision = (existing != null ? (existing['revision'] as int) : 0) + 1;

    final entry = VaultEntry(
      id: entryId,
      title: title,
      username: username,
      password: password,
      url: url,
      notes: notes,
      securityQuestions: securityQuestions,
      tags: tags,
      favorite: favorite,
      ciphertext: '',
      nonce: '',
      version: revision,
      isDeleted: false,
      syncStatus: 'pending_update',
      clientUpdatedAt: now,
    );

    await VaultDatabase.saveEntryEncrypted(
      entry: entry,
      dek: state.dek!,
      ownerId: ownerId,
    );
    await loadEntries();

    // Trigger instant cloud push
    SyncEngine.syncFullSweep();
  }

  Future<void> deleteEntry(String id) async {
    await VaultDatabase.softDeleteEncryptedRow(id);
    await loadEntries();
    SyncEngine.syncFullSweep();
  }

  void triggerSync() {
    SyncEngine.syncFullSweep();
  }
}

final vaultProvider = StateNotifierProvider<VaultNotifier, VaultState>((ref) {
  return VaultNotifier();
});
