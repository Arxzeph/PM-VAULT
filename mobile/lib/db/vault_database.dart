import 'dart:convert';
import 'dart:typed_data';
import 'package:path/path.dart';
import 'package:path_provider/path_provider.dart';
import 'package:sqflite_sqlcipher/sqflite.dart';
import '../models/vault_entry.dart';
import '../models/encrypted_envelope.dart';
import '../crypto/crypto_service.dart';

class VaultDatabase {
  static Database? _db;

  static Future<Database> get database async {
    if (_db != null) return _db!;
    _db = await _initDatabase();
    return _db!;
  }

  static Future<Database> _initDatabase() async {
    final documentsDirectory = await getApplicationDocumentsDirectory();
    final path = join(documentsDirectory.path, 'pm_mobile_vault.db');

    return await openDatabase(
      path,
      version: 3,
      onCreate: (db, version) async {
        await _createTables(db);
        await db.setVersion(3);
      },
      onUpgrade: (db, oldVersion, newVersion) async {
        await _upgradeDatabase(db, oldVersion, newVersion);
      },
    );
  }

  static Future<void> _createTables(Database db) async {
    await db.execute('''
      CREATE TABLE IF NOT EXISTS local_meta (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    ''');

    await db.execute('''
      CREATE TABLE IF NOT EXISTS encrypted_entries (
        id TEXT PRIMARY KEY,
        owner_id TEXT NOT NULL,
        crypto_version INTEGER NOT NULL DEFAULT 2,
        payload_schema_version INTEGER NOT NULL DEFAULT 2,
        nonce TEXT NOT NULL,
        ciphertext TEXT NOT NULL,
        revision INTEGER NOT NULL DEFAULT 1,
        is_deleted INTEGER NOT NULL DEFAULT 0,
        sync_state TEXT NOT NULL DEFAULT 'synced',
        client_updated_at TEXT NOT NULL,
        server_updated_at TEXT
      );
    ''');

    await db.execute(
        'CREATE INDEX IF NOT EXISTS idx_enc_sync ON encrypted_entries(sync_state);');
    await db.execute(
        'CREATE INDEX IF NOT EXISTS idx_enc_deleted ON encrypted_entries(is_deleted);');
    await db.execute(
        'CREATE INDEX IF NOT EXISTS idx_enc_owner ON encrypted_entries(owner_id);');

    await db.execute('''
      CREATE TABLE IF NOT EXISTS conflict_envelopes (
        original_id TEXT NOT NULL,
        owner_id TEXT NOT NULL,
        crypto_version INTEGER NOT NULL DEFAULT 2,
        payload_schema_version INTEGER NOT NULL DEFAULT 2,
        nonce TEXT NOT NULL,
        ciphertext TEXT NOT NULL,
        revision INTEGER NOT NULL,
        is_deleted INTEGER NOT NULL DEFAULT 0,
        client_updated_at TEXT,
        server_updated_at TEXT,
        created_at TEXT NOT NULL
      );
    ''');
    await db.execute(
        'CREATE INDEX IF NOT EXISTS idx_conflict_original ON conflict_envelopes(original_id);');
  }

