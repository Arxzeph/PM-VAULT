import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:local_auth/local_auth.dart';
import 'package:flutter_spinkit/flutter_spinkit.dart';
import '../providers/vault_providers.dart';

class UnlockScreen extends ConsumerStatefulWidget {
  const UnlockScreen({super.key});

  @override
  ConsumerState<UnlockScreen> createState() => _UnlockScreenState();
}

class _UnlockScreenState extends ConsumerState<UnlockScreen> {
  final _auth = LocalAuthentication();
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  final _manualSaltController = TextEditingController();
  bool _obscure = true;
  String? _localError;
  bool _canCheckBiometrics = false;
  String _mode = 'unlock'; // 'unlock', 'connect', 'create'

  @override
  void initState() {
    super.initState();
    _checkBiometrics();
  }

  Future<void> _checkBiometrics() async {
    try {
      final isSupported = await _auth.isDeviceSupported();
      final canCheck = await _auth.canCheckBiometrics;
      if (mounted) setState(() => _canCheckBiometrics = isSupported && canCheck);
    } catch (_) {}
  }

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    _manualSaltController.dispose();
    super.dispose();
  }

  Future<void> _handleUnlock() async {
    final pwd = _passwordController.text;
    if (pwd.isEmpty) {
      setState(() => _localError = 'Please enter your master password');
      return;
    }

    setState(() => _localError = null);
    try {
      await ref.read(vaultProvider.notifier).unlockVault(pwd);
    } catch (e) {
      setState(() => _localError = e.toString().replaceAll('Exception: ', ''));
    }
  }

  Future<void> _handleBiometricUnlock() async {
    setState(() => _localError = null);
    try {
      final didAuth = await _auth.authenticate(
        localizedReason: 'Scan fingerprint to unlock PM Vault',
        options: const AuthenticationOptions(
          biometricOnly: true,
          stickyAuth: true,
        ),
      );

      if (didAuth && mounted) {
        await ref.read(vaultProvider.notifier).unlockWithBiometrics();
      }
    } catch (e) {
      if (mounted) {
        setState(() => _localError = e.toString().replaceAll('Exception: ', ''));
      }
    }
  }

  Future<void> _handleLoginOrInit() async {
    final email = _emailController.text.trim();
    final pwd = _passwordController.text;

    if (email.isEmpty || !email.contains('@')) {
      setState(() => _localError = 'Please enter a valid email address');
      return;
    }
    if (pwd.length < 8) {
      setState(() => _localError = 'Master password must be at least 8 characters');
      return;
    }

    setState(() => _localError = null);
    try {
      await ref.read(vaultProvider.notifier).loginOrInitVault(
            email: email,
            password: pwd,
            manualSalt: _manualSaltController.text.trim().isEmpty
                ? null
                : _manualSaltController.text.trim(),
          );
    } catch (e) {
      setState(() => _localError = e.toString().replaceAll('Exception: ', ''));
    }
  }

  Future<void> _handleResetVault() async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: const Color(0xFF121316),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(18),
          side: const BorderSide(color: Color(0xFF27272A)),
        ),
        title: const Text('Reset Local Database?', style: TextStyle(color: Colors.white, fontSize: 16)),
        content: const Text(
          'DANGER: This will delete your local encrypted database from this phone. You can reconnect it if you know your Master Password.',
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
            child: const Text('Reset', style: TextStyle(color: Colors.white)),
          ),
        ],
      ),
    );

    if (confirm == true) {
      await ref.read(vaultProvider.notifier).resetLocalVault();
      setState(() {
        _passwordController.clear();
        _localError = null;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final vault = ref.watch(vaultProvider);
    final isInit = vault.isInitialized;

    return Scaffold(
      backgroundColor: const Color(0xFF09090B),
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 24),
            child: Container(
              constraints: const BoxConstraints(maxWidth: 400),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  // Lock Icon with Passkey / Biometric Badge
                  Stack(
                    alignment: Alignment.bottomRight,
                    children: [
                      Container(
                        width: 58,
                        height: 58,
                        decoration: BoxDecoration(
                          color: const Color(0xFF18181B),
                          borderRadius: BorderRadius.circular(18),
                          border: Border.all(color: Colors.white.withOpacity(0.08)),
                          boxShadow: [
                            BoxShadow(
                              color: const Color(0xFF10B981).withOpacity(0.12),
                              blurRadius: 20,
                              offset: const Offset(0, 4),
                            ),
                          ],
                        ),
                        alignment: Alignment.center,
                        child: const Icon(Icons.lock_rounded, color: Color(0xFF10B981), size: 28),
                      ),
                      // Passkey Badge
                      Container(
                        padding: const EdgeInsets.all(4),
                        decoration: BoxDecoration(
                          color: const Color(0xFF09090B),
                          shape: BoxShape.circle,
                          border: Border.all(color: const Color(0xFF10B981).withOpacity(0.5)),
                        ),
                        child: const Icon(Icons.fingerprint_rounded, color: Color(0xFF10B981), size: 14),
                      ),
                    ],
                  ),
                  const SizedBox(height: 16),

                  // Title
                  Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      const Text(
                        'PM Vault',
                        style: TextStyle(
                          fontSize: 22,
                          fontWeight: FontWeight.bold,
                          color: Colors.white,
                          letterSpacing: -0.5,
                        ),
                      ),
                      const SizedBox(width: 8),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                        decoration: BoxDecoration(
                          color: const Color(0xFF10B981).withOpacity(0.12),
                          borderRadius: BorderRadius.circular(20),
                          border: Border.all(color: const Color(0xFF10B981).withOpacity(0.25)),
                        ),
                        child: const Text(
                          'Zero-Knowledge',
                          style: TextStyle(
                            fontSize: 10,
                            fontFamily: 'monospace',
                            fontWeight: FontWeight.bold,
                            color: Color(0xFF10B981),
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 6),
                  Text(
                    isInit
                        ? 'Vault locked · Enter master password'
                        : 'Local-first encrypted password manager',
                    textAlign: TextAlign.center,
                    style: const TextStyle(fontSize: 12, color: Colors.white54),
                  ),
                  const SizedBox(height: 24),

                  // Error Message
                  if (_localError != null || vault.errorMessage != null)
                    Container(
                      margin: const EdgeInsets.only(bottom: 16),
                      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                      decoration: BoxDecoration(
                        color: const Color(0xFFF43F5E).withOpacity(0.12),
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: const Color(0xFFF43F5E).withOpacity(0.25)),
                      ),
                      child: Row(
                        children: [
                          const Icon(Icons.shield_outlined, color: Color(0xFFF43F5E), size: 16),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Text(
                              _localError ?? vault.errorMessage!,
                              style: const TextStyle(color: Color(0xFFFDA4AF), fontSize: 12),
                            ),
                          ),
                        ],
                      ),
                    ),

                  // Main Card
                  Container(
                    padding: const EdgeInsets.all(20),
                    decoration: BoxDecoration(
                      color: const Color(0xFF121316),
                      borderRadius: BorderRadius.circular(20),
                      border: Border.all(color: Colors.white.withOpacity(0.08)),
                    ),
                    child: isInit ? _buildUnlockForm(vault) : _buildInitForm(vault),
                  ),

                  const SizedBox(height: 20),

                  // Client-Side Crypto Security Footer
                  const Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(Icons.shield_outlined, color: Color(0xFF10B981), size: 14),
                      SizedBox(width: 6),
                      Text(
                        'Argon2id · XChaCha20-Poly1305 · SQLCipher',
                        style: TextStyle(color: Colors.white38, fontSize: 10, fontFamily: 'monospace'),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildUnlockForm(VaultState vault) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (vault.email != null) ...[
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
            decoration: BoxDecoration(
              color: const Color(0xFF0C0D10),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: const Color(0xFF27272A)),
            ),
            child: Row(
              children: [
                const Icon(Icons.account_circle_outlined, color: Colors.white54, size: 16),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    vault.email!,
                    style: const TextStyle(color: Colors.white70, fontSize: 12, fontFamily: 'monospace'),
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 14),
        ],

        // Master Password Input
        TextFormField(
          controller: _passwordController,
          obscureText: _obscure,
          autofocus: true,
          style: const TextStyle(color: Colors.white, fontSize: 13, fontFamily: 'monospace'),
          decoration: InputDecoration(
            hintText: 'Master Password',
            hintStyle: const TextStyle(color: Color(0xFF52525B), fontSize: 12),
            filled: true,
            fillColor: const Color(0xFF0C0D10),
            prefixIcon: const Icon(Icons.key_rounded, color: Colors.white38, size: 16),
            suffixIcon: IconButton(
              icon: Icon(
                _obscure ? Icons.visibility_outlined : Icons.visibility_off_outlined,
                color: Colors.white38,
                size: 16,
              ),
              onPressed: () => setState(() => _obscure = !_obscure),
            ),
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
          ),
          onFieldSubmitted: (_) => _handleUnlock(),
        ),
        const SizedBox(height: 16),

        // Unlock Button
        SizedBox(
          height: 44,
          child: ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: Colors.white,
              foregroundColor: const Color(0xFF09090B),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
              elevation: 0,
            ),
            onPressed: vault.isLoading ? null : _handleUnlock,
            child: vault.isLoading
                ? const SpinKitThreeBounce(color: Colors.black, size: 18)
                : const Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Text('Unlock Vault', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                      SizedBox(width: 8),
                      Icon(Icons.arrow_forward_rounded, size: 16),
                    ],
                  ),
          ),
        ),

        // Biometric Unlock Button
        if (_canCheckBiometrics) ...[
          const SizedBox(height: 10),
          SizedBox(
            height: 42,
            child: OutlinedButton.icon(
              style: OutlinedButton.styleFrom(
                foregroundColor: Colors.white,
                side: const BorderSide(color: Color(0xFF27272A)),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
              ),
              icon: const Icon(Icons.fingerprint_rounded, color: Color(0xFF10B981), size: 18),
              label: const Text('Unlock with Biometrics', style: TextStyle(fontSize: 12)),
              onPressed: _handleBiometricUnlock,
            ),
          ),
        ],

        const SizedBox(height: 12),
        Center(
          child: TextButton(
            onPressed: _handleResetVault,
            child: const Text(
              'Reset local vault database',
              style: TextStyle(color: Colors.white38, fontSize: 11),
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildInitForm(VaultState vault) {
    final isConnect = _mode != 'create';

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        // Mode Selector
        Container(
          padding: const EdgeInsets.all(3),
          decoration: BoxDecoration(
            color: const Color(0xFF0C0D10),
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: const Color(0xFF27272A)),
          ),
          child: Row(
            children: [
              Expanded(
                child: InkWell(
                  onTap: () => setState(() => _mode = 'connect'),
                  borderRadius: BorderRadius.circular(9),
                  child: Container(
                    padding: const EdgeInsets.symmetric(vertical: 8),
                    decoration: BoxDecoration(
                      color: isConnect ? const Color(0xFF27272A) : Colors.transparent,
                      borderRadius: BorderRadius.circular(9),
                    ),
                    alignment: Alignment.center,
                    child: Text(
                      'Sync Existing',
                      style: TextStyle(
                        color: isConnect ? Colors.white : Colors.white54,
                        fontSize: 11,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ),
                ),
              ),
              Expanded(
                child: InkWell(
                  onTap: () => setState(() => _mode = 'create'),
                  borderRadius: BorderRadius.circular(9),
                  child: Container(
                    padding: const EdgeInsets.symmetric(vertical: 8),
                    decoration: BoxDecoration(
                      color: !isConnect ? const Color(0xFF27272A) : Colors.transparent,
                      borderRadius: BorderRadius.circular(9),
                    ),
                    alignment: Alignment.center,
                    child: Text(
                      'Create New',
                      style: TextStyle(
                        color: !isConnect ? Colors.white : Colors.white54,
                        fontSize: 11,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 16),

        // Email
        TextFormField(
          controller: _emailController,
          keyboardType: TextInputType.emailAddress,
          style: const TextStyle(color: Colors.white, fontSize: 13),
          decoration: InputDecoration(
            hintText: 'Account Email',
            hintStyle: const TextStyle(color: Color(0xFF52525B), fontSize: 12),
            filled: true,
            fillColor: const Color(0xFF0C0D10),
            prefixIcon: const Icon(Icons.email_outlined, color: Colors.white38, size: 16),
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
          ),
        ),
        const SizedBox(height: 12),

        // Password
        TextFormField(
          controller: _passwordController,
          obscureText: _obscure,
          style: const TextStyle(color: Colors.white, fontSize: 13, fontFamily: 'monospace'),
          decoration: InputDecoration(
            hintText: isConnect ? 'Master Password' : 'Set Master Password (min 8 chars)',
            hintStyle: const TextStyle(color: Color(0xFF52525B), fontSize: 12),
            filled: true,
            fillColor: const Color(0xFF0C0D10),
            prefixIcon: const Icon(Icons.key_rounded, color: Colors.white38, size: 16),
            suffixIcon: IconButton(
              icon: Icon(
                _obscure ? Icons.visibility_outlined : Icons.visibility_off_outlined,
                color: Colors.white38,
                size: 16,
              ),
              onPressed: () => setState(() => _obscure = !_obscure),
            ),
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
          ),
        ),
        const SizedBox(height: 16),

        // Action Button
        SizedBox(
          height: 44,
          child: ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: Colors.white,
              foregroundColor: const Color(0xFF09090B),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
              elevation: 0,
            ),
            onPressed: vault.isLoading ? null : _handleLoginOrInit,
            child: vault.isLoading
                ? const SpinKitThreeBounce(color: Colors.black, size: 18)
                : Text(
                    isConnect ? 'Connect & Decrypt Vault' : 'Create Encrypted Vault',
                    style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
                  ),
          ),
        ),
      ],
    );
  }
}
