import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { VaultEntry, VaultCategory } from "../types";
import { copyWithAutoWipe } from "../services/clipboard";
import { DecryptedText } from "./reactbits/DecryptedText";
import { ClickSpark } from "./reactbits/ClickSpark";
import { SpotlightCard } from "./reactbits/SpotlightCard";
import {
  KeyRound,
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
  Globe,
  FileText,
  ShieldCheck,
  HelpCircle,
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
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
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

  // Reset revealed password state whenever the selected entry changes
  useEffect(() => {
    setShowPassword(false);
  }, [entry?.id]);

  const handleCopy = (text: string, key: string) => {
    copyWithAutoWipe(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // Password Entropy / Strength Calculation (strictly no green)
  const calculatePasswordStrength = (pwd?: string | null) => {
    if (!pwd) return { label: "None", percent: 0, barColor: "bg-slate-700", textColor: "text-slate-500" };
    const len = pwd.length;
    let score = 0;
    if (len >= 8) score += 20;
    if (len >= 14) score += 25;
    if (len >= 20) score += 20;
    if (/[A-Z]/.test(pwd)) score += 10;
    if (/[a-z]/.test(pwd)) score += 10;
    if (/[0-9]/.test(pwd)) score += 10;
    if (/[^A-Za-z0-9]/.test(pwd)) score += 15;

    const percent = Math.min(score, 100);
    if (percent < 40) {
      return { label: "Weak", percent, barColor: "bg-rose-500", textColor: "text-rose-400" };
    } else if (percent < 70) {
      return { label: "Fair", percent, barColor: "bg-amber-500", textColor: "text-amber-400" };
    } else if (percent < 90) {
      return { label: "Strong", percent, barColor: "bg-[#6366F1]", textColor: "text-[#818CF8]" };
    } else {
      return { label: "Cryptographic", percent: 100, barColor: "bg-[#38BDF8]", textColor: "text-[#38BDF8]" };
    }
  };

  if (!entry) {
    return (
      <main className="flex-1 bg-[#0C0E16]/90 backdrop-blur-2xl flex flex-col items-center justify-center p-8 text-center select-none relative z-0">
        <motion.div
          initial={{ scale: 0.94, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.2 }}
          className="max-w-sm flex flex-col items-center gap-3 text-slate-500"
        >
          <div className="w-16 h-16 rounded-2xl bg-[#161B26]/80 border border-[#242B3D] flex items-center justify-center text-[#38BDF8] shadow-xl">
            <Lock className="w-8 h-8 text-[#38BDF8]" />
          </div>
          <h2 className="text-sm font-semibold text-slate-300">No Password Selected</h2>
          <p className="text-xs text-slate-400">
            Select a password from the list or create a new entry to inspect its encrypted credentials.
          </p>
        </motion.div>
      </main>
    );
  }

  const isArchived = (entry.tags || []).some((t) => t === "status:archived" || t === "archived");
  const isTrash = entry.is_deleted === true || (entry.tags || []).some((t) => t === "status:trash" || t === "trash");
  const strength = calculatePasswordStrength(entry.password);

  return (
    <main className="flex-1 bg-[#0C0E16]/90 backdrop-blur-2xl flex flex-col h-screen overflow-hidden select-none relative z-0">
      {/* Top Inspector Header */}
      <header className="px-8 py-5 border-b border-[#242B3D]/70 bg-[#0C0E16]/60 backdrop-blur-md flex items-center justify-between z-10">
        <div className="flex items-center gap-3.5 min-w-0">
          <div className="w-11 h-11 rounded-2xl bg-[#161B26] border border-[#242B3D] flex items-center justify-center flex-shrink-0 text-[#38BDF8] shadow-lg shadow-[#6366F1]/10">
            {entry.url ? (
              <Globe className="w-5 h-5 text-[#38BDF8]" />
            ) : (
              <KeyRound className="w-5 h-5 text-[#38BDF8]" />
            )}
          </div>
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-white tracking-tight truncate">
                {entry.title}
              </h1>
              {entry.favorite && (
                <Star className="w-4 h-4 text-amber-400 fill-amber-400 flex-shrink-0" />
              )}
            </div>
            <span className="text-[11px] font-mono text-slate-400 truncate">
              {entry.username || entry.url || "Encrypted Password Entry"}
            </span>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {/* Favorite Button */}
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => onToggleFavorite(entry.id)}
            title={entry.favorite ? "Remove from Favorites" : "Mark as Favorite"}
            className={`p-2 rounded-xl border transition-colors cursor-pointer ${
              entry.favorite
                ? "bg-amber-500/15 border-amber-500/40 text-amber-400"
                : "bg-[#161B26]/80 border-[#242B3D] text-slate-400 hover:text-white hover:border-slate-700"
            }`}
          >
            <Star className={`w-4 h-4 ${entry.favorite ? "fill-amber-400" : ""}`} />
          </motion.button>

          {/* Edit Entry Button */}
          {!isTrash && (
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => onEdit(entry)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#6366F1]/20 hover:bg-[#6366F1]/30 border border-[#6366F1]/40 text-[#38BDF8] text-xs font-semibold shadow-sm transition-all cursor-pointer"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>Edit</span>
            </motion.button>
          )}

          {/* Overflow Menu Button */}
          <div className="relative" ref={moreMenuRef}>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowMoreMenu((prev) => !prev)}
              className="p-2 rounded-xl bg-[#161B26]/80 border border-[#242B3D] text-slate-400 hover:text-white hover:border-slate-700 transition-colors cursor-pointer"
            >
              <MoreVertical className="w-4 h-4" />
            </motion.button>

            <AnimatePresence>
              {showMoreMenu && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.94, y: -6 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.94, y: -6 }}
                  transition={{ duration: 0.12 }}
                  className="absolute right-0 top-full mt-2 w-48 bg-[#161B26] border border-[#242B3D] rounded-xl shadow-2xl p-1.5 z-50 flex flex-col gap-1 backdrop-blur-xl"
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
                        <RefreshCw className="w-3.5 h-3.5 text-[#38BDF8]" />
                        <span>Restore from Trash</span>
                      </button>
                      <button
                        onClick={() => {
                          setShowMoreMenu(false);
                          onPermanentDelete(entry.id);
                        }}
                        className="flex items-center gap-2.5 w-full px-3 py-2 text-xs font-medium text-rose-400 hover:text-rose-300 hover:bg-rose-950/40 rounded-lg transition-colors text-left cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                        <span>Permanent Delete</span>
                      </button>
                    </>
                  ) : (
                    <>
                      {isArchived ? (
                        <button
                          onClick={() => {
                            setShowMoreMenu(false);
                            onUnarchive(entry.id);
                          }}
                          className="flex items-center gap-2.5 w-full px-3 py-2 text-xs font-medium text-slate-200 hover:text-white hover:bg-[#6366F1]/20 rounded-lg transition-colors text-left cursor-pointer"
                        >
                          <Archive className="w-3.5 h-3.5 text-[#38BDF8]" />
                          <span>Unarchive Entry</span>
                        </button>
                      ) : (
                        <button
                          onClick={() => {
                            setShowMoreMenu(false);
                            onArchive(entry.id);
                          }}
                          className="flex items-center gap-2.5 w-full px-3 py-2 text-xs font-medium text-slate-200 hover:text-white hover:bg-[#6366F1]/20 rounded-lg transition-colors text-left cursor-pointer"
                        >
                          <Archive className="w-3.5 h-3.5 text-slate-400" />
                          <span>Archive Entry</span>
                        </button>
                      )}
                      <button
                        onClick={() => {
                          setShowMoreMenu(false);
                          onMoveToTrash(entry.id);
                        }}
                        className="flex items-center gap-2.5 w-full px-3 py-2 text-xs font-medium text-rose-400 hover:text-rose-300 hover:bg-rose-950/40 rounded-lg transition-colors text-left cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                        <span>Move to Trash</span>
                      </button>
                    </>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </header>

      {/* Main Details Body */}
      <div className="flex-1 overflow-y-auto px-8 py-6 space-y-6 max-w-3xl">
        {/* Credentials Glass Card */}
        <SpotlightCard
          spotlightColor="rgba(56, 189, 248, 0.1)"
          borderGlowColor="rgba(56, 189, 248, 0.3)"
          className="bg-[#161B26]/80 border border-[#242B3D] rounded-2xl p-6 shadow-xl backdrop-blur-xl flex flex-col gap-5"
        >
          <div className="flex items-center justify-between pb-3 border-b border-[#242B3D]/70">
            <span className="text-[11px] font-mono tracking-wider text-slate-400 uppercase font-semibold">
              Encrypted Credentials
            </span>
            <div className="flex items-center gap-1.5 text-[11px] font-mono text-[#38BDF8]">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>ChaCha20-Poly1305</span>
            </div>
          </div>

          {/* Username / Email Field */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-slate-400">Username or Email</label>
            <div className="flex items-center justify-between bg-[#0D0F17]/90 border border-[#242B3D] hover:border-slate-700 rounded-xl px-4 py-2.5 transition-colors">
              <span className="text-sm font-mono text-white select-all">
                {entry.username || <span className="text-slate-500 italic">No username set</span>}
              </span>
              {entry.username && (
                <ClickSpark sparkColor="#38BDF8" sparkCount={8}>
                  <button
                    onClick={() => handleCopy(entry.username!, "user")}
                    title="Copy Username"
                    className="p-1.5 rounded-lg hover:bg-white/[0.06] text-slate-400 hover:text-[#38BDF8] transition-colors cursor-pointer"
                  >
                    {copiedKey === "user" ? (
                      <Check className="w-4 h-4 text-[#38BDF8]" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </button>
                </ClickSpark>
              )}
            </div>
          </div>

          {/* Password Field with DecryptedText Scramble & ClickSpark Copy */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-slate-400">Password</label>
              {entry.password && (
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] font-mono font-semibold ${strength.textColor}`}>
                    {strength.label}
                  </span>
                  <div className="w-16 h-1.5 rounded-full bg-slate-800 overflow-hidden">
                    <div
                      className={`h-full ${strength.barColor} transition-all duration-300`}
                      style={{ width: `${strength.percent}%` }}
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between bg-[#0D0F17]/90 border border-[#242B3D] hover:border-slate-700 rounded-xl px-4 py-2.5 transition-colors">
              <div className="text-sm font-mono tracking-wider overflow-x-auto select-all pr-2">
                {entry.password ? (
                  showPassword ? (
                    <DecryptedText
                      text={entry.password}
                      speed={35}
                      maxIterations={10}
                      animateOn="view"
                      className="text-white font-mono"
                      encryptedClassName="text-[#38BDF8] font-mono"
                    />
                  ) : (
                    <span className="text-slate-400 select-none tracking-widest">
                      ••••••••••••••••
                    </span>
                  )
                ) : (
                  <span className="text-slate-500 italic">No password set</span>
                )}
              </div>

              {entry.password && (
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    onClick={() => setShowPassword((prev) => !prev)}
                    title={showPassword ? "Hide Password" : "Reveal Password"}
                    className="p-1.5 rounded-lg hover:bg-white/[0.06] text-slate-400 hover:text-white transition-colors cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>

                  <ClickSpark sparkColor="#38BDF8" sparkCount={10}>
                    <button
                      onClick={() => handleCopy(entry.password!, "pwd")}
                      title="Copy Password"
                      className="p-1.5 rounded-lg hover:bg-white/[0.06] text-slate-400 hover:text-[#38BDF8] transition-colors cursor-pointer"
                    >
                      {copiedKey === "pwd" ? (
                        <Check className="w-4 h-4 text-[#38BDF8]" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </button>
                  </ClickSpark>
                </div>
              )}
            </div>
          </div>

          {/* Website / Service URL */}
          {entry.url && (
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-slate-400">Website URL</label>
              <div className="flex items-center justify-between bg-[#0D0F17]/90 border border-[#242B3D] hover:border-slate-700 rounded-xl px-4 py-2.5 transition-colors">
                <span className="text-sm font-mono text-slate-300 truncate select-all pr-2">
                  {entry.url}
                </span>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <a
                    href={entry.url.startsWith("http") ? entry.url : `https://${entry.url}`}
                    target="_blank"
                    rel="noreferrer"
                    title="Open Website"
                    className="p-1.5 rounded-lg hover:bg-white/[0.06] text-slate-400 hover:text-[#38BDF8] transition-colors"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                  <ClickSpark sparkColor="#38BDF8" sparkCount={8}>
                    <button
                      onClick={() => handleCopy(entry.url!, "url")}
                      title="Copy URL"
                      className="p-1.5 rounded-lg hover:bg-white/[0.06] text-slate-400 hover:text-[#38BDF8] transition-colors cursor-pointer"
                    >
                      {copiedKey === "url" ? (
                        <Check className="w-4 h-4 text-[#38BDF8]" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </button>
                  </ClickSpark>
                </div>
              </div>
            </div>
          )}
        </SpotlightCard>

        {/* Security Questions / 2FA Fallback (if configured) */}
        {entry.security_questions && entry.security_questions.length > 0 && (
          <div className="bg-[#161B26]/80 border border-[#242B3D] rounded-2xl p-5 shadow-xl backdrop-blur-xl flex flex-col gap-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-300">
              <HelpCircle className="w-4 h-4 text-[#38BDF8]" />
              <span>Security Questions / 2FA Recovery</span>
            </div>
            <div className="space-y-2">
              {entry.security_questions.map((sq, i) => (
                <div
                  key={i}
                  className="bg-[#0D0F17]/90 border border-[#242B3D] rounded-xl p-3 flex flex-col gap-1 text-xs"
                >
                  <span className="text-slate-400 font-medium">{sq.question}</span>
                  <span className="font-mono text-white select-all">{sq.answer}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Encrypted Notes */}
        {entry.notes && (
          <div className="bg-[#161B26]/80 border border-[#242B3D] rounded-2xl p-5 shadow-xl backdrop-blur-xl flex flex-col gap-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-300">
              <FileText className="w-4 h-4 text-[#38BDF8]" />
              <span>Secure Notes</span>
            </div>
            <div className="bg-[#0D0F17]/90 border border-[#242B3D] rounded-xl p-4 text-xs font-mono text-slate-200 whitespace-pre-wrap leading-relaxed select-all">
              {entry.notes}
            </div>
          </div>
        )}

        {/* Cryptographic Audit Telemetry Strip */}
        <div className="bg-[#161B26]/40 border border-[#242B3D]/60 rounded-xl p-4 flex items-center justify-between text-[11px] font-mono text-slate-400">
          <div className="flex flex-col gap-0.5">
            <span>MODIFIED: {new Date(entry.client_updated_at || Date.now()).toLocaleString()}</span>
            <span>REVISION: v{entry.revision || 1} • ZERO-KNOWLEDGE SEALED</span>
          </div>
          <div className="text-right flex flex-col gap-0.5">
            <span className="text-[#38BDF8]">ARGON2ID + CHACHA20</span>
            <span>STATUS: {entry.sync_status || "LOCAL_ENCLAVE"}</span>
          </div>
        </div>
      </div>
    </main>
  );
};
