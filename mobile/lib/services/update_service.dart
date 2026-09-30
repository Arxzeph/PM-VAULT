import 'dart:convert';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:open_filex/open_filex.dart';
import 'package:package_info_plus/package_info_plus.dart';
import 'package:path_provider/path_provider.dart';

class UpdateInfo {
  final String version;
  final String releaseNotes;
  final String downloadUrl;
  final String htmlUrl;
  final bool hasUpdate;

  UpdateInfo({
    required this.version,
    required this.releaseNotes,
    required this.downloadUrl,
    required this.htmlUrl,
    required this.hasUpdate,
  });
}

class UpdateService {
  static const String repo = 'Arxzeph/PM-VAULT';
  static const String githubApiUrl =
      'https://api.github.com/repos/$repo/releases/latest';

  /// Check if a newer version is available on GitHub Releases
  static Future<UpdateInfo?> checkUpdate() async {
    try {
      final packageInfo = await PackageInfo.fromPlatform();
      final currentVersion = packageInfo.version;

      final response = await http.get(
        Uri.parse(githubApiUrl),
        headers: {
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'PM-Vault-Mobile-App',
        },
      ).timeout(const Duration(seconds: 10));

      if (response.statusCode != 200) {
        return null;
      }

      final data = jsonDecode(response.body) as Map<String, dynamic>;
      final rawTag = (data['tag_name'] as String? ?? '').replaceFirst('v', '');
      final releaseNotes =
          data['body'] as String? ?? 'No release notes provided.';
      final htmlUrl =
          data['html_url'] as String? ?? 'https://github.com/$repo/releases';

      // Find APK asset
      String apkUrl = '';
      final assets = data['assets'] as List<dynamic>? ?? [];
      for (final asset in assets) {
        final name = (asset['name'] as String? ?? '').toLowerCase();
        if (name.endsWith('.apk')) {
          apkUrl = asset['browser_download_url'] as String? ?? '';
          break;
        }
      }

      final isNewer = _isVersionGreater(rawTag, currentVersion);

      return UpdateInfo(
        version: rawTag,
        releaseNotes: releaseNotes,
        downloadUrl: apkUrl,
        htmlUrl: htmlUrl,
        hasUpdate: isNewer,
      );
    } catch (e) {
      debugPrint('Error checking update: $e');
      return null;
    }
  }

  /// Semver comparison
  static bool _isVersionGreater(String remote, String local) {
    if (remote.isEmpty) return false;
    try {
      final rParts =
          remote.split('.').map((p) => int.tryParse(p) ?? 0).toList();
      final lParts = local.split('.').map((p) => int.tryParse(p) ?? 0).toList();

      while (rParts.length < 3) {
        rParts.add(0);
      }
      while (lParts.length < 3) {
        lParts.add(0);
      }

      for (int i = 0; i < 3; i++) {
        if (rParts[i] > lParts[i]) return true;
        if (rParts[i] < lParts[i]) return false;
      }
      return false;
    } catch (_) {
      return false;
    }
  }

  /// Download APK with streaming progress and invoke package installer
  static Future<void> downloadAndInstallApk({
    required String downloadUrl,
    required void Function(double progress) onProgress,
    required void Function(String error) onError,
  }) async {
    try {
      final client = http.Client();
      final request = http.Request('GET', Uri.parse(downloadUrl));
      request.headers['User-Agent'] = 'PM-Vault-Mobile-App';

      final response = await client.send(request);

      if (response.statusCode != 200) {
        onError('Failed to download update (HTTP ${response.statusCode})');
        return;
      }

      final contentLength = response.contentLength ?? 0;
      final tempDir = await getTemporaryDirectory();
      final filePath = '${tempDir.path}/pm_vault_update.apk';
      final file = File(filePath);

      if (await file.exists()) {
        await file.delete();
      }

      final sink = file.openWrite();
      int received = 0;

      await for (final chunk in response.stream) {
        received += chunk.length;
        sink.add(chunk);
        if (contentLength > 0) {
          onProgress(received / contentLength);
        }
      }

      await sink.flush();
      await sink.close();
      client.close();

      onProgress(1.0);

      // Open the downloaded APK to trigger the Android package installer
      final result = await OpenFilex.open(filePath);
      if (result.type != ResultType.done) {
        onError('Could not open installer: ${result.message}');
      }
    } catch (e) {
      onError('Update failed: $e');
    }
  }

