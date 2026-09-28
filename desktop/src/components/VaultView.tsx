import React, { useState, useMemo, useEffect, useRef } from "react";
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
  CheckCircle2,
  RefreshCw,
  AlertCircle,
  Clock,
  Command,
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
  const [activeFilter, setActiveFilter] = useState<"all" | "favorites" | "logins" | "notes">("all");
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [showGlobalGenerator, setShowGlobalGenerator] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Keyboard shortcuts: Ctrl+K / Cmd+K to search, Ctrl+N to create, Esc to clear
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

  // Filter entries based on category, tag, and search query
  const filteredEntries = useMemo(() => {
    return entries.filter((e) => {
      // 1. Category filter
      if (activeFilter === "favorites" && !e.favorite) return false;
      if (activeFilter === "logins" && !e.password) return false;
      if (activeFilter === "notes" && (!e.notes || e.password)) return false;

      // 2. Tag filter
      if (selectedTag && !e.tags?.includes(selectedTag)) return false;

      // 3. Search query
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

  return (
    <div className="flex h-screen w-screen bg-[#09090b] text-zinc-100 select-none overflow-hidden font-sans">
      {/* 1. Left Sidebar: Raycast Obsidian Style */}
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
            <button
              onClick={() => {
                setActiveFilter("all");
                setSelectedTag(null);
              }}
              className={`w-full px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center justify-between transition-colors ${
                activeFilter === "all" && !selectedTag
                  ? "bg-white/[0.08] text-white shadow-sm border border-white/[0.06]"
                  : "text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.03] border border-transparent"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <KeyRound className="w-3.5 h-3.5 text-zinc-400" />
                <span>All Items</span>
              </div>
              <span className="text-[10px] font-mono text-zinc-500">{entries.length}</span>
            </button>

            <button
              onClick={() => {
                setActiveFilter("favorites");
                setSelectedTag(null);
              }}
              className={`w-full px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center justify-between transition-colors ${
                activeFilter === "favorites" && !selectedTag
                  ? "bg-white/[0.08] text-white shadow-sm border border-white/[0.06]"
                  : "text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.03] border border-transparent"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Star className="w-3.5 h-3.5 text-amber-400" />
                <span>Favorites</span>
              </div>
              <span className="text-[10px] font-mono text-zinc-500">
                {entries.filter((e) => e.favorite).length}
              </span>
            </button>

            <button
              onClick={() => {
                setActiveFilter("logins");
                setSelectedTag(null);
              }}
              className={`w-full px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center justify-between transition-colors ${
                activeFilter === "logins" && !selectedTag
                  ? "bg-white/[0.08] text-white shadow-sm border border-white/[0.06]"
                  : "text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.03] border border-transparent"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Globe className="w-3.5 h-3.5 text-zinc-400" />
                <span>Logins</span>
              </div>
              <span className="text-[10px] font-mono text-zinc-500">
                {entries.filter((e) => e.password).length}
              </span>
            </button>

            <button
              onClick={() => {
                setActiveFilter("notes");
                setSelectedTag(null);
              }}
              className={`w-full px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center justify-between transition-colors ${
                activeFilter === "notes" && !selectedTag
                  ? "bg-white/[0.08] text-white shadow-sm border border-white/[0.06]"
                  : "text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.03] border border-transparent"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <FileText className="w-3.5 h-3.5 text-zinc-400" />
                <span>Secure Notes</span>
              </div>
              <span className="text-[10px] font-mono text-zinc-500">
                {entries.filter((e) => e.notes && !e.password).length}
              </span>
            </button>

            {/* Quick Generator Trigger */}
            <div className="pt-2">
              <button
                onClick={() => setShowGlobalGenerator(true)}
                className="w-full px-2.5 py-1.5 rounded-lg text-xs font-medium text-zinc-300 bg-zinc-900/80 hover:bg-zinc-800/80 border border-white/[0.06] flex items-center justify-between transition group"
              >
                <div className="flex items-center gap-2">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-400 group-hover:rotate-12 transition-transform" />
                  <span>Generator</span>
                </div>
                <span className="kbd-badge text-[9px]">Gen</span>
              </button>
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
      <section className="w-76 bg-[#09090b] border-r border-white/[0.06] flex flex-col shrink-0">
        {/* Search Bar with Ctrl+K badge */}
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

          <button
            onClick={handleStartCreate}
            title="Create New Item (Ctrl+N)"
            className="p-1.5 bg-zinc-100 hover:bg-white text-zinc-950 rounded-lg transition shadow-sm shrink-0"
          >
            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
          </button>
        </div>

        {/* Counter & Category Label */}
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
            filteredEntries.map((entry) => {
              const isSelected = entry.id === selectedEntryId;

              return (
                <div
                  key={entry.id}
                  onClick={() => handleSelectEntry(entry.id)}
                  className={`p-2 rounded-xl cursor-pointer transition-all flex items-center gap-2.5 ${
                    isSelected
                      ? "bg-zinc-800/80 border border-zinc-700/60 text-white shadow-sm"
                      : "hover:bg-zinc-900/60 border border-transparent text-zinc-300"
                  }`}
                >
                  {/* Automatic Brand Favicon / Monogram */}
                  <ServiceIcon title={entry.title} url={entry.url} size={18} />

                  {/* Text details */}
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
                </div>
              );
            })
          )}
        </div>
      </section>

      {/* 3. Right Column: Raycast Minimalist Detail / Editor */}
      <main className="flex-1 bg-[#0c0d10] flex flex-col relative overflow-hidden">
        {isCreating || selectedEntry ? (
          <EntryEditor
            entry={selectedEntry}
            isCreating={isCreating}
            onSave={handleSave}
            onDelete={handleDelete}
            onClose={() => {
              setIsCreating(false);
              setSelectedEntryId(null);
            }}
          />
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-zinc-500 p-8 text-center select-none">
            {/* Subtle glow container */}
            <div className="relative mb-5">
              <div className="absolute inset-0 bg-emerald-500/10 blur-2xl rounded-full" />
              <div className="relative w-16 h-16 rounded-2xl bg-zinc-900 border border-white/[0.08] flex items-center justify-center text-zinc-400 shadow-xl">
                <Shield className="w-7 h-7 text-emerald-400" strokeWidth={1.5} />
              </div>
            </div>

            <h3 className="text-sm font-semibold text-zinc-200 tracking-tight">No Item Selected</h3>
            <p className="text-xs text-zinc-500 max-w-sm mt-1.5 leading-relaxed">
              Select an encrypted entry from the list to view credentials, or create a new password entry.
            </p>

            <button
              onClick={handleStartCreate}
              className="mt-5 px-3.5 py-2 bg-zinc-100 hover:bg-white text-zinc-950 rounded-xl text-xs font-medium transition shadow-md flex items-center gap-2"
            >
              <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>Create New Item</span>
              <span className="kbd-badge text-[9px] bg-zinc-200 border-zinc-300 text-zinc-700 ml-1">Ctrl N</span>
            </button>
          </div>
        )}

        {/* Global Password Generator Modal */}
        {showGlobalGenerator && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <PasswordGenerator onClose={() => setShowGlobalGenerator(false)} />
          </div>
        )}

        {/* Change Master Password Modal */}
        {showChangePassword && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <ChangePasswordModal
              onClose={() => setShowChangePassword(false)}
              onSuccess={() => setShowChangePassword(false)}
            />
          </div>
        )}
      </main>
    </div>
  );
};
