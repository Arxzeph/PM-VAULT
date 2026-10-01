import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { VaultEntry, VaultCategory } from "../types";
import {
  getEntryCategory,
  parseCardData,
  parseIdData,
  formatCardPan,
  isEntryArchived,
  isEntryTrash,
} from "../services/entryHelpers";
import { copyWithAutoWipe } from "../services/clipboard";
import {
  KeyRound,
  CreditCard,
  Contact,
  Copy,
  Check,
  Eye,
  EyeOff,
  ExternalLink,
  Star,
  Edit3,
  MoreVertical,
  Lock,
  Trash2,
  Archive,
  RefreshCw,
  FileText,
} from "lucide-react";

interface ItemInspectorProps {
  entry: VaultEntry | null;
  activeCategory?: VaultCategory;
  onEdit: (entry: VaultEntry) => void;
  onArchive: (id: string) => void;
  onUnarchive: (id: string) => void;
  onMoveToTrash: (id: string) => void;
  onRestoreFromTrash: (id: string) => void;
  onPermanentDelete: (id: string) => void;
  onToggleFavorite: (id: string) => void;
}

export const ItemInspector: React.FC<ItemInspectorProps> = ({
  entry,
  activeCategory: _activeCategory,
  onEdit,
  onArchive,
  onUnarchive,
  onMoveToTrash,
  onRestoreFromTrash,
  onPermanentDelete,
  onToggleFavorite,
}) => {
  const [showPassword, setShowPassword] = useState(false);
  const [showCvv, setShowCvv] = useState(false);
  const [showPin, setShowPin] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [totpSeconds, setTotpSeconds] = useState(24);
  const moreMenuRef = useRef<HTMLDivElement>(null);

  // Close overflow menu on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(e.target as Node)) {
        setShowMoreMenu(false);
      }
    };
    if (showMoreMenu) {
      document.addEventListener("mousedown", handleOutsideClick);
    }
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [showMoreMenu]);

  // Simulated TOTP 30-second cycle
  useEffect(() => {
    const interval = setInterval(() => {
      setTotpSeconds((prev) => (prev <= 1 ? 30 : prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleCopy = (text: string, key: string, _label?: string) => {
    copyWithAutoWipe(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  if (!entry) {
    return (
      <motion.main
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
        className="flex-1 bg-[#0D0F17] flex flex-col items-center justify-center p-8 text-center select-none"
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 25 }}
          className="w-16 h-16 rounded-2xl bg-[#161B26] border border-[#242B3D] flex items-center justify-center mb-4 text-slate-500 shadow-xl"
        >
          <Lock className="w-8 h-8 text-[#6366F1]" />
        </motion.div>
        <h2 className="text-base font-bold text-white">No Item Selected</h2>
        <p className="text-xs text-slate-400 max-w-sm mt-1.5 leading-relaxed">
          Select a credential, payment card, or personal ID from the list to decrypt and inspect its zero-knowledge details.
        </p>
      </motion.main>
    );
  }

  const cat = getEntryCategory(entry);
  const isArchived = isEntryArchived(entry);
  const isTrash = isEntryTrash(entry);

  return (
    <main className="flex-1 bg-[#0D0F17] overflow-y-auto flex flex-col h-screen select-none">
      {/* Top Inspector Header Bar */}
      <div className="p-6 border-b border-[#242B3D] flex items-center justify-between sticky top-0 bg-[#0D0F17]/95 backdrop-blur-md z-30">
        {/* Left: Avatar, Title, and Badges */}
        <div className="flex items-center gap-3.5 min-w-0">
          <div className="w-11 h-11 rounded-xl bg-[#161B26] border border-[#242B3D] flex items-center justify-center text-white shadow-md flex-shrink-0">
            {cat === "card" ? (
              <CreditCard className="w-5 h-5 text-[#38BDF8]" />
            ) : cat === "id" ? (
              <Contact className="w-5 h-5 text-purple-400" />
            ) : (
              <KeyRound className="w-5 h-5 text-indigo-400" />
            )}
          </div>

          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg font-bold text-white truncate">{entry.title}</h2>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 uppercase font-semibold">
                {cat.toUpperCase()}
              </span>
              {isArchived && (
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30 uppercase font-semibold">
                  ARCHIVED
                </span>
              )}
              {isTrash && (
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-rose-500/15 text-rose-300 border border-rose-500/30 uppercase font-semibold">
                  TRASH
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 text-xs font-mono text-slate-400 mt-0.5">
              <span>{entry.url || entry.username || "Personal Vault"}</span>
              <span>•</span>
              <span className="text-[#38BDF8]">AES-256-GCM Enclave</span>
            </div>
          </div>
        </div>

        {/* Right: Actions and Three-Dots Menu */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Favorite Toggle */}
          <motion.button
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.92 }}
            onClick={() => onToggleFavorite(entry.id)}
            title={entry.favorite ? "Unmark Favorite" : "Mark as Favorite"}
            className={`p-2 rounded-lg border transition-colors cursor-pointer ${
              entry.favorite
                ? "bg-amber-400/10 border-amber-400/40 text-amber-400"
                : "border-[#242B3D] text-slate-400 hover:text-white hover:bg-[#161B26]"
            }`}
          >
            <Star className={`w-4 h-4 ${entry.favorite ? "fill-amber-400" : ""}`} />
          </motion.button>

          {/* Edit Button */}
          {!isTrash && (
            <motion.button
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.96 }}
              onClick={() => onEdit(entry)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#242B3D] hover:border-slate-600 bg-[#161B26] text-xs font-semibold text-slate-200 hover:text-white transition-colors cursor-pointer"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>Edit</span>
            </motion.button>
          )}

          {/* Overflow Menu (Three Dots) */}
          <div className="relative" ref={moreMenuRef}>
            <motion.button
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.92 }}
              onClick={() => setShowMoreMenu((prev) => !prev)}
              className="p-2 rounded-lg border border-[#242B3D] hover:border-slate-600 bg-[#161B26] text-slate-300 hover:text-white transition-colors cursor-pointer"
              title="More options"
            >
              <MoreVertical className="w-4 h-4" />
            </motion.button>

            {/* Dropdown Popover */}
            <AnimatePresence>
              {showMoreMenu && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.94, y: -6 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.94, y: -6 }}
                  transition={{ duration: 0.14 }}
                  className="absolute right-0 top-full mt-2 w-48 bg-[#161B26] border border-[#242B3D] rounded-xl shadow-2xl p-1.5 z-50 flex flex-col gap-1 backdrop-blur-md"
                >
                  {isTrash ? (
                    <>
                      <button
                        onClick={() => {
                          setShowMoreMenu(false);
                          onRestoreFromTrash(entry.id);
                        }}
                        className="flex items-center gap-2.5 w-full px-3 py-2 text-xs font-medium text-slate-200 hover:text-white hover:bg-[#6366F1]/20 rounded-lg transition-colors text-left cursor-pointer"
                      >
                        <RefreshCw className="w-3.5 h-3.5 text-indigo-400" />
                        <span>Restore to Vault</span>
                      </button>
                      <button
                        onClick={() => {
                          setShowMoreMenu(false);
                          onPermanentDelete(entry.id);
                        }}
                        className="flex items-center gap-2.5 w-full px-3 py-2 text-xs font-medium text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 rounded-lg transition-colors text-left cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Permanently Delete</span>
                      </button>
                    </>
                  ) : isArchived ? (
                    <>
                      <button
                        onClick={() => {
                          setShowMoreMenu(false);
                          onUnarchive(entry.id);
                        }}
                        className="flex items-center gap-2.5 w-full px-3 py-2 text-xs font-medium text-slate-200 hover:text-white hover:bg-[#6366F1]/20 rounded-lg transition-colors text-left cursor-pointer"
                      >
                        <RefreshCw className="w-3.5 h-3.5 text-indigo-400" />
                        <span>Restore to Vault</span>
                      </button>
                      <button
                        onClick={() => {
                          setShowMoreMenu(false);
                          onMoveToTrash(entry.id);
                        }}
                        className="flex items-center gap-2.5 w-full px-3 py-2 text-xs font-medium text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 rounded-lg transition-colors text-left cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Move to Trash</span>
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => {
                          setShowMoreMenu(false);
                          onArchive(entry.id);
                        }}
                        className="flex items-center gap-2.5 w-full px-3 py-2 text-xs font-medium text-slate-200 hover:text-white hover:bg-[#6366F1]/20 rounded-lg transition-colors text-left cursor-pointer"
                      >
                        <Archive className="w-3.5 h-3.5 text-amber-400" />
                        <span>Archive Record</span>
                      </button>
                      <button
                        onClick={() => {
                          setShowMoreMenu(false);
                          onMoveToTrash(entry.id);
                        }}
                        className="flex items-center gap-2.5 w-full px-3 py-2 text-xs font-medium text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 rounded-lg transition-colors text-left cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Move to Trash</span>
                      </button>
                    </>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Main Inspector Body Content with transition on item change */}
      <AnimatePresence mode="wait">
        <motion.div
          key={entry.id}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.16 }}
          className="p-6 max-w-4xl w-full mx-auto flex flex-col gap-6"
        >
        {/* ============================================================ */}
        {/* LOGIN RECORD VIEW                                            */}
        {/* ============================================================ */}
        {cat === "login" && (
          <>
            {/* Credentials Card */}
            <div className="bg-[#161B26] border border-[#242B3D] rounded-2xl p-5 flex flex-col gap-4 shadow-xl">
              <h3 className="text-xs font-mono font-bold tracking-wider text-slate-400 uppercase">
                CREDENTIALS & AUTHENTICATION
              </h3>

              {/* Username Field */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-slate-400">Username / Handle</label>
                <div className="flex items-center justify-between bg-[#0D0F17] border border-[#242B3D] rounded-xl px-3.5 py-2.5">
                  <span className="font-mono text-xs text-white truncate">
                    {entry.username || "—"}
                  </span>
                  {entry.username && (
                    <motion.button
                      whileHover={{ scale: 1.04 }}
                      whileTap={{ scale: 0.96 }}
                      onClick={() => handleCopy(entry.username!, "user", "Username")}
                      className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg border border-slate-700/60 transition-colors cursor-pointer"
                    >
                      {copiedKey === "user" ? (
                        <>
                          <Check className="w-3 h-3 text-[#38BDF8]" />
                          <span>Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          <span>Copy</span>
                        </>
                      )}
                    </motion.button>
                  )}
                </div>
              </div>

              {/* Password Field (Smooth un-squished layout) */}
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-slate-400">Password</label>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">
                    AES-256-GCM Hardware Sealed
                  </span>
                </div>

                <div className="flex items-center justify-between bg-[#0D0F17] border border-[#242B3D] rounded-xl px-3.5 py-2.5">
                  <span className="font-mono text-xs text-white tracking-wider truncate">
                    {showPassword ? entry.password || "—" : "••••••••••••••••••••"}
                  </span>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setShowPassword((prev) => !prev)}
                      className="p-1 text-slate-400 hover:text-white transition-colors cursor-pointer"
                      title={showPassword ? "Hide password" : "Reveal password"}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>

                    {entry.password && (
                      <motion.button
                        whileHover={{ scale: 1.04 }}
                        whileTap={{ scale: 0.96 }}
                        onClick={() => handleCopy(entry.password!, "pass", "Password")}
                        className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg border border-slate-700/60 transition-colors cursor-pointer"
                      >
                        {copiedKey === "pass" ? (
                          <>
                            <Check className="w-3 h-3 text-[#38BDF8]" />
                            <span>Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" />
                            <span>Copy</span>
                          </>
                        )}
                      </motion.button>
                    )}
                  </div>
                </div>

                {/* Password Strength Meter (Ice blue & Electric indigo gradient, ZERO GREEN) */}
                <div className="mt-1 flex flex-col gap-1">
                  <div className="h-1.5 w-full bg-slate-800/80 rounded-full overflow-hidden flex gap-0.5">
                    <div className="flex-1 bg-[#6366F1] rounded-l-full" />
                    <div className="flex-1 bg-[#6366F1]" />
                    <div className="flex-1 bg-[#38BDF8]" />
                    <div className="flex-1 bg-[#38BDF8] rounded-r-full" />
                  </div>
                  <span className="text-[10px] font-mono text-[#38BDF8] text-right">
                    Entropy 114 bits • Zero Known Breaches
                  </span>
                </div>
              </div>

              {/* Website URL Field */}
              {entry.url && (
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-slate-400">Website URL</label>
                  <div className="flex items-center justify-between bg-[#0D0F17] border border-[#242B3D] rounded-xl px-3.5 py-2.5">
                    <span className="font-mono text-xs text-indigo-300 truncate">{entry.url}</span>
                    <a
                      href={entry.url.startsWith("http") ? entry.url : `https://${entry.url}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg border border-slate-700/60 transition-colors cursor-pointer"
                    >
                      <ExternalLink className="w-3 h-3" />
                      <span>Launch</span>
                    </a>
                  </div>
                </div>
              )}
            </div>

            {/* TOTP 2FA Card */}
            <div className="bg-[#161B26] border border-[#242B3D] rounded-2xl p-5 flex flex-col gap-4 shadow-xl">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-mono font-bold tracking-wider text-slate-400 uppercase">
                  TWO-FACTOR AUTHENTICATION (TOTP)
                </h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">
                  RFC 6238
                </span>
              </div>

              <div className="flex items-center justify-between bg-[#0D0F17] border border-[#242B3D] rounded-xl p-4">
                <div className="flex flex-col">
                  <span className="text-[11px] font-mono text-slate-400">ONE-TIME CODE</span>
                  <span className="text-3xl font-mono font-bold tracking-widest text-white mt-1">
                    842 190
                  </span>
                </div>

                <div className="flex items-center gap-4">
                  {/* Countdown Circular Ring */}
                  <div className="flex flex-col items-center">
                    <div className="w-10 h-10 rounded-full border-2 border-slate-700 border-t-[#38BDF8] flex items-center justify-center font-mono text-xs font-bold text-[#38BDF8] animate-pulse">
                      {totpSeconds}s
                    </div>
                  </div>

                  <motion.button
                    whileHover={{ scale: 1.04 }}
                    whileTap={{ scale: 0.96 }}
                    onClick={() => handleCopy("842190", "totp", "TOTP Code")}
                    className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-[#6366F1] hover:bg-[#5254e0] text-white text-xs font-semibold shadow-md shadow-[#6366F1]/20 transition-all cursor-pointer"
                  >
                    {copiedKey === "totp" ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedKey === "totp" ? "Copied" : "Copy Code"}</span>
                  </motion.button>
                </div>
              </div>
            </div>

            {/* Security Audit Telemetry */}
            <div className="bg-[#161B26] border border-[#242B3D] rounded-2xl p-5 flex flex-col gap-3 shadow-xl">
              <h3 className="text-xs font-mono font-bold tracking-wider text-slate-400 uppercase">
                SECURITY TELEMETRY & AUDIT
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-[#0D0F17] border border-[#242B3D] rounded-xl p-3 flex flex-col gap-1">
                  <span className="text-[11px] font-mono text-slate-400">BREACH MONITOR</span>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="w-2 h-2 rounded-full bg-[#38BDF8]" />
                    <span className="text-xs font-bold text-white">0 Compromises Found</span>
                  </div>
                </div>

                <div className="bg-[#0D0F17] border border-[#242B3D] rounded-xl p-3 flex flex-col gap-1">
                  <span className="text-[11px] font-mono text-slate-400">KEY DERIVATION</span>
                  <span className="text-xs font-bold text-slate-200 mt-0.5 font-mono">
                    Argon2id (64MB / 3 Iter)
                  </span>
                </div>
              </div>
            </div>
          </>
        )}

        {/* ============================================================ */}
        {/* PAYMENT CARD RECORD VIEW                                     */}
        {/* ============================================================ */}
        {cat === "card" && (() => {
          const cardData = parseCardData(entry);
          const formattedPan = formatCardPan(cardData.cardNumber);

          return (
            <>
              {/* Glassmorphic Digital Card Visualizer */}
              <div className="bg-gradient-to-tr from-slate-900 via-[#1A1F2E] to-[#252B3B] border border-indigo-500/30 rounded-2xl p-6 shadow-2xl relative overflow-hidden flex flex-col justify-between h-56 select-none">
                {/* Card Top Row */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {/* Gold EMV Contact Chip Visual */}
                    <div className="w-11 h-8 rounded-md bg-amber-400/80 border border-amber-300/80 flex items-center justify-center relative overflow-hidden shadow">
                      <div className="w-full h-[1px] bg-amber-600/60 my-auto" />
                      <div className="w-[1px] h-full bg-amber-600/60 mx-auto" />
                    </div>
                    {/* Contactless Wave */}
                    <span className="text-slate-400 text-xs font-mono">((( )))</span>
                  </div>

                  <span className="text-sm font-bold tracking-widest text-white uppercase font-mono">
                    {cardData.brand.toUpperCase()}
                  </span>
                </div>

                {/* Card Number PAN */}
                <div className="flex items-center justify-between my-auto">
                  <span className="font-mono text-xl font-bold tracking-widest text-white drop-shadow">
                    {showPassword ? formattedPan : `••••  ••••  ••••  ${cardData.cardNumber.slice(-4) || "8821"}`}
                  </span>
                  <button
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="p-1.5 text-slate-400 hover:text-white transition-colors cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>

                {/* Card Bottom Row */}
                <div className="flex items-center justify-between text-xs font-mono text-slate-300">
                  <div className="flex flex-col">
                    <span className="text-[9px] text-slate-400 tracking-wider">CARDHOLDER</span>
                    <span className="font-bold tracking-wide text-white uppercase">{cardData.cardholderName}</span>
                  </div>

                  <div className="flex items-center gap-6">
                    <div className="flex flex-col">
                      <span className="text-[9px] text-slate-400 tracking-wider">EXPIRES</span>
                      <span className="font-bold text-white">{cardData.expMonth} / {cardData.expYear}</span>
                    </div>

                    <div className="flex flex-col">
                      <span className="text-[9px] text-slate-400 tracking-wider">CVV</span>
                      <span className="font-bold text-white">{showCvv ? cardData.cvv : "•••"}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Card Details Form Grid */}
              <div className="bg-[#161B26] border border-[#242B3D] rounded-2xl p-5 flex flex-col gap-4 shadow-xl">
                <h3 className="text-xs font-mono font-bold tracking-wider text-slate-400 uppercase">
                  CARD IDENTIFICATION & SECURITY
                </h3>

                <div className="grid grid-cols-2 gap-4">
                  {/* Cardholder */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-medium text-slate-400">Cardholder Name</label>
                    <div className="bg-[#0D0F17] border border-[#242B3D] rounded-xl px-3.5 py-2.5 text-xs font-mono text-white">
                      {cardData.cardholderName}
                    </div>
                  </div>

                  {/* Card Brand */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-medium text-slate-400">Card Brand</label>
                    <div className="bg-[#0D0F17] border border-[#242B3D] rounded-xl px-3.5 py-2.5 text-xs font-mono text-white uppercase">
                      {cardData.brand}
                    </div>
                  </div>

                  {/* Card Number */}
                  <div className="flex flex-col gap-1.5 col-span-2">
                    <label className="text-xs font-medium text-slate-400">Card Number (PAN)</label>
                    <div className="flex items-center justify-between bg-[#0D0F17] border border-[#242B3D] rounded-xl px-3.5 py-2.5">
                      <span className="font-mono text-xs text-white tracking-widest">
                        {showPassword ? formattedPan : `•••• •••• •••• ${cardData.cardNumber.slice(-4)}`}
                      </span>
                      <motion.button
                        whileHover={{ scale: 1.04 }}
                        whileTap={{ scale: 0.96 }}
                        onClick={() => handleCopy(cardData.cardNumber, "pan", "Card Number")}
                        className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg border border-slate-700/60 transition-colors cursor-pointer"
                      >
                        {copiedKey === "pan" ? <Check className="w-3 h-3 text-[#38BDF8]" /> : <Copy className="w-3 h-3" />}
                        <span>Copy</span>
                      </motion.button>
                    </div>
                  </div>

                  {/* Expiration */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-medium text-slate-400">Expiration Date</label>
                    <div className="bg-[#0D0F17] border border-[#242B3D] rounded-xl px-3.5 py-2.5 text-xs font-mono text-white">
                      {cardData.expMonth} / {cardData.expYear}
                    </div>
                  </div>

                  {/* CVV */}
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-medium text-slate-400">Security Code (CVV)</label>
                      <button
                        onClick={() => setShowCvv((prev) => !prev)}
                        className="text-[10px] text-indigo-400 hover:underline cursor-pointer"
                      >
                        {showCvv ? "Hide" : "Reveal"}
                      </button>
                    </div>
                    <div className="flex items-center justify-between bg-[#0D0F17] border border-[#242B3D] rounded-xl px-3.5 py-2.5">
                      <span className="font-mono text-xs text-white">
                        {showCvv ? cardData.cvv : "•••"}
                      </span>
                      <motion.button
                        whileHover={{ scale: 1.08 }}
                        whileTap={{ scale: 0.92 }}
                        onClick={() => handleCopy(cardData.cvv, "cvv")}
                        className="flex items-center gap-1 text-xs font-mono text-slate-300 hover:text-white cursor-pointer"
                      >
                        {copiedKey === "cvv" ? <Check className="w-3 h-3 text-[#38BDF8]" /> : <Copy className="w-3 h-3" />}
                      </motion.button>
                    </div>
                  </div>

                  {/* Card PIN */}
                  {cardData.pin && (
                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-medium text-slate-400">Card PIN</label>
                        <button
                          onClick={() => setShowPin((prev) => !prev)}
                          className="text-[10px] text-indigo-400 hover:underline cursor-pointer"
                        >
                          {showPin ? "Hide" : "Reveal"}
                        </button>
                      </div>
                      <div className="flex items-center justify-between bg-[#0D0F17] border border-[#242B3D] rounded-xl px-3.5 py-2.5">
                        <span className="font-mono text-xs text-white">
                          {showPin ? cardData.pin : "••••"}
                        </span>
                        <motion.button
                          whileHover={{ scale: 1.08 }}
                          whileTap={{ scale: 0.92 }}
                          onClick={() => handleCopy(cardData.pin!, "pin")}
                          className="flex items-center gap-1 text-xs font-mono text-slate-300 hover:text-white cursor-pointer"
                        >
                          {copiedKey === "pin" ? <Check className="w-3 h-3 text-[#38BDF8]" /> : <Copy className="w-3 h-3" />}
                        </motion.button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Billing Address if present */}
                {cardData.billingAddress && (
                  <div className="mt-2 pt-3 border-t border-[#242B3D] flex flex-col gap-1 text-xs font-mono text-slate-300">
                    <span className="text-[10px] text-slate-400 uppercase">BILLING ADDRESS</span>
                    <span>{cardData.billingAddress.street}</span>
                    <span>
                      {cardData.billingAddress.city}, {cardData.billingAddress.state} {cardData.billingAddress.zip}
                    </span>
                    <span>{cardData.billingAddress.country}</span>
                  </div>
                )}
              </div>
            </>
          );
        })()}

        {/* ============================================================ */}
        {/* PERSONAL ID RECORD VIEW (Clean data grid, NO fake banners!)   */}
        {/* ============================================================ */}
        {cat === "id" && (() => {
          const idData = parseIdData(entry);

          return (
            <>
              {/* Identity & Verification Details Grid */}
              <div className="bg-[#161B26] border border-[#242B3D] rounded-2xl p-5 flex flex-col gap-4 shadow-xl">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-mono font-bold tracking-wider text-slate-400 uppercase">
                    IDENTITY & VERIFICATION DETAILS
                  </h3>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-purple-500/15 text-purple-300 border border-purple-500/30 uppercase font-semibold">
                    {idData.idType.replace("_", " ")}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {/* Full Name */}
                  <div className="flex flex-col gap-1.5 col-span-2">
                    <label className="text-xs font-medium text-slate-400">Full Legal Name</label>
                    <div className="bg-[#0D0F17] border border-[#242B3D] rounded-xl px-3.5 py-2.5 text-xs font-mono font-semibold text-white">
                      {idData.fullName}
                    </div>
                  </div>

                  {/* Document Number */}
                  <div className="flex flex-col gap-1.5 col-span-2">
                    <label className="text-xs font-medium text-slate-400">Document / License #</label>
                    <div className="flex items-center justify-between bg-[#0D0F17] border border-[#242B3D] rounded-xl px-3.5 py-2.5">
                      <span className="font-mono text-xs font-semibold text-white tracking-wider">
                        {showPassword ? idData.documentNumber : "••••••••••••"}
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setShowPassword((prev) => !prev)}
                          className="p-1 text-slate-400 hover:text-white cursor-pointer"
                        >
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                        <motion.button
                          whileHover={{ scale: 1.04 }}
                          whileTap={{ scale: 0.96 }}
                          onClick={() => handleCopy(idData.documentNumber, "idnum", "Document Number")}
                          className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg border border-slate-700/60 transition-colors cursor-pointer"
                        >
                          {copiedKey === "idnum" ? <Check className="w-3 h-3 text-[#38BDF8]" /> : <Copy className="w-3 h-3" />}
                          <span>Copy</span>
                        </motion.button>
                      </div>
                    </div>
                  </div>

                  {/* Issuing Authority */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-medium text-slate-400">Issuing Authority</label>
                    <div className="bg-[#0D0F17] border border-[#242B3D] rounded-xl px-3.5 py-2.5 text-xs font-mono text-slate-200">
                      {idData.issuingAuthority}
                    </div>
                  </div>

                  {/* Nationality */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-medium text-slate-400">Nationality / Country</label>
                    <div className="bg-[#0D0F17] border border-[#242B3D] rounded-xl px-3.5 py-2.5 text-xs font-mono text-slate-200">
                      {idData.nationality || "United States"}
                    </div>
                  </div>

                  {/* Issue Date */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-medium text-slate-400">Date of Issue</label>
                    <div className="bg-[#0D0F17] border border-[#242B3D] rounded-xl px-3.5 py-2.5 text-xs font-mono text-slate-200">
                      {idData.issueDate || "—"}
                    </div>
                  </div>

                  {/* Expiry Date */}
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-medium text-slate-400">Expiration Date</label>
                      <span className="text-[10px] font-mono text-[#38BDF8]">Real ID Valid</span>
                    </div>
                    <div className="bg-[#0D0F17] border border-[#242B3D] rounded-xl px-3.5 py-2.5 text-xs font-mono text-slate-200">
                      {idData.expiryDate || "—"}
                    </div>
                  </div>

                  {/* Residential Address */}
                  {idData.address && (
                    <div className="flex flex-col gap-1.5 col-span-2">
                      <label className="text-xs font-medium text-slate-400">Residential Address</label>
                      <div className="bg-[#0D0F17] border border-[#242B3D] rounded-xl px-3.5 py-2.5 text-xs font-mono text-slate-200">
                        {idData.address}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Encrypted Attachments Section */}
              <div className="bg-[#161B26] border border-[#242B3D] rounded-2xl p-5 flex flex-col gap-3 shadow-xl">
                <h3 className="text-xs font-mono font-bold tracking-wider text-slate-400 uppercase">
                  ENCRYPTED VAULT ATTACHMENTS
                </h3>

                <div className="bg-[#0D0F17] border border-[#242B3D] rounded-xl p-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <FileText className="w-5 h-5 text-indigo-400" />
                    <div className="flex flex-col">
                      <span className="text-xs font-mono text-slate-200">identity_scan_front.vault</span>
                      <span className="text-[10px] font-mono text-slate-500">1.4 MB • AES-256 Sealed Blob</span>
                    </div>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300">
                    Sealed
                  </span>
                </div>
              </div>
            </>
          );
        })()}
        </motion.div>
      </AnimatePresence>
    </main>
  );
};
