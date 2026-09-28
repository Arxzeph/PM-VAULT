import React, { useState } from "react";
import { Globe, KeyRound } from "lucide-react";

interface ServiceIconProps {
  title?: string;
  url?: string;
  className?: string;
  size?: number;
}

// Extract domain from url or service title
function extractDomain(url?: string, title?: string): string | null {
  if (url && url.trim()) {
    try {
      let clean = url.trim();
      if (!clean.startsWith("http://") && !clean.startsWith("https://")) {
        clean = "https://" + clean;
      }
      const parsed = new URL(clean);
      return parsed.hostname.replace(/^www\./, "");
    } catch {
      // ignore
    }
  }

  if (title) {
    const t = title.toLowerCase().trim();
    if (t.includes("google") || t.includes("gmail")) return "google.com";
    if (t.includes("github")) return "github.com";
    if (t.includes("discord")) return "discord.com";
    if (t.includes("steam")) return "steampowered.com";
    if (t.includes("spotify")) return "spotify.com";
    if (t.includes("apple") || t.includes("icloud")) return "apple.com";
    if (t.includes("microsoft") || t.includes("outlook") || t.includes("live.com")) return "microsoft.com";
    if (t.includes("twitter") || t.includes(" x ") || t === "x") return "x.com";
    if (t.includes("amazon")) return "amazon.com";
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
  }

  return null;
}

export const ServiceIcon: React.FC<ServiceIconProps> = ({
  title = "",
  url = "",
  className = "",
  size = 20,
}) => {
  const [imgError, setImgError] = useState(false);
  const domain = extractDomain(url, title);
  const initial = title.trim() ? title.trim()[0].toUpperCase() : "?";

  // Monogram color generation based on title character
  const getGradient = (char: string) => {
    const gradients = [
      "from-blue-600/30 to-indigo-600/30 text-blue-300 border-blue-500/20",
      "from-emerald-600/30 to-teal-600/30 text-emerald-300 border-emerald-500/20",
      "from-violet-600/30 to-purple-600/30 text-violet-300 border-violet-500/20",
      "from-amber-600/30 to-orange-600/30 text-amber-300 border-amber-500/20",
      "from-rose-600/30 to-pink-600/30 text-rose-300 border-rose-500/20",
      "from-cyan-600/30 to-sky-600/30 text-cyan-300 border-cyan-500/20",
    ];
    const code = char.charCodeAt(0) || 0;
    return gradients[code % gradients.length];
  };

  // If we have a domain and favicon didn't error, render high-res Google favicon
  if (domain && !imgError) {
    const faviconUrl = `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
    return (
      <div
        className={`relative flex items-center justify-center rounded-xl bg-zinc-900 border border-zinc-800/80 overflow-hidden shadow-sm shrink-0 ${className}`}
        style={{ width: size + 16, height: size + 16 }}
      >
        <img
          src={faviconUrl}
          alt={title || domain}
          onError={() => setImgError(true)}
          className="object-contain rounded-md"
          style={{ width: size, height: size }}
          loading="lazy"
        />
      </div>
    );
  }

  // Linear / Raycast Style Monogram Fallback
  return (
    <div
      className={`relative flex items-center justify-center rounded-xl bg-gradient-to-br border font-medium font-mono text-xs shadow-sm shrink-0 ${getGradient(
        initial
      )} ${className}`}
      style={{ width: size + 16, height: size + 16 }}
    >
      <span>{initial}</span>
    </div>
  );
};
