import 'dart:convert';
import 'vault_entry.dart';

enum SyncState {
  pendingInsert('pending_insert'),
  pendingUpdate('pending_update'),
  pendingDelete('pending_delete'),
  synced('synced'),
  conflict('conflict');

  final String value;
  const SyncState(this.value);

  static SyncState fromString(String val) {
    for (final s in SyncState.values) {
      if (s.value == val) return s;
    }
    return SyncState.synced;
  }
}

class EncryptedEnvelope {
  final String id;
  final String ownerId;
  final int cryptoVersion;
  final int payloadSchemaVersion;
  final String nonce;
  final String ciphertext;
  final int revision;
  final bool isDeleted;
  final String clientUpdatedAt;
  final String? serverUpdatedAt;
  final SyncState syncState;

  EncryptedEnvelope({
    required this.id,
    required this.ownerId,
    this.cryptoVersion = 2,
    this.payloadSchemaVersion = 2,
    required this.nonce,
    required this.ciphertext,
    required this.revision,
    this.isDeleted = false,
    required this.clientUpdatedAt,
    this.serverUpdatedAt,
    this.syncState = SyncState.synced,
  }) {
    validate();
  }

  void validate() {
    if (id.trim().isEmpty) {
      throw ArgumentError('Envelope id cannot be empty');
    }
    if (ownerId.trim().isEmpty) {
      throw ArgumentError('Envelope ownerId cannot be empty');
    }
    if (cryptoVersion != 1 && cryptoVersion != 2) {
      throw ArgumentError('Unsupported cryptoVersion: $cryptoVersion');
    }
    if (payloadSchemaVersion < 1) {
      throw ArgumentError(
          'Invalid payloadSchemaVersion: $payloadSchemaVersion');
    }
    if (revision < 1) {
      throw ArgumentError(
          'Revision must be a positive integer >= 1 (got $revision)');
    }

    // Verify base64 and lengths
    final nonceBytes = base64Decode(nonce);
    if (nonceBytes.length != 24) {
      throw ArgumentError(
          'Invalid nonce length: ${nonceBytes.length} bytes (expected 24)');
    }

    final ctBytes = base64Decode(ciphertext);
    if (ctBytes.length < 16) {
      throw ArgumentError(
          'Ciphertext too short: ${ctBytes.length} bytes (minimum 16 bytes for Poly1305 tag)');
    }
  }

  Map<String, dynamic> toLocalMap() {
    return {
      'id': id,
      'owner_id': ownerId,
      'crypto_version': cryptoVersion,
      'payload_schema_version': payloadSchemaVersion,
      'nonce': nonce,
      'ciphertext': ciphertext,
      'revision': revision,
      'is_deleted': isDeleted ? 1 : 0,
      'sync_state': syncState.value,
      'client_updated_at': clientUpdatedAt,
      'server_updated_at': serverUpdatedAt,
    };
  }

  factory EncryptedEnvelope.fromLocalMap(Map<String, dynamic> map) {
    return EncryptedEnvelope(
      id: map['id'] as String,
      ownerId: map['owner_id'] as String,
      cryptoVersion: (map['crypto_version'] as int?) ?? 2,
      payloadSchemaVersion: (map['payload_schema_version'] as int?) ?? 2,
      nonce: map['nonce'] as String,
      ciphertext: map['ciphertext'] as String,
      revision: (map['revision'] as int?) ?? 1,
      isDeleted: (map['is_deleted'] == 1 || map['is_deleted'] == true),
      syncState: SyncState.fromString(map['sync_state'] as String? ?? 'synced'),
      clientUpdatedAt: map['client_updated_at'] as String,
      serverUpdatedAt: map['server_updated_at'] as String?,
    );
  }

  Map<String, dynamic> toRemoteMap() {
    return {
      'id': id,
      'user_id': ownerId,
      'crypto_version': cryptoVersion,
      'payload_schema_version': payloadSchemaVersion,
      'nonce': nonce,
      'ciphertext': ciphertext,
      'revision': revision,
      'is_deleted': isDeleted,
      'client_updated_at': clientUpdatedAt,
    };
  }

  factory EncryptedEnvelope.fromRemoteMap(
    Map<String, dynamic> map, {
    required String authenticatedUserId,
  }) {
    final remoteUserId = map['user_id'] as String?;
    if (remoteUserId == null ||
        remoteUserId.trim().toLowerCase() !=
            authenticatedUserId.trim().toLowerCase()) {
      throw ArgumentError(
          'Untrusted remote envelope: user_id mismatch ($remoteUserId != $authenticatedUserId)');
    }

    return EncryptedEnvelope(
      id: map['id'] as String,
      ownerId: authenticatedUserId.trim().toLowerCase(),
      cryptoVersion: (map['crypto_version'] as int?) ?? 2,
      payloadSchemaVersion: (map['payload_schema_version'] as int?) ?? 2,
      nonce: map['nonce'] as String,
      ciphertext: map['ciphertext'] as String,
      revision: (map['revision'] as int?) ?? 1,
      isDeleted: (map['is_deleted'] == true || map['is_deleted'] == 1),
      syncState: SyncState.synced,
      clientUpdatedAt: map['client_updated_at'] as String,
      serverUpdatedAt: map['server_updated_at'] as String?,
    );
  }

  EncryptedEnvelope copyWith({
    String? id,
    String? ownerId,
    int? cryptoVersion,
    int? payloadSchemaVersion,
    String? nonce,
    String? ciphertext,
    int? revision,
    bool? isDeleted,
    String? clientUpdatedAt,
    String? serverUpdatedAt,
    SyncState? syncState,
  }) {
    return EncryptedEnvelope(
      id: id ?? this.id,
      ownerId: ownerId ?? this.ownerId,
      cryptoVersion: cryptoVersion ?? this.cryptoVersion,
      payloadSchemaVersion: payloadSchemaVersion ?? this.payloadSchemaVersion,
      nonce: nonce ?? this.nonce,
      ciphertext: ciphertext ?? this.ciphertext,
      revision: revision ?? this.revision,
      isDeleted: isDeleted ?? this.isDeleted,
      clientUpdatedAt: clientUpdatedAt ?? this.clientUpdatedAt,
      serverUpdatedAt: serverUpdatedAt ?? this.serverUpdatedAt,
      syncState: syncState ?? this.syncState,
    );
  }
}

class VaultLoadFailure {
  final String id;
  final String reasonCode;
  final int cryptoVersion;
  final int revision;

  const VaultLoadFailure({
    required this.id,
    required this.reasonCode,
    required this.cryptoVersion,
    required this.revision,
  });

  Map<String, dynamic> toJson() => {
        'id': id,
        'reason_code': reasonCode,
        'crypto_version': cryptoVersion,
        'revision': revision,
      };
}

class VaultLoadResult {
  final List<VaultEntry> entries;
  final List<VaultLoadFailure> failures;

  const VaultLoadResult({
    required this.entries,
    this.failures = const [],
  });
}
