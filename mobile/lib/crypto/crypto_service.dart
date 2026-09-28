import 'dart:convert';
import 'dart:math';
import 'dart:typed_data';
import 'package:cryptography/cryptography.dart' as crypto;
import 'package:pointycastle/export.dart';

class CryptoService {
  static final _secureRandom = Random.secure();
  static final _xchacha20 = crypto.Xchacha20.poly1305Aead();

  /// Derives 32-byte Master Key using Argon2id (m=64MiB, t=3, p=4)
  static Uint8List deriveMasterKey(String password, Uint8List salt) {
    final generator = Argon2BytesGenerator();
    final parameters = Argon2Parameters(
      Argon2Parameters.ARGON2_id,
      salt,
      desiredKeyLength: 32,
      iterations: 3,
      memory: 65536, // 64 MiB
      lanes: 4,      // p=4 parallelism
    );
    generator.init(parameters);
    final masterKey = Uint8List(32);
    final passwordBytes = utf8.encode(password);
    generator.deriveKey(Uint8List.fromList(passwordBytes), 0, masterKey, 0);
    return masterKey;
  }

  /// Derives Supabase Auth Verifier using HKDF-SHA256 (matching Rust desktop hex format)
  static Future<String> deriveAuthVerifier(Uint8List masterKey, String email) async {
    final hkdf = crypto.Hkdf(hmac: crypto.Hmac.sha256(), outputLength: 32);
    final secretKey = crypto.SecretKey(masterKey);
    final derived = await hkdf.deriveKey(
      secretKey: secretKey,
      nonce: utf8.encode(email.trim().toLowerCase()),
      info: utf8.encode('pm:auth:supabase_password'),
    );
    final bytes = await derived.extractBytes();
    // Format as 64-char lowercase hex string to match Rust hex::encode
    return bytes.map((b) => b.toRadixString(16).padLeft(2, '0')).join();
  }

  /// Generates a cryptographically secure 16-byte random salt
  static Uint8List generateSalt() {
    final salt = Uint8List(16);
    for (int i = 0; i < 16; i++) {
      salt[i] = _secureRandom.nextInt(256);
    }
    return salt;
  }

  /// Generates a cryptographically secure 24-byte nonce for XChaCha20
  static Uint8List generateNonce() {
    final nonce = Uint8List(24);
    for (int i = 0; i < 24; i++) {
      nonce[i] = _secureRandom.nextInt(256);
    }
    return nonce;
  }

  /// Generates a cryptographically secure 32-byte random Data Encryption Key (DEK)
  static Uint8List generateDek() {
    final dek = Uint8List(32);
    for (int i = 0; i < 32; i++) {
      dek[i] = _secureRandom.nextInt(256);
    }
    return dek;
  }

  /// Encrypts the 32-byte DEK with Master Key using DEK_AAD ('pm:dek:v1')
  static Future<Map<String, String>> encryptDek(Uint8List dek, Uint8List masterKey) async {
    final nonce = generateNonce();
    final secretKey = crypto.SecretKey(masterKey);
    final secretBox = await _xchacha20.encrypt(
      dek,
      secretKey: secretKey,
      nonce: nonce,
      aad: utf8.encode('pm:dek:v1'),
    );
    final packed = Uint8List.fromList([...secretBox.cipherText, ...secretBox.mac.bytes]);
    return {
      'encryptedDek': base64Encode(packed),
      'nonce': base64Encode(nonce),
    };
  }

  /// Decrypts the DEK using Master Key and DEK_AAD ('pm:dek:v1')
  static Future<Uint8List> decryptDek(String encryptedDekB64, String nonceB64, Uint8List masterKey) async {
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

  /// Encrypts an entry's JSON payload with DEK using entryId as Authenticated Additional Data (AAD)
  static Future<Map<String, String>> encryptEntry(String payloadJson, Uint8List dek, String entryId) async {
    final nonce = generateNonce();
    final secretKey = crypto.SecretKey(dek);
    final secretBox = await _xchacha20.encrypt(
      utf8.encode(payloadJson),
      secretKey: secretKey,
      nonce: nonce,
      aad: utf8.encode(entryId),
    );
    final packed = Uint8List.fromList([...secretBox.cipherText, ...secretBox.mac.bytes]);
    return {
      'ciphertext': base64Encode(packed),
      'nonce': base64Encode(nonce),
    };
  }

  /// Decrypts an entry's ciphertext using DEK and entryId AAD
  static Future<String> decryptEntry(String ciphertextB64, String nonceB64, Uint8List dek, String entryId) async {
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
      aad: utf8.encode(entryId),
    );
    return utf8.decode(decrypted);
  }

  /// Generates a customizable secure password
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

    return List.generate(length, (_) => pool[_secureRandom.nextInt(pool.length)]).join();
  }
}
