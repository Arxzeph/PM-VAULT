import React, { useState, useRef, useEffect, useMemo } from "react";
import { motion } from "motion/react";
import { VaultEntry, VaultCategory } from "../types";
import {
  Search,
  Plus,
  Lock,
  Star,
  Trash2,
} from "lucide-react";
import { ServiceIcon } from "./ServiceIcon";

interface ItemListProps {
  entries: VaultEntry[];
  selectedEntryId: string | null;
  onSelectEntry: (id: string) => void;
  activeCategory: VaultCategory;
  onOpenCreateLogin: () => void;
  onEmptyTrash?: () => void;
}

export const ItemList: React.FC<ItemListProps> = ({
  entries,
  selectedEntryId,
  onSelectEntry,
  activeCategory,
  onOpenCreateLogin,
  onEmptyTrash,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterMode, setFilterMode] = useState<"all" | "favorites">("all");
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Ctrl+K shortcut listener for search, Ctrl+N for new password
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "n") {
        e.preventDefault();
        onOpenCreateLogin();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onOpenCreateLogin]);

  // Filter entries according to active sidebar category + search query + favorite chip
  const filteredEntries = useMemo(() => {
    return entries.filter((entry) => {
      const isArchived = (entry.tags || []).some((t) => t === "status:archived" || t === "archived");
      const isTrash = entry.is_deleted === true || (entry.tags || []).some((t) => t === "status:trash" || t === "trash");

      // Category partitioning
      if (activeCategory === "trash") {
        if (!isTrash) return false;
      } else if (activeCategory === "archive") {
        if (!isArchived || isTrash) return false;
      } else {
        // Active non-archived non-trash items
        if (isTrash || isArchived) return false;

        // Favorites filter
        if (filterMode === "favorites" && !entry.favorite) {
          return false;
        }
      }

      // Search query filtering
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const titleMatch = entry.title?.toLowerCase().includes(q);
        const userMatch = entry.username?.toLowerCase().includes(q);
        const urlMatch = entry.url?.toLowerCase().includes(q);
        const tagMatch = entry.tags?.some((t) => t.toLowerCase().includes(q));
        if (!titleMatch && !userMatch && !urlMatch && !tagMatch) return false;
      }

      return true;
    });
  }, [entries, activeCategory, filterMode, searchQuery]);

  const categoryTitles: Record<VaultCategory, string> = {
    all: "All Passwords",
    logins: "Active Logins",
    cards: "All Passwords",
    ids: "All Passwords",
    archive: "Archived Passwords",
    trash: "Trash Bin",
  };

  return (
    <section className="w-84 flex-shrink-0 bg-[#09090B] border-r border-[#232326] flex flex-col h-screen select-none relative z-10">
      {/* Top Header Bar */}
      <div className="p-4 border-b border-[#232326] flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex flex-col">
            <h1 className="text-sm font-display font-bold text-white tracking-tight">
              {categoryTitles[activeCategory] || "Passwords"}
            </h1>
            <span className="text-[11px] font-mono text-zinc-500">
              {filteredEntries.length} {filteredEntries.length === 1 ? "password" : "passwords"}
            </span>
          </div>

          {/* Add Password CTA (Clean Solid White Button) or Empty Trash */}
          {activeCategory === "trash" ? (
            onEmptyTrash && (
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={onEmptyTrash}
                className="px-3 py-1.5 rounded-lg bg-red-950/40 hover:bg-red-900/40 text-red-400 border border-red-800/60 text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5 font-sans"
              >
                <Trash2 className="w-3.5 h-3.5 text-red-400" />
                <span>Empty Trash</span>
              </motion.button>
            )
          ) : (
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={onOpenCreateLogin}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white hover:bg-zinc-200 text-black text-xs font-semibold shadow-sm transition-all cursor-pointer font-sans"
            >
              <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>New</span>
              <kbd className="hidden sm:inline-block text-[9px] font-mono px-1 py-0.2 rounded bg-black/10 text-zinc-700 ml-0.5 font-medium">
                Ctrl+N
              </kbd>
            </motion.button>
          )}
        </div>

        {/* Search Bar Input */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search passwords, accounts, URLs..."
            className="w-full bg-[#121214] border border-[#27272A] focus:border-zinc-500 focus:ring-1 focus:ring-zinc-600 rounded-lg pl-9 pr-14 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none transition-all font-sans font-medium"
          />
          <kbd className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-zinc-400">
            Ctrl+K
          </kbd>
        </div>

        {/* Filter Chips (Visible in "All" and "Logins" view) */}
        {activeCategory !== "trash" && activeCategory !== "archive" && (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-none">
            <motion.button
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              onClick={() => setFilterMode("all")}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all cursor-pointer font-sans ${
                filterMode === "all"
                  ? "bg-zinc-800 text-white border border-zinc-700 font-semibold"
                  : "bg-transparent text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900 border border-transparent"
              }`}
            >
              All Passwords
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              onClick={() => setFilterMode("favorites")}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all cursor-pointer flex items-center gap-1.5 font-sans ${
                filterMode === "favorites"
                  ? "bg-amber-950/40 text-amber-300 border border-amber-800/60 font-semibold"
                  : "bg-transparent text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900 border border-transparent"
              }`}
            >
              <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
              <span>Favorites</span>
            </motion.button>
          </div>
        )}
      </div>

      {/* Scrollable Records List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {filteredEntries.length === 0 ? (
          <div className="h-48 flex flex-col items-center justify-center text-center p-4">
            <Lock className="w-7 h-7 text-zinc-700 mb-2" />
            <span className="text-xs font-semibold text-zinc-400">No passwords found</span>
            <span className="text-[11px] text-zinc-600 mt-1">
              {searchQuery ? "Try refining your search keyword" : "Click 'New' to save your first password"}
            </span>
          </div>
        ) : (
          filteredEntries.map((entry, index) => {
            const isSelected = entry.id === selectedEntryId;
            const subtitle = entry.username || entry.url || "Encrypted credential";

            return (
              <motion.div
                key={entry.id}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.12, delay: Math.min(index * 0.015, 0.2) }}
                whileHover={{ y: -1 }}
                whileTap={{ scale: 0.99 }}
                onClick={() => onSelectEntry(entry.id)}
                className={`w-full p-2.5 rounded-xl border transition-all cursor-pointer flex flex-col gap-1 ${
                  isSelected
                    ? "bg-[#1C1C20] border-zinc-500 shadow-sm text-white"
                    : "bg-[#121214] border-[#232326] hover:bg-[#161619] hover:border-zinc-700 text-zinc-300"
                }`}
              >
                {/* Top Row: Icon + Title + Fav/Badge */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <ServiceIcon
                      title={entry.title}
                      url={entry.url}
                      size={16}
                      className="w-7 h-7 rounded-lg"
                    />
                    <span className="text-xs font-semibold text-white truncate font-sans">
                      {entry.title}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {entry.favorite && (
                      <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                    )}
                    <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-400 border border-zinc-700 font-medium">
                      LOGIN
                    </span>
                  </div>
                </div>

                {/* Subtitle / Username */}
                <div className="flex items-center justify-between text-[11px] font-sans text-zinc-400 pl-9">
                  <span className="truncate">{subtitle}</span>
                  {entry.security_questions && entry.security_questions.length > 0 && (
                    <span className="text-[10px] text-zinc-500 ml-2 flex-shrink-0 font-mono">
                      • 2FA
                    </span>
                  )}
                </div>
              </motion.div>
            );
          })
        )}
      </div>
    </section>
  );
};
