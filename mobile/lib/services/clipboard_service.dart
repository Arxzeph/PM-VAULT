import 'dart:async';
import 'package:flutter/services.dart';

class ClipboardService {
  static Timer? _timer;
  static String? _lastCopied;

  /// Copies text to system clipboard and wipes it after [duration] (default: 30 seconds)
  static Future<void> copyWithAutoWipe(
    String text, {
    Duration duration = const Duration(seconds: 30),
    void Function()? onWiped,
  }) async {
    if (text.isEmpty) return;

    _lastCopied = text;
    await Clipboard.setData(ClipboardData(text: text));

    _timer?.cancel();
    _timer = Timer(duration, () async {
      try {
        final data = await Clipboard.getData(Clipboard.kTextPlain);
        if (data?.text == null || data?.text == _lastCopied) {
          await Clipboard.setData(const ClipboardData(text: ''));
          onWiped?.call();
        }
      } catch (_) {
        await Clipboard.setData(const ClipboardData(text: ''));
        onWiped?.call();
      } finally {
        _lastCopied = null;
        _timer = null;
      }
    });
  }
}
