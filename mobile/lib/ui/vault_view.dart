import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
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
                  Icon(Icons.shield_outlined,
                      color: Colors.white, size: 14),
                  SizedBox(width: 8),
                  Text('Clipboard cleared for security (30s)'),
                ],
              ),
              duration: const Duration(seconds: 2),
              backgroundColor: const Color(0xFF18181B),
              behavior: SnackBarBehavior.floating,
              shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(10)),
            ),
          );
        }
      },
    );
    setState(() => _copiedKey = key);
    Future.delayed(const Duration(seconds: 2), () {
      if (mounted && _copiedKey == key) {
        setState(() => _copiedKey = null);
      }
    });

    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('$label copied to clipboard'),
        duration: const Duration(seconds: 1),
        backgroundColor: const Color(0xFF18181B),
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final vault = ref.watch(vaultProvider);
    final notifier = ref.read(vaultProvider.notifier);

    // Extract unique tags across entries
    final allTags = <String>{};
    for (final e in vault.entries) {
      allTags.addAll(e.tags);
    }

    final filtered = vault.entries.where((entry) {
      if (entry.isDeleted) return false;

      // Category filter
      if (_filter == 'favorites' && !entry.favorite) return false;
      if (_filter == 'logins' &&
          (entry.password == null || entry.password!.isEmpty)) {
        return false;
      }
      if (_filter == 'passkeys' && !entry.tags.contains('passkey')) {
        return false;
      }
      if (_filter == 'notes' &&
          (entry.notes == null ||
              entry.notes!.isEmpty ||
              (entry.password != null && entry.password!.isNotEmpty))) {
        return false;
      }
      if (_filter == 'questions' && entry.securityQuestions.isEmpty) {
        return false;
      }

      // Tag filter
      if (_selectedTag != null && !entry.tags.contains(_selectedTag)) {
        return false;
      }

      // Search query
      if (_searchQuery.isNotEmpty) {
        final q = _searchQuery.toLowerCase();
        final matchTitle = entry.title.toLowerCase().contains(q);
        final matchUser =
            entry.username != null && entry.username!.toLowerCase().contains(q);
        final matchUrl =
            entry.url != null && entry.url!.toLowerCase().contains(q);
        final matchNotes =
            entry.notes != null && entry.notes!.toLowerCase().contains(q);
        final matchTags = entry.tags.any((t) => t.toLowerCase().contains(q));
        final matchQuestions = entry.securityQuestions.any((sq) =>
            sq.question.toLowerCase().contains(q) ||
            sq.answer.toLowerCase().contains(q));
        if (!matchTitle &&
            !matchUser &&
            !matchUrl &&
            !matchNotes &&
            !matchTags &&
            !matchQuestions) {
          return false;
        }
      }
      return true;
    }).toList();

    return Scaffold(
      backgroundColor: const Color(0xFF09090B),
      appBar: AppBar(
        backgroundColor: const Color(0xFF09090B),
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
                border: Border.all(color: const Color(0xFF27272A)),
              ),
              alignment: Alignment.center,
              child: const Icon(Icons.shield_outlined,
                  color: Colors.white, size: 16),
            ),
            const SizedBox(width: 10),
            Text(
              'PM-VAULT',
              style: GoogleFonts.spaceGrotesk(
                  fontWeight: FontWeight.bold,
                  fontSize: 16,
                  color: Colors.white),
            ),
            const SizedBox(width: 8),
            Container(
              width: 6,
              height: 6,
              decoration: const BoxDecoration(
                color: Color(0xFFD4D4D8),
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
                color: const Color(0xFF18181B),
                borderRadius: BorderRadius.circular(20),
                border: Border.all(color: const Color(0xFF27272A)),
              ),
              child: Row(
                children: [
                  _buildSyncIcon(vault.syncStatus),
                  const SizedBox(width: 5),
                  Text(
                    _getSyncLabel(vault.syncStatus),
                    style: GoogleFonts.ibmPlexMono(
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
            icon: const Icon(Icons.auto_awesome_rounded,
                color: Colors.white, size: 18),
            tooltip: 'Password Generator',
            onPressed: _openGenerator,
          ),
          // More Menu
          PopupMenuButton<String>(
            icon: const Icon(Icons.more_vert_rounded,
                color: Color(0xFFA1A1AA), size: 18),
            color: const Color(0xFF121214),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(14),
              side: const BorderSide(color: Color(0xFF27272A)),
            ),
            onSelected: (val) async {
              if (val == 'sync') {
                notifier.triggerSync();
              } else if (val == 'update') {
                UpdateService.showUpdateDialog(context,
                    silentIfUpToDate: false);
              } else if (val == 'lock') {
                notifier.lockVault();
              } else if (val == 'relink') {
                final confirm = await showDialog<bool>(
                  context: context,
                  builder: (ctx) => AlertDialog(
                    backgroundColor: const Color(0xFF121214),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(16),
                      side: const BorderSide(color: Color(0xFF27272A)),
                    ),
                    title: const Text('Re-link Vault?',
                        style: TextStyle(color: Colors.white, fontSize: 16)),
                    content: const Text(
                      'Clear local cache on this phone to re-link to your desktop/cloud vault?',
                      style: TextStyle(color: Color(0xFFA1A1AA), fontSize: 13),
                    ),
                    actions: [
                      TextButton(
                        onPressed: () => Navigator.pop(ctx, false),
                        child: const Text('Cancel',
                            style: TextStyle(color: Color(0xFF71717A))),
                      ),
                      ElevatedButton(
                        style: ElevatedButton.styleFrom(
                            backgroundColor: const Color(0xFFF43F5E)),
                        onPressed: () => Navigator.pop(ctx, true),
                        child: const Text('Re-link',
                            style: TextStyle(color: Colors.white)),
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
                    Icon(Icons.sync_rounded,
                        color: Colors.white, size: 16),
                    SizedBox(width: 10),
                    Text('Sync Now',
                        style: TextStyle(color: Colors.white, fontSize: 13)),
                  ],
                ),
              ),
              const PopupMenuItem(
                value: 'update',
                child: Row(
                  children: [
                    Icon(Icons.system_update_rounded,
                        color: Color(0xFFD4D4D8), size: 16),
                    SizedBox(width: 10),
                    Text('Check for Updates',
                        style: TextStyle(color: Colors.white, fontSize: 13)),
                  ],
                ),
              ),
              const PopupMenuItem(
                value: 'lock',
                child: Row(
                  children: [
                    Icon(Icons.lock_clock_rounded,
                        color: Colors.white70, size: 16),
                    SizedBox(width: 10),
                    Text('Lock Vault',
                        style: TextStyle(color: Colors.white, fontSize: 13)),
                  ],
                ),
              ),
              const PopupMenuItem(
                value: 'relink',
                child: Row(
                  children: [
                    Icon(Icons.refresh_rounded,
                        color: Color(0xFFF43F5E), size: 16),
                    SizedBox(width: 10),
                    Text('Re-link Account',
                        style:
                            TextStyle(color: Color(0xFFF43F5E), fontSize: 13)),
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
            color: const Color(0xFF09090B),
            child: Column(
              children: [
                // Search Input
                TextField(
                  onChanged: (val) => setState(() => _searchQuery = val.trim()),
                  style: const TextStyle(color: Colors.white, fontSize: 13),
                  decoration: InputDecoration(
                    hintText: 'Search vault...',
                    hintStyle:
                        const TextStyle(color: Color(0xFF52525B), fontSize: 12),
                    prefixIcon: const Icon(Icons.search_rounded,
                        color: Color(0xFF71717A), size: 16),
                    filled: true,
                    fillColor: const Color(0xFF121214),
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
                      borderSide: const BorderSide(color: Colors.white),
                    ),
                  ),
                ),
                const SizedBox(height: 8),

                // Category Tabs with Passkeys
                SingleChildScrollView(
                  scrollDirection: Axis.horizontal,
                  child: Row(
                    children: [
                      _buildFilterChip('All', 'all', Icons.key_rounded,
                          count: vault.entries.length),
                      _buildFilterChip(
                          'Favorites', 'favorites', Icons.star_rounded,
                          count: vault.entries.where((e) => e.favorite).length),
                      _buildFilterChip(
                          'Logins', 'logins', Icons.language_rounded,
                          count: vault.entries
                              .where((e) =>
                                  e.password != null && e.password!.isNotEmpty)
                              .length),
                      _buildFilterChip(
                          'Passkeys', 'passkeys', Icons.fingerprint_rounded,
                          count: vault.entries
                              .where((e) => e.tags.contains('passkey'))
                              .length),
                      _buildFilterChip(
                          'Notes', 'notes', Icons.description_outlined,
                          count: vault.entries
                              .where((e) =>
                                  e.notes != null &&
                                  (e.password == null || e.password!.isEmpty))
                              .length),
                      _buildFilterChip(
                          'Q&A', 'questions', Icons.help_outline_rounded,
                          count: vault.entries
                              .where((e) => e.securityQuestions.isNotEmpty)
                              .length),
                      if (allTags.isNotEmpty) ...[
                        const SizedBox(width: 6),
                        ...allTags.map((tag) => Padding(
                              padding: const EdgeInsets.only(right: 6),
                              child: FilterChip(
                                label: Text('#$tag'),
                                selected: _selectedTag == tag,
                                onSelected: (sel) => setState(
                                    () => _selectedTag = sel ? tag : null),
                                selectedColor: Colors.white,
                                backgroundColor: const Color(0xFF121214),
                                shape: RoundedRectangleBorder(
                                    borderRadius: BorderRadius.circular(8)),
                                labelStyle: TextStyle(
                                  color: _selectedTag == tag
                                      ? Colors.black
                                      : const Color(0xFFA1A1AA),
                                  fontSize: 11,
                                  fontFamily: 'monospace',
                                  fontWeight: _selectedTag == tag
                                      ? FontWeight.bold
                                      : FontWeight.normal,
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
                  style: GoogleFonts.ibmPlexMono(
                      color: const Color(0xFF71717A),
                      fontSize: 10,
                      fontWeight: FontWeight.bold),
                ),
                Text(
                  '${filtered.length} items',
                  style: GoogleFonts.ibmPlexMono(
                      color: const Color(0xFF71717A),
                      fontSize: 10),
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
                        const Icon(Icons.folder_open_rounded,
                            color: Color(0xFF3F3F46), size: 44),
                        const SizedBox(height: 10),
                        Text(
                          _searchQuery.isNotEmpty
                              ? 'No entries match "$_searchQuery"'
                              : 'No items in this category',
                          style: const TextStyle(
                              color: Color(0xFF71717A), fontSize: 13),
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
        foregroundColor: Colors.black,
        onPressed: () => _openEditor(),
        tooltip: 'Add Entry',
        elevation: 4,
        child: const Icon(Icons.add_rounded, size: 26),
      ),
    );
  }

  Widget _buildFilterChip(String label, String value, IconData icon,
      {int? count}) {
    final isSelected = _filter == value && _selectedTag == null;
    return Padding(
      padding: const EdgeInsets.only(right: 6),
      child: FilterChip(
        avatar: Icon(
          icon,
          size: 13,
          color: isSelected ? Colors.black : const Color(0xFFA1A1AA),
        ),
        label: Text(count != null ? '$label ($count)' : label),
        selected: isSelected,
        onSelected: (_) {
          setState(() {
            _filter = value;
            _selectedTag = null;
          });
        },
        selectedColor: Colors.white,
        backgroundColor: const Color(0xFF121214),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(8),
          side: BorderSide(
            color: isSelected
                ? Colors.white
                : const Color(0xFF27272A),
          ),
        ),
        labelStyle: TextStyle(
          color: isSelected ? Colors.black : const Color(0xFFA1A1AA),
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
        color: const Color(0xFF121214),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFF232326)),
      ),
      child: InkWell(
        borderRadius: BorderRadius.circular(16),
        onTap: () => _openEditor(item),
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Row(
            children: [
              // Website Favicon / Brand Monogram
              Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(
                  color: const Color(0xFF18181B),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: const Color(0xFF27272A)),
                ),
                alignment: Alignment.center,
                child: ServiceIcon(
                  title: item.title,
                  url: item.url,
                  size: 24,
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
                            style: GoogleFonts.spaceGrotesk(
                              color: Colors.white,
                              fontWeight: FontWeight.bold,
                              fontSize: 14,
                            ),
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                        if (item.favorite)
                          const Icon(Icons.star_rounded,
                              color: Colors.amber, size: 14),
                      ],
                    ),
                    const SizedBox(height: 2),
                    Row(
                      children: [
                        Flexible(
                          child: Text(
                            item.username ?? item.url ?? 'No username',
                            style: GoogleFonts.ibmPlexMono(
                              color: const Color(0xFFA1A1AA),
                              fontSize: 11,
                            ),
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                        if (item.securityQuestions.isNotEmpty) ...[
                          const SizedBox(width: 5),
                          Container(
                            padding: const EdgeInsets.symmetric(
                                horizontal: 4, vertical: 1),
                            decoration: BoxDecoration(
                              color: const Color(0xFF18181B),
                              borderRadius: BorderRadius.circular(4),
                              border: Border.all(color: const Color(0xFF27272A)),
                            ),
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                const Icon(Icons.help_outline_rounded,
                                    color: Color(0xFFD4D4D8), size: 9),
                                const SizedBox(width: 2),
                                Text(
                                  '${item.securityQuestions.length}',
                                  style: GoogleFonts.ibmPlexMono(
                                      color: Colors.white,
                                      fontSize: 9,
                                      fontWeight: FontWeight.bold),
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
                      onTap: () => _copyToClipboard(
                          item.username!, '${item.id}-user', 'Username'),
                      borderRadius: BorderRadius.circular(8),
                      child: Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 8, vertical: 5),
                        margin: const EdgeInsets.only(right: 4),
                        decoration: BoxDecoration(
                          color: const Color(0xFF18181B),
                          borderRadius: BorderRadius.circular(8),
                          border: Border.all(color: const Color(0xFF27272A)),
                        ),
                        child: isUserCopied
                            ? const Icon(Icons.check_rounded,
                                color: Colors.white, size: 14)
                            : const Text('User',
                                style: TextStyle(
                                    color: Color(0xFFD4D4D8),
                                    fontSize: 10,
                                    fontWeight: FontWeight.bold)),
                      ),
                    ),
                  if (item.password != null && item.password!.isNotEmpty)
                    InkWell(
                      onTap: () => _copyToClipboard(
                          item.password!, '${item.id}-pass', 'Password'),
                      borderRadius: BorderRadius.circular(8),
                      child: Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 8, vertical: 5),
                        decoration: BoxDecoration(
                          color: const Color(0xFF18181B),
                          borderRadius: BorderRadius.circular(8),
                          border: Border.all(color: const Color(0xFF3F3F46)),
                        ),
                        child: isPassCopied
                            ? const Icon(Icons.check_rounded,
                                color: Colors.white, size: 14)
                            : const Text('Pass',
                                style: TextStyle(
                                    color: Colors.white,
                                    fontSize: 10,
                                    fontWeight: FontWeight.bold)),
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
        return const Icon(Icons.check_circle_rounded,
            color: Color(0xFFD4D4D8), size: 12);
      case SyncStatus.syncing:
        return const SizedBox(
          width: 10,
          height: 10,
          child: CircularProgressIndicator(
              strokeWidth: 1.5, color: Colors.white),
        );
      case SyncStatus.degraded:
        return const Icon(Icons.warning_amber_rounded,
            color: Color(0xFFF59E0B), size: 12);
      case SyncStatus.error:
        return const Icon(Icons.error_outline_rounded,
            color: Color(0xFFF43F5E), size: 12);
      case SyncStatus.offline:
        return const Icon(Icons.cloud_off_rounded,
            color: Color(0xFF71717A), size: 12);
    }
  }

  String _getSyncLabel(SyncStatus status) {
    switch (status) {
      case SyncStatus.synced:
        return 'Synced';
      case SyncStatus.syncing:
        return 'Syncing';
      case SyncStatus.degraded:
        return 'Degraded';
      case SyncStatus.error:
        return 'Error';
      case SyncStatus.offline:
        return 'Local';
    }
  }

  Color _getSyncColor(SyncStatus status) {
    switch (status) {
      case SyncStatus.synced:
        return const Color(0xFFD4D4D8);
      case SyncStatus.syncing:
        return Colors.white;
      case SyncStatus.degraded:
        return const Color(0xFFF59E0B);
      case SyncStatus.error:
        return const Color(0xFFF43F5E);
      case SyncStatus.offline:
        return const Color(0xFF71717A);
    }
  }
}
