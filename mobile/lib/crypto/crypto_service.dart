import 'dart:convert';
import 'dart:math';
import 'dart:typed_data';
import 'package:cryptography/cryptography.dart' as crypto;
import 'package:pointycastle/export.dart';

class CryptoService {
  static final _secureRandom = Random.secure();
  static final _xchacha20 = crypto.Xchacha20.poly1305Aead();

  // ---------------------------------------------------------------------------
  // Master Key & Auth Verifier Derivation
  // ---------------------------------------------------------------------------

  /// Derives 32-byte Master Key using Argon2id (m=64MiB, t=3, p=4)
  static Uint8List deriveMasterKey(String password, Uint8List salt) {
    final generator = Argon2BytesGenerator();
    final parameters = Argon2Parameters(
      Argon2Parameters.ARGON2_id,
      salt,
      desiredKeyLength: 32,
      iterations: 3,
      memory: 65536, // 64 MiB
      lanes: 4, // p=4 parallelism
    );
    generator.init(parameters);
    final masterKey = Uint8List(32);
    final passwordBytes = utf8.encode(password);
    generator.deriveKey(Uint8List.fromList(passwordBytes), 0, masterKey, 0);
    return masterKey;
  }

  /// Derives Supabase Auth Verifier using HKDF-SHA256 (matching Rust desktop hex format)
  static Future<String> deriveAuthVerifier(
      Uint8List masterKey, String email) async {
    final hkdf = crypto.Hkdf(hmac: crypto.Hmac.sha256(), outputLength: 32);
    final secretKey = crypto.SecretKey(masterKey);
    final derived = await hkdf.deriveKey(
      secretKey: secretKey,
      nonce: utf8.encode(email.trim().toLowerCase()),
      info: utf8.encode('pm:auth:supabase_password'),
    );
    final bytes = await derived.extractBytes();
    return bytes.map((b) => b.toRadixString(16).padLeft(2, '0')).join();
  }

  // ---------------------------------------------------------------------------
  // CSPRNG Generators
  // ---------------------------------------------------------------------------

  static Uint8List generateSalt() {
    final salt = Uint8List(16);
    for (int i = 0; i < 16; i++) {
      salt[i] = _secureRandom.nextInt(256);
    }
    return salt;
  }

  static Uint8List generateNonce() {
    final nonce = Uint8List(24);
    for (int i = 0; i < 24; i++) {
      nonce[i] = _secureRandom.nextInt(256);
    }
    return nonce;
  }

  static Uint8List generateDek() {
    final dek = Uint8List(32);
    for (int i = 0; i < 32; i++) {
      dek[i] = _secureRandom.nextInt(256);
    }
    return dek;
  }

  static Uint8List generateRecoverySecret() {
    final secret = Uint8List(32);
    for (int i = 0; i < 32; i++) {
      secret[i] = _secureRandom.nextInt(256);
    }
    return secret;
  }

  // ---------------------------------------------------------------------------
  // RFC 8785 JSON Canonicalization Scheme (JCS)
  // ---------------------------------------------------------------------------

  /// Deterministically serializes values per PM-Vault Canonical Payload v2:
  /// - Lexicographically sorted UTF-8 keys
  /// - Compact representation (no extraneous spaces)
  /// - Object keys must be strings
  /// - Integer schema values, booleans, nulls, strings and lists only
  /// - Reject non-finite/fractional numeric values and unsupported types
  static String toCanonicalJson(dynamic value) {
    if (value == null) return 'null';
    if (value is bool) return value ? 'true' : 'false';
    if (value is int) return value.toString();
    if (value is num) {
      if (value.isNaN || value.isInfinite) {
        throw ArgumentError(
            'NaN or Infinite numeric values are not supported in canonical JSON');
      }
      throw ArgumentError(
          'Non-integer numeric values are not supported in PM-Vault Canonical Payload v2');
    }
    if (value is String) return jsonEncode(value);
    if (value is List) {
      final elements = value.map((e) => toCanonicalJson(e)).join(',');
      return '[$elements]';
    }
    if (value is Map) {
      final keys = <String>[];
      for (final k in value.keys) {
        if (k is! String) throw ArgumentError('Map keys must be strings');
        keys.add(k);
      }
      keys.sort((a, b) => a.compareTo(b));
      final entries = keys.map((k) {
        final kJson = jsonEncode(k);
        return '$kJson:${toCanonicalJson(value[k])}';
      }).join(',');
      return '{$entries}';
    }
    throw ArgumentError(
        'Unsupported runtime type in canonical JSON: ${value.runtimeType}');
  }