  static Future<void> _upgradeDatabase(
      Database db, int oldVersion, int newVersion) async {
    if (oldVersion < 2) {
      await _createTables(db);
    }
    if (oldVersion < 3) {
      // Check PRAGMA table_info on encrypted_entries
      final info = await db.rawQuery('PRAGMA table_info(encrypted_entries);');
      final colNames = info.map((r) => r['name'] as String).toSet();

      if (!colNames.contains('crypto_version')) {
        await db.execute(
            'ALTER TABLE encrypted_entries ADD COLUMN crypto_version INTEGER NOT NULL DEFAULT 2;');
      }
      if (!colNames.contains('payload_schema_version')) {
        await db.execute(
            'ALTER TABLE encrypted_entries ADD COLUMN payload_schema_version INTEGER NOT NULL DEFAULT 2;');
      }
      if (!colNames.contains('revision')) {
        await db.execute(
            'ALTER TABLE encrypted_entries ADD COLUMN revision INTEGER NOT NULL DEFAULT 1;');
      }

      // Upgrade conflict_envelopes schema if necessary
      final conflictInfo =
          await db.rawQuery('PRAGMA table_info(conflict_envelopes);');
      final conflictCols = conflictInfo.map((r) => r['name'] as String).toSet();
      if (!conflictCols.contains('crypto_version')) {
        await db.execute(
            'ALTER TABLE conflict_envelopes ADD COLUMN crypto_version INTEGER NOT NULL DEFAULT 2;');
      }
      if (!conflictCols.contains('payload_schema_version')) {
        await db.execute(
            'ALTER TABLE conflict_envelopes ADD COLUMN payload_schema_version INTEGER NOT NULL DEFAULT 2;');
      }
      if (!conflictCols.contains('is_deleted')) {
        await db.execute(
            'ALTER TABLE conflict_envelopes ADD COLUMN is_deleted INTEGER NOT NULL DEFAULT 0;');
      }
      if (!conflictCols.contains('client_updated_at')) {
        await db.execute(
            'ALTER TABLE conflict_envelopes ADD COLUMN client_updated_at TEXT;');
      }
      if (!conflictCols.contains('server_updated_at')) {
        await db.execute(
            'ALTER TABLE conflict_envelopes ADD COLUMN server_updated_at TEXT;');
      }
    }
    await db.setVersion(newVersion);
  }

  // ---------------------------------------------------------------------------
  // Metadata Operations
  // ---------------------------------------------------------------------------

  static Future<String?> getMeta(String key) async {
    final db = await database;
    final res = await db.query(
      'local_meta',
      where: 'key = ?',
      whereArgs: [key],
      limit: 1,
    );
    if (res.isEmpty) return null;
    return res.first['value'] as String?;
  }

  static Future<void> setMeta(String key, String value) async {
    final db = await database;
    await db.insert(
      'local_meta',
      {'key': key, 'value': value},
      conflictAlgorithm: ConflictAlgorithm.replace,
    );
  }

  static Future<String> getOrCreateOwnerId() async {
    final existing = await getMeta('owner_id');
    if (existing != null && existing.isNotEmpty) {
      return existing;
    }
    final newId = CryptoService.generateNonce();
    final ownerId = base64UrlEncode(newId);
    await setMeta('owner_id', ownerId);
    return ownerId;
  }

  // ---------------------------------------------------------------------------
  // Legacy Detection & Migration Engine
  // ---------------------------------------------------------------------------

  static Future<bool> hasLegacyTable() async {
    final db = await database;
    final res = await db.rawQuery(
      "SELECT count(*) as cnt FROM sqlite_master WHERE type='table' AND name='local_entries';",
    );
    final count = Sqflite.firstIntValue(res) ?? 0;
    return count > 0;
  }

  static Future<void> executeWalCheckpointAndVacuum() async {
    final db = await database;
    try {
      await db.rawQuery('PRAGMA wal_checkpoint(TRUNCATE);');
      await db.execute('VACUUM;');
    } catch (_) {}
  }

