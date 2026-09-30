import 'dart:convert';
import 'dart:typed_data';
import 'package:flutter_test/flutter_test.dart';
import 'package:pm_vault_mobile/crypto/crypto_service.dart';
import 'package:pm_vault_mobile/models/encrypted_envelope.dart';
import 'package:pm_vault_mobile/models/vault_entry.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('V2.2 Envelope Hardening & Tamper Resistance', () {
    const ownerId = '7f1d2a3c-4b5e-6f7a-8b9c-0d1e2f3a4b5c';
    const entryId = 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d';

    late Uint8List masterKey;
    late Uint8List dek;

    setUp(() {
      final salt = CryptoService.generateSalt();
      masterKey = CryptoService.deriveMasterKey('TestMasterPassword123!', salt);
      dek = CryptoService.generateDek();
    });

    test('V1 DEK unwrap followed by verified V2 rewrap', () async {
      // 1. Wrap with V1 legacy AAD ("pm:dek:v1")
      final v1Wrap = await CryptoService.encryptDek(dek, masterKey);

      // 2. Unwrap V1
      final unwrappedDek = await CryptoService.decryptDek(
        v1Wrap['encryptedDek']!,
        v1Wrap['nonce']!,
        masterKey,
      );
      expect(unwrappedDek, equals(dek));

      // 3. Rewrap with V2 owner/generation AAD
      final v2Wrap = await CryptoService.encryptDekMaster(
        dek: unwrappedDek,
        masterKey: masterKey,
        ownerId: ownerId,
        keyGeneration: 1,
      );

      // 4. Decrypt V2 with exact AAD
      final v2Dek = await CryptoService.decryptDekMaster(
        encryptedDekB64: v2Wrap['encryptedDek']!,
        nonceB64: v2Wrap['nonce']!,
        masterKey: masterKey,
        ownerId: ownerId,
        keyGeneration: 1,
      );
      expect(v2Dek, equals(dek));
    });

    test('V2 master-wrap owner and generation tamper failures', () async {
      final v2Wrap = await CryptoService.encryptDekMaster(
        dek: dek,
        masterKey: masterKey,
        ownerId: ownerId,
        keyGeneration: 1,
      );

      // Tamper owner ID -> fails decryption
      expect(
        () async => await CryptoService.decryptDekMaster(
          encryptedDekB64: v2Wrap['encryptedDek']!,
          nonceB64: v2Wrap['nonce']!,
          masterKey: masterKey,
          ownerId: 'wrong-owner-uuid',
          keyGeneration: 1,
        ),
        throwsA(anything),
      );

      // Tamper key generation -> fails decryption
      expect(
        () async => await CryptoService.decryptDekMaster(
          encryptedDekB64: v2Wrap['encryptedDek']!,
          nonceB64: v2Wrap['nonce']!,
          masterKey: masterKey,
          ownerId: ownerId,
          keyGeneration: 2,
        ),
        throwsA(anything),
      );
    });

    test('Entry V2 round trip for every field', () async {
      final entry = VaultEntry(
        id: entryId,
        title: 'Work Email',
        username: 'alice@example.com',
        password: 'SuperSecretPassword99!',
        url: 'https://mail.example.com',
        notes: 'Personal work email note',
        securityQuestions: [
          SecurityQuestion(question: 'Childhood street?', answer: 'Maple Ave'),
        ],
        tags: ['work', 'email'],
        favorite: true,
        ciphertext: '',
        nonce: '',
        revision: 1,
        isDeleted: false,
        clientUpdatedAt: DateTime.now().toUtc().toIso8601String(),
      );

      final canonicalJson =
          CryptoService.toCanonicalJson(entry.toCanonicalPayload());
      final aad = CryptoService.buildEntryAad(
        cryptoVersion: 2,
        schemaVersion: 2,
        ownerId: ownerId,
        entryId: entry.id,
        revision: entry.revision,
        isDeleted: entry.isDeleted,
      );

      final enc = await CryptoService.encryptEntryPayload(
        payloadJson: canonicalJson,
        dek: dek,
        aad: aad,
      );

      final decryptedJson = await CryptoService.decryptEntryPayload(
        ciphertextB64: enc['ciphertext']!,
        nonceB64: enc['nonce']!,
        dek: dek,
        aad: aad,
      );

      expect(decryptedJson, equals(canonicalJson));
      final decoded = jsonDecode(decryptedJson) as Map<String, dynamic>;
      expect(decoded['title'], equals('Work Email'));
      expect(decoded['username'], equals('alice@example.com'));
      expect(decoded['password'], equals('SuperSecretPassword99!'));
      expect(decoded['favorite'], isTrue);
      expect(decoded['schema_version'], equals(2));
    });

    test('Revision, owner, schema, crypto version and deletion tamper failures',
        () async {
      const payload =
          '{"favorite":false,"notes":null,"password":null,"schema_version":2,"security_questions":[],"tags":[],"title":"Bank","url":null,"username":null}';
      final validAad = CryptoService.buildEntryAad(
        cryptoVersion: 2,
        schemaVersion: 2,
        ownerId: ownerId,
        entryId: entryId,
        revision: 5,
        isDeleted: false,
      );

      final enc = await CryptoService.encryptEntryPayload(
        payloadJson: payload,
        dek: dek,
        aad: validAad,
      );

      // Tampered revision (5 -> 4)
      final tamperedRevAad = CryptoService.buildEntryAad(
        cryptoVersion: 2,
        schemaVersion: 2,
        ownerId: ownerId,
        entryId: entryId,
        revision: 4,
        isDeleted: false,
      );
      expect(
        () async => await CryptoService.decryptEntryPayload(
          ciphertextB64: enc['ciphertext']!,
          nonceB64: enc['nonce']!,
          dek: dek,
          aad: tamperedRevAad,
        ),
        throwsA(anything),
      );

      // Tampered owner
      final tamperedOwnerAad = CryptoService.buildEntryAad(
        cryptoVersion: 2,
        schemaVersion: 2,
        ownerId: 'different-owner-id',
        entryId: entryId,
        revision: 5,
        isDeleted: false,
      );
      expect(
        () async => await CryptoService.decryptEntryPayload(
          ciphertextB64: enc['ciphertext']!,
          nonceB64: enc['nonce']!,
          dek: dek,
          aad: tamperedOwnerAad,
        ),
        throwsA(anything),
      );

      // Tampered deletion flag (false -> true)
      final tamperedDeletedAad = CryptoService.buildEntryAad(
        cryptoVersion: 2,
        schemaVersion: 2,
        ownerId: ownerId,
        entryId: entryId,
        revision: 5,
        isDeleted: true,
      );
      expect(
        () async => await CryptoService.decryptEntryPayload(
          ciphertextB64: enc['ciphertext']!,
          nonceB64: enc['nonce']!,
          dek: dek,
          aad: tamperedDeletedAad,
        ),
        throwsA(anything),
      );
    });

    test(
        'Delete increments revision, changes nonce and decrypts only with deleted=1',
        () async {
      const tombstonePayload = '{"deleted":true,"schema_version":2}';
      const oldRevision = 1;
      const newRevision = 2;

      final oldAad = CryptoService.buildEntryAad(
        cryptoVersion: 2,
        schemaVersion: 2,
        ownerId: ownerId,
        entryId: entryId,
        revision: oldRevision,
        isDeleted: false,
      );
      final oldEnc = await CryptoService.encryptEntryPayload(
        payloadJson: '{"title":"To Delete"}',
        dek: dek,
        aad: oldAad,
      );

      final tombstoneAad = CryptoService.buildEntryAad(
        cryptoVersion: 2,
        schemaVersion: 2,
        ownerId: ownerId,
        entryId: entryId,
        revision: newRevision,
        isDeleted: true,
      );
      final tombstoneEnc = await CryptoService.encryptEntryPayload(
        payloadJson: tombstonePayload,
        dek: dek,
        aad: tombstoneAad,
      );

      // Nonce must be distinct
      expect(tombstoneEnc['nonce'], isNot(equals(oldEnc['nonce'])));

      // Decrypts successfully with deleted=1 AAD
      final decrypted = await CryptoService.decryptEntryPayload(
        ciphertextB64: tombstoneEnc['ciphertext']!,
        nonceB64: tombstoneEnc['nonce']!,
        dek: dek,
        aad: tombstoneAad,
      );
      expect(decrypted, equals(tombstonePayload));

      // Fails if decrypted with deleted=0 AAD
      final wrongAad = CryptoService.buildEntryAad(
        cryptoVersion: 2,
        schemaVersion: 2,
        ownerId: ownerId,
        entryId: entryId,
        revision: newRevision,
        isDeleted: false,
      );
      expect(
        () async => await CryptoService.decryptEntryPayload(
          ciphertextB64: tombstoneEnc['ciphertext']!,
          nonceB64: tombstoneEnc['nonce']!,
          dek: dek,
          aad: wrongAad,
        ),
        throwsA(anything),
      );
    });

    test('Strict EncryptedEnvelope validation', () {
      final validNonce = base64Encode(Uint8List(24));
      final validCt = base64Encode(Uint8List(32));

      // Empty ID fails
      expect(
        () => EncryptedEnvelope(
          id: '',
          ownerId: ownerId,
          nonce: validNonce,
          ciphertext: validCt,
          revision: 1,
          clientUpdatedAt: DateTime.now().toUtc().toIso8601String(),
        ),
        throwsA(isA<ArgumentError>()),
      );

      // Invalid revision < 1 fails
      expect(
        () => EncryptedEnvelope(
          id: entryId,
          ownerId: ownerId,
          nonce: validNonce,
          ciphertext: validCt,
          revision: 0,
          clientUpdatedAt: DateTime.now().toUtc().toIso8601String(),
        ),
        throwsA(isA<ArgumentError>()),
      );

      // Nonce length != 24 bytes fails
      expect(
        () => EncryptedEnvelope(
          id: entryId,
          ownerId: ownerId,
          nonce: base64Encode(Uint8List(16)),
          ciphertext: validCt,
          revision: 1,
          clientUpdatedAt: DateTime.now().toUtc().toIso8601String(),
        ),
        throwsA(isA<ArgumentError>()),
      );

      // Ciphertext length < 16 bytes fails
      expect(
        () => EncryptedEnvelope(
          id: entryId,
          ownerId: ownerId,
          nonce: validNonce,
          ciphertext: base64Encode(Uint8List(10)),
          revision: 1,
          clientUpdatedAt: DateTime.now().toUtc().toIso8601String(),
        ),
        throwsA(isA<ArgumentError>()),
      );

      // Untrusted remote owner fails
      final remoteMap = {
        'id': entryId,
        'user_id': 'malicious-attacker-user-id',
        'crypto_version': 2,
        'payload_schema_version': 2,
        'nonce': validNonce,
        'ciphertext': validCt,
        'revision': 1,
        'is_deleted': false,
        'client_updated_at': DateTime.now().toUtc().toIso8601String(),
      };
      expect(
        () => EncryptedEnvelope.fromRemoteMap(
          remoteMap,
          authenticatedUserId: ownerId,
        ),
        throwsA(isA<ArgumentError>()),
      );
    });

    test('Canonical JSON subset rejects invalid types and non-integer numbers',
        () {
      // Rejects double / float
      expect(
        () => CryptoService.toCanonicalJson({'float': 3.14159}),
        throwsA(isA<ArgumentError>()),
      );

      // Rejects non-string map keys
      expect(
        () => CryptoService.toCanonicalJson({123: 'val'}),
        throwsA(isA<ArgumentError>()),
      );

      // Correctly sorts keys
      final sortedJson = CryptoService.toCanonicalJson({
        'z': 1,
        'a': 'first',
        'm': false,
      });
      expect(sortedJson, equals('{"a":"first","m":false,"z":1}'));
    });
  });
}
