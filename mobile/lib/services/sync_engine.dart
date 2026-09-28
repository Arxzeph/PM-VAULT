import 'dart:convert';
import 'dart:typed_data';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../models/vault_entry.dart';
import '../db/vault_database.dart';
import '../crypto/crypto_service.dart';
import 'supabase_service.dart';

enum SyncStatus { synced, syncing, offline, error }

class SyncEngine {
  static RealtimeChannel? _channel;
  static bool _isSyncing = false;
  static String? _currentUserId;
  static Uint8List? _activeDek;
  static void Function(SyncStatus status)? onStatusChanged;
  static void Function()? onEntriesUpdated;

  static void start({
    required String userId,
    required Uint8List dek,
    void Function(SyncStatus status)? statusCallback,
    void Function()? updatedCallback,
  }) {
    _currentUserId = userId;
    _activeDek = dek;
    onStatusChanged = statusCallback;
    onEntriesUpdated = updatedCallback;

    // 1. Initial full sweep
    syncFullSweep();

    // 2. Realtime WebSocket subscription
    _setupRealtimeSubscription(userId);
  }

  static void stop() {
    if (_channel != null) {
      SupabaseService.client.removeChannel(_channel!);
      _channel = null;
    }
    _currentUserId = null;
    _activeDek = null;
    onStatusChanged?.call(SyncStatus.offline);
  }

  static Future<void> syncFullSweep() async {
    if (_isSyncing || _currentUserId == null || _activeDek == null) return;

    _isSyncing = true;
    onStatusChanged?.call(SyncStatus.syncing);

    try {
      // 1. Push all pending local entries modified offline
      final pendingList = await VaultDatabase.getPendingSync();
      for (final item in pendingList) {
        final serverTime = await SupabaseService.pushEntry(_currentUserId!, item);
        if (serverTime != null) {
          await VaultDatabase.markEntrySynced(item.id, serverTime);
        }
      }

      // 2. Fetch all remote entries from Supabase
      final remoteRows = await SupabaseService.fetchAllRemoteEntries(_currentUserId!);
      bool hasChanges = false;

      for (final row in remoteRows) {
        final id = row['id'] as String;
        final remoteClientTime = row['client_updated_at'] as String;
        final existingLocal = await VaultDatabase.getEntry(id);

        // LWW (Last-Write-Wins): If local is newer, do not overwrite
        if (existingLocal != null &&
            existingLocal.clientUpdatedAt.compareTo(remoteClientTime) >= 0) {
          continue;
        }

        // Decrypt incoming remote ciphertext
        try {
          final decryptedJson = await CryptoService.decryptEntry(
            row['ciphertext'] as String,
            row['nonce'] as String,
            _activeDek!,
            id,
          );

          final payload = jsonDecode(decryptedJson) as Map<String, dynamic>;
          final List<String> tags = [];
          if (payload['tags'] != null && payload['tags'] is List) {
            tags.addAll((payload['tags'] as List).map((e) => e.toString()));
          }

          final updatedEntry = VaultEntry(
            id: id,
            title: payload['title'] as String? ?? 'Untitled',
            username: payload['username'] as String?,
            password: payload['password'] as String?,
            url: payload['url'] as String?,
            notes: payload['notes'] as String?,
            tags: tags,
            favorite: payload['favorite'] == true,
            ciphertext: row['ciphertext'] as String,
            nonce: row['nonce'] as String,
            version: row['version'] as int? ?? 1,
            isDeleted: row['is_deleted'] == true,
            syncStatus: 'synced',
            clientUpdatedAt: remoteClientTime,
            serverUpdatedAt: row['server_updated_at'] as String?,
          );

          await VaultDatabase.upsertEntry(updatedEntry);
          hasChanges = true;
        } catch (decryptErr) {
          print('[SyncEngine] Failed to decrypt entry $id: $decryptErr');
        }
      }

      if (hasChanges || pendingList.isNotEmpty) {
        onEntriesUpdated?.call();
      }

      onStatusChanged?.call(SyncStatus.synced);
    } catch (e) {
      print('[SyncEngine] Full sweep error: $e');
      onStatusChanged?.call(SyncStatus.error);
    } finally {
      _isSyncing = false;
    }
  }

  static void _setupRealtimeSubscription(String userId) {
    if (_channel != null) {
      SupabaseService.client.removeChannel(_channel!);
    }

    _channel = SupabaseService.client
        .channel('public:vault_entries:$userId')
        .onPostgresChanges(
          event: PostgresChangeEvent.all,
          schema: 'public',
          table: 'vault_entries',
          filter: PostgresChangeFilter(
            type: PostgresChangeFilterType.eq,
            column: 'user_id',
            value: userId,
          ),
          callback: (payload) async {
            final row = payload.newRecord;
            if (row.isEmpty || _activeDek == null) return;

            final id = row['id'] as String;
            final remoteClientTime = row['client_updated_at'] as String?;
            if (remoteClientTime == null) return;

            final existing = await VaultDatabase.getEntry(id);
            if (existing != null &&
                existing.clientUpdatedAt.compareTo(remoteClientTime) >= 0) {
              return;
            }

            try {
              final decryptedJson = await CryptoService.decryptEntry(
                row['ciphertext'] as String,
                row['nonce'] as String,
                _activeDek!,
                id,
              );

              final p = jsonDecode(decryptedJson) as Map<String, dynamic>;
              final List<String> tags = [];
              if (p['tags'] != null && p['tags'] is List) {
                tags.addAll((p['tags'] as List).map((e) => e.toString()));
              }

              final entry = VaultEntry(
                id: id,
                title: p['title'] as String? ?? 'Untitled',
                username: p['username'] as String?,
                password: p['password'] as String?,
                url: p['url'] as String?,
                notes: p['notes'] as String?,
                tags: tags,
                favorite: p['favorite'] == true,
                ciphertext: row['ciphertext'] as String,
                nonce: row['nonce'] as String,
                version: row['version'] as int? ?? 1,
                isDeleted: row['is_deleted'] == true,
                syncStatus: 'synced',
                clientUpdatedAt: remoteClientTime,
                serverUpdatedAt: row['server_updated_at'] as String?,
              );

              await VaultDatabase.upsertEntry(entry);
              onEntriesUpdated?.call();
              onStatusChanged?.call(SyncStatus.synced);
            } catch (err) {
              print('[SyncEngine] Realtime decrypt error: $err');
            }
          },
        )
        .subscribe((status, [error]) {
          if (status == RealtimeSubscribeStatus.subscribed) {
            onStatusChanged?.call(SyncStatus.synced);
          } else if (status == RealtimeSubscribeStatus.closed) {
            onStatusChanged?.call(SyncStatus.offline);
          }
        });
  }
}
