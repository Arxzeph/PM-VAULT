import 'package:flutter/material.dart';

class ServiceIcon extends StatefulWidget {
  final String title;
  final String? url;
  final double size;

  const ServiceIcon({
    super.key,
    required this.title,
    this.url,
    this.size = 22,
  });

  static String? extractDomain(String? url, String title) {
    if (url != null && url.trim().isNotEmpty) {
      try {
        var clean = url.trim();
        if (!clean.startsWith('http://') && !clean.startsWith('https://')) {
          clean = 'https://$clean';
        }
        final uri = Uri.parse(clean);
        if (uri.host.isNotEmpty && uri.host.contains('.')) {
          return uri.host.replaceFirst(RegExp(r'^www\.'), '');
        }
      } catch (_) {}
    }

    final t = title.toLowerCase().trim();

    // Check if title itself looks like a domain
    if (t.contains('.') && !t.contains(' ') && !t.startsWith('.') && !t.endsWith('.')) {
      return t.replaceAll(RegExp(r'^https?:\/\/'), '').replaceAll(RegExp(r'^www\.'), '');
    }

    // Common brand services
    if (t.contains('google') || t.contains('gmail') || t.contains('drive')) return 'google.com';
    if (t.contains('github')) return 'github.com';
    if (t.contains('gitlab')) return 'gitlab.com';
    if (t.contains('bitbucket')) return 'bitbucket.org';
    if (t.contains('discord')) return 'discord.com';
    if (t.contains('steam')) return 'steampowered.com';
    if (t.contains('spotify')) return 'spotify.com';
    if (t.contains('apple') || t.contains('icloud')) return 'apple.com';
    if (t.contains('microsoft') ||
        t.contains('outlook') ||
        t.contains('live.com') ||
        t.contains('hotmail') ||
        t.contains('office')) {
      return 'microsoft.com';
    }
    if (t.contains('twitter') || t.contains(' x ') || t == 'x') return 'x.com';
    if (t.contains('amazon') || t.contains('aws')) return 'amazon.com';
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
    if (t.contains('stripe')) return 'stripe.com';
    if (t.contains('cloudflare')) return 'cloudflare.com';
    if (t.contains('vercel')) return 'vercel.com';
    if (t.contains('supabase')) return 'supabase.com';
    if (t.contains('digitalocean')) return 'digitalocean.com';
    if (t.contains('docker')) return 'docker.com';
    if (t.contains('slack')) return 'slack.com';
    if (t.contains('zoom')) return 'zoom.us';
    if (t.contains('dropbox')) return 'dropbox.com';
    if (t.contains('figma')) return 'figma.com';
    if (t.contains('adobe')) return 'adobe.com';
    if (t.contains('linear')) return 'linear.app';
    if (t.contains('coinbase')) return 'coinbase.com';
    if (t.contains('binance')) return 'binance.com';
    if (t.contains('kraken')) return 'kraken.com';
    if (t.contains('epic games') || t.contains('epicgames')) return 'epicgames.com';
    if (t.contains('riot') || t.contains('valorant') || t.contains('league of legends')) return 'riotgames.com';
    if (t.contains('playstation') || t.contains('sony')) return 'playstation.com';
    if (t.contains('xbox')) return 'xbox.com';
    if (t.contains('wikipedia')) return 'wikipedia.org';
    if (t.contains('pinterest')) return 'pinterest.com';
    if (t.contains('tiktok')) return 'tiktok.com';
    if (t.contains('whatsapp')) return 'whatsapp.com';
    if (t.contains('signal')) return 'signal.org';

    return null;
  }

  @override
  State<ServiceIcon> createState() => _ServiceIconState();
}

class _ServiceIconState extends State<ServiceIcon> {
  bool _useFallback = false;
  bool _failed = false;

  @override
  void didUpdateWidget(covariant ServiceIcon oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.title != widget.title || oldWidget.url != widget.url) {
      setState(() {
        _useFallback = false;
        _failed = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final domain = ServiceIcon.extractDomain(widget.url, widget.title);
    final cleanTitle = widget.title.trim();
    final letter = cleanTitle.isNotEmpty ? cleanTitle[0].toUpperCase() : '?';

    final fallback = Container(
      width: widget.size,
      height: widget.size,
      decoration: BoxDecoration(
        color: const Color(0xFF18181B),
        borderRadius: BorderRadius.circular(widget.size * 0.28),
        border: Border.all(color: const Color(0xFF27272A)),
      ),
      alignment: Alignment.center,
      child: Text(
        letter,
        style: TextStyle(
          color: const Color(0xFFE4E4E7),
          fontSize: widget.size * 0.46,
          fontWeight: FontWeight.bold,
          fontFamily: 'monospace',
        ),
      ),
    );

    if (domain == null || _failed) return fallback;

    final iconUrl = _useFallback
        ? 'https://icons.duckduckgo.com/ip3/$domain.ico'
        : 'https://www.google.com/s2/favicons?domain=$domain&sz=128';

    return Container(
      width: widget.size,
      height: widget.size,
      decoration: BoxDecoration(
        color: const Color(0xFF141416),
        borderRadius: BorderRadius.circular(widget.size * 0.28),
        border: Border.all(color: const Color(0xFF27272A)),
      ),
      clipBehavior: Clip.antiAlias,
      alignment: Alignment.center,
      child: Image.network(
        iconUrl,
        width: widget.size * 0.85,
        height: widget.size * 0.85,
        fit: BoxFit.contain,
        errorBuilder: (context, error, stackTrace) {
          if (!_useFallback) {
            WidgetsBinding.instance.addPostFrameCallback((_) {
              if (mounted) setState(() => _useFallback = true);
            });
            return fallback;
          } else {
            WidgetsBinding.instance.addPostFrameCallback((_) {
              if (mounted) setState(() => _failed = true);
            });
            return fallback;
          }
        },
      ),
    );
  }
}
