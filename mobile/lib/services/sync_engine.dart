import 'dart:typed_data';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../models/encrypted_envelope.dart';
import '../db/vault_database.dart';
import 'supabase_service.dart';

enum SyncStatus { synced, syncing, offline, degraded, error }

class SyncSession {
  final int sessionGeneration;
  final String userId;
  final Uint8List dek;
  bool isCancelled = false;
  RealtimeChannel? channel;
  void Function(SyncStatus status)? statusCallback;
  void Function()? updatedCallback;

  SyncSession({
    required this.sessionGeneration,
    required this.userId,
    required this.dek,
    this.statusCallback,
    this.updatedCallback,
  });

  void cancel() {
    isCancelled = true;
    if (channel != null) {
      try {
        SupabaseService.client.removeChannel(channel!);
      } catch (_) {}
      channel = null;
    }
    statusCallback = null;
    updatedCallback = null;
    dek.fillRange(0, dek.length, 0);
  }
}

class SyncEngine {
  static SyncSession? _currentSession;
  static int _nextGeneration = 1;
  static bool _isSyncing = false;

  static void Function(SyncStatus status)? get onStatusChanged =>
      _currentSession?.statusCallback;

  static void Function()? get onEntriesUpdated =>
      _currentSession?.updatedCallback;

  /// Starts a new isolated sync session, stopping any previous session first.
  static Future<void> start({
    required String userId,
    required Uint8List dek,
    void Function(SyncStatus status)? statusCallback,
    void Function()? updatedCallback,
  }) async {
    await stop();

    final sessionGen = _nextGeneration++;
    final session = SyncSession(
      sessionGeneration: sessionGen,
      userId: userId.trim().toLowerCase(),
      dek: Uint8List.fromList(dek),
      statusCallback: statusCallback,
      updatedCallback: updatedCallback,
    );
    _currentSession = session;

    session.statusCallback?.call(SyncStatus.syncing);

    // 1. Initial full sweep
    await syncFullSweep();

    // 2. Realtime WebSocket subscription
    _setupRealtimeSubscription(session);
  }

  /// Stops and wipes the active sync session cleanly.
  static Future<void> stop() async {
    final oldSession = _currentSession;
    _currentSession = null;
    if (oldSession != null) {
      oldSession.statusCallback?.call(SyncStatus.offline);
      oldSession.cancel();
    }
  }

  /// Applies a remote envelope using canonical revision comparison and conflict detection.
  /// Shared between full sweep and Realtime listener.
  static Future<bool> applyRemoteEnvelope(
    EncryptedEnvelope remote,
    SyncSession session,
  ) async {
    if (session.isCancelled) return false;

    // Validate ownership
    if (remote.ownerId != session.userId) {
      return false;
    }

    final local = await VaultDatabase.getEncryptedEnvelope(remote.id);
    if (local != null) {
      // If local has pending un-synced edits
      if (local.syncState != SyncState.synced) {
        if (remote.revision == local.revision) {
          // Concurrent conflict: store remote in conflict_envelopes
          await VaultDatabase.recordConflictEnvelope(
            originalId: remote.id,
            ownerId: remote.ownerId,
            cryptoVersion: remote.cryptoVersion,
            payloadSchemaVersion: remote.payloadSchemaVersion,
            nonce: remote.nonce,
            ciphertext: remote.ciphertext,
            revision: remote.revision,
            isDeleted: remote.isDeleted,
            clientUpdatedAt: remote.clientUpdatedAt,
            serverUpdatedAt: remote.serverUpdatedAt,
          );
          return false;
        }

        // If remote revision is lower than our pending revision, keep local
        if (remote.revision < local.revision) {
          return false;
        }
      }

      // If local is synced, compare revisions
      if (remote.revision < local.revision) {
        return false;
      }

      // Revision tie-break with client timestamp for legacy envelopes
      if (remote.revision == local.revision) {
        if (local.clientUpdatedAt.compareTo(remote.clientUpdatedAt) >= 0) {
          return false;
        }
      }
    }

    // Persist ciphertext directly without decrypting in network/transport layer
    await VaultDatabase.upsertEncryptedEnvelope(
      remote.copyWith(syncState: SyncState.synced),
    );
    return true;
  }

