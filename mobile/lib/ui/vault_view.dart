import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../models/vault_entry.dart';
import '../providers/vault_providers.dart';
import '../services/sync_engine.dart';
import 'entry_editor_dialog.dart';
import 'password_generator_sheet.dart';

class VaultView extends ConsumerStatefulWidget {
  const VaultView({super.key});

  @override
  ConsumerState<VaultView> createState() => _VaultViewState();
}

class _VaultViewState extends ConsumerState<VaultView> {
  String _searchQuery = '';
  String _filter = 'all'; // 'all', 'favorites', 'logins', 'notes'
  String? _selectedTag;

  void _openEditor([VaultEntry? entry]) {
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (ctx) => EntryEditorDialog(
          initialEntry: entry,
          onSave: ({
            String? id,
            required String title,
            String? username,
            String? password,
            String? url,
            String? notes,
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
                  tags: tags,
                  favorite: favorite,
                );
          },
        ),
      ),
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

  @override
  Widget build(BuildContext context) {
    final vault = ref.watch(vaultProvider);
    final notifier = ref.read(vaultProvider.notifier);

    // Collect all tags
    final Set<String> allTags = {};
    for (final e in vault.entries) {
      allTags.addAll(e.tags);
    }

    // Filtered entries
    final filtered = vault.entries.where((e) {
      if (_filter == 'favorites' && !e.favorite) return false;
      if (_filter == 'logins' && (e.password == null || e.password!.isEmpty)) return false;
      if (_filter == 'notes' && (e.notes == null || e.notes!.isEmpty || (e.password != null && e.password!.isNotEmpty))) return false;
      if (_selectedTag != null && !e.tags.contains(_selectedTag)) return false;

      if (_searchQuery.isNotEmpty) {
        final q = _searchQuery.toLowerCase();
        final matchTitle = e.title.toLowerCase().contains(q);
        final matchUser = e.username?.toLowerCase().contains(q) ?? false;
        final matchUrl = e.url?.toLowerCase().contains(q) ?? false;
        final matchNotes = e.notes?.toLowerCase().contains(q) ?? false;
        final matchTags = e.tags.any((t) => t.toLowerCase().contains(q));
        if (!matchTitle && !matchUser && !matchUrl && !matchNotes && !matchTags) {
          return false;
        }
      }
      return true;
    }).toList();

    return Scaffold(
      backgroundColor: const Color(0xFF020817),
      appBar: AppBar(
        backgroundColor: const Color(0xFF0F172A),
        elevation: 0,
        title: const Row(
          children: [
            Icon(Icons.lock_rounded, color: Color(0xFF6366F1), size: 20),
            SizedBox(width: 8),
            Text(
              'PM Vault',
              style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18),
            ),
          ],
        ),
        actions: [
          // Sync status indicator
          InkWell(
            onTap: () => notifier.triggerSync(),
            borderRadius: BorderRadius.circular(12),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
              child: Row(
                children: [
                  _buildSyncIcon(vault.syncStatus),
                  const SizedBox(width: 6),
                  Text(
                    _getSyncLabel(vault.syncStatus),
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w600,
                      color: _getSyncColor(vault.syncStatus),
                    ),
                  ),
                ],
              ),
            ),
          ),
          IconButton(
            icon: const Icon(Icons.auto_awesome_rounded, color: Color(0xFF6366F1), size: 20),
            tooltip: 'Password Generator',
            onPressed: _openGenerator,
          ),
          PopupMenuButton<String>(
            icon: const Icon(Icons.more_vert_rounded, color: Colors.white70),
            color: const Color(0xFF0F172A),
            onSelected: (val) async {
              if (val == 'sync') {
                notifier.triggerSync();
              } else if (val == 'lock') {
                notifier.lockVault();
              } else if (val == 'relink') {
                final confirm = await showDialog<bool>(
                  context: context,
                  builder: (ctx) => AlertDialog(
                    backgroundColor: const Color(0xFF0F172A),
                    title: const Text('Re-link Vault?', style: TextStyle(color: Colors.white)),
                    content: const Text(
                      'Clear local cache on this phone to re-link to your desktop/cloud vault?',
                      style: TextStyle(color: Colors.white70),
                    ),
                    actions: [
                      TextButton(
                        onPressed: () => Navigator.pop(ctx, false),
                        child: const Text('Cancel', style: TextStyle(color: Colors.white60)),
                      ),
                      ElevatedButton(
                        style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFFE11D48)),
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
                    Icon(Icons.sync_rounded, color: Color(0xFF6366F1), size: 18),
                    SizedBox(width: 10),
                    Text('Sync Now', style: TextStyle(color: Colors.white)),
                  ],
                ),
              ),
              const PopupMenuItem(
                value: 'lock',
                child: Row(
                  children: [
                    Icon(Icons.lock_clock_rounded, color: Colors.white70, size: 18),
                    SizedBox(width: 10),
                    Text('Lock Vault', style: TextStyle(color: Colors.white)),
                  ],
                ),
              ),
              const PopupMenuItem(
                value: 'relink',
                child: Row(
                  children: [
                    Icon(Icons.refresh_rounded, color: Color(0xFFF43F5E), size: 18),
                    SizedBox(width: 10),
                    Text('Re-link Account', style: TextStyle(color: Color(0xFFF43F5E))),
                  ],
                ),
              ),
            ],
          ),
        ],
      ),
      body: Column(
        children: [
          // Search & Filters Header
          Container(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
            color: const Color(0xFF0F172A),
            child: Column(
              children: [
                // Search Input
                TextField(
                  onChanged: (val) => setState(() => _searchQuery = val.trim()),
                  style: const TextStyle(color: Colors.white, fontSize: 14),
                  decoration: InputDecoration(
                    hintText: 'Search vault...',
                    hintStyle: const TextStyle(color: Colors.white38),
                    prefixIcon: const Icon(Icons.search_rounded, color: Colors.white54, size: 18),
                    filled: true,
                    fillColor: const Color(0xFF020817),
                    contentPadding: const EdgeInsets.symmetric(vertical: 10),
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                      borderSide: const BorderSide(color: Color(0xFF1E293B)),
                    ),
                  ),
                ),
                const SizedBox(height: 10),

                // Category Tabs
                SingleChildScrollView(
                  scrollDirection: Axis.horizontal,
                  child: Row(
                    children: [
                      _buildFilterChip('All', 'all', Icons.vpn_key_rounded),
                      _buildFilterChip('Favorites', 'favorites', Icons.star_rounded),
                      _buildFilterChip('Logins', 'logins', Icons.language_rounded),
                      _buildFilterChip('Notes', 'notes', Icons.description_outlined),
                      if (allTags.isNotEmpty) ...[
                        const SizedBox(width: 8),
                        ...allTags.map((tag) => Padding(
                              padding: const EdgeInsets.only(right: 6),
                              child: FilterChip(
                                label: Text('#$tag'),
                                selected: _selectedTag == tag,
                                onSelected: (sel) => setState(() => _selectedTag = sel ? tag : null),
                                selectedColor: const Color(0xFF6366F1),
                                backgroundColor: const Color(0xFF020817),
                                labelStyle: TextStyle(
                                  color: _selectedTag == tag ? Colors.white : Colors.white60,
                                  fontSize: 12,
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

          // Entries List
          Expanded(
            child: filtered.isEmpty
                ? Center(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(Icons.folder_open_rounded, color: Colors.white.withOpacity(0.2), size: 48),
                        const SizedBox(height: 12),
                        Text(
                          _searchQuery.isNotEmpty
                              ? 'No entries match "$_searchQuery"'
                              : 'No items in this category',
                          style: const TextStyle(color: Colors.white54, fontSize: 14),
                        ),
                      ],
                    ),
                  )
                : ListView.builder(
                    padding: const EdgeInsets.all(16),
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
        backgroundColor: const Color(0xFF6366F1),
        onPressed: () => _openEditor(),
        tooltip: 'Add Entry',
        child: const Icon(Icons.add_rounded, color: Colors.white),
      ),
    );
  }

  Widget _buildFilterChip(String label, String value, IconData icon) {
    final isSelected = _filter == value && _selectedTag == null;
    return Padding(
      padding: const EdgeInsets.only(right: 6),
      child: FilterChip(
        avatar: Icon(icon, size: 14, color: isSelected ? Colors.white : Colors.white60),
        label: Text(label),
        selected: isSelected,
        onSelected: (_) {
          setState(() {
            _filter = value;
            _selectedTag = null;
          });
        },
        selectedColor: const Color(0xFF6366F1),
        backgroundColor: const Color(0xFF020817),
        labelStyle: TextStyle(
          color: isSelected ? Colors.white : Colors.white60,
          fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
          fontSize: 12,
        ),
      ),
    );
  }

  Widget _buildEntryCard(VaultEntry item) {
    return Card(
      color: const Color(0xFF0F172A),
      margin: const EdgeInsets.only(bottom: 12),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: const BorderSide(color: Color(0xFF1E293B)),
      ),
      child: InkWell(
        borderRadius: BorderRadius.circular(16),
        onTap: () => _openEditor(item),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Row(
            children: [
              // Icon Badge
              Container(
                width: 42,
                height: 42,
                decoration: BoxDecoration(
                  color: const Color(0xFF6366F1).withOpacity(0.15),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Icon(
                  item.password != null ? Icons.language_rounded : Icons.description_outlined,
                  color: const Color(0xFF818CF8),
                  size: 20,
                ),
              ),
              const SizedBox(width: 14),

              // Title and Username
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
                              fontSize: 15,
                            ),
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                        if (item.favorite)
                          const Icon(Icons.star_rounded, color: Colors.amber, size: 16),
                      ],
                    ),
                    if (item.username != null) ...[
                      const SizedBox(height: 2),
                      Text(
                        item.username!,
                        style: const TextStyle(color: Colors.white60, fontSize: 13),
                        overflow: TextOverflow.ellipsis,
                      ),
                    ],
                  ],
                ),
              ),

              // Actions: Copy Username & Password
              Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  if (item.username != null)
                    IconButton(
                      icon: const Icon(Icons.person_outline_rounded, color: Colors.white54, size: 18),
                      tooltip: 'Copy Username',
                      onPressed: () {
                        Clipboard.setData(ClipboardData(text: item.username!));
                        ScaffoldMessenger.of(context).showSnackBar(
                          const SnackBar(content: Text('Username copied'), duration: Duration(seconds: 1)),
                        );
                      },
                    ),
                  if (item.password != null)
                    IconButton(
                      icon: const Icon(Icons.copy_rounded, color: Color(0xFF6366F1), size: 18),
                      tooltip: 'Copy Password',
                      onPressed: () {
                        Clipboard.setData(ClipboardData(text: item.password!));
                        ScaffoldMessenger.of(context).showSnackBar(
                          const SnackBar(content: Text('Password copied'), duration: Duration(seconds: 1)),
                        );
                      },
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
        return const Icon(Icons.check_circle_rounded, color: Color(0xFF10B981), size: 14);
      case SyncStatus.syncing:
        return const SizedBox(
          width: 12,
          height: 12,
          child: CircularProgressIndicator(strokeWidth: 2, color: Color(0xFF6366F1)),
        );
      case SyncStatus.error:
        return const Icon(Icons.error_outline_rounded, color: Color(0xFFF43F5E), size: 14);
      case SyncStatus.offline:
        return const Icon(Icons.cloud_off_rounded, color: Color(0xFFF59E0B), size: 14);
    }
  }

  String _getSyncLabel(SyncStatus status) {
    switch (status) {
      case SyncStatus.synced:
        return 'Synced';
      case SyncStatus.syncing:
        return 'Syncing...';
      case SyncStatus.error:
        return 'Sync Error';
      case SyncStatus.offline:
        return 'Local-first';
    }
  }

  Color _getSyncColor(SyncStatus status) {
    switch (status) {
      case SyncStatus.synced:
        return const Color(0xFF10B981);
      case SyncStatus.syncing:
        return const Color(0xFF6366F1);
      case SyncStatus.error:
        return const Color(0xFFF43F5E);
      case SyncStatus.offline:
        return const Color(0xFFF59E0B);
    }
  }
}
