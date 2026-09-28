import 'dart:convert';
import 'dart:typed_data';
import 'package:flutter_test/flutter_test.dart';
import 'package:pm_vault_mobile/crypto/crypto_service.dart';

void main() {
  test('Verify HKDF Auth Verifier is 64-char hex string', () async {
    final masterKey = Uint8List.fromList(List.generate(32, (i) => i));
    final email = 'onlyvalorant3092@gmail.com';
    final authVerifier = await CryptoService.deriveAuthVerifier(masterKey, email);

    expect(authVerifier.length, 64);
    expect(RegExp(r'^[0-9a-f]{64}$').hasMatch(authVerifier), true);
    print('Derived Hex Auth Verifier: $authVerifier');
  });

  test('Verify DEK encryption and decryption with pm:dek:v1 AAD', () async {
    final masterKey = Uint8List.fromList(List.generate(32, (i) => (i + 3) % 256));
    final dek = CryptoService.generateDek();

    final enc = await CryptoService.encryptDek(dek, masterKey);
    final decryptedDek = await CryptoService.decryptDek(
      enc['encryptedDek']!,
      enc['nonce']!,
      masterKey,
    );

    expect(decryptedDek, dek);
    print('DEK round-trip encryption with AAD succeeded!');
  });
}