  static Future<int> migrateLegacyToEncrypted(
      Uint8List dek, String ownerId) async {
    if (!await hasLegacyTable()) return 0;

    final db = await database;
    return await db.transaction((txn) async {
      final legacyRows = await txn.query('local_entries');
      int count = 0;

      for (final row in legacyRows) {
        final id = row['id'] as String;
        final title = row['title'] as String? ?? 'Untitled';
        final username = row['username'] as String?;
        final password = row['password'] as String?;
        final url = row['url'] as String?;
        final notes = row['notes'] as String?;
        final favorite = (row['favorite'] == 1 || row['favorite'] == true);
        final isDeleted = (row['is_deleted'] == 1 || row['is_deleted'] == true);
        final version = (row['version'] as int?) ?? 1;
        final syncStatus = row['sync_status'] as String? ?? 'synced';
        final clientUpdatedAt = row['client_updated_at'] as String? ??
            DateTime.now().toUtc().toIso8601String();
        final serverUpdatedAt = row['server_updated_at'] as String?;

        List<Map<String, dynamic>> secQuestions = [];
        if (row['security_questions'] != null) {
          try {
            final decoded = jsonDecode(row['security_questions'] as String);
            if (decoded is List) {
              secQuestions = decoded
                  .map((e) => {
                        'answer': e['answer'] ?? '',
                        'question': e['question'] ?? '',
                      })
                  .toList();
            }
          } catch (_) {}
        }

        List<String> tags = [];
        if (row['tags'] != null) {
          try {
            final decoded = jsonDecode(row['tags'] as String);
            if (decoded is List) {
              tags = decoded.map((e) => e.toString()).toList();
            }
          } catch (_) {}
        }

        final payload = {
          'favorite': favorite,
          'notes': notes,
          'password': password,
          'schema_version': 2,
          'security_questions': secQuestions,
          'tags': tags,
          'title': title,
          'url': url,
          'username': username,
        };

        final canonicalJson = CryptoService.toCanonicalJson(payload);
        final aad = CryptoService.buildEntryAad(
          cryptoVersion: 2,
          schemaVersion: 2,
          ownerId: ownerId,
          entryId: id,
          revision: version,
          isDeleted: isDeleted,
        );

        final enc = await CryptoService.encryptEntryPayload(
          payloadJson: canonicalJson,
          dek: dek,
          aad: aad,
        );

        // Immediate canary verification
        final decrypted = await CryptoService.decryptEntryPayload(
          ciphertextB64: enc['ciphertext']!,
          nonceB64: enc['nonce']!,
          dek: dek,
          aad: aad,
        );

        if (decrypted != canonicalJson) {
          throw Exception("Migration canary verification failed for entry $id");
        }

        await txn.insert(
          'encrypted_entries',
          {
            'id': id,
            'owner_id': ownerId,
            'crypto_version': 2,
            'payload_schema_version': 2,
            'nonce': enc['nonce']!,
            'ciphertext': enc['ciphertext']!,
            'revision': version,
            'is_deleted': isDeleted ? 1 : 0,
            'sync_state': syncStatus,
            'client_updated_at': clientUpdatedAt,
            'server_updated_at': serverUpdatedAt,
          },
          conflictAlgorithm: ConflictAlgorithm.replace,
        );
        count++;
      }

      await txn.execute('DROP TABLE local_entries;');
      return count;
    }).then((migratedCount) async {
      await executeWalCheckpointAndVacuum();
      return migratedCount;
    });
  }

  // ---------------------------------------------------------------------------
  // Canonical Encrypted Envelope Operations
  // ---------------------------------------------------------------------------

  static Future<List<EncryptedEnvelope>> getPendingSyncEnvelopes() async {
    final db = await database;
    final rows = await db.query(
      'encrypted_entries',
      where: "sync_state != 'synced'",
    );
    return rows.map((r) => EncryptedEnvelope.fromLocalMap(r)).toList();
  }

  static Future<void> markEnvelopeSynced({
    required String id,
    required int revision,
    required String serverUpdatedAt,
  }) async {
    final db = await database;
    await db.update(
      'encrypted_entries',
      {
        'sync_state': SyncState.synced.value,
        'server_updated_at': serverUpdatedAt,
      },
      where: 'id = ? AND revision = ?',
      whereArgs: [id, revision],
    );
  }

  static Future<EncryptedEnvelope?> getEncryptedEnvelope(String id) async {
    final db = await database;
    final res = await db.query(
      'encrypted_entries',
      where: 'id = ?',
      whereArgs: [id],
      limit: 1,
    );
    if (res.isEmpty) return null;
    return EncryptedEnvelope.fromLocalMap(res.first);
  }

  static Future<void> upsertEncryptedEnvelope(
      EncryptedEnvelope envelope) async {
    final db = await database;
    await db.insert(
      'encrypted_entries',
      envelope.toLocalMap(),
      conflictAlgorithm: ConflictAlgorithm.replace,
    );
  }

