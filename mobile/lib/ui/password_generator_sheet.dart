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

  String _getStrengthLabel() {
    if (_length < 12) return 'Weak';
    if (_length < 16) return 'Fair';
    if (_length < 24) return 'Strong';
    return 'Very Strong';
  }

  Color _getStrengthColor() {
    if (_length < 12) return const Color(0xFFF43F5E);
    if (_length < 16) return const Color(0xFFF59E0B);
    if (_length < 24) return const Color(0xFF10B981);
    return const Color(0xFF34D399);
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(22),
      decoration: const BoxDecoration(
        color: Color(0xFF121316),
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Row(
                children: [
                  Container(
                    width: 32,
                    height: 32,
                    decoration: BoxDecoration(
                      color: const Color(0xFF18181B),
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(color: Colors.white.withOpacity(0.08)),
                    ),
                    alignment: Alignment.center,
                    child: const Icon(Icons.auto_awesome_rounded, color: Color(0xFF10B981), size: 16),
                  ),
                  const SizedBox(width: 10),
                  const Text(
                    'Password Generator',
                    style: TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.bold,
                      color: Colors.white,
                    ),
                  ),
                ],
              ),
              IconButton(
                icon: const Icon(Icons.close_rounded, color: Colors.white54, size: 20),
                onPressed: () => Navigator.pop(context),
              ),
            ],
          ),
          const SizedBox(height: 16),

          // Generated Password Display Card
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
            decoration: BoxDecoration(
              color: const Color(0xFF09090B),
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: const Color(0xFF27272A)),
            ),
            child: Row(
              children: [
                Expanded(
                  child: SelectableText(
                    _generated,
                    style: const TextStyle(
                      fontFamily: 'monospace',
                      fontSize: 14,
                      letterSpacing: 1.1,
                      color: Color(0xFF10B981),
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
                  icon: const Icon(Icons.copy_rounded, color: Color(0xFF10B981), size: 18),
                  onPressed: () {
                    Clipboard.setData(ClipboardData(text: _generated));
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(
                        content: Text('Password copied to clipboard'),
                        duration: Duration(seconds: 1),
                      ),
                    );
                  },
                  tooltip: 'Copy',
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),

          // Length Slider
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text('Length', style: TextStyle(color: Colors.white70, fontSize: 13)),
              Row(
                children: [
                  Text(
                    '$_length chars',
                    style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 13),
                  ),
                  const SizedBox(width: 8),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                    decoration: BoxDecoration(
                      color: _getStrengthColor().withOpacity(0.15),
                      borderRadius: BorderRadius.circular(6),
                      border: Border.all(color: _getStrengthColor().withOpacity(0.3)),
                    ),
                    child: Text(
                      _getStrengthLabel(),
                      style: TextStyle(color: _getStrengthColor(), fontSize: 10, fontWeight: FontWeight.bold),
                    ),
                  ),
                ],
              ),
            ],
          ),
          SliderTheme(
            data: SliderTheme.of(context).copyWith(
              activeTrackColor: const Color(0xFF10B981),
              inactiveTrackColor: const Color(0xFF27272A),
              thumbColor: Colors.white,
              overlayColor: const Color(0xFF10B981).withOpacity(0.2),
            ),
            child: Slider(
              value: _length.toDouble(),
              min: 8,
              max: 64,
              divisions: 56,
              onChanged: (val) {
                setState(() => _length = val.round());
                _regenerate();
              },
            ),
          ),
          const SizedBox(height: 10),

          // Character Toggles in 2x2 Grid
          Row(
            children: [
              Expanded(
                child: _buildToggle(
                  'Uppercase (A-Z)',
                  _uppercase,
                  (v) => setState(() {
                    _uppercase = v;
                    _regenerate();
                  }),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: _buildToggle(
                  'Lowercase (a-z)',
                  _lowercase,
                  (v) => setState(() {
                    _lowercase = v;
                    _regenerate();
                  }),
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Row(
            children: [
              Expanded(
                child: _buildToggle(
                  'Numbers (0-9)',
                  _numbers,
                  (v) => setState(() {
                    _numbers = v;
                    _regenerate();
                  }),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: _buildToggle(
                  'Symbols (!@#)',
                  _symbols,
                  (v) => setState(() {
                    _symbols = v;
                    _regenerate();
                  }),
                ),
              ),
            ],
          ),
          const SizedBox(height: 20),

          if (widget.onPasswordSelected != null)
            ElevatedButton(
              style: ElevatedButton.styleFrom(
                backgroundColor: Colors.white,
                foregroundColor: const Color(0xFF09090B),
                padding: const EdgeInsets.symmetric(vertical: 14),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                elevation: 0,
              ),
              onPressed: () {
                widget.onPasswordSelected!(_generated);
                Navigator.pop(context);
              },
              child: const Text('Use Password', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
            ),
        ],
      ),
    );
  }

  Widget _buildToggle(String label, bool value, ValueChanged<bool> onChanged) {
    return InkWell(
      onTap: () => onChanged(!value),
      borderRadius: BorderRadius.circular(12),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
        decoration: BoxDecoration(
          color: const Color(0xFF0C0D10),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
            color: value ? const Color(0xFF10B981).withOpacity(0.5) : const Color(0xFF27272A),
          ),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Expanded(
              child: Text(
                label,
                style: TextStyle(
                  color: value ? Colors.white : Colors.white54,
                  fontSize: 11,
                  fontWeight: value ? FontWeight.w600 : FontWeight.normal,
                ),
              ),
            ),
            Icon(
              value ? Icons.check_box_rounded : Icons.check_box_outline_blank_rounded,
              color: value ? const Color(0xFF10B981) : Colors.white30,
              size: 16,
            ),
          ],
        ),
      ),
    );
  }
}
