import React, { useState, useRef, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import { VaultEntry, VaultCategory, EntryType } from "../types";
import { getEntryCategory, parseCardData, parseIdData } from "../services/entryHelpers";
import {
  Search,
  Plus,
  KeyRound,
  CreditCard,
  Contact,
  ChevronDown,
  Lock,
  Star,
} from "lucide-react";

interface ItemListProps {
  entries: VaultEntry[];
  selectedEntryId: string | null;
  onSelectEntry: (id: string) => void;
  activeCategory: VaultCategory;
  onOpenCreateLogin: () => void;
  onOpenAddCard: () => void;
  onOpenAddId: () => void;
  onEmptyTrash?: () => void;
}

export const ItemList: React.FC<ItemListProps> = ({
  entries,
  selectedEntryId,
  onSelectEntry,
  activeCategory,
  onOpenCreateLogin,
  onOpenAddCard,
  onOpenAddId,
  onEmptyTrash,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | EntryType>("all");
  const [showAddMenu, setShowAddMenu] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Ctrl+K shortcut listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Close add dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowAddMenu(false);
      }
    };
    if (showAddMenu) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showAddMenu]);

  // Filter entries according to active sidebar category + search query + chip filter
  const filteredEntries = useMemo(() => {
    return entries.filter((entry) => {
      const cat = getEntryCategory(entry);
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

        if (activeCategory === "logins" && cat !== "login") return false;
        if (activeCategory === "cards" && cat !== "card") return false;
        if (activeCategory === "ids" && cat !== "id") return false;
      }

      // Secondary type chip filter in "all" view
      if (activeCategory === "all" && typeFilter !== "all" && cat !== typeFilter) {
        return false;
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
  }, [entries, activeCategory, typeFilter, searchQuery]);

  const categoryTitles: Record<VaultCategory, string> = {
    all: "All Items",
    logins: "Logins",
    cards: "Payment Cards",
    ids: "Personal IDs",
    archive: "Archived Items",
    trash: "Trash Bin",
  };

  return (
    <section className="w-88 flex-shrink-0 bg-[#11131B] border-r border-[#242B3D] flex flex-col h-screen select-none">
      {/* Top Header Bar */}
      <div className="p-4 border-b border-[#242B3D]/70 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex flex-col">
            <h1 className="text-base font-bold text-white tracking-tight">
              {categoryTitles[activeCategory]}
            </h1>
            <span className="text-[11px] font-mono text-slate-400">
              {filteredEntries.length} {filteredEntries.length === 1 ? "record" : "records"} • E2E Encrypted
            </span>
          </div>

          {/* Add Item or Empty Trash Action */}
          {activeCategory === "trash" ? (
            onEmptyTrash && (
              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={onEmptyTrash}
                className="px-2.5 py-1.5 rounded-lg bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/40 text-xs font-semibold transition-colors cursor-pointer"
              >
                Empty Trash
              </motion.button>
            )
          ) : (
            <div className="relative" ref={menuRef}>
              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => setShowAddMenu((prev) => !prev)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#6366F1] hover:bg-[#5254e0] text-white text-xs font-semibold shadow-md shadow-[#6366F1]/20 transition-all cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Item</span>
                <ChevronDown className="w-3 h-3 ml-0.5" />
              </motion.button>

              {/* Add Dropdown Popover */}
              <AnimatePresence>
                {showAddMenu && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.94, y: -6 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.94, y: -6 }}
                    transition={{ duration: 0.14 }}
                    className="absolute right-0 top-full mt-2 w-52 bg-[#161B26] border border-[#242B3D] rounded-xl shadow-2xl p-1.5 z-50 flex flex-col gap-1 backdrop-blur-md"
                  >
                    <motion.button
                      whileHover={{ x: 2 }}
                      onClick={() => {
                        setShowAddMenu(false);
                        onOpenCreateLogin();
                      }}
                      className="flex items-center gap-2.5 w-full px-3 py-2 text-xs font-medium text-slate-200 hover:text-white hover:bg-[#6366F1]/20 rounded-lg transition-colors text-left cursor-pointer"
                    >
                      <KeyRound className="w-3.5 h-3.5 text-indigo-400" />
                      <span>New Login Credential</span>
                    </motion.button>

                    <motion.button
                      whileHover={{ x: 2 }}
                      onClick={() => {
                        setShowAddMenu(false);
                        onOpenAddCard();
                      }}
                      className="flex items-center gap-2.5 w-full px-3 py-2 text-xs font-medium text-slate-200 hover:text-white hover:bg-[#6366F1]/20 rounded-lg transition-colors text-left cursor-pointer"
                    >
                      <CreditCard className="w-3.5 h-3.5 text-[#38BDF8]" />
                      <span>Add Payment Card</span>
                    </motion.button>

                    <motion.button
                      whileHover={{ x: 2 }}
                      onClick={() => {
                        setShowAddMenu(false);
                        onOpenAddId();
                      }}
                      className="flex items-center gap-2.5 w-full px-3 py-2 text-xs font-medium text-slate-200 hover:text-white hover:bg-[#6366F1]/20 rounded-lg transition-colors text-left cursor-pointer"
                    >
                      <Contact className="w-3.5 h-3.5 text-purple-400" />
                      <span>Add Personal ID</span>
                    </motion.button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>

        {/* Search Bar Input */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search items, cards, IDs..."
            className="w-full bg-[#0D0F17] border border-[#242B3D] rounded-lg pl-9 pr-14 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#6366F1] focus:ring-1 focus:ring-[#6366F1] transition-all font-sans"
          />
          <kbd className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-400">
            Ctrl+K
          </kbd>
        </div>

        {/* Filter Chips (Visible in "All Items" view) */}
        {activeCategory === "all" && (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-none">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setTypeFilter("all")}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer ${
                typeFilter === "all"
                  ? "bg-indigo-600/25 text-indigo-300 border border-indigo-500/40 font-semibold"
                  : "bg-slate-800/40 text-slate-400 hover:text-slate-200 border border-transparent"
              }`}
            >
              All
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setTypeFilter("login")}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer ${
                typeFilter === "login"
                  ? "bg-indigo-600/25 text-indigo-300 border border-indigo-500/40 font-semibold"
                  : "bg-slate-800/40 text-slate-400 hover:text-slate-200 border border-transparent"
              }`}
            >
              Logins
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setTypeFilter("card")}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer ${
                typeFilter === "card"
                  ? "bg-sky-600/25 text-sky-300 border border-sky-500/40 font-semibold"
                  : "bg-slate-800/40 text-slate-400 hover:text-slate-200 border border-transparent"
              }`}
            >
              Cards
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setTypeFilter("id")}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer ${
                typeFilter === "id"
                  ? "bg-purple-600/25 text-purple-300 border border-purple-500/40 font-semibold"
                  : "bg-slate-800/40 text-slate-400 hover:text-slate-200 border border-transparent"
              }`}
            >
              IDs
            </motion.button>
          </div>
        )}
      </div>

      {/* Scrollable Records List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
        {filteredEntries.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="h-48 flex flex-col items-center justify-center text-center p-4"
          >
            <Lock className="w-8 h-8 text-slate-600 mb-2" />
            <span className="text-xs font-medium text-slate-400">No records found</span>
            <span className="text-[11px] text-slate-500 mt-1">
              {searchQuery ? "Try refining your search keyword" : "Add an item to populate this vault category"}
            </span>
          </motion.div>
        ) : (
          filteredEntries.map((entry, index) => {
            const cat = getEntryCategory(entry);
            const isSelected = entry.id === selectedEntryId;

            // Render details depending on category
            let subtitle = entry.username || entry.url || "No username";
            let iconElement = <KeyRound className="w-4 h-4 text-indigo-400" />;
            let badgeText = "LOGIN";
            let badgeClass = "bg-indigo-950/60 text-indigo-400 border-indigo-800/60";

            if (cat === "card") {
              const cardData = parseCardData(entry);
              const last4 = cardData.cardNumber.slice(-4) || "••••";
              subtitle = `•••• ${last4} • Exp ${cardData.expMonth}/${cardData.expYear}`;
              iconElement = <CreditCard className="w-4 h-4 text-[#38BDF8]" />;
              badgeText = "CARD";
              badgeClass = "bg-sky-950/60 text-sky-400 border-sky-800/60";
            } else if (cat === "id") {
              const idData = parseIdData(entry);
              subtitle = `${idData.documentNumber} • ${idData.issuingAuthority}`;
              iconElement = <Contact className="w-4 h-4 text-purple-400" />;
              badgeText = "ID";
              badgeClass = "bg-purple-950/60 text-purple-400 border-purple-800/60";
            }

            return (
              <motion.div
                key={entry.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.14, delay: Math.min(index * 0.02, 0.25) }}
                whileHover={{ scale: 1.012, x: 2 }}
                whileTap={{ scale: 0.985 }}
                onClick={() => onSelectEntry(entry.id)}
                className={`w-full p-3 rounded-xl border transition-colors cursor-pointer flex flex-col gap-1.5 ${
                  isSelected
                    ? "bg-[#161B26] border-[#6366F1] shadow-lg shadow-[#6366F1]/10 ring-1 ring-[#6366F1]"
                    : "bg-[#161B26]/60 border-[#242B3D]/70 hover:bg-[#161B26] hover:border-slate-700"
                }`}
              >
                {/* Item Top Row */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-7 h-7 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center flex-shrink-0">
                      {iconElement}
                    </div>
                    <span className="text-xs font-semibold text-white truncate">
                      {entry.title}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {entry.favorite && (
                      <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                    )}
                    <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded border font-semibold ${badgeClass}`}>
                      {badgeText}
                    </span>
                  </div>
                </div>

                {/* Item Subtitle / Meta */}
                <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 pl-9">
                  <span className="truncate">{subtitle}</span>
                  {cat === "login" && entry.security_questions && entry.security_questions.length > 0 && (
                    <span className="text-[10px] text-[#38BDF8] ml-2 flex-shrink-0 font-medium">
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
