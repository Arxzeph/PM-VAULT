import 'package:flutter/material.dart';

class ServiceIcon extends StatelessWidget {
  final String title;
  final String? url;
  final double size;

  const ServiceIcon({
    super.key,
    required this.title,
    this.url,
    this.size = 22,
  });

  static String? _extractDomain(String? url, String title) {
    if (url != null && url.trim().isNotEmpty) {
      try {
        var clean = url.trim();
        if (!clean.startsWith('http://') && !clean.startsWith('https://')) {
          clean = 'https://$clean';
        }
        final uri = Uri.parse(clean);
        if (uri.host.isNotEmpty) {
          return uri.host.replaceFirst(RegExp(r'^www\.'), '');
        }
      } catch (_) {}
    }

    final t = title.toLowerCase().trim();
    if (t.contains('google') || t.contains('gmail')) return 'google.com';
    if (t.contains('github')) return 'github.com';
    if (t.contains('discord')) return 'discord.com';
    if (t.contains('steam')) return 'steampowered.com';
    if (t.contains('spotify')) return 'spotify.com';
    if (t.contains('apple') || t.contains('icloud')) return 'apple.com';
    if (t.contains('microsoft') ||
        t.contains('outlook') ||
        t.contains('live.com') ||
        t.contains('hotmail')) {
      return 'microsoft.com';
    }
    if (t.contains('twitter') || t.contains(' x ') || t == 'x') return 'x.com';
    if (t.contains('amazon')) return 'amazon.com';
    if (t.contains('netflix')) return 'netflix.com';
    if (t.contains('reddit')) return 'reddit.com';
    if (t.contains('youtube')) return 'youtube.com';
    if (t.contains('twitch')) return 'twitch.tv';
    if (t.contains('notion')) return 'notion.so';
    if (t.contains('openai') || t.contains('chatgpt')) return 'openai.com';
    if (t.contains('claude') || t.contains('anthropic')) return 'anthropic.com';
    if (t.contains('proton')) return 'proton.me';
    if (t.contains('telegram')) return 'telegram.org';
    if (t.contains('facebook') || t.contains('meta')) return 'facebook.com';
    if (t.contains('instagram')) return 'instagram.com';
    if (t.contains('linkedin')) return 'linkedin.com';
    if (t.contains('paypal')) return 'paypal.com';

    return null;
  }

  @override
  Widget build(BuildContext context) {
    final domain = _extractDomain(url, title);
    final letter = title.isNotEmpty ? title[0].toUpperCase() : '?';

    final fallback = Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        color: const Color(0xFF27272A),
        borderRadius: BorderRadius.circular(size * 0.28),
      ),
      alignment: Alignment.center,
      child: Text(
        letter,
        style: TextStyle(
          color: const Color(0xFFE4E4E7),
          fontSize: size * 0.5,
          fontWeight: FontWeight.bold,
        ),
      ),
    );

    if (domain == null) return fallback;

    return ClipRRect(
      borderRadius: BorderRadius.circular(size * 0.28),
      child: Image.network(
        'https://www.google.com/s2/favicons?domain=$domain&sz=128',
        width: size,
        height: size,
        fit: BoxFit.cover,
        errorBuilder: (context, error, stackTrace) => fallback,
      ),
    );
  }
}
