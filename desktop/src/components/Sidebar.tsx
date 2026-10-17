import React, { useState, useEffect } from "react";
import { motion } from "motion/react";
import { VaultCategory } from "../types";
import { getStoredAvatar, subscribeAvatarChange } from "../services/profile";
import { ShinyText } from "./reactbits";
import {
  Shield,
  KeyRound,
  Archive,
  Trash2,
  FolderOpen,
  Settings,
  RefreshCw,
  Lock,
  ChevronDown,
  Sparkles,
} from "lucide-react";

interface SidebarProps {
  activeCategory: VaultCategory;
  onSelectCategory: (cat: VaultCategory) => void;
  counts: {
    all: number;
    logins: number;
    cards: number;
    ids: number;
    archive: number;
    trash: number;
  };
  syncStatus: "synced" | "syncing" | "offline" | "error";
  onOpenSettings: () => void;
  onTriggerSync: () => void;
  onLockVault: () => void;
  onOpenGenerator?: () => void;
  username?: string;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeCategory,
  onSelectCategory,
  counts,
  syncStatus,
  onOpenSettings,
  onTriggerSync,
  onLockVault,
  onOpenGenerator,
  username,
}) => {
  const [avatarUrl, setAvatarUrl] = useState<string | null>(() => getStoredAvatar());

  useEffect(() => {
    setAvatarUrl(getStoredAvatar());
    const unsub = subscribeAvatarChange((newAvatar) => {
      setAvatarUrl(newAvatar);
    });
    return unsub;
  }, []);

  return (
    <aside className="w-60 flex-shrink-0 bg-[#000000] border-r border-[#232326] flex flex-col justify-between h-screen p-3.5 select-none relative z-20">
      {/* Top Header & Vault Selector */}
      <div className="flex flex-col gap-3.5">
        {/* Brand Header */}
        <div className="flex items-center gap-2.5 px-1 py-1">
          <div className="w-8 h-8 rounded-lg bg-[#161618] border border-[#27272A] flex items-center justify-center text-white shadow-sm">
            <Shield className="w-4 h-4 text-white" />
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="font-display font-bold text-sm tracking-wider text-white">PM-VAULT</span>
              <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-400 border border-zinc-700 font-medium">
                v2.4
              </span>
            </div>
            <span className="text-[9px] font-mono tracking-widest text-zinc-500 uppercase">PASSWORD ENCLAVE</span>
          </div>
        </div>

        {/* Active Vault Card / Selector */}
        <div
          onClick={onOpenSettings}
          className="bg-[#121214] border border-[#232326] hover:border-zinc-700 rounded-xl p-2.5 flex items-center justify-between hover:bg-[#161618] transition-all cursor-pointer group"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-6 h-6 rounded-md bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-400 overflow-hidden flex-shrink-0">
              {avatarUrl ? (
                <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                <Lock className="w-3 h-3 text-zinc-400" />
              )}
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-xs font-semibold text-zinc-200 truncate group-hover:text-white font-sans">
                {username ? `${username}'s Vault` : "Personal Vault"}
              </span>
              <span className="text-[10px] font-mono text-zinc-500">
                {counts.all} passwords
              </span>
            </div>
          </div>
          <ChevronDown className="w-3.5 h-3.5 text-zinc-500 group-hover:text-zinc-300 transition-colors" />
        </div>

        {/* Navigation Section */}
        <nav className="flex flex-col gap-1 mt-1">
          {/* All Passwords */}
          <motion.button
            whileHover={{ x: 1 }}
            whileTap={{ scale: 0.99 }}
            onClick={() => onSelectCategory("all")}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-all cursor-pointer font-sans ${
              activeCategory === "all"
                ? "bg-[#1C1C20] border border-zinc-700 text-white font-semibold shadow-sm"
                : "text-zinc-400 hover:text-white hover:bg-zinc-900 border border-transparent"
            }`}
          >
            <div className="flex items-center gap-2.5">
              <FolderOpen className={`w-3.5 h-3.5 ${activeCategory === "all" ? "text-white" : "text-zinc-500"}`} />
              <span>All Passwords</span>
            </div>
            <span
              className={`text-[10px] font-mono px-1.5 py-0.2 rounded ${
                activeCategory === "all" ? "bg-zinc-800 text-white font-bold" : "bg-zinc-900 text-zinc-500"
              }`}
            >
              {counts.all}
            </span>
          </motion.button>

          {/* Active Logins */}
          <motion.button
            whileHover={{ x: 1 }}
            whileTap={{ scale: 0.99 }}
            onClick={() => onSelectCategory("logins")}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-all cursor-pointer font-sans ${
              activeCategory === "logins"
                ? "bg-[#1C1C20] border border-zinc-700 text-white font-semibold shadow-sm"
                : "text-zinc-400 hover:text-white hover:bg-zinc-900 border border-transparent"
            }`}
          >
            <div className="flex items-center gap-2.5">
              <KeyRound className={`w-3.5 h-3.5 ${activeCategory === "logins" ? "text-white" : "text-zinc-500"}`} />
              <span>Active Logins</span>
            </div>
            <span
              className={`text-[10px] font-mono px-1.5 py-0.2 rounded ${
                activeCategory === "logins" ? "bg-zinc-800 text-white font-bold" : "bg-zinc-900 text-zinc-500"
              }`}
            >
              {counts.logins}
            </span>
          </motion.button>

          {/* Quick-Access Password Generator */}
          {onOpenGenerator && (
            <motion.button
              whileHover={{ x: 1 }}
              whileTap={{ scale: 0.99 }}
              onClick={onOpenGenerator}
              className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-all cursor-pointer text-zinc-300 hover:text-white hover:bg-zinc-900 border border-zinc-800 bg-[#121214] my-1 font-sans"
            >
              <div className="flex items-center gap-2.5">
                <Sparkles className="w-3.5 h-3.5 text-zinc-400" />
                <span>Password Generator</span>
              </div>
              <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-400">
                TOOL
              </span>
            </motion.button>
          )}

          {/* Divider */}
          <div className="border-t border-[#232326] my-1.5" />

          {/* Archive */}
          <motion.button
            whileHover={{ x: 1 }}
            whileTap={{ scale: 0.99 }}
            onClick={() => onSelectCategory("archive")}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-all cursor-pointer font-sans ${
              activeCategory === "archive"
                ? "bg-[#1C1C20] border border-zinc-700 text-white font-semibold shadow-sm"
                : "text-zinc-400 hover:text-white hover:bg-zinc-900 border border-transparent"
            }`}
          >
            <div className="flex items-center gap-2.5">
              <Archive className={`w-3.5 h-3.5 ${activeCategory === "archive" ? "text-white" : "text-zinc-500"}`} />
              <span>Archive</span>
            </div>
            <span
              className={`text-[10px] font-mono px-1.5 py-0.2 rounded ${
                activeCategory === "archive" ? "bg-zinc-800 text-white font-bold" : "bg-zinc-900 text-zinc-500"
              }`}
            >
              {counts.archive}
            </span>
          </motion.button>

          {/* Trash */}
          <motion.button
            whileHover={{ x: 1 }}
            whileTap={{ scale: 0.99 }}
            onClick={() => onSelectCategory("trash")}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-all cursor-pointer font-sans ${
              activeCategory === "trash"
                ? "bg-red-950/40 border border-red-800/60 text-red-300 font-semibold"
                : "text-zinc-400 hover:text-white hover:bg-zinc-900 border border-transparent"
            }`}
          >
            <div className="flex items-center gap-2.5">
              <Trash2 className={`w-3.5 h-3.5 ${activeCategory === "trash" ? "text-red-400" : "text-zinc-500"}`} />
              <span>Trash</span>
            </div>
            <span
              className={`text-[10px] font-mono px-1.5 py-0.2 rounded ${
                activeCategory === "trash" ? "bg-red-900/60 text-red-300 font-bold" : "bg-zinc-900 text-zinc-500"
              }`}
            >
              {counts.trash}
            </span>
          </motion.button>
        </nav>
      </div>

      {/* Footer Controls */}
      <div className="flex flex-col gap-1.5 pt-3 border-t border-[#232326]">
        {/* Full-width E2E Encrypted Status Card */}
        <div className="bg-[#121214] border border-[#232326] rounded-lg px-2.5 py-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-zinc-400" />
            <ShinyText
              text="E2E Encrypted"
              color="#d4d4d8"
              shineColor="#ffffff"
              speed={5}
              delay={3}
              className="text-[11px] font-medium font-sans"
            />
          </div>
          <span className="text-[10px] font-mono text-zinc-400">
            {syncStatus === "syncing" ? "Syncing..." : syncStatus === "offline" ? "Offline" : "Synced"}
          </span>
        </div>

        {/* Row 1: Settings */}
        <motion.button
          whileHover={{ x: 1 }}
          whileTap={{ scale: 0.99 }}
          onClick={onOpenSettings}
          className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-900 transition-colors text-xs font-medium text-left cursor-pointer font-sans"
        >
          <Settings className="w-3.5 h-3.5 text-zinc-500" />
          <span>Settings</span>
        </motion.button>

        {/* Row 2: Encrypted Sync */}
        <motion.button
          whileHover={{ x: 1 }}
          whileTap={{ scale: 0.99 }}
          onClick={onTriggerSync}
          className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-900 transition-colors text-xs font-medium text-left cursor-pointer font-sans"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-zinc-500 ${syncStatus === "syncing" ? "animate-spin text-white" : ""}`} />
          <span>Encrypted Sync</span>
        </motion.button>

        {/* Row 3: Lock Vault */}
        <motion.button
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.99 }}
          onClick={onLockVault}
          className="w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-zinc-300 hover:text-white hover:bg-[#1C1C20] border border-[#232326] hover:border-zinc-700 transition-all text-xs font-medium cursor-pointer font-sans"
        >
          <div className="flex items-center gap-2">
            <Lock className="w-3.5 h-3.5 text-zinc-400" />
            <span>Lock Vault</span>
          </div>
          <kbd className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-zinc-900 border border-zinc-800 text-zinc-500">
            Ctrl+L
          </kbd>
        </motion.button>
      </div>
    </aside>
  );
};
