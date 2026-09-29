import 'package:path/path.dart';
import 'package:path_provider/path_provider.dart';
import 'package:sqflite_sqlcipher/sqflite.dart';
import '../models/vault_entry.dart';

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
      version: 1,
      onCreate: (db, version) async {
        await db.execute('''
          CREATE TABLE IF NOT EXISTS local_meta (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
          );
        ''');

        await db.execute('''
          CREATE TABLE IF NOT EXISTS local_entries (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            username TEXT,
            password TEXT,
            url TEXT,
            notes TEXT,
            security_questions TEXT,
            tags TEXT,
            favorite INTEGER NOT NULL DEFAULT 0,
            ciphertext TEXT NOT NULL,
            nonce TEXT NOT NULL,
            version INTEGER NOT NULL DEFAULT 1,
            is_deleted INTEGER NOT NULL DEFAULT 0,
            sync_status TEXT NOT NULL DEFAULT 'synced',
            client_updated_at TEXT NOT NULL,
            server_updated_at TEXT
          );
        ''');

        await db.execute(
          'CREATE INDEX IF NOT EXISTS idx_entries_status ON local_entries(sync_status);'
        );
      },
      onOpen: (db) async {
        try {
          await db.execute(
            'ALTER TABLE local_entries ADD COLUMN security_questions TEXT;'
          );
        } catch (_) {}
      },
    );
  }

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

  static Future<List<VaultEntry>> listActiveEntries() async {
    final db = await database;
    final res = await db.query(
      'local_entries',
      where: 'is_deleted = 0',
      orderBy: 'title COLLATE NOCASE ASC',
    );
    return res.map((row) => VaultEntry.fromMap(row)).toList();
  }

  static Future<VaultEntry?> getEntry(String id) async {
    final db = await database;
    final res = await db.query(
      'local_entries',
      where: 'id = ?',
      whereArgs: [id],
      limit: 1,
    );
    if (res.isEmpty) return null;
    return VaultEntry.fromMap(res.first);
  }

  static Future<void> upsertEntry(VaultEntry entry) async {
    final db = await database;
    await db.insert(
      'local_entries',
      entry.toMap(),
      conflictAlgorithm: ConflictAlgorithm.replace,
    );
  }

  static Future<void> softDeleteEntry(String id) async {
    final db = await database;
    final now = DateTime.now().toUtc().toIso8601String();
    await db.update(
      'local_entries',
      {
        'is_deleted': 1,
        'sync_status': 'pending_update',
        'client_updated_at': now,
      },
      where: 'id = ?',
      whereArgs: [id],
    );
  }

  static Future<List<VaultEntry>> getPendingSync() async {
    final db = await database;
    final res = await db.query(
      'local_entries',
      where: "sync_status != 'synced'",
    );
    return res.map((row) => VaultEntry.fromMap(row)).toList();
  }

  static Future<void> markEntrySynced(String id, String serverUpdatedAt) async {
    final db = await database;
    await db.update(
      'local_entries',
      {
        'sync_status': 'synced',
        'server_updated_at': serverUpdatedAt,
      },
      where: 'id = ?',
      whereArgs: [id],
    );
  }

  static Future<void> clearDatabase() async {
    final db = await database;
    await db.delete('local_meta');
    await db.delete('local_entries');
  }
}