  // ---------------------------------------------------------------------------
  // Canonical Domain-Separated AAD Specifications (V2)
  // ---------------------------------------------------------------------------

  static String buildEntryAad({
    int cryptoVersion = 2,
    int schemaVersion = 2,
    required String ownerId,
    required String entryId,
    required int revision,
    required bool isDeleted,
  }) {
    return 'pm-vault|entry|crypto=$cryptoVersion|schema=$schemaVersion|owner=${ownerId.trim().toLowerCase()}|entry=${entryId.trim().toLowerCase()}|revision=$revision|deleted=${isDeleted ? 1 : 0}';
  }

  static String buildMasterDekAad({
    required String ownerId,
    int keyGeneration = 1,
  }) {
    return 'pm-vault|dek-wrap|master|v2|${ownerId.trim().toLowerCase()}|$keyGeneration';
  }

  static String buildRecoveryDekAad({
    required String ownerId,
    int recoveryGeneration = 1,
  }) {
    return 'pm-vault|dek-wrap|recovery|v2|${ownerId.trim().toLowerCase()}|$recoveryGeneration';
  }

  // ---------------------------------------------------------------------------
  // Split Recovery Secret Architecture
  // ---------------------------------------------------------------------------

  static String formatRecoveryCode(Uint8List secret) {
    final hexStr = secret
        .map((b) => b.toRadixString(16).padLeft(2, '0'))
        .join()
        .toUpperCase();
    final chunks = <String>[];
    for (int i = 0; i < hexStr.length; i += 8) {
      chunks.add(hexStr.substring(i, min(i + 8, hexStr.length)));
    }
    return chunks.join('-');
  }

  static Uint8List parseRecoveryCode(String codeStr) {
    final clean = codeStr.replaceAll(RegExp(r'[^0-9a-fA-F]'), '').toLowerCase();
    if (clean.length != 64) {
      throw Exception(
          'Recovery code must be exactly 64 hex characters (got ${clean.length})');
    }
    final result = Uint8List(32);
    for (int i = 0; i < 32; i++) {
      result[i] = int.parse(clean.substring(i * 2, i * 2 + 2), radix: 16);
    }
    return result;
  }

  static Future<Map<String, dynamic>> deriveRecoveryKeys({
    required Uint8List recoverySecret,
    required String userId,
  }) async {
    final cleanUid = utf8.encode(userId.trim().toLowerCase());
    final hkdf = crypto.Hkdf(hmac: crypto.Hmac.sha256(), outputLength: 32);
    final secretKey = crypto.SecretKey(recoverySecret);

    final rekDerived = await hkdf.deriveKey(
      secretKey: secretKey,
      nonce: cleanUid,
      info: utf8.encode('pm-vault-recovery-wrap-v2'),
    );
    final rekBytes = Uint8List.fromList(await rekDerived.extractBytes());

    final authDerived = await hkdf.deriveKey(
      secretKey: secretKey,
      nonce: cleanUid,
      info: utf8.encode('pm-vault-recovery-auth-v2'),
    );
    final authBytes = Uint8List.fromList(await authDerived.extractBytes());

    final sha256 = crypto.Sha256();
    final hash = await sha256.hash(authBytes);
    final authHash =
        hash.bytes.map((b) => b.toRadixString(16).padLeft(2, '0')).join();

    return {
      'rek': rekBytes,
      'recoveryAuthToken': authBytes,
      'recoveryAuthHash': authHash,
    };
  }

