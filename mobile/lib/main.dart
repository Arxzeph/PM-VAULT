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
    debugPrint('Failed to initialize Supabase: $e');
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
      title: 'PM-VAULT',
      debugShowCheckedModeBanner: false,
      theme: ThemeData.dark().copyWith(
        scaffoldBackgroundColor: const Color(0xFF09090B),
        colorScheme: const ColorScheme.dark(
          primary: Colors.white,
          onPrimary: Colors.black,
          secondary: Color(0xFFA1A1AA),
          surface: Color(0xFF121214),
          error: Color(0xFFF43F5E),
        ),
        cardColor: const Color(0xFF121214),
        dialogBackgroundColor: const Color(0xFF121214),
        dividerColor: const Color(0xFF232326),
        textTheme: GoogleFonts.plusJakartaSansTextTheme(ThemeData.dark().textTheme),
      ),
      home: vault.isUnlocked ? const VaultView() : const UnlockScreen(),
    );
  }
}
