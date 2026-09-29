import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../models/vault_entry.dart';
import '../providers/vault_providers.dart';
import '../services/sync_engine.dart';
import '../services/clipboard_service.dart';
import '../services/update_service.dart';
import 'entry_editor_dialog.dart';
import 'password_generator_sheet.dart';
import 'service_icon.dart';

class VaultView extends ConsumerStatefulWidget {
  const VaultView({super.key});

  @override
  ConsumerState<VaultView> createState() => _VaultViewState();
}

class _VaultViewState extends ConsumerState<VaultView> {
  String _searchQuery = '';
  String _filter = 'all'; // 'all', 'favorites', 'logins', 'passkeys', 'notes'
  String? _selectedTag;
  String? _copiedKey;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      UpdateService.showUpdateDialog(context, silentIfUpToDate: true);
    });
  }

  void _openEditor([VaultEntry? entry]) {
    EntryEditorDialog.show(
      context: context,
      entry: entry,
      onSave: ({
        String? id,
        required String title,
        String? username,
        String? password,
        String? url,
        String? notes,
        List<SecurityQuestion> securityQuestions = const [],
        List<String> tags = const [],
        bool favorite = false,
      }) async {
        await ref.read(vaultProvider.notifier).saveEntry(
              id: id,
              title: title,
              username: username,
              password: password,
              url: url,
              notes: notes,
              securityQuestions: securityQuestions,
              tags: tags,
              favorite: favorite,
            );
      },
      onDelete: (id) async {
        await ref.read(vaultProvider.notifier).deleteEntry(id);
      },
    );
  }

  void _openGenerator() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => const PasswordGeneratorSheet(),
    );
  }

  void _copyToClipboard(String text, String key, String label) {
    ClipboardService.copyWithAutoWipe(
      text,
      onWiped: () {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: const Row(
                children: [
                  Icon(Icons.shield_rounded, color: Color(0xFF10B981), size: 14),
                  SizedBox(width: 8),
                  Text('Clipboard cleared for security (30s)'),
                ],
              ),
              duration: const Duration(seconds: 2),
              backgroundColor: const Color(0xFF18181B),
              behavior: SnackBarBehavior.floating,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
            ),
          );
        }
      },
    );
    setState(() => _copiedKey = key);
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('$label copied (auto-wipes in 30s)'),
        duration: const Duration(seconds: 1),
        backgroundColor: const Color(0xFF18181B),
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
      ),
    );
    Future.delayed(const Duration(milliseconds: 1500), () {
      if (mounted) setState(() => _copiedKey = null);
    });
  }

  @override
  Widget build(BuildContext context) {
    final vault = ref.watch(vaultProvider);
    final notifier = ref.read(vaultProvider.notifier);

    // Collect all unique tags
    final Set<String> allTags = {};
    for (final e in vault.entries) {
      allTags.addAll(e.tags);
    }

    // Filtered entries
    final filtered = vault.entries.where((e) {
      if (_filter == 'favorites' && !e.favorite) return false;
      if (_filter == 'logins' && (e.password == null || e.password!.isEmpty)) return false;
      if (_filter == 'passkeys' && !e.tags.contains('passkey')) return false;
      if (_filter == 'questions' && e.securityQuestions.isEmpty) return false;
      if (_filter == 'notes' &&
          (e.notes == null || e.notes!.isEmpty || (e.password != null && e.password!.isNotEmpty))) {
        return false;
      }
      if (_selectedTag != null && !e.tags.contains(_selectedTag)) return false;

      if (_searchQuery.isNotEmpty) {
        final q = _searchQuery.toLowerCase();
        final matchTitle = e.title.toLowerCase().contains(q);
        final matchUser = e.username?.toLowerCase().contains(q) ?? false;
        final matchUrl = e.url?.toLowerCase().contains(q) ?? false;
        final matchNotes = e.notes?.toLowerCase().contains(q) ?? false;
        final matchTags = e.tags.any((t) => t.toLowerCase().contains(q));
        final matchQuestions = e.securityQuestions.any((sq) =>
            sq.question.toLowerCase().contains(q) ||
            sq.answer.toLowerCase().contains(q));
        if (!matchTitle && !matchUser && !matchUrl && !matchNotes && !matchTags && !matchQuestions) {
          return false;
        }
      }
      return true;
    }).toList();

    return Scaffold(
      backgroundColor: const Color(0xFF09090B),
      appBar: AppBar(
        backgroundColor: const Color(0xFF0C0D0E),
        elevation: 0,
        titleSpacing: 16,
        title: Row(
          children: [
            Container(
              width: 28,
              height: 28,
              decoration: BoxDecoration(
                color: const Color(0xFF18181B),
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: Colors.white.withOpacity(0.08)),
              ),
              alignment: Alignment.center,
              child: const Icon(Icons.shield_rounded, color: Color(0xFF10B981), size: 16),
            ),
            const SizedBox(width: 10),
            const Text(
              'PM Vault',
              style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16, color: Colors.white),
            ),
            const SizedBox(width: 6),
            Container(
              width: 6,
              height: 6,
              decoration: const BoxDecoration(
                color: Color(0xFF10B981),
                shape: BoxShape.circle,
              ),
            ),
          ],
        ),
        actions: [
          // Cloud Sync status indicator
          InkWell(
            onTap: () => notifier.triggerSync(),
            borderRadius: BorderRadius.circular(12),
            child: Container(
              margin: const EdgeInsets.symmetric(vertical: 10, horizontal: 4),
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
              decoration: BoxDecoration(
                color: _getSyncColor(vault.syncStatus).withOpacity(0.12),
                borderRadius: BorderRadius.circular(20),
                border: Border.all(color: _getSyncColor(vault.syncStatus).withOpacity(0.25)),
              ),
              child: Row(
                children: [
                  _buildSyncIcon(vault.syncStatus),
                  const SizedBox(width: 5),
                  Text(
                    _getSyncLabel(vault.syncStatus),
                    style: TextStyle(
                      fontSize: 10,
                      fontWeight: FontWeight.bold,
                      color: _getSyncColor(vault.syncStatus),
                    ),
                  ),
                ],
              ),
            ),
          ),
          // Generator shortcut
          IconButton(
            icon: const Icon(Icons.auto_awesome_rounded, color: Color(0xFF10B981), size: 18),
            tooltip: 'Password Generator',
            onPressed: _openGenerator,
          ),
          // More Menu
          PopupMenuButton<String>(
            icon: const Icon(Icons.more_vert_rounded, color: Colors.white60, size: 18),
            color: const Color(0xFF121316),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(14),
              side: const BorderSide(color: Color(0xFF27272A)),
            ),
            onSelected: (val) async {
              if (val == 'sync') {
                notifier.triggerSync();
              } else if (val == 'update') {
                UpdateService.showUpdateDialog(context, silentIfUpToDate: false);
              } else if (val == 'lock') {
                notifier.lockVault();
              } else if (val == 'relink') {
                final confirm = await showDialog<bool>(
                  context: context,
                  builder: (ctx) => AlertDialog(
                    backgroundColor: const Color(0xFF121316),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(16),
                      side: const BorderSide(color: Color(0xFF27272A)),
                    ),
                    title: const Text('Re-link Vault?', style: TextStyle(color: Colors.white, fontSize: 16)),
                    content: const Text(
                      'Clear local cache on this phone to re-link to your desktop/cloud vault?',
                      style: TextStyle(color: Colors.white70, fontSize: 13),
                    ),
                    actions: [
                      TextButton(
                        onPressed: () => Navigator.pop(ctx, false),
                        child: const Text('Cancel', style: TextStyle(color: Colors.white60)),
                      ),
                      ElevatedButton(
                        style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFFF43F5E)),
                        onPressed: () => Navigator.pop(ctx, true),
                        child: const Text('Re-link', style: TextStyle(color: Colors.white)),
                      ),
                    ],
                  ),
                );
                if (confirm == true) {
                  await notifier.resetLocalVault();
                }
              }
            },
            itemBuilder: (ctx) => [
              const PopupMenuItem(
                value: 'sync',
                child: Row(
                  children: [
                    Icon(Icons.sync_rounded, color: Color(0xFF10B981), size: 16),
                    SizedBox(width: 10),
                    Text('Sync Now', style: TextStyle(color: Colors.white, fontSize: 13)),
                  ],
                ),
              ),
              const PopupMenuItem(
                value: 'update',
                child: Row(
                  children: [
                    Icon(Icons.system_update_rounded, color: Colors.cyanAccent, size: 16),
                    SizedBox(width: 10),
                    Text('Check for Updates', style: TextStyle(color: Colors.white, fontSize: 13)),
                  ],
                ),
              ),
              const PopupMenuItem(
                value: 'lock',
                child: Row(
                  children: [
                    Icon(Icons.lock_clock_rounded, color: Colors.white70, size: 16),
                    SizedBox(width: 10),
                    Text('Lock Vault', style: TextStyle(color: Colors.white, fontSize: 13)),
                  ],
                ),
              ),
              const PopupMenuItem(
                value: 'relink',
                child: Row(
                  children: [
                    Icon(Icons.refresh_rounded, color: Color(0xFFF43F5E), size: 16),
                    SizedBox(width: 10),
                    Text('Re-link Account', style: TextStyle(color: Color(0xFFF43F5E), fontSize: 13)),
                  ],
                ),
              ),
            ],
          ),
        ],
      ),
      body: Column(
        children: [
          // Search & Filter Header
          Container(
            padding: const EdgeInsets.fromLTRB(16, 10, 16, 8),
            color: const Color(0xFF0C0D0E),
            child: Column(
              children: [
                // Search Input
                TextField(
                  onChanged: (val) => setState(() => _searchQuery = val.trim()),
                  style: const TextStyle(color: Colors.white, fontSize: 13),
                  decoration: InputDecoration(
                    hintText: 'Search vault...',
                    hintStyle: const TextStyle(color: Color(0xFF52525B), fontSize: 12),
                    prefixIcon: const Icon(Icons.search_rounded, color: Color(0xFF71717A), size: 16),
                    filled: true,
                    fillColor: const Color(0xFF121316),
                    contentPadding: const EdgeInsets.symmetric(vertical: 8),
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                      borderSide: const BorderSide(color: Color(0xFF27272A)),
                    ),
                    enabledBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                      borderSide: const BorderSide(color: Color(0xFF27272A)),
                    ),
                    focusedBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                      borderSide: const BorderSide(color: Color(0xFF10B981)),
                    ),
                  ),
                ),
                const SizedBox(height: 8),

                // Category Tabs with Passkeys
                SingleChildScrollView(
                  scrollDirection: Axis.horizontal,
                  child: Row(
                    children: [
                      _buildFilterChip('All', 'all', Icons.key_rounded, count: vault.entries.length),
                      _buildFilterChip('Favorites', 'favorites', Icons.star_rounded,
                          count: vault.entries.where((e) => e.favorite).length),
                      _buildFilterChip('Logins', 'logins', Icons.language_rounded,
                          count: vault.entries.where((e) => e.password != null && e.password!.isNotEmpty).length),
                      _buildFilterChip('Passkeys', 'passkeys', Icons.fingerprint_rounded,
                          count: vault.entries.where((e) => e.tags.contains('passkey')).length),
                      _buildFilterChip('Notes', 'notes', Icons.description_outlined,
                          count: vault.entries.where((e) => e.notes != null && (e.password == null || e.password!.isEmpty)).length),
                      _buildFilterChip('Q&A', 'questions', Icons.help_outline_rounded,
                          count: vault.entries.where((e) => e.securityQuestions.isNotEmpty).length),
                      if (allTags.isNotEmpty) ...[
                        const SizedBox(width: 6),
                        ...allTags.map((tag) => Padding(
                              padding: const EdgeInsets.only(right: 6),
                              child: FilterChip(
                                label: Text('#$tag'),
                                selected: _selectedTag == tag,
                                onSelected: (sel) => setState(() => _selectedTag = sel ? tag : null),
                                selectedColor: const Color(0xFF10B981).withOpacity(0.2),
                                backgroundColor: const Color(0xFF121316),
                                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                                labelStyle: TextStyle(
                                  color: _selectedTag == tag ? const Color(0xFF10B981) : Colors.white60,
                                  fontSize: 11,
                                  fontFamily: 'monospace',
                                ),
                              ),
                            )),
                      ],
                    ],
                  ),
                ),
              ],
            ),
          ),

          // Count Bar
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  _filter.toUpperCase(),
                  style: const TextStyle(color: Color(0xFF71717A), fontSize: 10, fontFamily: 'monospace', fontWeight: FontWeight.bold),
                ),
                Text(
                  '${filtered.length} items',
                  style: const TextStyle(color: Color(0xFF71717A), fontSize: 10, fontFamily: 'monospace'),
                ),
              ],
            ),
          ),

          // Entries List
          Expanded(
            child: filtered.isEmpty
                ? Center(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(Icons.folder_open_rounded, color: Colors.white.withOpacity(0.2), size: 44),
                        const SizedBox(height: 10),
                        Text(
                          _searchQuery.isNotEmpty
                              ? 'No entries match "$_searchQuery"'
                              : 'No items in this category',
                          style: const TextStyle(color: Colors.white54, fontSize: 13),
                        ),
                      ],
                    ),
                  )
                : ListView.builder(
                    padding: const EdgeInsets.fromLTRB(16, 0, 16, 80),
                    itemCount: filtered.length,
                    itemBuilder: (ctx, index) {
                      final item = filtered[index];
                      return _buildEntryCard(item);
                    },
                  ),
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton(
        backgroundColor: Colors.white,
        foregroundColor: const Color(0xFF09090B),
        onPressed: () => _openEditor(),
        tooltip: 'Add Entry',
        elevation: 4,
        child: const Icon(Icons.add_rounded, size: 26),
      ),
    );
  }

  Widget _buildFilterChip(String label, String value, IconData icon, {int? count}) {
    final isSelected = _filter == value && _selectedTag == null;
    return Padding(
      padding: const EdgeInsets.only(right: 6),
      child: FilterChip(
        avatar: Icon(
          icon,
          size: 13,
          color: isSelected ? const Color(0xFF10B981) : Colors.white54,
        ),
        label: Text(count != null ? '$label ($count)' : label),
        selected: isSelected,
        onSelected: (_) {
          setState(() {
            _filter = value;
            _selectedTag = null;
          });
        },
        selectedColor: const Color(0xFF10B981).withOpacity(0.15),
        backgroundColor: const Color(0xFF121316),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(8),
          side: BorderSide(
            color: isSelected ? const Color(0xFF10B981).withOpacity(0.4) : const Color(0xFF27272A),
          ),
        ),
        labelStyle: TextStyle(
          color: isSelected ? Colors.white : Colors.white60,
          fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
          fontSize: 11,
        ),
      ),
    );
  }

  Widget _buildEntryCard(VaultEntry item) {
    final isUserCopied = _copiedKey == '${item.id}-user';
    final isPassCopied = _copiedKey == '${item.id}-pass';

    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      decoration: BoxDecoration(
        color: const Color(0xFF121316),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.white.withOpacity(0.06)),
      ),
      child: InkWell(
        borderRadius: BorderRadius.circular(16),
        onTap: () => _openEditor(item),
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Row(
            children: [
              // Brand Favicon / Monogram
              Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(
                  color: const Color(0xFF18181B),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: Colors.white.withOpacity(0.08)),
                ),
                alignment: Alignment.center,
                child: ServiceIcon(
                  title: item.title,
                  url: item.url,
                  size: 22,
                ),
              ),
              const SizedBox(width: 12),

              // Title and Username/Email
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            item.title,
                            style: const TextStyle(
                              color: Colors.white,
                              fontWeight: FontWeight.bold,
                              fontSize: 14,
                            ),
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                        if (item.favorite)
                          const Icon(Icons.star_rounded, color: Colors.amber, size: 14),
                      ],
                    ),
                    const SizedBox(height: 2),
                    Row(
                      children: [
                        Flexible(
                          child: Text(
                            item.username ?? item.url ?? 'No username',
                            style: const TextStyle(
                              color: Color(0xFFA1A1AA),
                              fontSize: 11,
                              fontFamily: 'monospace',
                            ),
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                        if (item.securityQuestions.isNotEmpty) ...[
                          const SizedBox(width: 5),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 1),
                            decoration: BoxDecoration(
                              color: const Color(0xFF06B6D4).withOpacity(0.15),
                              borderRadius: BorderRadius.circular(4),
                              border: Border.all(color: const Color(0xFF06B6D4).withOpacity(0.3)),
                            ),
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                const Icon(Icons.help_outline_rounded, color: Color(0xFF06B6D4), size: 9),
                                const SizedBox(width: 2),
                                Text(
                                  '${item.securityQuestions.length}',
                                  style: const TextStyle(color: Color(0xFF06B6D4), fontSize: 9, fontWeight: FontWeight.bold),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ],
                    ),
                  ],
                ),
              ),

              // Quick Copy Action Buttons directly on card
              Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  if (item.username != null && item.username!.isNotEmpty)
                    InkWell(
                      onTap: () => _copyToClipboard(item.username!, '${item.id}-user', 'Username'),
                      borderRadius: BorderRadius.circular(8),
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 5),
                        margin: const EdgeInsets.only(right: 4),
                        decoration: BoxDecoration(
                          color: const Color(0xFF18181B),
                          borderRadius: BorderRadius.circular(8),
                          border: Border.all(color: Colors.white.withOpacity(0.06)),
                        ),
                        child: isUserCopied
                            ? const Icon(Icons.check_rounded, color: Color(0xFF10B981), size: 14)
                            : const Text('User', style: TextStyle(color: Colors.white70, fontSize: 10, fontWeight: FontWeight.bold)),
                      ),
                    ),
                  if (item.password != null && item.password!.isNotEmpty)
                    InkWell(
                      onTap: () => _copyToClipboard(item.password!, '${item.id}-pass', 'Password'),
                      borderRadius: BorderRadius.circular(8),
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 5),
                        decoration: BoxDecoration(
                          color: const Color(0xFF18181B),
                          borderRadius: BorderRadius.circular(8),
                          border: Border.all(color: const Color(0xFF10B981).withOpacity(0.3)),
                        ),
                        child: isPassCopied
                            ? const Icon(Icons.check_rounded, color: Color(0xFF10B981), size: 14)
                            : const Text('Pass', style: TextStyle(color: Color(0xFF10B981), fontSize: 10, fontWeight: FontWeight.bold)),
                      ),
                    ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildSyncIcon(SyncStatus status) {
    switch (status) {
      case SyncStatus.synced:
        return const Icon(Icons.check_circle_rounded, color: Color(0xFF10B981), size: 12);
      case SyncStatus.syncing:
        return const SizedBox(
          width: 10,
          height: 10,
          child: CircularProgressIndicator(strokeWidth: 1.5, color: Color(0xFF10B981)),
        );
      case SyncStatus.error:
        return const Icon(Icons.error_outline_rounded, color: Color(0xFFF43F5E), size: 12);
      case SyncStatus.offline:
        return const Icon(Icons.cloud_off_rounded, color: Color(0xFFF59E0B), size: 12);
    }
  }

  String _getSyncLabel(SyncStatus status) {
    switch (status) {
      case SyncStatus.synced:
        return 'Synced';
      case SyncStatus.syncing:
        return 'Syncing';
      case SyncStatus.error:
        return 'Error';
      case SyncStatus.offline:
        return 'Local';
    }
  }

  Color _getSyncColor(SyncStatus status) {
    switch (status) {
      case SyncStatus.synced:
        return const Color(0xFF10B981);
      case SyncStatus.syncing:
        return const Color(0xFF38BDF8);
      case SyncStatus.error:
        return const Color(0xFFF43F5E);
      case SyncStatus.offline:
        return const Color(0xFFF59E0B);
    }
  }
}
