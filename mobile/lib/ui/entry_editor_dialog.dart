import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../models/vault_entry.dart';
import 'password_generator_sheet.dart';
import 'service_icon.dart';

class EntryEditorDialog extends StatefulWidget {
  final VaultEntry? initialEntry;
  final Future<void> Function({
    String? id,
    required String title,
    String? username,
    String? password,
    String? url,
    String? notes,
    List<String> tags,
    bool favorite,
  }) onSave;
  final Future<void> Function(String id)? onDelete;

  const EntryEditorDialog({
    super.key,
    this.initialEntry,
    required this.onSave,
    this.onDelete,
  });

  static Future<void> show({
    required BuildContext context,
    VaultEntry? entry,
    required Future<void> Function({
      String? id,
      required String title,
      String? username,
      String? password,
      String? url,
      String? notes,
      List<String> tags,
      bool favorite,
    }) onSave,
    Future<void> Function(String id)? onDelete,
  }) {
    return showGeneralDialog(
      context: context,
      barrierDismissible: true,
      barrierLabel: 'Dismiss',
      barrierColor: Colors.black.withOpacity(0.7),
      transitionDuration: const Duration(milliseconds: 250),
      transitionBuilder: (ctx, anim, secondaryAnim, child) {
        final curved = CurvedAnimation(parent: anim, curve: Curves.easeOutBack);
        return ScaleTransition(
          scale: Tween<double>(begin: 0.88, end: 1.0).animate(curved),
          child: FadeTransition(opacity: anim, child: child),
        );
      },
      pageBuilder: (ctx, anim, secondaryAnim) => EntryEditorDialog(
        initialEntry: entry,
        onSave: onSave,
        onDelete: onDelete,
      ),
    );
  }

  @override
  State<EntryEditorDialog> createState() => _EntryEditorDialogState();
}

class _EntryEditorDialogState extends State<EntryEditorDialog> {
  final _formKey = GlobalKey<FormState>();
  late TextEditingController _titleController;
  late TextEditingController _usernameController;
  late TextEditingController _passwordController;
  late TextEditingController _urlController;
  late TextEditingController _notesController;
  late TextEditingController _tagsController;
  bool _favorite = false;
  bool _obscurePassword = true;
  bool _isSaving = false;

  @override
  void initState() {
    super.initState();
    final e = widget.initialEntry;
    _titleController = TextEditingController(text: e?.title ?? '');
    _usernameController = TextEditingController(text: e?.username ?? '');
    _passwordController = TextEditingController(text: e?.password ?? '');
    _urlController = TextEditingController(text: e?.url ?? '');
    _notesController = TextEditingController(text: e?.notes ?? '');
    _tagsController = TextEditingController(text: e?.tags.join(', ') ?? '');
    _favorite = e?.favorite ?? false;
  }

  @override
  void dispose() {
    _titleController.dispose();
    _usernameController.dispose();
    _passwordController.dispose();
    _urlController.dispose();
    _notesController.dispose();
    _tagsController.dispose();
    super.dispose();
  }