  static Future<void> recordConflictEnvelope({
    required String originalId,
    required String ownerId,
    int cryptoVersion = 2,
    int payloadSchemaVersion = 2,
    required String nonce,
    required String ciphertext,
    required int revision,
    bool isDeleted = false,
    String? clientUpdatedAt,
    String? serverUpdatedAt,
  }) async {
    final db = await database;
    await db.insert('conflict_envelopes', {
      'original_id': originalId,
      'owner_id': ownerId,
      'crypto_version': cryptoVersion,
      'payload_schema_version': payloadSchemaVersion,
      'nonce': nonce,
      'ciphertext': ciphertext,
      'revision': revision,
      'is_deleted': isDeleted ? 1 : 0,
      'client_updated_at': clientUpdatedAt,
      'server_updated_at': serverUpdatedAt,
      'created_at': DateTime.now().toUtc().toIso8601String(),
    });
  }

  // ---------------------------------------------------------------------------
  // Crypto-Aware Tombstones (Stage 4)
  // ---------------------------------------------------------------------------

  static Future<void> cryptoSoftDeleteEntry({
    required String id,
    required Uint8List dek,
    required String ownerId,
  }) async {
    final existing = await getEncryptedEnvelope(id);
    if (existing == null) return;

    // 1. Verify/decrypt using old metadata
    final oldAad = CryptoService.buildEntryAad(
      cryptoVersion: existing.cryptoVersion,
      schemaVersion: existing.payloadSchemaVersion,
      ownerId: existing.ownerId,
      entryId: existing.id,
      revision: existing.revision,
      isDeleted: existing.isDeleted,
    );

    // Verify existing ciphertext decodes
    await CryptoService.decryptEntryPayload(
      ciphertextB64: existing.ciphertext,
      nonceB64: existing.nonce,
      dek: dek,
      aad: oldAad,
    );

    // 2. Increment revision & build minimal tombstone payload
    final newRevision = existing.revision + 1;
    const tombstoneJson = '{"deleted":true,"schema_version":2}';

    // 3. Re-encrypt with deleted=1 in AAD
    final newAad = CryptoService.buildEntryAad(
      cryptoVersion: 2,
      schemaVersion: 2,
      ownerId: ownerId,
      entryId: id,
      revision: newRevision,
      isDeleted: true,
    );

    final enc = await CryptoService.encryptEntryPayload(
      payloadJson: tombstoneJson,
      dek: dek,
      aad: newAad,
    );

    // 4. Immediate canary decrypt verification
    final verified = await CryptoService.decryptEntryPayload(
      ciphertextB64: enc['ciphertext']!,
      nonceB64: enc['nonce']!,
      dek: dek,
      aad: newAad,
    );
    if (verified != tombstoneJson) {
      throw Exception('Canary decrypt failed for tombstone of entry $id');
    }

    // 5. Persist atomically with pending_delete
    final now = DateTime.now().toUtc().toIso8601String();
    final db = await database;
    await db.update(
      'encrypted_entries',
      {
        'crypto_version': 2,
        'payload_schema_version': 2,
        'nonce': enc['nonce']!,
        'ciphertext': enc['ciphertext']!,
        'revision': newRevision,
        'is_deleted': 1,
        'sync_state': SyncState.pendingDelete.value,
        'client_updated_at': now,
      },
      where: 'id = ?',
      whereArgs: [id],
    );
  }

  // ---------------------------------------------------------------------------
  // In-Memory Decryption & VaultLoadResult (Stage 4)
  // ---------------------------------------------------------------------------

