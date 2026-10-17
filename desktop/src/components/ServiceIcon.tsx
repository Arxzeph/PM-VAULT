import React, { useState, useEffect } from "react";
import { KeyRound } from "lucide-react";

interface ServiceIconProps {
  title?: string | null;
  url?: string | null;
  className?: string;
  size?: number;
}

// Extract clean domain from url or service title
export function extractDomain(url?: string | null, title?: string | null): string | null {
  if (url && url.trim()) {
    try {
      let clean = url.trim();
      if (!clean.startsWith("http://") && !clean.startsWith("https://")) {
        clean = "https://" + clean;
      }
      const parsed = new URL(clean);
      let hostname = parsed.hostname.toLowerCase().replace(/^www\./, "");
      if (hostname.length > 2 && hostname.includes(".")) {
        return hostname;
      }
    } catch {
      // ignore
    }
  }

  if (title) {
    const t = title.toLowerCase().trim();

    // Check if title itself is a domain (e.g. "github.com", "amazon.in")
    if (t.includes(".") && !t.includes(" ") && !t.startsWith(".") && !t.endsWith(".")) {
      return t.replace(/^https?:\/\//, "").replace(/^www\./, "");
    }

    // Common services mapping
    if (t.includes("google") || t.includes("gmail") || t.includes("drive")) return "google.com";
    if (t.includes("github")) return "github.com";
    if (t.includes("gitlab")) return "gitlab.com";
    if (t.includes("bitbucket")) return "bitbucket.org";
    if (t.includes("discord")) return "discord.com";
    if (t.includes("steam")) return "steampowered.com";
    if (t.includes("spotify")) return "spotify.com";
    if (t.includes("apple") || t.includes("icloud")) return "apple.com";
    if (t.includes("microsoft") || t.includes("outlook") || t.includes("live.com") || t.includes("office")) return "microsoft.com";
    if (t.includes("twitter") || t.includes(" x ") || t === "x") return "x.com";
    if (t.includes("amazon") || t.includes("aws")) return "amazon.com";
    if (t.includes("netflix")) return "netflix.com";
    if (t.includes("reddit")) return "reddit.com";
    if (t.includes("youtube")) return "youtube.com";
    if (t.includes("twitch")) return "twitch.tv";
    if (t.includes("notion")) return "notion.so";
    if (t.includes("openai") || t.includes("chatgpt")) return "openai.com";
    if (t.includes("claude") || t.includes("anthropic")) return "anthropic.com";
    if (t.includes("proton")) return "proton.me";
    if (t.includes("telegram")) return "telegram.org";
    if (t.includes("facebook") || t.includes("meta")) return "facebook.com";
    if (t.includes("instagram")) return "instagram.com";
    if (t.includes("linkedin")) return "linkedin.com";
    if (t.includes("paypal")) return "paypal.com";
    if (t.includes("stripe")) return "stripe.com";
    if (t.includes("cloudflare")) return "cloudflare.com";
    if (t.includes("vercel")) return "vercel.com";
    if (t.includes("supabase")) return "supabase.com";
    if (t.includes("digitalocean")) return "digitalocean.com";
    if (t.includes("docker")) return "docker.com";
    if (t.includes("slack")) return "slack.com";
    if (t.includes("zoom")) return "zoom.us";
    if (t.includes("dropbox")) return "dropbox.com";
    if (t.includes("figma")) return "figma.com";
    if (t.includes("adobe")) return "adobe.com";
    if (t.includes("linear")) return "linear.app";
    if (t.includes("coinbase")) return "coinbase.com";
    if (t.includes("binance")) return "binance.com";
    if (t.includes("kraken")) return "kraken.com";
    if (t.includes("epic games") || t.includes("epicgames")) return "epicgames.com";
    if (t.includes("riot") || t.includes("valorant") || t.includes("league of legends")) return "riotgames.com";
    if (t.includes("playstation") || t.includes("sony")) return "playstation.com";
    if (t.includes("xbox")) return "xbox.com";
    if (t.includes("wikipedia")) return "wikipedia.org";
    if (t.includes("pinterest")) return "pinterest.com";
    if (t.includes("tiktok")) return "tiktok.com";
    if (t.includes("whatsapp")) return "whatsapp.com";
    if (t.includes("signal")) return "signal.org";
  }

  return null;
}

export const ServiceIcon: React.FC<ServiceIconProps> = ({
  title = "",
  url = "",
  className = "",
  size = 18,
}) => {
  const [imgError, setImgError] = useState(false);
  const [useFallbackService, setUseFallbackService] = useState(false);
  const domain = extractDomain(url, title);
  const cleanTitle = (title || "").trim();
  const initial = cleanTitle ? cleanTitle[0].toUpperCase() : null;

  // Reset error states whenever domain changes
  useEffect(() => {
    setImgError(false);
    setUseFallbackService(false);
  }, [domain]);

  const handleImageError = () => {
    if (!useFallbackService && domain) {
      setUseFallbackService(true);
    } else {
      setImgError(true);
    }
  };

  const faviconUrl = domain
    ? useFallbackService
      ? `https://icons.duckduckgo.com/ip3/${domain}.ico`
      : `https://www.google.com/s2/favicons?domain=${domain}&sz=128`
    : null;

  // If we have a domain and haven't errored out, render high-res website favicon
  if (faviconUrl && !imgError) {
    return (
      <div
        className={`relative flex items-center justify-center bg-[#141416] border border-[#27272A] overflow-hidden shadow-sm shrink-0 ${className}`}
      >
        <img
          src={faviconUrl}
          alt={title || domain || "Service"}
          onError={handleImageError}
          className="object-contain rounded-[4px]"
          style={{ width: size, height: size }}
          loading="lazy"
        />
      </div>
    );
  }

  // Clean unslop obsidian monogram fallback
  return (
    <div
      className={`relative flex items-center justify-center bg-[#141416] border border-[#27272A] text-zinc-300 font-mono font-bold shadow-sm shrink-0 select-none ${className}`}
    >
      {initial ? (
        <span style={{ fontSize: Math.max(10, size * 0.75) }}>{initial}</span>
      ) : (
        <KeyRound className="text-zinc-500" style={{ width: size * 0.8, height: size * 0.8 }} />
      )}
    </div>
  );
};

export default ServiceIcon;
