import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { VaultEntry, SaveEntryInput } from "../../types";
import { detectBrandFromInput, DetectedBrand } from "../../services/entryHelpers";
import { api } from "../../services/api";
import {
  KeyRound,
  X,
  Lock,
  Eye,
  EyeOff,
  Sparkles,
  ChevronDown,
  Check,
  RefreshCw,
} from "lucide-react";

interface CreateLoginModalProps {
  initialEntry?: VaultEntry | null;
  onSave: (input: SaveEntryInput) => Promise<void>;
  onClose: () => void;
}

export const CreateLoginModal: React.FC<CreateLoginModalProps> = ({
  initialEntry,
  onSave,
  onClose,
}) => {
  const [title, setTitle] = useState(initialEntry?.title || "");
  const [username, setUsername] = useState(initialEntry?.username || "");
  const [password, setPassword] = useState(initialEntry?.password || "");
  const [url, setUrl] = useState(initialEntry?.url || "");
  const [notes, setNotes] = useState(initialEntry?.notes || "");
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);

  // Dynamic brand detection
  const [detectedBrand, setDetectedBrand] = useState<DetectedBrand | null>(null);

  // Custom vault dropdown
  const [selectedVault, setSelectedVault] = useState("Personal Vault (Master)");
  const [showVaultDropdown, setShowVaultDropdown] = useState(false);
  const vaultDropdownRef = useRef<HTMLDivElement>(null);

  // Generator options
  const [showGenerator, setShowGenerator] = useState(false);
  const [genLength, setGenLength] = useState(20);
  const [genSymbols, setGenSymbols] = useState(true);
  const [genNumbers, setGenNumbers] = useState(true);

  // Auto-detect brand when title changes
  useEffect(() => {
    const brand = detectBrandFromInput(title);
    setDetectedBrand(brand);
    if (brand && !url) {
      setUrl(brand.autofillUrl);
    }
  }, [title]);

  // Close vault dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (vaultDropdownRef.current && !vaultDropdownRef.current.contains(e.target as Node)) {
        setShowVaultDropdown(false);
      }
    };
    if (showVaultDropdown) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showVaultDropdown]);

  const handleGeneratePassword = async () => {
    try {
      const generated = await api.generatePassword({
        length: genLength,
        uppercase: true,
        lowercase: true,
        numbers: genNumbers,
        symbols: genSymbols,
      });
      setPassword(generated);
    } catch {
      // client fallback
      const chars = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%^&*";
      let res = "";
      for (let i = 0; i < genLength; i++) {
        res += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      setPassword(res);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    setSaving(true);
    try {
      await onSave({
        id: initialEntry?.id,
        title: title.trim(),
        username: username.trim(),
        password: password,
        url: url.trim(),
        notes: notes.trim(),
        tags: ["type:login"],
        favorite: initialEntry?.favorite || false,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0D0F17]/85 backdrop-blur-md select-none"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.94, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.94, y: 12 }}
        transition={{ type: "spring", damping: 26, stiffness: 360 }}
        className="bg-[#161B26] border border-slate-700/70 rounded-2xl shadow-2xl max-w-xl w-full p-6 relative overflow-hidden flex flex-col gap-5 text-white max-h-[90vh] overflow-y-auto"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[#242B3D]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">
                {initialEntry ? "Edit Login Credential" : "Create New Login"}
              </h2>
              <span className="text-xs font-mono text-slate-400">
                AES-256-GCM Zero-Knowledge Enclave
              </span>
            </div>
          </div>

          <motion.button
            whileHover={{ scale: 1.1, rotate: 90 }}
            whileTap={{ scale: 0.9 }}
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </motion.button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Service Name with Dynamic Brand Detection */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-slate-400">Service / Website Name</label>
              {detectedBrand && (
                <motion.span
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-medium"
                >
                  Detected: {detectedBrand.name}
                </motion.span>
              )}
            </div>

            <div className="relative">
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Netflix, Spotify, GitHub, Apple ID..."
                className="w-full bg-[#0D0F17] border border-[#242B3D] rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-[#6366F1] focus:ring-1 focus:ring-[#6366F1] transition-all font-sans"
              />
            </div>

            {detectedBrand && (
              <span className="text-[11px] font-mono text-[#38BDF8]">
                ✓ Auto-detected brand mark & suggested URL matched
              </span>
            )}
          </div>

          {/* Username / Email */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-slate-400">Username, Handle, or Email</label>
            <div className="relative">
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="alex@domain.com or @alex_dev"
                className="w-full bg-[#0D0F17] border border-[#242B3D] rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-[#6366F1] focus:ring-1 focus:ring-[#6366F1] transition-all font-mono"
              />
            </div>
          </div>

          {/* Password with Generator */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-slate-400">Password</label>
              <button
                type="button"
                onClick={() => setShowGenerator((prev) => !prev)}
                className="flex items-center gap-1 text-[11px] font-mono text-indigo-400 hover:text-indigo-300 cursor-pointer"
              >
                <Sparkles className="w-3 h-3" />
                <span>{showGenerator ? "Hide Generator" : "Generate Password"}</span>
              </button>
            </div>

            <div className="flex items-center bg-[#0D0F17] border border-[#242B3D] rounded-xl px-3.5 py-2.5 focus-within:border-[#6366F1] focus-within:ring-1 focus-within:ring-[#6366F1]">
              <input
                type={showPassword ? "text" : "password"}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter or generate strong password"
                className="w-full bg-transparent text-sm text-white placeholder-slate-500 focus:outline-none font-mono"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="p-1 text-slate-400 hover:text-white cursor-pointer ml-2"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            {/* In-Line Generator Panel */}
            <AnimatePresence>
              {showGenerator && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                  className="bg-[#0D0F17] border border-slate-800 rounded-xl p-3 flex flex-col gap-3 mt-1 overflow-hidden"
                >
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="text-slate-400">Length: {genLength}</span>
                    <div className="flex items-center gap-3">
                      <label className="flex items-center gap-1.5 cursor-pointer text-slate-300">
                        <input
                          type="checkbox"
                          checked={genSymbols}
                          onChange={(e) => setGenSymbols(e.target.checked)}
                          className="rounded bg-slate-800 border-slate-700 text-indigo-600 focus:ring-0"
                        />
                        <span>Symbols</span>
                      </label>
                      <label className="flex items-center gap-1.5 cursor-pointer text-slate-300">
                        <input
                          type="checkbox"
                          checked={genNumbers}
                          onChange={(e) => setGenNumbers(e.target.checked)}
                          className="rounded bg-slate-800 border-slate-700 text-indigo-600 focus:ring-0"
                        />
                        <span>Numbers</span>
                      </label>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min={12}
                      max={48}
                      value={genLength}
                      onChange={(e) => setGenLength(Number(e.target.value))}
                      className="flex-1 accent-[#6366F1]"
                    />
                    <motion.button
                      type="button"
                      whileHover={{ scale: 1.04 }}
                      whileTap={{ scale: 0.96 }}
                      onClick={handleGeneratePassword}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600/30 hover:bg-indigo-600/40 text-indigo-300 border border-indigo-500/40 text-xs font-semibold cursor-pointer"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Regenerate</span>
                    </motion.button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Website URL */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-slate-400">Website URL (Autofill Target)</label>
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com/login"
              className="w-full bg-[#0D0F17] border border-[#242B3D] rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-[#6366F1] focus:ring-1 focus:ring-[#6366F1] transition-all font-mono"
            />
          </div>

          {/* Secure Notes */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-slate-400">Secure Notes (Optional)</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Recovery codes, PINs, or private notes..."
              className="w-full bg-[#0D0F17] border border-[#242B3D] rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#6366F1] resize-none"
            />
          </div>

          {/* Custom Dark Vault Selection Popover (Replaces default OS dropdown) */}
          <div className="flex flex-col gap-1.5 relative" ref={vaultDropdownRef}>
            <label className="text-xs font-medium text-slate-400">Target Vault</label>
            <button
              type="button"
              onClick={() => setShowVaultDropdown((prev) => !prev)}
              className="w-full bg-[#0D0F17] border border-[#242B3D] hover:border-slate-700 rounded-xl px-3.5 py-2.5 flex items-center justify-between text-left cursor-pointer transition-colors"
            >
              <div className="flex items-center gap-2.5">
                <Lock className="w-4 h-4 text-indigo-400" />
                <span className="text-sm font-medium text-slate-200">{selectedVault}</span>
              </div>
              <ChevronDown className="w-4 h-4 text-slate-500" />
            </button>

            {/* Custom Popover Menu */}
            <AnimatePresence>
              {showVaultDropdown && (
                <motion.div
                  initial={{ opacity: 0, y: -6, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -6, scale: 0.96 }}
                  transition={{ duration: 0.15 }}
                  className="absolute left-0 top-full mt-1.5 w-full bg-[#161B26] border border-[#242B3D] rounded-xl shadow-2xl p-1.5 z-50 flex flex-col gap-1 backdrop-blur-md"
                >
                  <div
                    onClick={() => {
                      setSelectedVault("Personal Vault (Master)");
                      setShowVaultDropdown(false);
                    }}
                    className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-slate-800 text-xs text-slate-200 cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <Lock className="w-3.5 h-3.5 text-indigo-400" />
                      <span>Personal Vault (Master)</span>
                    </div>
                    {selectedVault === "Personal Vault (Master)" && (
                      <Check className="w-4 h-4 text-[#38BDF8]" />
                    )}
                  </div>

                  <div
                    onClick={() => {
                      setSelectedVault("Work / Engineering Enclave");
                      setShowVaultDropdown(false);
                    }}
                    className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-slate-800 text-xs text-slate-200 cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <Lock className="w-3.5 h-3.5 text-purple-400" />
                      <span>Work / Engineering Enclave</span>
                    </div>
                    {selectedVault === "Work / Engineering Enclave" && (
                      <Check className="w-4 h-4 text-[#38BDF8]" />
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Modal Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#242B3D] mt-2">
            <motion.button
              type="button"
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            >
              Cancel
            </motion.button>
            <motion.button
              type="submit"
              disabled={saving}
              whileHover={!saving ? { scale: 1.02 } : undefined}
              whileTap={!saving ? { scale: 0.98 } : undefined}
              className="px-5 py-2.5 rounded-xl bg-[#6366F1] hover:bg-[#5254e0] text-white text-xs font-semibold shadow-lg shadow-[#6366F1]/20 transition-all cursor-pointer flex items-center gap-2"
            >
              {saving ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Sealing Key...</span>
                </>
              ) : (
                <span>Save to Encrypted Vault</span>
              )}
            </motion.button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
};