  /// Interactive Update Dialog
  static Future<void> showUpdateDialog(BuildContext context,
      {bool silentIfUpToDate = false}) async {
    if (!context.mounted) return;

    // Show loading indicator if not silent
    if (!silentIfUpToDate) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Row(
            children: [
              SizedBox(
                width: 18,
                height: 18,
                child: CircularProgressIndicator(
                    strokeWidth: 2, color: Colors.white),
              ),
              SizedBox(width: 14),
              Text('Checking for updates...',
                  style: TextStyle(color: Colors.white)),
            ],
          ),
          backgroundColor: Color(0xFF1E293B),
          duration: Duration(seconds: 2),
        ),
      );
    }

    final update = await checkUpdate();

    if (!context.mounted) return;

    if (update == null || !update.hasUpdate) {
      if (!silentIfUpToDate) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Row(
              children: [
                Icon(Icons.check_circle_rounded,
                    color: Color(0xFF10B981), size: 20),
                SizedBox(width: 12),
                Text('PM Vault is up to date (V2.0.0)',
                    style: TextStyle(color: Colors.white)),
              ],
            ),
            backgroundColor: Color(0xFF0F172A),
            duration: Duration(seconds: 3),
          ),
        );
      }
      return;
    }

    // New update dialog
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (ctx) => _UpdatePromptDialog(update: update),
    );
  }
}

class _UpdatePromptDialog extends StatefulWidget {
  final UpdateInfo update;

  const _UpdatePromptDialog({required this.update});

  @override
  State<_UpdatePromptDialog> createState() => _UpdatePromptDialogState();
}

class _UpdatePromptDialogState extends State<_UpdatePromptDialog> {
  bool _isDownloading = false;
  double _progress = 0.0;
  String? _errorMessage;

  void _startDownload() {
    setState(() {
      _isDownloading = true;
      _errorMessage = null;
      _progress = 0.0;
    });

    UpdateService.downloadAndInstallApk(
      downloadUrl: widget.update.downloadUrl,
      onProgress: (p) {
        if (mounted) setState(() => _progress = p);
      },
      onError: (err) {
        if (mounted) {
          setState(() {
            _isDownloading = false;
            _errorMessage = err;
          });
        }
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      backgroundColor: const Color(0xFF131722),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(20),
        side: BorderSide(color: Colors.cyanAccent.withOpacity(0.3), width: 1.2),
      ),
      title: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: Colors.cyanAccent.withOpacity(0.12),
              borderRadius: BorderRadius.circular(10),
            ),
            child: const Icon(Icons.system_update_rounded,
                color: Colors.cyanAccent, size: 24),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              'Update Available (v${widget.update.version})',
              style: const TextStyle(
                color: Colors.white,
                fontSize: 18,
                fontWeight: FontWeight.bold,
              ),
            ),
          ),
        ],
      ),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'A new version of PM Vault is available with enhanced security and improvements.',
            style: TextStyle(color: Color(0xFF94A3B8), fontSize: 13),
          ),
          const SizedBox(height: 12),
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: const Color(0xFF0F172A),
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: Colors.white.withOpacity(0.08)),
            ),
            constraints: const BoxConstraints(maxHeight: 140),
            child: SingleChildScrollView(
              child: Text(
                widget.update.releaseNotes,
                style: const TextStyle(
                    color: Color(0xFFCBD5E1), fontSize: 12, height: 1.4),
              ),
            ),
          ),
          if (_errorMessage != null) ...[
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: Colors.redAccent.withOpacity(0.12),
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: Colors.redAccent.withOpacity(0.3)),
              ),
              child: Text(
                _errorMessage!,
                style: const TextStyle(color: Colors.redAccent, fontSize: 12),
              ),
            ),
          ],
          if (_isDownloading) ...[
            const SizedBox(height: 16),
            ClipRRect(
              borderRadius: BorderRadius.circular(6),
              child: LinearProgressIndicator(
                value: _progress > 0 ? _progress : null,
                backgroundColor: const Color(0xFF1E293B),
                valueColor:
                    const AlwaysStoppedAnimation<Color>(Colors.cyanAccent),
                minHeight: 8,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              'Downloading: ${(_progress * 100).toInt()}%',
              style: const TextStyle(color: Color(0xFF94A3B8), fontSize: 12),
            ),
          ],
        ],
      ),
      actions: [
        if (!_isDownloading)
          TextButton(
            onPressed: () => Navigator.of(context).pop(),
            child:
                const Text('Later', style: TextStyle(color: Color(0xFF64748B))),
          ),
        ElevatedButton(
          onPressed: _isDownloading ? null : _startDownload,
          style: ElevatedButton.styleFrom(
            backgroundColor: Colors.cyanAccent,
            foregroundColor: Colors.black,
            shape:
                RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
          ),
          child: Text(_isDownloading ? 'Updating...' : 'Update Now'),
        ),
      ],
    );
  }
}
