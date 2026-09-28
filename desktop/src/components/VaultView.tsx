import React, { useState, useMemo } from "react";
import { VaultEntry, SaveEntryInput } from "../types";
import { EntryEditor } from "./EntryEditor";
import { PasswordGenerator } from "./PasswordGenerator";
import { ChangePasswordModal } from "./ChangePasswordModal";
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
    <div className="flex h-screen w-screen bg-slate-950 text-slate-100 select-none overflow-hidden font-sans">
      {/* 1. Left Sidebar */}
      <aside className="w-64 bg-slate-900/90 border-r border-slate-800 flex flex-col justify-between shrink-0">
        <div>
          {/* App Branding */}
          <div className="p-4 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-600 to-cyan-500 flex items-center justify-center shadow-md shadow-indigo-500/20">
                <Shield className="w-4 h-4 text-white" />
              </div>
              <div>
                <h1 className="font-bold text-sm tracking-tight text-white leading-none">PM Vault</h1>
                <span className="text-[10px] text-emerald-400 font-mono font-medium">Zero-Knowledge</span>
              </div>
            </div>

            <button
              onClick={onLock}
              title="Lock Vault"
              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition"
            >
              <Lock className="w-4 h-4" />
            </button>
          </div>

          {/* Navigation Categories */}
          <nav className="p-3 space-y-1">
            <button
              onClick={() => {
                setActiveFilter("all");
                setSelectedTag(null);
              }}
              className={`w-full px-3 py-2 rounded-xl text-xs font-medium flex items-center justify-between transition ${
                activeFilter === "all" && !selectedTag
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <KeyRound className="w-4 h-4" />
                <span>All Items</span>
              </div>
              <span className="text-[11px] opacity-75">{entries.length}</span>
            </button>

            <button
              onClick={() => {
                setActiveFilter("favorites");
                setSelectedTag(null);
              }}
              className={`w-full px-3 py-2 rounded-xl text-xs font-medium flex items-center justify-between transition ${
                activeFilter === "favorites" && !selectedTag
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Star className="w-4 h-4" />
                <span>Favorites</span>
              </div>
              <span className="text-[11px] opacity-75">
                {entries.filter((e) => e.favorite).length}
              </span>
            </button>

            <button
              onClick={() => {
                setActiveFilter("logins");
                setSelectedTag(null);
              }}
              className={`w-full px-3 py-2 rounded-xl text-xs font-medium flex items-center justify-between transition ${
                activeFilter === "logins" && !selectedTag
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Globe className="w-4 h-4" />
                <span>Logins</span>
              </div>
              <span className="text-[11px] opacity-75">
                {entries.filter((e) => e.password).length}
              </span>
            </button>

            <button
              onClick={() => {
                setActiveFilter("notes");
                setSelectedTag(null);
              }}
              className={`w-full px-3 py-2 rounded-xl text-xs font-medium flex items-center justify-between transition ${
                activeFilter === "notes" && !selectedTag
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <FileText className="w-4 h-4" />
                <span>Secure Notes</span>
              </div>
              <span className="text-[11px] opacity-75">
                {entries.filter((e) => e.notes && !e.password).length}
              </span>
            </button>

            {/* Quick Generator Trigger */}
            <button
              onClick={() => setShowGlobalGenerator(true)}
              className="w-full mt-3 px-3 py-2 rounded-xl text-xs font-medium text-indigo-300 bg-indigo-950/40 border border-indigo-500/20 hover:bg-indigo-950/70 flex items-center gap-2.5 transition"
            >
              <Sparkles className="w-4 h-4 text-indigo-400" />
              <span>Password Generator</span>
            </button>
          </nav>

          {/* Tags Section */}
          {allTags.length > 0 && (
            <div className="px-4 py-3 border-t border-slate-800/80">
              <h3 className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Tag className="w-3 h-3" />
                <span>Tags</span>
              </h3>
              <div className="space-y-1 max-h-36 overflow-y-auto">
                {allTags.map((tag) => (
                  <button
                    key={tag}
                    onClick={() => {
                      setSelectedTag(selectedTag === tag ? null : tag);
                    }}
                    className={`w-full text-left px-2.5 py-1 rounded-lg text-xs truncate transition ${
                      selectedTag === tag
                        ? "bg-slate-800 text-indigo-400 font-medium"
                        : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/40"
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
        <div className="p-3 border-t border-slate-800 bg-slate-950/50 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="truncate text-slate-400 font-medium">{userEmail || "Local Vault"}</span>
            <div
              onClick={onTriggerSync}
              title={syncStatus === "synced" ? "All entries synced" : "Click to sync"}
              className="flex items-center gap-1 cursor-pointer hover:opacity-80 transition"
            >
              {syncStatus === "synced" ? (
                <span className="flex items-center gap-1 text-[11px] text-emerald-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  Synced
                </span>
              ) : syncStatus === "syncing" ? (
                <span className="flex items-center gap-1 text-[11px] text-indigo-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-spin" />
                  Syncing...
                </span>
              ) : syncStatus === "error" ? (
                <span className="flex items-center gap-1 text-[11px] text-rose-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                  Sync error
                </span>
              ) : (
                <span className="flex items-center gap-1 text-[11px] text-amber-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                  Local-first
                </span>
              )}
            </div>
          </div>

          <button
            onClick={() => setShowChangePassword(true)}
            className="w-full py-1.5 px-2 bg-slate-800/80 hover:bg-slate-800 text-slate-300 hover:text-white rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 transition"
          >
            <KeyRound className="w-3.5 h-3.5 text-indigo-400" />
            <span>Change Master Password</span>
          </button>

          <div className="grid grid-cols-2 gap-1.5 pt-0.5">
            <button
              onClick={onLock}
              className="py-1 px-2 bg-slate-800/50 hover:bg-slate-800 text-slate-400 hover:text-indigo-300 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 transition"
            >
              <Lock className="w-3 h-3" />
              <span>Lock</span>
            </button>
            <button
              onClick={onLogout}
              className="py-1 px-2 bg-slate-800/50 hover:bg-rose-950/40 text-slate-400 hover:text-rose-400 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 transition"
              title="Log out and reset local vault cache"
            >
              <LogOut className="w-3 h-3" />
              <span>Log Out</span>
            </button>
          </div>
        </div>
      </aside>

      {/* 2. Middle Column: Item List */}
      <section className="w-80 bg-slate-950 border-r border-slate-800 flex flex-col shrink-0">
        {/* Search & Add Bar */}
        <div className="p-3 border-b border-slate-800 flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-3" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search vault..."
              className="w-full pl-8 pr-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition"
            />
          </div>

          <button
            onClick={handleStartCreate}
            title="Add New Entry"
            className="p-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition shadow-md shadow-indigo-600/20"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        {/* List Content */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-900/60 p-2 space-y-1">
          {filteredEntries.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center text-center p-4 text-slate-500">
              <FolderOpen className="w-8 h-8 stroke-1 mb-2 opacity-60" />
              <p className="text-xs">No entries found</p>
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="mt-2 text-xs text-indigo-400 hover:underline"
                >
                  Clear search
                </button>
              )}
            </div>
          ) : (
            filteredEntries.map((entry) => {
              const isSelected = entry.id === selectedEntryId;
              const initial = entry.title ? entry.title[0].toUpperCase() : "?";

              return (
                <div
                  key={entry.id}
                  onClick={() => handleSelectEntry(entry.id)}
                  className={`p-2.5 rounded-xl cursor-pointer transition flex items-center gap-3 ${
                    isSelected
                      ? "bg-indigo-600/20 border border-indigo-500/30 text-white"
                      : "hover:bg-slate-900/80 text-slate-300"
                  }`}
                >
                  {/* Avatar / Icon */}
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold shrink-0 ${
                      isSelected
                        ? "bg-indigo-600 text-white"
                        : "bg-slate-800 text-indigo-300 border border-slate-700/50"
                    }`}
                  >
                    {initial}
                  </div>

                  {/* Text details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-medium text-xs truncate text-slate-100">{entry.title}</span>
                      {entry.favorite && <Star className="w-3 h-3 text-amber-400 fill-current shrink-0" />}
                    </div>
                    <p className="text-[11px] text-slate-500 truncate mt-0.5">
                      {entry.username || entry.url || "No username"}
                    </p>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>

      {/* 3. Right Column: Detail / Editor */}
      <main className="flex-1 bg-slate-900/60 flex flex-col relative overflow-hidden">
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
          <div className="h-full flex flex-col items-center justify-center text-slate-500 p-8 text-center select-none">
            <div className="w-16 h-16 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center mb-4 text-slate-400 shadow-xl">
              <Shield className="w-8 h-8 stroke-1 text-indigo-400" />
            </div>
            <h3 className="text-base font-semibold text-slate-300">No Item Selected</h3>
            <p className="text-xs text-slate-500 max-w-sm mt-1">
              Select an entry from the list to view its encrypted credentials, or click below to create a new one.
            </p>
            <button
              onClick={handleStartCreate}
              className="mt-5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-medium transition shadow-md shadow-indigo-600/20 flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              <span>Create New Item</span>
            </button>
          </div>
        )}

        {/* Global Password Generator Modal */}
        {showGlobalGenerator && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <PasswordGenerator onClose={() => setShowGlobalGenerator(false)} />
          </div>
        )}

        {/* Change Master Password Modal */}
        {showChangePassword && (
          <ChangePasswordModal
            onClose={() => setShowChangePassword(false)}
            onSuccess={() => setShowChangePassword(false)}
          />
        )}
      </main>
    </div>
  );
};
