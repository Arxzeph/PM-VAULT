import React from "react";
import { motion } from "motion/react";
import { VaultCategory } from "../types";
import {
  Shield,
  KeyRound,
  CreditCard,
  Contact,
  Archive,
  Trash2,
  FolderOpen,
  Settings,
  RefreshCw,
  Lock,
  ChevronDown,
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
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeCategory,
  onSelectCategory,
  counts,
  syncStatus,
  onOpenSettings,
  onTriggerSync,
  onLockVault,
}) => {
  return (
    <aside className="w-64 flex-shrink-0 bg-[#0C0E16] border-r border-[#242B3D] flex flex-col justify-between h-screen p-4 select-none">
      {/* Top Header & Vault Selector */}
      <div className="flex flex-col gap-4">
        {/* Brand Header */}
        <div className="flex items-center gap-3 px-2 py-1">
          <div className="w-9 h-9 rounded-xl bg-[#6366F1]/15 border border-[#6366F1]/30 flex items-center justify-center text-[#6366F1] shadow-lg shadow-[#6366F1]/10">
            <Shield className="w-5 h-5" />
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm tracking-wider text-white">PM-VAULT</span>
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-medium">
                v2.4
              </span>
            </div>
            <span className="text-[11px] font-mono text-slate-400">ZERO-KNOWLEDGE ENCLAVE</span>
          </div>
        </div>

        {/* Active Vault Card / Selector */}
        <div className="bg-[#161B26] border border-[#242B3D] rounded-xl p-3 flex items-center justify-between hover:border-slate-700 transition-colors cursor-pointer group">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-slate-800/80 border border-slate-700 flex items-center justify-center text-slate-300">
              <Lock className="w-3.5 h-3.5 text-indigo-400" />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-xs font-semibold text-slate-200 truncate group-hover:text-white">
                Personal Vault
              </span>
              <span className="text-[11px] font-mono text-slate-400">
                {counts.all} items • Master
              </span>
            </div>
          </div>
          <ChevronDown className="w-4 h-4 text-slate-500 group-hover:text-slate-300 transition-colors" />
        </div>

        {/* Navigation Section */}
        <nav className="flex flex-col gap-1 mt-1">
          {/* All Items */}
          <motion.button
            whileHover={{ x: 2 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => onSelectCategory("all")}
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
              activeCategory === "all"
                ? "bg-[#6366F1] text-white shadow-lg shadow-[#6366F1]/20 font-semibold"
                : "text-slate-400 hover:text-white hover:bg-slate-800/40"
            }`}
          >
            <div className="flex items-center gap-3">
              <FolderOpen className={`w-4 h-4 ${activeCategory === "all" ? "text-white" : "text-slate-400"}`} />
              <span>All Items</span>
            </div>
            <span
              className={`text-xs font-mono px-2 py-0.5 rounded-md ${
                activeCategory === "all" ? "bg-white/20 text-white font-bold" : "bg-slate-800/80 text-slate-400"
              }`}
            >
              {counts.all}
            </span>
          </motion.button>

          {/* Logins */}
          <motion.button
            whileHover={{ x: 2 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => onSelectCategory("logins")}
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
              activeCategory === "logins"
                ? "bg-[#6366F1] text-white shadow-lg shadow-[#6366F1]/20 font-semibold"
                : "text-slate-400 hover:text-white hover:bg-slate-800/40"
            }`}
          >
            <div className="flex items-center gap-3">
              <KeyRound className={`w-4 h-4 ${activeCategory === "logins" ? "text-white" : "text-slate-400"}`} />
              <span>Logins</span>
            </div>
            <span
              className={`text-xs font-mono px-2 py-0.5 rounded-md ${
                activeCategory === "logins" ? "bg-white/20 text-white font-bold" : "bg-slate-800/80 text-slate-400"
              }`}
            >
              {counts.logins}
            </span>
          </motion.button>

          {/* Payment Cards */}
          <motion.button
            whileHover={{ x: 2 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => onSelectCategory("cards")}
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
              activeCategory === "cards"
                ? "bg-[#6366F1] text-white shadow-lg shadow-[#6366F1]/20 font-semibold"
                : "text-slate-400 hover:text-white hover:bg-slate-800/40"
            }`}
          >
            <div className="flex items-center gap-3">
              <CreditCard className={`w-4 h-4 ${activeCategory === "cards" ? "text-white" : "text-slate-400"}`} />
              <span>Payment Cards</span>
            </div>
            <span
              className={`text-xs font-mono px-2 py-0.5 rounded-md ${
                activeCategory === "cards" ? "bg-white/20 text-white font-bold" : "bg-slate-800/80 text-slate-400"
              }`}
            >
              {counts.cards}
            </span>
          </motion.button>

          {/* Personal IDs */}
          <motion.button
            whileHover={{ x: 2 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => onSelectCategory("ids")}
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
              activeCategory === "ids"
                ? "bg-[#6366F1] text-white shadow-lg shadow-[#6366F1]/20 font-semibold"
                : "text-slate-400 hover:text-white hover:bg-slate-800/40"
            }`}
          >
            <div className="flex items-center gap-3">
              <Contact className={`w-4 h-4 ${activeCategory === "ids" ? "text-white" : "text-slate-400"}`} />
              <span>Personal IDs</span>
            </div>
            <span
              className={`text-xs font-mono px-2 py-0.5 rounded-md ${
                activeCategory === "ids" ? "bg-white/20 text-white font-bold" : "bg-slate-800/80 text-slate-400"
              }`}
            >
              {counts.ids}
            </span>
          </motion.button>

          {/* Divider */}
          <div className="border-t border-[#242B3D]/70 my-2" />

          {/* Archive */}
          <motion.button
            whileHover={{ x: 2 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => onSelectCategory("archive")}
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
              activeCategory === "archive"
                ? "bg-[#6366F1] text-white shadow-lg shadow-[#6366F1]/20 font-semibold"
                : "text-slate-400 hover:text-white hover:bg-slate-800/40"
            }`}
          >
            <div className="flex items-center gap-3">
              <Archive className={`w-4 h-4 ${activeCategory === "archive" ? "text-white" : "text-slate-400"}`} />
              <span>Archive</span>
            </div>
            <span
              className={`text-xs font-mono px-2 py-0.5 rounded-md ${
                activeCategory === "archive" ? "bg-white/20 text-white font-bold" : "bg-slate-800/80 text-slate-400"
              }`}
            >
              {counts.archive}
            </span>
          </motion.button>

          {/* Trash */}
          <motion.button
            whileHover={{ x: 2 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => onSelectCategory("trash")}
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
              activeCategory === "trash"
                ? "bg-rose-600/80 text-white shadow-lg shadow-rose-950/40 font-semibold"
                : "text-slate-400 hover:text-white hover:bg-slate-800/40"
            }`}
          >
            <div className="flex items-center gap-3">
              <Trash2 className={`w-4 h-4 ${activeCategory === "trash" ? "text-white" : "text-slate-400"}`} />
              <span>Trash</span>
            </div>
            <span
              className={`text-xs font-mono px-2 py-0.5 rounded-md ${
                activeCategory === "trash" ? "bg-white/20 text-white font-bold" : "bg-slate-800/80 text-slate-400"
              }`}
            >
              {counts.trash}
            </span>
          </motion.button>
        </nav>
      </div>

      {/* Standardized Vertical Footer (Clean Full-Width Stack) */}
      <div className="flex flex-col gap-2 pt-3 border-t border-[#242B3D]/70">
        {/* Full-width E2E Encrypted Status Card */}
        <div className="bg-[#161B26] border border-[#242B3D] rounded-xl px-3 py-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#38BDF8] animate-pulse" />
            <span className="text-xs font-medium text-slate-300">E2E Encrypted</span>
          </div>
          <span className="text-[11px] font-mono text-[#38BDF8] font-medium">
            {syncStatus === "syncing" ? "Syncing..." : syncStatus === "offline" ? "Offline" : "Synced"}
          </span>
        </div>

        {/* Row 1: Full-width Settings */}
        <motion.button
          whileHover={{ x: 2 }}
          whileTap={{ scale: 0.98 }}
          onClick={onOpenSettings}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/60 transition-colors text-sm font-medium text-left cursor-pointer"
        >
          <Settings className="w-4 h-4 text-slate-400" />
          <span>Settings</span>
        </motion.button>

        {/* Row 2: Full-width Encrypted Sync */}
        <motion.button
          whileHover={{ x: 2 }}
          whileTap={{ scale: 0.98 }}
          onClick={onTriggerSync}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/60 transition-colors text-sm font-medium text-left cursor-pointer"
        >
          <RefreshCw className={`w-4 h-4 text-slate-400 ${syncStatus === "syncing" ? "animate-spin text-[#38BDF8]" : ""}`} />
          <span>Encrypted Sync</span>
        </motion.button>

        {/* Row 3: Full-width Lock Vault with Shortcut Badge */}
        <motion.button
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.98 }}
          onClick={onLockVault}
          className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800/80 border border-[#242B3D] transition-colors text-sm font-medium cursor-pointer"
        >
          <div className="flex items-center gap-3">
            <Lock className="w-4 h-4 text-indigo-400" />
            <span>Lock Vault</span>
          </div>
          <kbd className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-400">
            Ctrl+L
          </kbd>
        </motion.button>
      </div>
    </aside>
  );
};