  // ---------------------------------------------------------------------------
  // V2 DEK & Entry Wraps with Explicit AAD
  // ---------------------------------------------------------------------------

  static Future<Map<String, String>> encryptDekMaster({
    required Uint8List dek,
    required Uint8List masterKey,
    required String ownerId,
    int keyGeneration = 1,
  }) async {
    final nonce = generateNonce();
    final secretKey = crypto.SecretKey(masterKey);
    final aad =
        buildMasterDekAad(ownerId: ownerId, keyGeneration: keyGeneration);
    final secretBox = await _xchacha20.encrypt(
      dek,
      secretKey: secretKey,
      nonce: nonce,
      aad: utf8.encode(aad),
    );
    final packed =
        Uint8List.fromList([...secretBox.cipherText, ...secretBox.mac.bytes]);
    return {
      'encryptedDek': base64Encode(packed),
      'nonce': base64Encode(nonce),
    };
  }

  static Future<Uint8List> decryptDekMaster({
    required String encryptedDekB64,
    required String nonceB64,
    required Uint8List masterKey,
    required String ownerId,
    int keyGeneration = 1,
  }) async {
    final raw = base64Decode(encryptedDekB64);
    if (raw.length < 16) throw Exception("Encrypted DEK is too short");
    final cipherPart = raw.sublist(0, raw.length - 16);
    final macPart = raw.sublist(raw.length - 16);
    final nonce = base64Decode(nonceB64);
    final aad =
        buildMasterDekAad(ownerId: ownerId, keyGeneration: keyGeneration);

    final box = crypto.SecretBox(
      cipherPart,
      nonce: nonce,
      mac: crypto.Mac(macPart),
    );

    final decrypted = await _xchacha20.decrypt(
      box,
      secretKey: crypto.SecretKey(masterKey),
      aad: utf8.encode(aad),
    );
    return Uint8List.fromList(decrypted);
  }

  static Future<Map<String, String>> encryptDekRecovery({
    required Uint8List dek,
    required Uint8List rek,
    required String ownerId,
    int recoveryGeneration = 1,
  }) async {
    final nonce = generateNonce();
    final secretKey = crypto.SecretKey(rek);
    final aad = buildRecoveryDekAad(
        ownerId: ownerId, recoveryGeneration: recoveryGeneration);
    final secretBox = await _xchacha20.encrypt(
      dek,
      secretKey: secretKey,
      nonce: nonce,
      aad: utf8.encode(aad),
    );
    final packed =
        Uint8List.fromList([...secretBox.cipherText, ...secretBox.mac.bytes]);
    return {
      'encryptedDek': base64Encode(packed),
      'nonce': base64Encode(nonce),
    };
  }

  static Future<Uint8List> decryptDekRecovery({
    required String encryptedDekB64,
    required String nonceB64,
    required Uint8List rek,
    required String ownerId,
    int recoveryGeneration = 1,
  }) async {
    final raw = base64Decode(encryptedDekB64);
    if (raw.length < 16) throw Exception("Encrypted recovery DEK is too short");
    final cipherPart = raw.sublist(0, raw.length - 16);
    final macPart = raw.sublist(raw.length - 16);
    final nonce = base64Decode(nonceB64);
    final aad = buildRecoveryDekAad(
        ownerId: ownerId, recoveryGeneration: recoveryGeneration);

    final box = crypto.SecretBox(
      cipherPart,
      nonce: nonce,
      mac: crypto.Mac(macPart),
    );

    final decrypted = await _xchacha20.decrypt(
      box,
      secretKey: crypto.SecretKey(rek),
      aad: utf8.encode(aad),
    );
    return Uint8List.fromList(decrypted);
  }