  static Future<VaultLoadResult> listActiveEntries({
    required Uint8List dek,
    required String ownerId,
  }) async {
    final db = await database;
    final rows = await db.query(
      'encrypted_entries',
      where: 'is_deleted = 0',
    );

    final entries = <VaultEntry>[];
    final failures = <VaultLoadFailure>[];

    for (final row in rows) {
      final id = row['id'] as String;
      final cryptoVer = (row['crypto_version'] as int?) ?? 2;
      final schemaVer = (row['payload_schema_version'] as int?) ?? 2;
      final revision = (row['revision'] as int?) ?? 1;
      final isDeleted = (row['is_deleted'] == 1);
      final ciphertext = row['ciphertext'] as String;
      final nonce = row['nonce'] as String;
      final syncState = row['sync_state'] as String? ?? 'synced';
      final clientUpdatedAt = row['client_updated_at'] as String;
      final serverUpdatedAt = row['server_updated_at'] as String?;

      try {
        final aad = CryptoService.buildEntryAad(
          cryptoVersion: cryptoVer,
          schemaVersion: schemaVer,
          ownerId: ownerId,
          entryId: id,
          revision: revision,
          isDeleted: isDeleted,
        );

        final decryptedJson = await CryptoService.decryptEntryPayload(
          ciphertextB64: ciphertext,
          nonceB64: nonce,
          dek: dek,
          aad: aad,
        );

        final payload = jsonDecode(decryptedJson) as Map<String, dynamic>;

        List<SecurityQuestion> questions = [];
        if (payload['security_questions'] is List) {
          questions = (payload['security_questions'] as List)
              .map((q) => SecurityQuestion(
                    question: q['question'] ?? '',
                    answer: q['answer'] ?? '',
                  ))
              .toList();
        }

        List<String> tags = [];
        if (payload['tags'] is List) {
          tags = (payload['tags'] as List).map((t) => t.toString()).toList();
        }

        entries.add(VaultEntry(
          id: id,
          title: payload['title'] as String? ?? 'Untitled',
          username: payload['username'] as String?,
          password: payload['password'] as String?,
          url: payload['url'] as String?,
          notes: payload['notes'] as String?,
          securityQuestions: questions,
          tags: tags,
          favorite: (payload['favorite'] == true || payload['favorite'] == 1),
          ciphertext: ciphertext,
          nonce: nonce,
          revision: revision,
          isDeleted: isDeleted,
          syncStatus: syncState,
          clientUpdatedAt: clientUpdatedAt,
          serverUpdatedAt: serverUpdatedAt,
        ));
      } catch (_) {
        // Structured error: never drop ciphertext or leak plaintext
        failures.add(VaultLoadFailure(
          id: id,
          reasonCode: 'DECRYPT_FAILED',
          cryptoVersion: cryptoVer,
          revision: revision,
        ));
      }
    }

    entries.sort((a, b) {
      if (a.favorite != b.favorite) {
        return a.favorite ? -1 : 1;
      }
      return a.title.toLowerCase().compareTo(b.title.toLowerCase());
    });

    return VaultLoadResult(entries: entries, failures: failures);
  }

  static Future<void> saveEntryEncrypted({
    required VaultEntry entry,
    required Uint8List dek,
    required String ownerId,
  }) async {
    final existing = await getEncryptedEnvelope(entry.id);
    final revision = existing != null ? (existing.revision + 1) : 1;
    final syncState =
        existing != null ? SyncState.pendingUpdate : SyncState.pendingInsert;

    final canonicalJson =
        CryptoService.toCanonicalJson(entry.toCanonicalPayload());
    final aad = CryptoService.buildEntryAad(
      cryptoVersion: 2,
      schemaVersion: 2,
      ownerId: ownerId,
      entryId: entry.id,
      revision: revision,
      isDeleted: false,
    );

    final enc = await CryptoService.encryptEntryPayload(
      payloadJson: canonicalJson,
      dek: dek,
      aad: aad,
    );

    // Immediate canary verification
    final verified = await CryptoService.decryptEntryPayload(
      ciphertextB64: enc['ciphertext']!,
      nonceB64: enc['nonce']!,
      dek: dek,
      aad: aad,
    );
    if (verified != canonicalJson) {
      throw Exception('Canary verification failed for saved entry ${entry.id}');
    }

    final envelope = EncryptedEnvelope(
      id: entry.id,
      ownerId: ownerId,
      cryptoVersion: 2,
      payloadSchemaVersion: 2,
      nonce: enc['nonce']!,
      ciphertext: enc['ciphertext']!,
      revision: revision,
      isDeleted: false,
      syncState: syncState,
      clientUpdatedAt: entry.clientUpdatedAt,
      serverUpdatedAt: entry.serverUpdatedAt,
    );

    await upsertEncryptedEnvelope(envelope);
  }

