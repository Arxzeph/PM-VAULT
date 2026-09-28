import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../crypto/crypto_service.dart';

class PasswordGeneratorSheet extends StatefulWidget {
  final void Function(String generatedPassword)? onPasswordSelected;

  const PasswordGeneratorSheet({super.key, this.onPasswordSelected});

  @override
  State<PasswordGeneratorSheet> createState() => _PasswordGeneratorSheetState();
}

class _PasswordGeneratorSheetState extends State<PasswordGeneratorSheet> {
  int _length = 20;
  bool _uppercase = true;
  bool _lowercase = true;
  bool _numbers = true;
  bool _symbols = true;
  String _generated = '';

  @override
  void initState() {
    super.initState();
    _regenerate();
  }

  void _regenerate() {
    setState(() {
      _generated = CryptoService.generatePassword(
        length: _length,
        uppercase: _uppercase,
        lowercase: _lowercase,
        numbers: _numbers,
        symbols: _symbols,
      );
    });
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: const BoxDecoration(
        color: Color(0xFF0F172A),
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Row(
                children: [
                  Icon(Icons.auto_awesome_rounded, color: Color(0xFF6366F1), size: 20),
                  SizedBox(width: 8),
                  Text(
                    'Password Generator',
                    style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.bold,
                      color: Colors.white,
                    ),
                  ),
                ],
              ),
              IconButton(
                icon: const Icon(Icons.close_rounded, color: Colors.white70, size: 20),
                onPressed: () => Navigator.pop(context),
              ),
            ],
          ),
          const SizedBox(height: 16),

          // Generated Password Display Card
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
            decoration: BoxDecoration(
              color: const Color(0xFF020817),
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: const Color(0xFF1E293B)),
            ),
            child: Row(
              children: [
                Expanded(
                  child: SelectableText(
                    _generated,
                    style: const TextStyle(
                      fontFamily: 'monospace',
                      fontSize: 15,
                      letterSpacing: 1.2,
                      color: Color(0xFF38BDF8),
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
                IconButton(
                  icon: const Icon(Icons.refresh_rounded, color: Colors.white60, size: 18),
                  onPressed: _regenerate,
                  tooltip: 'Regenerate',
                ),
                IconButton(
                  icon: const Icon(Icons.copy_rounded, color: Color(0xFF6366F1), size: 18),
                  onPressed: () {
                    Clipboard.setData(ClipboardData(text: _generated));
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(
                        content: Text('Password copied to clipboard'),
                        duration: Duration(seconds: 2),
                      ),
                    );
                  },
                  tooltip: 'Copy',
                ),
              ],
            ),
          ),
          const SizedBox(height: 20),

          // Length Slider
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text('Length', style: TextStyle(color: Colors.white70, fontSize: 13)),
              Text(
                '$_length characters',
                style: const TextStyle(color: Color(0xFF6366F1), fontWeight: FontWeight.bold, fontSize: 13),
              ),
            ],
          ),
          Slider(
            value: _length.toDouble(),
            min: 8,
            max: 64,
            divisions: 56,
            activeColor: const Color(0xFF6366F1),
            inactiveColor: const Color(0xFF334155),
            onChanged: (val) {
              setState(() => _length = val.round());
              _regenerate();
            },
          ),
          const SizedBox(height: 8),

          // Toggles
          _buildToggle('Uppercase (A-Z)', _uppercase, (v) {
            setState(() => _uppercase = v);
            _regenerate();
          }),
          _buildToggle('Lowercase (a-z)', _lowercase, (v) {
            setState(() => _lowercase = v);
            _regenerate();
          }),
          _buildToggle('Numbers (0-9)', _numbers, (v) {
            setState(() => _numbers = v);
            _regenerate();
          }),
          _buildToggle('Symbols (!@#\$%)', _symbols, (v) {
            setState(() => _symbols = v);
            _regenerate();
          }),
          const SizedBox(height: 16),

          if (widget.onPasswordSelected != null)
            ElevatedButton(
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF6366F1),
                padding: const EdgeInsets.symmetric(vertical: 14),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              ),
              onPressed: () {
                widget.onPasswordSelected!(_generated);
                Navigator.pop(context);
              },
              child: const Text('Use Password', style: TextStyle(fontWeight: FontWeight.bold, color: Colors.white)),
            ),
        ],
      ),
    );
  }

  Widget _buildToggle(String label, bool value, ValueChanged<bool> onChanged) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 2),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: const TextStyle(color: Colors.white70, fontSize: 13)),
          Switch(
            value: value,
            activeColor: const Color(0xFF6366F1),
            onChanged: onChanged,
          ),
        ],
      ),
    );
  }
}
