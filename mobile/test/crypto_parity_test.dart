import 'dart:typed_data';
import 'package:flutter_test/flutter_test.dart';
import 'package:pm_vault_mobile/crypto/crypto_service.dart';

void main() {
  test('Verify HKDF Auth Verifier is 64-char hex string', () async {
    final masterKey = Uint8List.fromList(List.generate(32, (i) => i));
    const email = 'onlyvalorant3092@gmail.com';
    final authVerifier = await CryptoService.deriveAuthVerifier(masterKey, email);

    expect(authVerifier.length, 64);
    expect(RegExp(r'^[0-9a-f]{64}$').hasMatch(authVerifier), true);
  });

  test('Verify DEK encryption and decryption with pm:dek:v1 AAD (legacy)', () async {
    final masterKey = Uint8List.fromList(List.generate(32, (i) => (i + 3) % 256));
    final dek = CryptoService.generateDek();

    final enc = await CryptoService.encryptDek(dek, masterKey);
    final decryptedDek = await CryptoService.decryptDek(
      enc['encryptedDek']!,
      enc['nonce']!,
      masterKey,
    );

    expect(decryptedDek, dek);
  });

  test('Verify RFC 8785 JSON Canonicalization (JCS) parity', () {
    final testMap = {
      'title': 'GitHub',
      'url': 'https://github.com',
      'tags': ['personal', 'work'],
      'notes': null,
      'security_questions': [
        {
          'question': 'What was the name of your first pet?',
          'answer': 'VelvetFalcon#8829',
        }
      ],
      'schema_version': 2,
      'favorite': false,
      'password': 'ExamplePassword123!',
      'username': 'user@example.com',
    };

    final canonical = CryptoService.toCanonicalJson(testMap);
    const expected =
        '{"favorite":false,"notes":null,"password":"ExamplePassword123!","schema_version":2,"security_questions":[{"answer":"VelvetFalcon#8829","question":"What was the name of your first pet?"}],"tags":["personal","work"],"title":"GitHub","url":"https://github.com","username":"user@example.com"}';

    expect(canonical, expected);
  });

  test('Verify V2 Domain-Separated AAD builders and encryption roundtrip', () async {
    const ownerId = '7f1d2a3c-4b5e-6f7a-8b9c-0d1e2f3a4b5c';
    const entryId = 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d';
    const revision = 12;
    const isDeleted = false;

    final aad = CryptoService.buildEntryAad(
      cryptoVersion: 2,
      schemaVersion: 2,
      ownerId: ownerId,
      entryId: entryId,
      revision: revision,
      isDeleted: isDeleted,
    );

    expect(
      aad,
      'pm-vault|entry|crypto=2|schema=2|owner=7f1d2a3c-4b5e-6f7a-8b9c-0d1e2f3a4b5c|entry=a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d|revision=12|deleted=0',
    );

    final dek = CryptoService.generateDek();
    const payload = '{"favorite":true,"title":"VaultTest"}';

    final enc = await CryptoService.encryptEntryPayload(
      payloadJson: payload,
      dek: dek,
      aad: aad,
    );

    final decrypted = await CryptoService.decryptEntryPayload(
      ciphertextB64: enc['ciphertext']!,
      nonceB64: enc['nonce']!,
      dek: dek,
      aad: aad,
    );

    expect(decrypted, payload);

    // Tampering test: revision changed to 13
    final tamperedAad = CryptoService.buildEntryAad(
      cryptoVersion: 2,
      schemaVersion: 2,
      ownerId: ownerId,
      entryId: entryId,
      revision: 13,
      isDeleted: isDeleted,
    );

    expect(
      () async => await CryptoService.decryptEntryPayload(
        ciphertextB64: enc['ciphertext']!,
        nonceB64: enc['nonce']!,
        dek: dek,
        aad: tamperedAad,
      ),
      throwsA(isA<Exception>()),
    );
  });

  test('Verify Split Recovery Secret Architecture in Dart', () async {
    const userId = '7f1d2a3c-4b5e-6f7a-8b9c-0d1e2f3a4b5c';
    final secret = CryptoService.generateRecoverySecret();
    final formatted = CryptoService.formatRecoveryCode(secret);
    expect(formatted.length, 71); // 64 chars + 7 hyphens

    final parsed = CryptoService.parseRecoveryCode(formatted);
    expect(parsed, secret);

    final recoveryKeys = await CryptoService.deriveRecoveryKeys(
      recoverySecret: secret,
      userId: userId,
    );

    final Uint8List rek = recoveryKeys['rek'];
    final Uint8List authToken = recoveryKeys['recoveryAuthToken'];
    final String authHash = recoveryKeys['recoveryAuthHash'];

    expect(rek, isNot(equals(authToken)));
    expect(authHash.length, 64);

    final dek = CryptoService.generateDek();
    final encRecovery = await CryptoService.encryptDekRecovery(
      dek: dek,
      rek: rek,
      ownerId: userId,
      recoveryGeneration: 1,
    );

    final decryptedDek = await CryptoService.decryptDekRecovery(
      encryptedDekB64: encRecovery['encryptedDek']!,
      nonceB64: encRecovery['nonce']!,
      rek: rek,
      ownerId: userId,
      recoveryGeneration: 1,
    );

    expect(decryptedDek, dek);

    // Tampering recovery generation fails closed
    expect(
      () async => await CryptoService.decryptDekRecovery(
        encryptedDekB64: encRecovery['encryptedDek']!,
        nonceB64: encRecovery['nonce']!,
        rek: rek,
        ownerId: userId,
        recoveryGeneration: 2,
      ),
      throwsA(isA<Exception>()),
    );
  });
}