  void _openGenerator() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => PasswordGeneratorSheet(
        onPasswordSelected: (pwd) {
          setState(() {
            _passwordController.text = pwd;
            _obscurePassword = false;
          });
        },
      ),
    );
  }

  int _calculateStrength(String password) {
    if (password.isEmpty) return 0;
    int score = 0;
    if (password.length >= 8) score++;
    if (password.length >= 14) score++;
    if (RegExp(r'[a-z]').hasMatch(password) && RegExp(r'[A-Z]').hasMatch(password)) score++;
    if (RegExp(r'[0-9]').hasMatch(password) && RegExp(r'[^A-Za-z0-9]').hasMatch(password)) score++;
    return score;
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate() || _isSaving) return;

    setState(() => _isSaving = true);
    try {
      final tagsList = _tagsController.text
          .split(',')
          .map((s) => s.trim())
          .where((s) => s.isNotEmpty)
          .toList();

      await widget.onSave(
        id: widget.initialEntry?.id,
        title: _titleController.text.trim(),
        username: _usernameController.text.trim().isEmpty ? null : _usernameController.text.trim(),
        password: _passwordController.text.isEmpty ? null : _passwordController.text,
        url: _urlController.text.trim().isEmpty ? null : _urlController.text.trim(),
        notes: _notesController.text.trim().isEmpty ? null : _notesController.text.trim(),
        tags: tagsList,
        favorite: _favorite,
      );

      if (mounted) Navigator.pop(context);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error saving: $e')),
        );
      }
    } finally {
      if (mounted) setState(() => _isSaving = false);
    }
  }

  Future<void> _confirmDelete() async {
    if (widget.initialEntry == null || widget.onDelete == null) return;
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: const Color(0xFF121316),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(18),
          side: const BorderSide(color: Color(0xFF27272A)),
        ),
        title: const Text('Delete Entry?', style: TextStyle(color: Colors.white, fontSize: 16)),
        content: const Text(
          'This will permanently delete this encrypted entry from your vault.',
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
            child: const Text('Delete', style: TextStyle(color: Colors.white)),
          ),
        ],
      ),
    );

    if (confirm == true && mounted) {
      await widget.onDelete!(widget.initialEntry!.id);
      if (mounted) Navigator.pop(context);
    }
  }

  @override
  Widget build(BuildContext context) {
    final isCreating = widget.initialEntry == null;
    final strength = _calculateStrength(_passwordController.text);

    return Center(
      child: Material(
        color: Colors.transparent,
        child: Container(
          width: MediaQuery.of(context).size.width * 0.92,
          constraints: const BoxConstraints(maxWidth: 440, maxHeight: 680),
          decoration: BoxDecoration(
            color: const Color(0xFF121316),
            borderRadius: BorderRadius.circular(24),
            border: Border.all(color: Colors.white.withOpacity(0.08)),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withOpacity(0.6),
                blurRadius: 30,
                offset: const Offset(0, 12),
              ),
            ],
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              // Bubble Header
              Padding(
                padding: const EdgeInsets.fromLTRB(18, 16, 12, 12),
                child: Row(
                  children: [
                    Container(
                      width: 36,
                      height: 36,
                      decoration: BoxDecoration(
                        color: const Color(0xFF18181B),
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(color: Colors.white.withOpacity(0.08)),
                      ),
                      alignment: Alignment.center,
                      child: ServiceIcon(
                        title: _titleController.text,
                        url: _urlController.text,
                        size: 20,
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            isCreating ? 'New Credential' : (_titleController.text.isEmpty ? 'Edit Item' : _titleController.text),
                            style: const TextStyle(
                              color: Colors.white,
                              fontWeight: FontWeight.bold,
                              fontSize: 14,
                            ),
                            overflow: TextOverflow.ellipsis,
                          ),
                          const Text(
                            'Zero-Knowledge Encrypted',
                            style: TextStyle(
                              color: Colors.white38,
                              fontSize: 10,
                              fontFamily: 'monospace',
                            ),
                          ),
                        ],
                      ),
                    ),
                    // Favorite Toggle
                    IconButton(
                      icon: Icon(
                        _favorite ? Icons.star_rounded : Icons.star_outline_rounded,
                        color: _favorite ? Colors.amber : Colors.white38,
                        size: 20,
                      ),
                      onPressed: () => setState(() => _favorite = !_favorite),
                      tooltip: _favorite ? 'Favorited' : 'Add to Favorites',
                    ),
                    // Delete button if existing
                    if (!isCreating && widget.onDelete != null)
                      IconButton(
                        icon: const Icon(Icons.delete_outline_rounded, color: Color(0xFFF43F5E), size: 20),
                        onPressed: _confirmDelete,
                        tooltip: 'Delete Entry',
                      ),
                    // Close button
                    IconButton(
                      icon: const Icon(Icons.close_rounded, color: Colors.white54, size: 20),
                      onPressed: () => Navigator.pop(context),
                    ),
                  ],
                ),
              ),

              const Divider(color: Color(0xFF27272A), height: 1),

              // Scrollable Form Content
              Flexible(
                child: SingleChildScrollView(
                  padding: const EdgeInsets.all(18),
                  child: Form(
                    key: _formKey,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        // Title
                        _buildLabel('Item Name *'),
                        TextFormField(
                          controller: _titleController,
                          style: const TextStyle(color: Colors.white, fontSize: 13),
                          onChanged: (_) => setState(() {}),
                          decoration: _inputDecoration('e.g. Gmail, Discord, GitHub'),
                          validator: (v) => (v == null || v.trim().isEmpty) ? 'Item name is required' : null,
                        ),
                        const SizedBox(height: 14),

                        // Username / Email
                        _buildLabel('Username / Email'),
                        TextFormField(
                          controller: _usernameController,
                          style: const TextStyle(color: Colors.white, fontSize: 13, fontFamily: 'monospace'),
                          decoration: _inputDecoration(
                            'e.g. user@example.com',
                            suffix: _usernameController.text.isNotEmpty
                                ? IconButton(
                                    icon: const Icon(Icons.copy_rounded, color: Colors.white38, size: 16),
                                    onPressed: () {
                                      Clipboard.setData(ClipboardData(text: _usernameController.text));
                                      ScaffoldMessenger.of(context).showSnackBar(
                                        const SnackBar(content: Text('Username copied'), duration: Duration(seconds: 1)),
                                      );
                                    },
                                  )
                                : null,
                          ),
                        ),
                        const SizedBox(height: 14),

                        // Password
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            _buildLabel('Password'),
                            InkWell(
                              onTap: _openGenerator,
                              child: const Padding(
                                padding: EdgeInsets.only(bottom: 6),
                                child: Row(
                                  children: [
                                    Icon(Icons.auto_awesome_rounded, color: Color(0xFF10B981), size: 14),
                                    SizedBox(width: 4),
                                    Text('Generate', style: TextStyle(color: Color(0xFF10B981), fontSize: 11, fontWeight: FontWeight.w600)),
                                  ],
                                ),
                              ),
                            ),
                          ],
                        ),
                        TextFormField(
                          controller: _passwordController,
                          obscureText: _obscurePassword,
                          onChanged: (_) => setState(() {}),
                          style: const TextStyle(color: Colors.white, fontSize: 13, fontFamily: 'monospace'),
                          decoration: _inputDecoration(
                            '••••••••••••••••',
                            suffix: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                IconButton(
                                  icon: Icon(
                                    _obscurePassword ? Icons.visibility_outlined : Icons.visibility_off_outlined,
                                    color: Colors.white38,
                                    size: 16,
                                  ),
                                  onPressed: () => setState(() => _obscurePassword = !_obscurePassword),
                                ),
                                if (_passwordController.text.isNotEmpty)
                                  IconButton(
                                    icon: const Icon(Icons.copy_rounded, color: Color(0xFF10B981), size: 16),
                                    onPressed: () {
                                      Clipboard.setData(ClipboardData(text: _passwordController.text));
                                      ScaffoldMessenger.of(context).showSnackBar(
                                        const SnackBar(content: Text('Password copied'), duration: Duration(seconds: 1)),
                                      );
                                    },
                                  ),
                              ],
                            ),
                          ),
                        ),

                        // Password Strength Meter
                        if (_passwordController.text.isNotEmpty) ...[
                          const SizedBox(height: 8),
                          Row(
                            children: List.generate(4, (index) {
                              final filled = index < strength;
                              Color c = const Color(0xFF27272A);
                              if (filled) {
                                if (strength <= 1) c = const Color(0xFFF43F5E);
                                else if (strength == 2) c = const Color(0xFFF59E0B);
                                else if (strength == 3) c = const Color(0xFF3B82F6);
                                else c = const Color(0xFF10B981);
                              }
                              return Expanded(
                                child: Container(
                                  height: 4,
                                  margin: EdgeInsets.only(right: index == 3 ? 0 : 4),
                                  decoration: BoxDecoration(
                                    color: c,
                                    borderRadius: BorderRadius.circular(2),
                                  ),
                                ),
                              );
                            }),
                          ),
                        ],
                        const SizedBox(height: 14),

                        // Website URL
                        _buildLabel('Website / Service URL'),
                        TextFormField(
                          controller: _urlController,
                          style: const TextStyle(color: Colors.white, fontSize: 13),
                          onChanged: (_) => setState(() {}),
                          decoration: _inputDecoration('https://example.com'),
                        ),
                        const SizedBox(height: 14),

                        // Tags
                        _buildLabel('Tags (comma separated, add "passkey" for passkeys)'),
                        TextFormField(
                          controller: _tagsController,
                          style: const TextStyle(color: Colors.white, fontSize: 13, fontFamily: 'monospace'),
                          decoration: _inputDecoration('e.g. personal, passkey, work'),
                        ),
                        const SizedBox(height: 14),

                        // Notes
                        _buildLabel('Secure Notes'),
                        TextFormField(
                          controller: _notesController,
                          maxLines: 3,
                          style: const TextStyle(color: Colors.white, fontSize: 13),
                          decoration: _inputDecoration('Recovery codes, answers, PINs...'),
                        ),
                      ],
                    ),
                  ),
                ),
              ),

              const Divider(color: Color(0xFF27272A), height: 1),

              // Bottom Action Buttons
              Padding(
                padding: const EdgeInsets.all(16),
                child: SizedBox(
                  width: double.infinity,
                  height: 44,
                  child: ElevatedButton(
                    style: ElevatedButton.styleFrom(
                      backgroundColor: Colors.white,
                      foregroundColor: const Color(0xFF09090B),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                      elevation: 0,
                    ),
                    onPressed: _isSaving ? null : _submit,
                    child: _isSaving
                        ? const SizedBox(
                            width: 18,
                            height: 18,
                            child: CircularProgressIndicator(strokeWidth: 2, color: Colors.black),
                          )
                        : Row(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              const Icon(Icons.shield_outlined, size: 16, color: Color(0xFF10B981)),
                              const SizedBox(width: 8),
                              Text(
                                isCreating ? 'Create Encrypted Item' : 'Save Encrypted Item',
                                style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
                              ),
                            ],
                          ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildLabel(String text) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 6),
      child: Text(
        text,
        style: const TextStyle(
          color: Color(0xFFA1A1AA),
          fontSize: 11,
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }

  InputDecoration _inputDecoration(String hint, {Widget? suffix}) {
    return InputDecoration(
      hintText: hint,
      hintStyle: const TextStyle(color: Color(0xFF52525B), fontSize: 12),
      filled: true,
      fillColor: const Color(0xFF0C0D10),
      suffixIcon: suffix,
      contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
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
    );
  }
}