  static Future<Map<String, String>> encryptEntryPayload({
    required String payloadJson,
    required Uint8List dek,
    required String aad,
  }) async {
    final nonce = generateNonce();
    final secretKey = crypto.SecretKey(dek);
    final secretBox = await _xchacha20.encrypt(
      utf8.encode(payloadJson),
      secretKey: secretKey,
      nonce: nonce,
      aad: utf8.encode(aad),
    );
    final packed =
        Uint8List.fromList([...secretBox.cipherText, ...secretBox.mac.bytes]);
    return {
      'ciphertext': base64Encode(packed),
      'nonce': base64Encode(nonce),
    };
  }

  static Future<String> decryptEntryPayload({
    required String ciphertextB64,
    required String nonceB64,
    required Uint8List dek,
    required String aad,
  }) async {
    final raw = base64Decode(ciphertextB64);
    if (raw.length < 16) throw Exception("Ciphertext is too short");
    final cipherPart = raw.sublist(0, raw.length - 16);
    final macPart = raw.sublist(raw.length - 16);
    final nonce = base64Decode(nonceB64);

    final box = crypto.SecretBox(
      cipherPart,
      nonce: nonce,
      mac: crypto.Mac(macPart),
    );

    final decrypted = await _xchacha20.decrypt(
      box,
      secretKey: crypto.SecretKey(dek),
      aad: utf8.encode(aad),
    );
    return utf8.decode(decrypted);
  }

  // ---------------------------------------------------------------------------
  // Legacy V1 Fallbacks (For Backward Compatibility & First-Unlock Migration)
  // ---------------------------------------------------------------------------

  static Future<Map<String, String>> encryptDek(
      Uint8List dek, Uint8List masterKey) async {
    final nonce = generateNonce();
    final secretKey = crypto.SecretKey(masterKey);
    final secretBox = await _xchacha20.encrypt(
      dek,
      secretKey: secretKey,
      nonce: nonce,
      aad: utf8.encode('pm:dek:v1'),
    );
    final packed =
        Uint8List.fromList([...secretBox.cipherText, ...secretBox.mac.bytes]);
    return {
      'encryptedDek': base64Encode(packed),
      'nonce': base64Encode(nonce),
    };
  }

  static Future<Uint8List> decryptDek(
      String encryptedDekB64, String nonceB64, Uint8List masterKey) async {
    final raw = base64Decode(encryptedDekB64);
    if (raw.length < 16) throw Exception("Encrypted DEK is too short");
    final cipherPart = raw.sublist(0, raw.length - 16);
    final macPart = raw.sublist(raw.length - 16);
    final nonce = base64Decode(nonceB64);

    final box = crypto.SecretBox(
      cipherPart,
      nonce: nonce,
      mac: crypto.Mac(macPart),
    );

    final decrypted = await _xchacha20.decrypt(
      box,
      secretKey: crypto.SecretKey(masterKey),
      aad: utf8.encode('pm:dek:v1'),
    );
    return Uint8List.fromList(decrypted);
  }

  static Future<Map<String, String>> encryptEntry(
      String payloadJson, Uint8List dek, String entryId) async {
    return encryptEntryPayload(
        payloadJson: payloadJson, dek: dek, aad: entryId);
  }

  static Future<String> decryptEntry(String ciphertextB64, String nonceB64,
      Uint8List dek, String entryId) async {
    return decryptEntryPayload(
        ciphertextB64: ciphertextB64,
        nonceB64: nonceB64,
        dek: dek,
        aad: entryId);
  }

  static String generatePassword({
    int length = 20,
    bool uppercase = true,
    bool lowercase = true,
    bool numbers = true,
    bool symbols = true,
  }) {
    const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    const lower = 'abcdefghijkmnopqrstuvwxyz';
    const num = '23456789';
    const sym = '!@#\$%^&*()-_=+[]{}|;:,.<>?';

    String pool = '';
    if (uppercase) pool += upper;
    if (lowercase) pool += lower;
    if (numbers) pool += num;
    if (symbols) pool += sym;

    if (pool.isEmpty) pool = lower + num;

    return List.generate(
        length, (_) => pool[_secureRandom.nextInt(pool.length)]).join();
  }
}
