import React, { useState, useMemo, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { VaultEntry, SaveEntryInput } from "../types";
import { EntryEditor } from "./EntryEditor";
import { PasswordGenerator } from "./PasswordGenerator";
import { ChangePasswordModal } from "./ChangePasswordModal";
import { ServiceIcon } from "./ServiceIcon";
import {
  Search,
  Plus,
  Lock,
  LogOut,
  Star,
  KeyRound,
  FileText,
  Shield,
  Sparkles,
  Globe,
  Tag,
  FolderOpen,
  RefreshCw,
  AlertCircle,
  Fingerprint,
} from "lucide-react";

interface VaultViewProps {
  entries: VaultEntry[];
  userEmail?: string | null;
  onSaveEntry: (input: SaveEntryInput) => Promise<void>;
  onDeleteEntry: (id: string) => Promise<void>;
  onLock: () => void;
  onLogout?: () => void;
  syncStatus?: "synced" | "syncing" | "offline" | "error";
  onTriggerSync?: () => void;
}

export const VaultView: React.FC<VaultViewProps> = ({
  entries,
  userEmail,
  onSaveEntry,
  onDeleteEntry,
  onLock,
  onLogout,
  syncStatus = "synced",
  onTriggerSync,
}) => {
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<"all" | "favorites" | "logins" | "passkeys" | "notes">("all");
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [showGlobalGenerator, setShowGlobalGenerator] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "n") {
        e.preventDefault();
        handleStartCreate();
      } else if (e.key === "Escape") {
        if (isCreating) {
          setIsCreating(false);
        } else if (searchQuery) {
          setSearchQuery("");
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isCreating, searchQuery]);

  // Extract all distinct tags from entries
  const allTags = useMemo(() => {
    const tagsSet = new Set<string>();
    entries.forEach((e) => {
      e.tags?.forEach((t) => tagsSet.add(t));
    });
    return Array.from(tagsSet).sort();
  }, [entries]);

  // Filter entries
  const filteredEntries = useMemo(() => {
    return entries.filter((e) => {
      if (activeFilter === "favorites" && !e.favorite) return false;
      if (activeFilter === "logins" && !e.password) return false;
      if (activeFilter === "passkeys" && !e.tags?.includes("passkey")) return false;
      if (activeFilter === "notes" && (!e.notes || e.password)) return false;

      if (selectedTag && !e.tags?.includes(selectedTag)) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = e.title?.toLowerCase().includes(q);
        const matchUser = e.username?.toLowerCase().includes(q);
        const matchUrl = e.url?.toLowerCase().includes(q);
        const matchNotes = e.notes?.toLowerCase().includes(q);
        const matchTags = e.tags?.some((t) => t.toLowerCase().includes(q));
        if (!matchTitle && !matchUser && !matchUrl && !matchNotes && !matchTags) {
          return false;
        }
      }

      return true;
    });
  }, [entries, activeFilter, selectedTag, searchQuery]);

  const selectedEntry = entries.find((e) => e.id === selectedEntryId) || null;

  const handleStartCreate = () => {
    setSelectedEntryId(null);
    setIsCreating(true);
  };

  const handleSelectEntry = (id: string) => {
    setIsCreating(false);
    setSelectedEntryId(id);
  };

  const handleSave = async (input: SaveEntryInput) => {
    await onSaveEntry(input);
    setIsCreating(false);
  };

  const handleDelete = async (id: string) => {
    await onDeleteEntry(id);
    setSelectedEntryId(null);
  };

  // Sidebar nav items config
  const navItems = [
    { key: "all" as const, label: "All Items", icon: KeyRound, iconColor: "text-zinc-400", count: entries.length },
    { key: "favorites" as const, label: "Favorites", icon: Star, iconColor: "text-amber-400", count: entries.filter((e) => e.favorite).length },
    { key: "logins" as const, label: "Logins", icon: Globe, iconColor: "text-zinc-400", count: entries.filter((e) => e.password).length },
    { key: "passkeys" as const, label: "Passkeys", icon: Fingerprint, iconColor: "text-violet-400", count: entries.filter((e) => e.tags?.includes("passkey")).length },
    { key: "notes" as const, label: "Secure Notes", icon: FileText, iconColor: "text-zinc-400", count: entries.filter((e) => e.notes && !e.password).length },
  ];

  return (
    <div className="flex h-screen w-screen bg-[#09090b] text-zinc-100 select-none overflow-hidden font-sans">
      {/* 1. Left Sidebar */}
      <aside className="w-60 bg-[#0c0d0e] border-r border-white/[0.06] flex flex-col justify-between shrink-0">
        <div>
          {/* App Branding */}
          <div className="p-3.5 border-b border-white/[0.06] flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-zinc-900 border border-white/[0.08] flex items-center justify-center shadow-inner">
                <Shield className="w-3.5 h-3.5 text-emerald-400" />
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-1.5">
                  <span className="font-semibold text-xs tracking-tight text-white">PM Vault</span>
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                </div>
                <span className="text-[9px] font-mono tracking-wider uppercase text-zinc-500">
                  Zero-Knowledge
                </span>
              </div>
            </div>

            <button
              onClick={onLock}
              title="Lock Vault"
              className="p-1.5 rounded-lg text-zinc-400 hover:text-rose-400 hover:bg-white/[0.04] transition"
            >
              <Lock className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Navigation Categories */}
          <nav className="p-2 space-y-0.5">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeFilter === item.key && !selectedTag;
              return (
                <motion.button
                  key={item.key}
                  onClick={() => {
                    setActiveFilter(item.key);
                    setSelectedTag(null);
                  }}
                  whileTap={{ scale: 0.97 }}
                  className={`w-full px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center justify-between transition-colors ${
                    isActive
                      ? "bg-white/[0.08] text-white shadow-sm border border-white/[0.06]"
                      : "text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.03] border border-transparent"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Icon className={`w-3.5 h-3.5 ${isActive ? "text-white" : item.iconColor}`} />
                    <span>{item.label}</span>
                  </div>
                  <span className="text-[10px] font-mono text-zinc-500">{item.count}</span>
                </motion.button>
              );
            })}

            {/* Quick Generator Trigger */}
            <div className="pt-2">
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={() => setShowGlobalGenerator(true)}
                className="w-full px-2.5 py-1.5 rounded-lg text-xs font-medium text-zinc-300 bg-zinc-900/80 hover:bg-zinc-800/80 border border-white/[0.06] flex items-center justify-between transition group"
              >
                <div className="flex items-center gap-2">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-400 group-hover:rotate-12 transition-transform" />
                  <span>Generator</span>
                </div>
                <span className="kbd-badge text-[9px]">Gen</span>
              </motion.button>
            </div>
          </nav>

          {/* Tags Section */}
          {allTags.length > 0 && (
            <div className="px-3 pt-3 border-t border-white/[0.06]">
              <h3 className="text-[10px] font-mono font-semibold text-zinc-500 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <Tag className="w-3 h-3 text-zinc-600" />
                <span>Tags</span>
              </h3>
              <div className="space-y-0.5 max-h-36 overflow-y-auto">
                {allTags.map((tag) => (
                  <button
                    key={tag}
                    onClick={() => {
                      setSelectedTag(selectedTag === tag ? null : tag);
                    }}
                    className={`w-full text-left px-2 py-1 rounded-md text-[11px] font-mono truncate transition-colors ${
                      selectedTag === tag
                        ? "bg-zinc-800 text-emerald-400 font-medium border border-white/[0.08]"
                        : "text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.03]"
                    }`}
                  >
                    #{tag}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer: User & Sync Status */}
        <div className="p-3 border-t border-white/[0.06] bg-[#090a0c] space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="truncate text-zinc-400 font-mono text-[11px] max-w-[120px]">
              {userEmail || "Local Vault"}
            </span>
            <div
              onClick={onTriggerSync}
              title={syncStatus === "synced" ? "All entries synced to cloud" : "Click to sync"}
              className="flex items-center gap-1 cursor-pointer hover:opacity-80 transition"
            >
              {syncStatus === "synced" ? (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  Synced
                </span>
              ) : syncStatus === "syncing" ? (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                  <RefreshCw className="w-2.5 h-2.5 animate-spin" />
                  Syncing
                </span>
              ) : syncStatus === "error" ? (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20">
                  <AlertCircle className="w-2.5 h-2.5" />
                  Error
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                  Local
                </span>
              )}
            </div>
          </div>

          <button
            onClick={() => setShowChangePassword(true)}
            className="w-full py-1.5 px-2 bg-zinc-900/60 hover:bg-zinc-800 text-zinc-300 hover:text-white rounded-lg text-[11px] font-medium border border-white/[0.04] flex items-center justify-center gap-1.5 transition"
          >
            <KeyRound className="w-3 h-3 text-zinc-400" />
            <span>Master Password</span>
          </button>

          <div className="grid grid-cols-2 gap-1.5 pt-0.5">
            <button
              onClick={onLock}
              className="py-1 px-2 bg-zinc-900/40 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 rounded-lg text-[11px] font-medium border border-white/[0.04] flex items-center justify-center gap-1.5 transition"
            >
              <Lock className="w-3 h-3 text-zinc-500" />
              <span>Lock</span>
            </button>
            <button
              onClick={onLogout}
              className="py-1 px-2 bg-zinc-900/40 hover:bg-rose-950/30 text-zinc-400 hover:text-rose-400 rounded-lg text-[11px] font-medium border border-white/[0.04] flex items-center justify-center gap-1.5 transition"
              title="Log out and reset local vault cache"
            >
              <LogOut className="w-3 h-3 text-zinc-500" />
              <span>Log Out</span>
            </button>
          </div>
        </div>
      </aside>

      {/* 2. Middle Column: Vault Item List */}
      <section className={`bg-[#09090b] border-r border-white/[0.06] flex flex-col shrink-0 transition-all duration-300 ${selectedEntry ? 'w-76' : 'flex-1'}`}>
        {/* Search Bar */}
        <div className="p-2.5 border-b border-white/[0.06] flex items-center gap-1.5">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-2.5 top-2.5" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search vault..."
              className="w-full pl-8 pr-14 py-1.5 bg-[#121316] border border-white/[0.08] rounded-lg text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-zinc-500 transition"
            />
            <div className="absolute right-2 top-2 pointer-events-none">
              <span className="kbd-badge">Ctrl K</span>
            </div>
          </div>

          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={handleStartCreate}
            title="Create New Item (Ctrl+N)"
            className="p-1.5 bg-zinc-100 hover:bg-white text-zinc-950 rounded-lg transition shadow-sm shrink-0"
          >
            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
          </motion.button>
        </div>

        {/* Counter */}
        <div className="px-3 py-1.5 flex items-center justify-between text-[11px] text-zinc-500 border-b border-white/[0.03]">
          <span className="uppercase tracking-wider font-mono text-[9px]">
            {activeFilter === "all" ? "All Entries" : activeFilter}
          </span>
          <span className="font-mono text-[10px]">{filteredEntries.length} items</span>
        </div>

        {/* List Items */}
        <div className="flex-1 overflow-y-auto p-1.5 space-y-1">
          {filteredEntries.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center text-center p-4 text-zinc-600">
              <FolderOpen className="w-7 h-7 stroke-1 mb-2 opacity-40 text-zinc-500" />
              <p className="text-xs text-zinc-500">No entries found</p>
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="mt-2 text-xs text-emerald-400 hover:underline"
                >
                  Clear search
                </button>
              )}
            </div>
          ) : (
            <AnimatePresence>
              {filteredEntries.map((entry, index) => {
                const isSelected = entry.id === selectedEntryId;

                return (
                  <motion.div
                    key={entry.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.2, delay: index * 0.03 }}
                    onClick={() => handleSelectEntry(entry.id)}
                    className={`p-2 rounded-xl cursor-pointer transition-all flex items-center gap-2.5 ${
                      isSelected
                        ? "bg-zinc-800/80 border border-zinc-700/60 text-white shadow-sm"
                        : "hover:bg-zinc-900/60 border border-transparent text-zinc-300"
                    }`}
                  >
                    <ServiceIcon title={entry.title} url={entry.url || undefined} size={18} />

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-medium text-xs truncate text-zinc-100 tracking-tight">
                          {entry.title}
                        </span>
                        {entry.favorite && (
                          <Star className="w-3 h-3 text-amber-400 fill-current shrink-0" />
                        )}
                      </div>
                      <p className="text-[11px] text-zinc-500 truncate mt-0.5 font-mono">
                        {entry.username || entry.url || "No username"}
                      </p>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          )}
        </div>
      </section>

      {/* 3. Right Column: Only renders when an entry is selected */}
      <AnimatePresence>
        {selectedEntry && (
          <motion.main
            key="detail-panel"
            initial={{ opacity: 0, width: 0 }}
            animate={{ opacity: 1, width: "auto" }}
            exit={{ opacity: 0, width: 0 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="flex-1 bg-[#0c0d10] flex flex-col relative overflow-hidden min-w-[340px]"
          >
            <EntryEditor
              entry={selectedEntry}
              isCreating={false}
              onSave={handleSave}
              onDelete={handleDelete}
              onClose={() => setSelectedEntryId(null)}
            />
          </motion.main>
        )}
      </AnimatePresence>

      {/* ============ CREATE NEW ITEM — Centered Floating Bubble Modal ============ */}
      <AnimatePresence>
        {isCreating && (
          <>
            {/* Backdrop */}
            <motion.div
              key="create-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-md z-40"
              onClick={() => setIsCreating(false)}
            />

            {/* Floating Bubble */}
            <motion.div
              key="create-bubble"
              initial={{ opacity: 0, scale: 0.85, y: 40 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.85, y: 40 }}
              transition={{ type: "spring", damping: 25, stiffness: 350 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-6 pointer-events-none"
            >
              <div className="w-full max-w-lg max-h-[85vh] overflow-y-auto bg-[#121316] border border-white/[0.1] rounded-3xl shadow-2xl shadow-black/40 pointer-events-auto">
                <EntryEditor
                  entry={null}
                  isCreating={true}
                  onSave={handleSave}
                  onDelete={handleDelete}
                  onClose={() => setIsCreating(false)}
                />
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Global Password Generator Modal */}
      <AnimatePresence>
        {showGlobalGenerator && (
          <>
            <motion.div
              key="gen-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50"
              onClick={() => setShowGlobalGenerator(false)}
            />
            <motion.div
              key="gen-modal"
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              transition={{ type: "spring", damping: 25, stiffness: 350 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
            >
              <div className="pointer-events-auto">
                <PasswordGenerator onClose={() => setShowGlobalGenerator(false)} />
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Change Master Password Modal */}
      <AnimatePresence>
        {showChangePassword && (
          <motion.div
            key="chgpwd"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <ChangePasswordModal
              onClose={() => setShowChangePassword(false)}
              onSuccess={() => setShowChangePassword(false)}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