  /// Full bidirectional synchronization sweep
  static Future<void> syncFullSweep() async {
    final session = _currentSession;
    if (session == null || session.isCancelled || _isSyncing) return;

    _isSyncing = true;
    session.statusCallback?.call(SyncStatus.syncing);

    bool hasErrors = false;
    bool hasChanges = false;

    try {
      // 1. Drain pending local envelopes (push with optimistic concurrency)
      final pendingList = await VaultDatabase.getPendingSyncEnvelopes();
      for (final env in pendingList) {
        if (session.isCancelled) break;

        try {
          final expectedPrevRev = env.revision > 1 ? env.revision - 1 : null;
          final pushRes = await SupabaseService.pushEnvelope(
            userId: session.userId,
            envelope: env,
            expectedPreviousRevision: expectedPrevRev,
          );

          if (pushRes['success'] == true) {
            final serverTime = pushRes['server_updated_at'] as String? ??
                DateTime.now().toUtc().toIso8601String();
            await VaultDatabase.markEnvelopeSynced(
              id: env.id,
              revision: env.revision,
              serverUpdatedAt: serverTime,
            );
            hasChanges = true;
          } else if (pushRes['status'] == 'stale_revision') {
            // Server has newer revision: record conflict
            hasErrors = true;
            await VaultDatabase.recordConflictEnvelope(
              originalId: env.id,
              ownerId: env.ownerId,
              cryptoVersion: env.cryptoVersion,
              payloadSchemaVersion: env.payloadSchemaVersion,
              nonce: env.nonce,
              ciphertext: env.ciphertext,
              revision: env.revision,
              isDeleted: env.isDeleted,
              clientUpdatedAt: env.clientUpdatedAt,
              serverUpdatedAt: null,
            );
          } else {
            hasErrors = true;
          }
        } catch (_) {
          hasErrors = true;
        }
      }

      // 2. Fetch all remote envelopes
      if (!session.isCancelled) {
        final remoteEnvelopes =
            await SupabaseService.fetchAllRemoteEnvelopes(session.userId);

        for (final remote in remoteEnvelopes) {
          if (session.isCancelled) break;
          final applied = await applyRemoteEnvelope(remote, session);
          if (applied) {
            hasChanges = true;
          }
        }
      }

      if (hasChanges && !session.isCancelled) {
        session.updatedCallback?.call();
      }

      if (!session.isCancelled) {
        if (hasErrors) {
          session.statusCallback?.call(SyncStatus.degraded);
        } else {
          session.statusCallback?.call(SyncStatus.synced);
        }
      }
    } catch (_) {
      if (!session.isCancelled) {
        session.statusCallback?.call(SyncStatus.error);
      }
    } finally {
      _isSyncing = false;
    }
  }

  static void _setupRealtimeSubscription(SyncSession session) {
    if (session.channel != null) {
      SupabaseService.client.removeChannel(session.channel!);
    }

    session.channel = SupabaseService.client
        .channel('public:vault_entries:${session.userId}')
        .onPostgresChanges(
          event: PostgresChangeEvent.all,
          schema: 'public',
          table: 'vault_entries',
          filter: PostgresChangeFilter(
            type: PostgresChangeFilterType.eq,
            column: 'user_id',
            value: session.userId,
          ),
          callback: (payload) async {
            if (session.isCancelled) return;
            final row = payload.newRecord;
            if (row.isEmpty) return;

            try {
              final envelope = EncryptedEnvelope.fromRemoteMap(
                Map<String, dynamic>.from(row),
                authenticatedUserId: session.userId,
              );

              final applied = await applyRemoteEnvelope(envelope, session);
              if (applied && !session.isCancelled) {
                session.updatedCallback?.call();
                session.statusCallback?.call(SyncStatus.synced);
              }
            } catch (_) {
              // Quarantine untrusted or malformed remote envelope
            }
          },
        )
        .subscribe((status, [error]) {
      if (session.isCancelled) return;
      if (status == RealtimeSubscribeStatus.subscribed) {
        session.statusCallback?.call(SyncStatus.synced);
      } else if (status == RealtimeSubscribeStatus.closed) {
        session.statusCallback?.call(SyncStatus.offline);
      }
    });
  }
}
