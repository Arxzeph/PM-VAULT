import 'dart:convert';
import 'dart:typed_data';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:uuid/uuid.dart';
import '../models/vault_entry.dart';
import '../models/encrypted_envelope.dart';
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
  final List<VaultLoadFailure> failures;
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
    this.failures = const [],
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
    List<VaultLoadFailure>? failures,
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
      failures: failures ?? this.failures,
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
      if (saltB64 == null &&
          manualSalt != null &&
          manualSalt.trim().isNotEmpty) {
        saltB64 = manualSalt.trim();
      }

      if (saltB64 != null) {
        // --- EXISTING CLOUD ACCOUNT ---
        final salt = base64Decode(saltB64);
        final mk = CryptoService.deriveMasterKey(password, salt);
        final authVerifier =
            await CryptoService.deriveAuthVerifier(mk, cleanEmail);

        // Sign in to Supabase (Existing Account)
        final user = await SupabaseService.signIn(cleanEmail, authVerifier);
        if (user == null) {
          throw Exception(
              "Incorrect Master Password or account authentication failed.");
        }

        // Fetch remote vault metadata
        final remoteMeta = await SupabaseService.fetchRemoteVaultMeta(user.id);
        if (remoteMeta == null) {
          throw Exception("Could not retrieve vault metadata from cloud.");
        }

        Uint8List dek;
        if (remoteMeta.dekWrapVersion == 1) {
          // V1 legacy wrap: decrypt with legacy AAD
          dek = await CryptoService.decryptDek(
            remoteMeta.encryptedDek,
            remoteMeta.dekNonce,
            mk,
          );

          // Transparently upgrade to V2 master wrap
          final v2Wrap = await CryptoService.encryptDekMaster(
            dek: dek,
            masterKey: mk,
            ownerId: user.id,
            keyGeneration: 1,
          );

          // Canary verify V2 wrap before persisting
          final canary = await CryptoService.decryptDekMaster(
            encryptedDekB64: v2Wrap['encryptedDek']!,
            nonceB64: v2Wrap['nonce']!,
            masterKey: mk,
            ownerId: user.id,
            keyGeneration: 1,
          );
          if (canary.length != 32) {
            throw Exception("V2 wrap canary verification failed");
          }

          // Persist upgraded V2 wrap locally & remotely
          await SupabaseService.saveRemoteVaultMeta(
            userId: user.id,
            masterSalt: saltB64,
            encryptedDek: v2Wrap['encryptedDek']!,
            dekNonce: v2Wrap['nonce']!,
            dekWrapVersion: 2,
            keyGeneration: 1,
          );

          await VaultDatabase.setMeta('encrypted_dek', v2Wrap['encryptedDek']!);
          await VaultDatabase.setMeta('dek_nonce', v2Wrap['nonce']!);
          await VaultDatabase.setMeta('dek_wrap_version', '2');
          await VaultDatabase.setMeta('key_generation', '1');
        } else if (remoteMeta.dekWrapVersion == 2) {
          // V2 wrap: decrypt with owner/generation AAD
          dek = await CryptoService.decryptDekMaster(
            encryptedDekB64: remoteMeta.encryptedDek,
            nonceB64: remoteMeta.dekNonce,
            masterKey: mk,
            ownerId: user.id,
            keyGeneration: remoteMeta.keyGeneration,
          );

          await VaultDatabase.setMeta('encrypted_dek', remoteMeta.encryptedDek);
          await VaultDatabase.setMeta('dek_nonce', remoteMeta.dekNonce);
          await VaultDatabase.setMeta('dek_wrap_version', '2');
          await VaultDatabase.setMeta(
              'key_generation', remoteMeta.keyGeneration.toString());
        } else {
          throw Exception(
              "Unsupported DEK wrap version: ${remoteMeta.dekWrapVersion}");
        }

        // Save metadata locally to SQLite
        await VaultDatabase.setMeta('user_email', cleanEmail);
        await VaultDatabase.setMeta('owner_id', user.id);
        await VaultDatabase.setMeta('master_salt', saltB64);

        // Blocking migration check if legacy local_entries exists
        if (await VaultDatabase.hasLegacyTable()) {
          await VaultDatabase.migrateLegacyToEncrypted(dek, user.id);
        }

        // Store Master Key in Hardware Keystore for Biometrics
        await _storage.write(key: _bioKeyName, value: base64Encode(mk));

        // Start Realtime Sync Engine
        await SyncEngine.start(
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
        // Authenticate/register first to establish immutable owner ID per Stage 5
        final newSalt = CryptoService.generateSalt();
        final mk = CryptoService.deriveMasterKey(password, newSalt);
        final dek = CryptoService.generateDek();
        final newSaltB64 = base64Encode(newSalt);
        final authVerifier =
            await CryptoService.deriveAuthVerifier(mk, cleanEmail);

        String ownerId;
        bool isCloud = false;

        try {
          final user =
              await SupabaseService.signUpOrSignIn(cleanEmail, authVerifier);
          if (user != null) {
            ownerId = user.id;
            isCloud = true;
          } else {
            ownerId = const Uuid().v4();
          }
        } catch (_) {
          // If offline / registration unreachable, use stable local owner
          ownerId = const Uuid().v4();
        }

        // Encrypt DEK with V2 owner/generation AAD
        final encDekMap = await CryptoService.encryptDekMaster(
          dek: dek,
          masterKey: mk,
          ownerId: ownerId,
          keyGeneration: 1,
        );
        final encDekB64 = encDekMap['encryptedDek']!;
        final dekNonceB64 = encDekMap['nonce']!;

        // Canary verification before saving
        final canary = await CryptoService.decryptDekMaster(
          encryptedDekB64: encDekB64,
          nonceB64: dekNonceB64,
          masterKey: mk,
          ownerId: ownerId,
          keyGeneration: 1,
        );
        if (canary.length != 32) {
          throw Exception("New vault DEK wrap canary verification failed");
        }

        // Save locally
        await VaultDatabase.setMeta('user_email', cleanEmail);
        await VaultDatabase.setMeta('owner_id', ownerId);
        await VaultDatabase.setMeta('master_salt', newSaltB64);
        await VaultDatabase.setMeta('encrypted_dek', encDekB64);
        await VaultDatabase.setMeta('dek_nonce', dekNonceB64);
        await VaultDatabase.setMeta('dek_wrap_version', '2');
        await VaultDatabase.setMeta('key_generation', '1');

        // Save to Secure Storage for Biometrics
        await _storage.write(key: _bioKeyName, value: base64Encode(mk));

        // If cloud user authenticated, backup metadata and start sync
        if (isCloud) {
          try {
            await SupabaseService.saveRemoteVaultMeta(
              userId: ownerId,
              masterSalt: newSaltB64,
              encryptedDek: encDekB64,
              dekNonce: dekNonceB64,
              dekWrapVersion: 2,
              keyGeneration: 1,
            );
            await SyncEngine.start(
              userId: ownerId,
              dek: dek,
              statusCallback: (s) => state = state.copyWith(syncStatus: s),
              updatedCallback: () => loadEntries(),
            );
          } catch (_) {}
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
      final wrapVerStr = await VaultDatabase.getMeta('dek_wrap_version') ?? '1';
      final wrapVersion = int.tryParse(wrapVerStr) ?? 1;
      final keyGenStr = await VaultDatabase.getMeta('key_generation') ?? '1';
      final keyGen = int.tryParse(keyGenStr) ?? 1;

      if (saltB64 == null || encDekB64 == null || dekNonceB64 == null) {
        throw Exception('Vault not initialized');
      }

      final salt = base64Decode(saltB64);
      final mk = CryptoService.deriveMasterKey(password, salt);

      if (ownerId == null || ownerId.isEmpty) {
        ownerId = await VaultDatabase.getOrCreateOwnerId();
      }

      Uint8List dek;
      if (wrapVersion == 1) {
        dek = await CryptoService.decryptDek(encDekB64, dekNonceB64, mk);

        // Transparently upgrade to V2 wrap
        final v2Wrap = await CryptoService.encryptDekMaster(
          dek: dek,
          masterKey: mk,
          ownerId: ownerId,
          keyGeneration: 1,
        );
        await VaultDatabase.setMeta('encrypted_dek', v2Wrap['encryptedDek']!);
        await VaultDatabase.setMeta('dek_nonce', v2Wrap['nonce']!);
        await VaultDatabase.setMeta('dek_wrap_version', '2');
        await VaultDatabase.setMeta('key_generation', '1');
      } else if (wrapVersion == 2) {
        dek = await CryptoService.decryptDekMaster(
          encryptedDekB64: encDekB64,
          nonceB64: dekNonceB64,
          masterKey: mk,
          ownerId: ownerId,
          keyGeneration: keyGen,
        );
      } else {
        throw Exception("Unsupported DEK wrap version: $wrapVersion");
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
          final user =
              await SupabaseService.signUpOrSignIn(email, authVerifier);
          if (user != null) {
            // Check if local owner differs from cloud user (Offline vault attachment)
            if (ownerId != user.id) {
              await VaultDatabase.migrateOwnerId(
                oldOwnerId: ownerId,
                newOwnerId: user.id,
                dek: dek,
                masterKey: mk,
                keyGeneration: 1,
              );
              ownerId = user.id;
            }

            await SyncEngine.start(
              userId: user.id,
              dek: dek,
              statusCallback: (s) => state = state.copyWith(syncStatus: s),
              updatedCallback: () => loadEntries(),
            );
          }
        } catch (_) {}
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
        throw Exception(
            'Biometrics not registered. Please enter master password once.');
      }

      final encDekB64 = await VaultDatabase.getMeta('encrypted_dek');
      final dekNonceB64 = await VaultDatabase.getMeta('dek_nonce');
      final email = await VaultDatabase.getMeta('user_email');
      var ownerId = await VaultDatabase.getMeta('owner_id');
      final wrapVerStr = await VaultDatabase.getMeta('dek_wrap_version') ?? '1';
      final wrapVersion = int.tryParse(wrapVerStr) ?? 1;
      final keyGenStr = await VaultDatabase.getMeta('key_generation') ?? '1';
      final keyGen = int.tryParse(keyGenStr) ?? 1;

      if (encDekB64 == null || dekNonceB64 == null) {
        throw Exception('Vault metadata missing.');
      }

      final mk = base64Decode(bioKeyB64);
      if (ownerId == null || ownerId.isEmpty) {
        ownerId = await VaultDatabase.getOrCreateOwnerId();
      }

      Uint8List dek;
      if (wrapVersion == 1) {
        dek = await CryptoService.decryptDek(encDekB64, dekNonceB64, mk);
      } else {
        dek = await CryptoService.decryptDekMaster(
          encryptedDekB64: encDekB64,
          nonceB64: dekNonceB64,
          masterKey: mk,
          ownerId: ownerId,
          keyGeneration: keyGen,
        );
      }

      if (await VaultDatabase.hasLegacyTable()) {
        await VaultDatabase.migrateLegacyToEncrypted(dek, ownerId);
      }

      if (email != null) {
        final authVerifier = await CryptoService.deriveAuthVerifier(mk, email);
        try {
          final user =
              await SupabaseService.signUpOrSignIn(email, authVerifier);
          if (user != null) {
            if (ownerId != user.id) {
              await VaultDatabase.migrateOwnerId(
                oldOwnerId: ownerId,
                newOwnerId: user.id,
                dek: dek,
                masterKey: mk,
                keyGeneration: 1,
              );
              ownerId = user.id;
            }

            await SyncEngine.start(
              userId: user.id,
              dek: dek,
              statusCallback: (s) => state = state.copyWith(syncStatus: s),
              updatedCallback: () => loadEntries(),
            );
          }
        } catch (_) {}
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
    await SyncEngine.stop();
    await VaultDatabase.clearDatabase();
    await _storage.deleteAll();
    state = VaultState();
  }

  Future<void> lockVault() async {
    await SyncEngine.stop();
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
      failures: const [],
      syncStatus: SyncStatus.offline,
    );
  }

  Future<void> loadEntries() async {
    if (state.dek == null) return;
    final ownerId = state.ownerId ?? await VaultDatabase.getOrCreateOwnerId();
    final result = await VaultDatabase.listActiveEntries(
        dek: state.dek!, ownerId: ownerId);
    state = state.copyWith(entries: result.entries, failures: result.failures);
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

    final existing = await VaultDatabase.getEncryptedEnvelope(entryId);
    final revision = (existing != null ? existing.revision : 0) + 1;

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
      revision: revision,
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
    await SyncEngine.syncFullSweep();
  }

  Future<void> deleteEntry(String id) async {
    if (state.dek == null) throw Exception("Vault is locked");
    final ownerId = state.ownerId ?? await VaultDatabase.getOrCreateOwnerId();

    await VaultDatabase.cryptoSoftDeleteEntry(
      id: id,
      dek: state.dek!,
      ownerId: ownerId,
    );
    await loadEntries();
    await SyncEngine.syncFullSweep();
  }

  void triggerSync() {
    SyncEngine.syncFullSweep();
  }
}

final vaultProvider = StateNotifierProvider<VaultNotifier, VaultState>((ref) {
  return VaultNotifier();
});
