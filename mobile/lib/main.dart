import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import 'services/supabase_service.dart';
import 'providers/vault_providers.dart';
import 'ui/unlock_screen.dart';
import 'ui/vault_view.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Initialize Supabase
  try {
    await SupabaseService.initialize();
  } catch (e) {
    print('Failed to initialize Supabase: $e');
  }

  runApp(
    const ProviderScope(
      child: PMVaultApp(),
    ),
  );
}

class PMVaultApp extends ConsumerStatefulWidget {
  const PMVaultApp({super.key});

  @override
  ConsumerState<PMVaultApp> createState() => _PMVaultAppState();
}

class _PMVaultAppState extends ConsumerState<PMVaultApp>
    with WidgetsBindingObserver {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    // Security Hardening: Immediately lock vault when app is backgrounded or minimized
    if (state == AppLifecycleState.paused ||
        state == AppLifecycleState.inactive) {
      final isUnlocked = ref.read(vaultProvider).isUnlocked;
      if (isUnlocked) {
        ref.read(vaultProvider.notifier).lockVault();
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final vault = ref.watch(vaultProvider);

    return MaterialApp(
      title: 'PM Vault',
      debugShowCheckedModeBanner: false,
      theme: ThemeData.dark().copyWith(
        scaffoldBackgroundColor: const Color(0xFF09090B),
        colorScheme: const ColorScheme.dark(
          primary: Color(0xFF10B981),
          secondary: Color(0xFF34D399),
          surface: Color(0xFF121316),
          error: Color(0xFFF43F5E),
        ),
        cardColor: const Color(0xFF121316),
        dialogBackgroundColor: const Color(0xFF121316),
        textTheme: GoogleFonts.interTextTheme(ThemeData.dark().textTheme),
      ),
      home: vault.isUnlocked ? const VaultView() : const UnlockScreen(),
    );
  }
}
