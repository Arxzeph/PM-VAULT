import 'dart:convert';
import 'dart:typed_data';
import 'package:path/path.dart';
import 'package:path_provider/path_provider.dart';
import 'package:sqflite_sqlcipher/sqflite.dart';
import '../models/vault_entry.dart';
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
      version: 2,
      onCreate: (db, version) async {
        await _createTables(db);
      },
      onUpgrade: (db, oldVersion, newVersion) async {
        await _createTables(db);
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
      'CREATE INDEX IF NOT EXISTS idx_enc_sync ON encrypted_entries(sync_state);'
    );
    await db.execute(
      'CREATE INDEX IF NOT EXISTS idx_enc_deleted ON encrypted_entries(is_deleted);'
    );
    await db.execute(
      'CREATE INDEX IF NOT EXISTS idx_enc_owner ON encrypted_entries(owner_id);'
    );

    await db.execute('''
      CREATE TABLE IF NOT EXISTS conflict_envelopes (
        original_id TEXT NOT NULL,
        owner_id TEXT NOT NULL,
        nonce TEXT NOT NULL,
        ciphertext TEXT NOT NULL,
        revision INTEGER NOT NULL,
        created_at TEXT NOT NULL
      );
    ''');
    await db.execute(
      'CREATE INDEX IF NOT EXISTS idx_conflict_original ON conflict_envelopes(original_id);'
    );
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
    final newId = CryptoService.generateNonce(); // temporary random bytes
    final ownerId = base64UrlEncode(newId);
    await setMeta('owner_id', ownerId);
    return ownerId;
  }

  // ---------------------------------------------------------------------------
  // Legacy Detection & Blocking Migration Engine (Milestone 6.4)
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
    } catch (e) {
      print('[VaultDatabase] WAL checkpoint / vacuum notice: $e');
    }
  }

  static Future<int> migrateLegacyToEncrypted(Uint8List dek, String ownerId) async {
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

      // Drop the legacy plaintext table completely
      await txn.execute('DROP TABLE local_entries;');
      return count;
    }).then((migratedCount) async {
      await executeWalCheckpointAndVacuum();
      return migratedCount;
    });
  }

  // ---------------------------------------------------------------------------
  // Zero-Plaintext Encrypted Entries CRUD
  // ---------------------------------------------------------------------------

  static Future<List<Map<String, dynamic>>> listEncryptedRows() async {
    final db = await database;
    return await db.query(
      'encrypted_entries',
      where: 'is_deleted = 0',
    );
  }

  static Future<Map<String, dynamic>?> getEncryptedRow(String id) async {
    final db = await database;
    final res = await db.query(
      'encrypted_entries',
      where: 'id = ?',
      whereArgs: [id],
      limit: 1,
    );
    if (res.isEmpty) return null;
    return res.first;
  }

  static Future<void> upsertEncryptedRow(Map<String, dynamic> row) async {
    final db = await database;
    await db.insert(
      'encrypted_entries',
      row,
      conflictAlgorithm: ConflictAlgorithm.replace,
    );
  }

  static Future<void> softDeleteEncryptedRow(String id) async {
    final db = await database;
    final now = DateTime.now().toUtc().toIso8601String();
    await db.update(
      'encrypted_entries',
      {
        'is_deleted': 1,
        'sync_state': 'pending_delete',
        'client_updated_at': now,
      },
      where: 'id = ?',
      whereArgs: [id],
    );
  }

  static Future<List<Map<String, dynamic>>> getPendingSyncEnvelopes() async {
    final db = await database;
    return await db.query(
      'encrypted_entries',
      where: "sync_state != 'synced'",
    );
  }

  static Future<void> markEnvelopesSynced(List<String> ids, String serverUpdatedAt) async {
    final db = await database;
    for (final id in ids) {
      await db.update(
        'encrypted_entries',
        {
          'sync_state': 'synced',
          'server_updated_at': serverUpdatedAt,
        },
        where: 'id = ?',
        whereArgs: [id],
      );
    }
  }

  // ---------------------------------------------------------------------------
  // In-Memory Decryption Helpers for UI / Providers
  // ---------------------------------------------------------------------------

  static Future<List<VaultEntry>> listActiveEntries({
    required Uint8List dek,
    required String ownerId,
  }) async {
    final rows = await listEncryptedRows();
    final entries = <VaultEntry>[];

    for (final row in rows) {
      try {
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
          version: revision,
          isDeleted: isDeleted,
          syncStatus: syncState,
          clientUpdatedAt: clientUpdatedAt,
          serverUpdatedAt: serverUpdatedAt,
        ));
      } catch (e) {
        print('[VaultDatabase] Failed to decrypt entry ${row['id']}: $e');
      }
    }

    entries.sort((a, b) {
      if (a.favorite != b.favorite) {
        return a.favorite ? -1 : 1;
      }
      return a.title.toLowerCase().compareTo(b.title.toLowerCase());
    });

    return entries;
  }

  static Future<void> saveEntryEncrypted({
    required VaultEntry entry,
    required Uint8List dek,
    required String ownerId,
  }) async {
    final payload = {
      'favorite': entry.favorite,
      'notes': entry.notes,
      'password': entry.password,
      'schema_version': 2,
      'security_questions': entry.securityQuestions
          .map((q) => {
                'answer': q.answer,
                'question': q.question,
              })
          .toList(),
      'tags': entry.tags,
      'title': entry.title,
      'url': entry.url,
      'username': entry.username,
    };

    final canonicalJson = CryptoService.toCanonicalJson(payload);
    final aad = CryptoService.buildEntryAad(
      cryptoVersion: 2,
      schemaVersion: 2,
      ownerId: ownerId,
      entryId: entry.id,
      revision: entry.version,
      isDeleted: entry.isDeleted,
    );

    final enc = await CryptoService.encryptEntryPayload(
      payloadJson: canonicalJson,
      dek: dek,
      aad: aad,
    );

    await upsertEncryptedRow({
      'id': entry.id,
      'owner_id': ownerId,
      'crypto_version': 2,
      'payload_schema_version': 2,
      'nonce': enc['nonce']!,
      'ciphertext': enc['ciphertext']!,
      'revision': entry.version,
      'is_deleted': entry.isDeleted ? 1 : 0,
      'sync_state': entry.syncStatus,
      'client_updated_at': entry.clientUpdatedAt,
      'server_updated_at': entry.serverUpdatedAt,
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
