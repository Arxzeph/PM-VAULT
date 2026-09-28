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
  bool _showAdvancedSalt = false;
  String? _localError;
  bool _canCheckBiometrics = false;

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
        backgroundColor: const Color(0xFF0F172A),
        title: const Text('Re-link Vault?', style: TextStyle(color: Colors.white)),
        content: const Text(
          'This will clear the local cache on this phone so you can re-link to your cloud vault. Cloud data in Supabase will NOT be deleted.',
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
            child: const Text('Clear & Re-link', style: TextStyle(color: Colors.white)),
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
      backgroundColor: const Color(0xFF020817),
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 32),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                // App Logo
                Container(
                  width: 64,
                  height: 64,
                  decoration: BoxDecoration(
                    gradient: const LinearGradient(
                      colors: [Color(0xFF6366F1), Color(0xFF06B6D4)],
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                    ),
                    borderRadius: BorderRadius.circular(20),
                    boxShadow: [
                      BoxShadow(
                        color: const Color(0xFF6366F1).withOpacity(0.3),
                        blurRadius: 20,
                        offset: const Offset(0, 8),
                      ),
                    ],
                  ),
                  child: const Icon(Icons.lock_rounded, color: Colors.white, size: 32),
                ),
                const SizedBox(height: 20),

                // Title
                const Text(
                  'PM Vault',
                  style: TextStyle(
                    fontSize: 26,
                    fontWeight: FontWeight.bold,
                    color: Colors.white,
                    letterSpacing: -0.5,
                  ),
                ),
                const SizedBox(height: 6),
                Text(
                  isInit
                      ? 'Your vault is locked. Enter master password.'
                      : 'Zero-Knowledge Personal Password Manager',
                  textAlign: TextAlign.center,
                  style: const TextStyle(fontSize: 13, color: Colors.white60),
                ),
                const SizedBox(height: 28),

                // Error Message
                if (_localError != null || vault.errorMessage != null)
                  Container(
                    margin: const EdgeInsets.only(bottom: 20),
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                    decoration: BoxDecoration(
                      color: const Color(0xFFE11D48).withOpacity(0.15),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: const Color(0xFFE11D48).withOpacity(0.3)),
                    ),
                    child: Row(
                      children: [
                        const Icon(Icons.shield_outlined, color: Color(0xFFF43F5E), size: 18),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Text(
                            _localError ?? vault.errorMessage!,
                            style: const TextStyle(color: Color(0xFFFDA4AF), fontSize: 12),
                          ),
                        ),
                      ],
                    ),
                  ),

                // Card Form
                Container(
                  padding: const EdgeInsets.all(24),
                  decoration: BoxDecoration(
                    color: const Color(0xFF0F172A),
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(color: const Color(0xFF1E293B)),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      if (!isInit) ...[
                        TextField(
                          controller: _emailController,
                          keyboardType: TextInputType.emailAddress,
                          style: const TextStyle(color: Colors.white),
                          decoration: InputDecoration(
                            labelText: 'Account Email',
                            hintText: 'your.email@example.com',
                            hintStyle: const TextStyle(color: Colors.white38, fontSize: 13),
                            labelStyle: const TextStyle(color: Colors.white60, fontSize: 13),
                            prefixIcon: const Icon(Icons.email_outlined, color: Color(0xFF6366F1), size: 18),
                            filled: true,
                            fillColor: const Color(0xFF020817),
                            border: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(12),
                              borderSide: const BorderSide(color: Color(0xFF1E293B)),
                            ),
                          ),
                        ),
                        const SizedBox(height: 16),
                      ],

                      if (isInit && vault.email != null)
                        Container(
                          margin: const EdgeInsets.only(bottom: 16),
                          padding: const EdgeInsets.all(12),
                          decoration: BoxDecoration(
                            color: const Color(0xFF020817),
                            borderRadius: BorderRadius.circular(12),
                            border: Border.all(color: const Color(0xFF1E293B)),
                          ),
                          child: Row(
                            children: [
                              const Icon(Icons.email_outlined, color: Colors.white54, size: 16),
                              const SizedBox(width: 8),
                              Expanded(
                                child: Text(
                                  vault.email!,
                                  style: const TextStyle(color: Colors.white70, fontSize: 13),
                                  overflow: TextOverflow.ellipsis,
                                ),
                              ),
                            ],
                          ),
                        ),

                      TextField(
                        controller: _passwordController,
                        obscureText: _obscure,
                        autocorrect: false,
                        enableSuggestions: false,
                        textCapitalization: TextCapitalization.none,
                        style: const TextStyle(color: Colors.white),
                        decoration: InputDecoration(
                          labelText: 'Master Password',
                          labelStyle: const TextStyle(color: Colors.white60, fontSize: 13),
                          prefixIcon: const Icon(Icons.vpn_key_rounded, color: Color(0xFF6366F1), size: 18),
                          suffixIcon: IconButton(
                            icon: Icon(
                              _obscure ? Icons.visibility_outlined : Icons.visibility_off_outlined,
                              color: Colors.white54,
                              size: 18,
                            ),
                            onPressed: () => setState(() => _obscure = !_obscure),
                          ),
                          filled: true,
                          fillColor: const Color(0xFF020817),
                          border: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(12),
                            borderSide: const BorderSide(color: Color(0xFF1E293B)),
                          ),
                        ),
                      ),
                      const SizedBox(height: 16),

                      if (!isInit) ...[
                        InkWell(
                          onTap: () => setState(() => _showAdvancedSalt = !_showAdvancedSalt),
                          child: Row(
                            children: [
                              Icon(
                                _showAdvancedSalt ? Icons.expand_less : Icons.expand_more,
                                color: const Color(0xFF6366F1),
                                size: 18,
                              ),
                              const SizedBox(width: 4),
                              const Text(
                                'Advanced: Master Salt',
                                style: TextStyle(color: Color(0xFF6366F1), fontSize: 12),
                              ),
                            ],
                          ),
                        ),
                        if (_showAdvancedSalt) ...[
                          const SizedBox(height: 8),
                          TextField(
                            controller: _manualSaltController,
                            style: const TextStyle(color: Colors.white, fontFamily: 'monospace', fontSize: 12),
                            decoration: InputDecoration(
                              labelText: 'Master Salt',
                              labelStyle: const TextStyle(color: Colors.white60, fontSize: 12),
                              helperText: 'Auto-detected from cloud. Only modify if offline or custom.',
                              helperStyle: const TextStyle(color: Colors.white38, fontSize: 11),
                              filled: true,
                              fillColor: const Color(0xFF020817),
                              border: OutlineInputBorder(
                                borderRadius: BorderRadius.circular(12),
                                borderSide: const BorderSide(color: Color(0xFF1E293B)),
                              ),
                            ),
                          ),
                        ],
                        const SizedBox(height: 16),
                      ],

                      ElevatedButton(
                        style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(0xFF6366F1),
                          padding: const EdgeInsets.symmetric(vertical: 14),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                          elevation: 4,
                        ),
                        onPressed: vault.isLoading
                            ? null
                            : (isInit ? _handleUnlock : _handleLoginOrInit),
                        child: vault.isLoading
                            ? const Row(
                                mainAxisAlignment: MainAxisAlignment.center,
                                children: [
                                  SpinKitThreeBounce(color: Colors.white, size: 18),
                                  SizedBox(width: 10),
                                  Text('Deriving Argon2id Key...', style: TextStyle(color: Colors.white)),
                                ],
                              )
                            : Text(
                                isInit ? 'Unlock Vault' : 'Connect & Sync Vault',
                                style: const TextStyle(
                                  color: Colors.white,
                                  fontWeight: FontWeight.bold,
                                  fontSize: 15,
                                ),
                              ),
                      ),

                      // Biometric Unlock Button
                      if (isInit && _canCheckBiometrics && vault.hasBiometricKey) ...[
                        const SizedBox(height: 12),
                        OutlinedButton.icon(
                          style: OutlinedButton.styleFrom(
                            side: const BorderSide(color: Color(0xFF6366F1)),
                            padding: const EdgeInsets.symmetric(vertical: 12),
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                          ),
                          onPressed: _handleBiometricUnlock,
                          icon: const Icon(Icons.fingerprint_rounded, color: Color(0xFF6366F1), size: 20),
                          label: const Text(
                            'Unlock with Fingerprint',
                            style: TextStyle(color: Colors.white, fontWeight: FontWeight.w600),
                          ),
                        ),
                      ],

                      if (isInit) ...[
                        const SizedBox(height: 14),
                        TextButton(
                          onPressed: _handleResetVault,
                          child: const Text(
                            'Re-link Account / Reset Local Data',
                            style: TextStyle(color: Colors.white38, fontSize: 12),
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
                const SizedBox(height: 24),

                // Footer Guarantee
                const Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(Icons.verified_user_rounded, color: Color(0xFF10B981), size: 16),
                    SizedBox(width: 6),
                    Text(
                      'Client-Side Argon2id & XChaCha20-Poly1305',
                      style: TextStyle(color: Colors.white54, fontSize: 12),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