  // ---------------------------------------------------------------------------
  // Transactional Owner Migration (Stage 5)
  // ---------------------------------------------------------------------------

  static Future<void> migrateOwnerId({
    required String oldOwnerId,
    required String newOwnerId,
    required Uint8List dek,
    required Uint8List masterKey,
    int keyGeneration = 1,
  }) async {
    if (oldOwnerId == newOwnerId) return;

    final db = await database;
    await db.transaction((txn) async {
      final rows = await txn.query('encrypted_entries');

      for (final row in rows) {
        final id = row['id'] as String;
        final cryptoVer = (row['crypto_version'] as int?) ?? 2;
        final schemaVer = (row['payload_schema_version'] as int?) ?? 2;
        final oldRev = (row['revision'] as int?) ?? 1;
        final isDeleted = (row['is_deleted'] == 1);
        final oldCiphertext = row['ciphertext'] as String;
        final oldNonce = row['nonce'] as String;
        final newRev = oldRev + 1;

        // 1. Decrypt with old owner AAD
        final oldAad = CryptoService.buildEntryAad(
          cryptoVersion: cryptoVer,
          schemaVersion: schemaVer,
          ownerId: oldOwnerId,
          entryId: id,
          revision: oldRev,
          isDeleted: isDeleted,
        );

        final plaintextJson = await CryptoService.decryptEntryPayload(
          ciphertextB64: oldCiphertext,
          nonceB64: oldNonce,
          dek: dek,
          aad: oldAad,
        );

        // 2. Re-encrypt with new owner AAD
        final newAad = CryptoService.buildEntryAad(
          cryptoVersion: 2,
          schemaVersion: 2,
          ownerId: newOwnerId,
          entryId: id,
          revision: newRev,
          isDeleted: isDeleted,
        );

        final enc = await CryptoService.encryptEntryPayload(
          payloadJson: plaintextJson,
          dek: dek,
          aad: newAad,
        );

        // 3. Canary verify new ciphertext
        final canary = await CryptoService.decryptEntryPayload(
          ciphertextB64: enc['ciphertext']!,
          nonceB64: enc['nonce']!,
          dek: dek,
          aad: newAad,
        );
        if (canary != plaintextJson) {
          throw Exception(
              'Canary verification failed during owner migration on $id');
        }

        await txn.update(
          'encrypted_entries',
          {
            'owner_id': newOwnerId,
            'crypto_version': 2,
            'payload_schema_version': 2,
            'nonce': enc['nonce']!,
            'ciphertext': enc['ciphertext']!,
            'revision': newRev,
            'sync_state': SyncState.pendingUpdate.value,
            'client_updated_at': DateTime.now().toUtc().toIso8601String(),
          },
          where: 'id = ?',
          whereArgs: [id],
        );
      }

      // Rewrap DEK with new owner AAD
      final masterWrap = await CryptoService.encryptDekMaster(
        dek: dek,
        masterKey: masterKey,
        ownerId: newOwnerId,
        keyGeneration: keyGeneration,
      );

      await txn.insert(
        'local_meta',
        {'key': 'owner_id', 'value': newOwnerId},
        conflictAlgorithm: ConflictAlgorithm.replace,
      );
      await txn.insert(
        'local_meta',
        {'key': 'encrypted_dek', 'value': masterWrap['encryptedDek']!},
        conflictAlgorithm: ConflictAlgorithm.replace,
      );
      await txn.insert(
        'local_meta',
        {'key': 'dek_nonce', 'value': masterWrap['nonce']!},
        conflictAlgorithm: ConflictAlgorithm.replace,
      );
      await txn.insert(
        'local_meta',
        {'key': 'dek_wrap_version', 'value': '2'},
        conflictAlgorithm: ConflictAlgorithm.replace,
      );
    });
  }

  static Future<void> clearDatabase() async {
    final db = await database;
    await db.delete('local_meta');
    await db.delete('encrypted_entries');
    await db.delete('conflict_envelopes');
    try {
      await db.delete('local_entries');
    } catch (_) {}
  }
}
