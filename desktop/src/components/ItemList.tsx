import React, { useState, useRef, useEffect, useMemo } from "react";
import { motion } from "motion/react";
import { VaultEntry, VaultCategory } from "../types";
import { SpotlightCard } from "./reactbits/SpotlightCard";
import { StarBorder } from "./reactbits/StarBorder";
import {
  Search,
  Plus,
  KeyRound,
  Lock,
  Star,
  Globe,
  Trash2,
} from "lucide-react";

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
    <section className="w-88 flex-shrink-0 bg-[#0D0F17]/80 backdrop-blur-xl border-r border-[#242B3D]/80 flex flex-col h-screen select-none relative z-10">
      {/* Top Header Bar */}
      <div className="p-4 border-b border-[#242B3D]/70 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex flex-col">
            <h1 className="text-sm font-bold text-white tracking-tight">
              {categoryTitles[activeCategory] || "Passwords"}
            </h1>
            <span className="text-[11px] font-mono text-slate-400">
              {filteredEntries.length} {filteredEntries.length === 1 ? "password" : "passwords"} • Zero-Knowledge
            </span>
          </div>

          {/* Add Password CTA with StarBorder or Empty Trash */}
          {activeCategory === "trash" ? (
            onEmptyTrash && (
              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={onEmptyTrash}
                className="px-2.5 py-1.5 rounded-lg bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/40 text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                <span>Empty Trash</span>
              </motion.button>
            )
          ) : (
            <StarBorder
              onClick={onOpenCreateLogin}
              color="#6366F1"
              trailColor="#38BDF8"
              className="px-0 py-0"
            >
              <div className="flex items-center gap-1.5 text-xs font-semibold text-white py-0.5 px-1">
                <Plus className="w-3.5 h-3.5 text-[#38BDF8]" />
                <span>New</span>
                <kbd className="hidden sm:inline-block text-[9px] font-mono px-1 py-0.2 rounded bg-white/10 text-slate-300 ml-1">
                  Ctrl+N
                </kbd>
              </div>
            </StarBorder>
          )}
        </div>

        {/* Search Bar Input */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search passwords, accounts, URLs..."
            className="w-full bg-[#161B26]/80 border border-[#242B3D] rounded-xl pl-9 pr-14 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#38BDF8]/60 focus:ring-1 focus:ring-[#38BDF8]/30 transition-all font-sans"
          />
          <kbd className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-400">
            Ctrl+K
          </kbd>
        </div>

        {/* Filter Chips (Visible in "All" and "Logins" view) */}
        {activeCategory !== "trash" && activeCategory !== "archive" && (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-none">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setFilterMode("all")}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all cursor-pointer ${
                filterMode === "all"
                  ? "bg-[#6366F1]/20 text-[#38BDF8] border border-[#6366F1]/40 font-semibold"
                  : "bg-slate-800/40 text-slate-400 hover:text-slate-200 border border-transparent"
              }`}
            >
              All Passwords
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setFilterMode("favorites")}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all cursor-pointer flex items-center gap-1.5 ${
                filterMode === "favorites"
                  ? "bg-amber-500/20 text-amber-300 border border-amber-500/40 font-semibold"
                  : "bg-slate-800/40 text-slate-400 hover:text-slate-200 border border-transparent"
              }`}
            >
              <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
              <span>Favorites</span>
            </motion.button>
          </div>
        )}
      </div>

      {/* Scrollable Records List with SpotlightCard */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
        {filteredEntries.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="h-48 flex flex-col items-center justify-center text-center p-4"
          >
            <Lock className="w-8 h-8 text-slate-600 mb-2" />
            <span className="text-xs font-medium text-slate-400">No passwords found</span>
            <span className="text-[11px] text-slate-500 mt-1">
              {searchQuery ? "Try refining your search keyword" : "Click 'New' to save your first password"}
            </span>
          </motion.div>
        ) : (
          filteredEntries.map((entry, index) => {
            const isSelected = entry.id === selectedEntryId;
            const subtitle = entry.username || entry.url || "Encrypted credential";

            return (
              <motion.div
                key={entry.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.14, delay: Math.min(index * 0.02, 0.25) }}
                whileHover={{ scale: 1.01, x: 2 }}
                whileTap={{ scale: 0.985 }}
                onClick={() => onSelectEntry(entry.id)}
                className="w-full cursor-pointer"
              >
                <SpotlightCard
                  spotlightColor={isSelected ? "rgba(56, 189, 248, 0.15)" : "rgba(99, 102, 241, 0.08)"}
                  borderGlowColor={isSelected ? "rgba(56, 189, 248, 0.45)" : "rgba(99, 102, 241, 0.25)"}
                  className={`w-full p-3 rounded-xl transition-all relative ${
                    isSelected
                      ? "bg-[#161B26] border-[#38BDF8]/60 shadow-lg shadow-[#6366F1]/10 ring-1 ring-[#38BDF8]/40"
                      : "bg-[#161B26]/60 border-[#242B3D]/70 hover:bg-[#161B26]/90 hover:border-slate-700"
                  }`}
                >
                  {/* Left Active Rail for Selected Item */}
                  {isSelected && (
                    <span className="absolute left-0 top-2.5 bottom-2.5 w-1 rounded-r-full bg-[#38BDF8]" />
                  )}

                  {/* Top Row: Icon + Title + Fav/Badge */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-7 h-7 rounded-lg bg-[#0D0F17] border border-[#242B3D] flex items-center justify-center flex-shrink-0 text-[#38BDF8]">
                        {entry.url ? (
                          <Globe className="w-3.5 h-3.5 text-[#38BDF8]" />
                        ) : (
                          <KeyRound className="w-3.5 h-3.5 text-[#38BDF8]" />
                        )}
                      </div>
                      <span className="text-xs font-semibold text-white truncate">
                        {entry.title}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {entry.favorite && (
                        <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                      )}
                      <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-indigo-950/60 text-[#38BDF8] border border-indigo-800/60 font-semibold">
                        LOGIN
                      </span>
                    </div>
                  </div>

                  {/* Subtitle / Username */}
                  <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 pl-9 mt-1">
                    <span className="truncate">{subtitle}</span>
                    {entry.security_questions && entry.security_questions.length > 0 && (
                      <span className="text-[10px] text-[#38BDF8] ml-2 flex-shrink-0 font-medium">
                        • 2FA
                      </span>
                    )}
                  </div>
                </SpotlightCard>
              </motion.div>
            );
          })
        )}
      </div>
    </section>
  );
};
