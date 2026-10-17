import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { VaultEntry, SaveEntryInput } from "../../types";
import { detectBrandFromInput, DetectedBrand } from "../../services/entryHelpers";
import { api } from "../../services/api";
import {
  X,
  Lock,
  Eye,
  EyeOff,
  Sparkles,
  ChevronDown,
  Check,
  RefreshCw,
} from "lucide-react";
import { ServiceIcon } from "../ServiceIcon";

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
      transition={{ duration: 0.14 }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm select-none"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 8 }}
        transition={{ type: "spring", damping: 28, stiffness: 380 }}
        className="max-w-xl w-full bg-[#121214] border border-[#232326] rounded-2xl shadow-2xl p-6 relative flex flex-col gap-5 text-white max-h-[92vh] overflow-y-auto"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-3.5 border-b border-[#232326]">
          <div className="flex items-center gap-3">
            <ServiceIcon
              title={title}
              url={url}
              size={22}
              className="w-10 h-10 rounded-xl"
            />
            <div>
              <h2 className="text-base font-display font-bold text-white tracking-tight">
                {initialEntry ? "Edit Password Entry" : "Create New Password"}
              </h2>
              <span className="text-[10px] font-mono tracking-wider text-zinc-500 uppercase font-medium">
                Argon2id + ChaCha20-Poly1305 Zero-Knowledge
              </span>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Service Name with Dynamic Brand Detection */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-semibold text-zinc-300 font-sans tracking-normal">
                Service / Website Name
              </label>
              {detectedBrand && (
                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-zinc-800 border border-zinc-700">
                  <ServiceIcon title={detectedBrand.name} url={detectedBrand.domain} size={12} className="w-3.5 h-3.5 rounded" />
                  <span className="text-[10px] font-mono text-zinc-300 font-medium">
                    {detectedBrand.name}
                  </span>
                </div>
              )}
            </div>

            <div className="relative">
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. GitHub, Google, Netflix, AWS..."
                className="w-full bg-[#18181B] border border-[#27272A] focus:border-zinc-500 focus:ring-1 focus:ring-zinc-600 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-zinc-600 focus:outline-none transition-all font-sans font-medium"
              />
            </div>

            {detectedBrand && (
              <span className="text-[11px] font-mono text-zinc-400">
                ✓ Auto-detected brand & suggested URL matched
              </span>
            )}
          </div>

          {/* Username / Email */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-semibold text-zinc-300 font-sans tracking-normal">
              Username or Email
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="user@example.com or username"
              className="w-full bg-[#18181B] border border-[#27272A] focus:border-zinc-500 focus:ring-1 focus:ring-zinc-600 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-zinc-600 focus:outline-none transition-all font-sans font-medium"
            />
          </div>

          {/* Password with Inline Generator */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-semibold text-zinc-300 font-sans tracking-normal">
                Password
              </label>
              <button
                type="button"
                onClick={() => setShowGenerator((prev) => !prev)}
                className="flex items-center gap-1.5 text-[11px] font-semibold text-zinc-400 hover:text-white cursor-pointer font-sans transition-colors"
              >
                <Sparkles className="w-3.5 h-3.5 text-zinc-400" />
                <span>{showGenerator ? "Hide Generator" : "Generate Strong Password"}</span>
              </button>
            </div>

            <div className="flex items-center bg-[#18181B] border border-[#27272A] rounded-xl px-3.5 py-2.5 focus-within:border-zinc-500 focus-within:ring-1 focus-within:ring-zinc-600 transition-all">
              <input
                type={showPassword ? "text" : "password"}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter or generate cryptographic password"
                className="w-full bg-transparent text-xs text-white placeholder-zinc-600 focus:outline-none font-mono tracking-wider font-medium"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="p-1 text-zinc-400 hover:text-white cursor-pointer ml-2 transition-colors"
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
                  className="bg-[#18181B] border border-[#27272A] rounded-xl p-3.5 flex flex-col gap-3 mt-1 overflow-hidden"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-mono text-zinc-400">Length: {genLength} chars</span>
                    <div className="flex items-center gap-3">
                      <label className="flex items-center gap-1.5 text-[11px] text-zinc-300 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={genSymbols}
                          onChange={(e) => setGenSymbols(e.target.checked)}
                          className="rounded accent-white"
                        />
                        <span>Symbols</span>
                      </label>
                      <label className="flex items-center gap-1.5 text-[11px] text-zinc-300 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={genNumbers}
                          onChange={(e) => setGenNumbers(e.target.checked)}
                          className="rounded accent-white"
                        />
                        <span>Numbers</span>
                      </label>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min="12"
                      max="64"
                      value={genLength}
                      onChange={(e) => setGenLength(parseInt(e.target.value))}
                      className="flex-1 accent-white cursor-pointer h-1.5 bg-zinc-800 rounded-lg appearance-none"
                    />
                    <button
                      type="button"
                      onClick={handleGeneratePassword}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white border border-zinc-700 text-xs font-semibold cursor-pointer font-sans"
                    >
                      <RefreshCw className="w-3 h-3 text-zinc-300" />
                      <span>Regenerate</span>
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Website / Service URL */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-semibold text-zinc-300 font-sans tracking-normal">
              Website URL
            </label>
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com/login"
              className="w-full bg-[#18181B] border border-[#27272A] focus:border-zinc-500 focus:ring-1 focus:ring-zinc-600 rounded-xl px-3.5 py-2.5 text-xs text-zinc-200 placeholder-zinc-600 focus:outline-none transition-all font-sans font-medium"
            />
          </div>

          {/* Secure Notes */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-semibold text-zinc-300 font-sans tracking-normal">
              Secure Notes (Encrypted)
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add sensitive recovery keys, PINs or notes..."
              className="w-full bg-[#18181B] border border-[#27272A] focus:border-zinc-500 focus:ring-1 focus:ring-zinc-600 rounded-xl px-3.5 py-2 text-xs text-zinc-200 placeholder-zinc-600 focus:outline-none transition-all font-sans font-medium resize-none"
            />
          </div>

          {/* Enclave Selector */}
          <div className="flex flex-col gap-1.5 relative" ref={vaultDropdownRef}>
            <label className="text-[11px] font-semibold text-zinc-300 font-sans tracking-normal">
              Target Enclave
            </label>
            <div
              onClick={() => setShowVaultDropdown((prev) => !prev)}
              className="w-full bg-[#18181B] border border-[#27272A] hover:border-zinc-600 rounded-xl px-3.5 py-2.5 text-xs text-white flex items-center justify-between cursor-pointer transition-colors"
            >
              <div className="flex items-center gap-2">
                <Lock className="w-3.5 h-3.5 text-zinc-400" />
                <span className="font-sans font-medium">{selectedVault}</span>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-zinc-400" />
            </div>

            <AnimatePresence>
              {showVaultDropdown && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: -4 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: -4 }}
                  transition={{ duration: 0.1 }}
                  className="absolute left-0 top-full mt-1.5 w-full bg-[#121214] border border-[#27272A] rounded-xl shadow-2xl p-1.5 z-50 flex flex-col gap-1"
                >
                  <div
                    onClick={() => {
                      setSelectedVault("Personal Vault (Master)");
                      setShowVaultDropdown(false);
                    }}
                    className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-zinc-800 text-xs text-zinc-200 cursor-pointer font-sans"
                  >
                    <div className="flex items-center gap-2">
                      <Lock className="w-3.5 h-3.5 text-zinc-400" />
                      <span>Personal Vault (Master)</span>
                    </div>
                    {selectedVault === "Personal Vault (Master)" && (
                      <Check className="w-4 h-4 text-white" />
                    )}
                  </div>

                  <div
                    onClick={() => {
                      setSelectedVault("Work / Engineering Enclave");
                      setShowVaultDropdown(false);
                    }}
                    className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-zinc-800 text-xs text-zinc-200 cursor-pointer font-sans"
                  >
                    <div className="flex items-center gap-2">
                      <Lock className="w-3.5 h-3.5 text-zinc-400" />
                      <span>Work / Engineering Enclave</span>
                    </div>
                    {selectedVault === "Work / Engineering Enclave" && (
                      <Check className="w-4 h-4 text-white" />
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Modal Actions */}
          <div className="flex items-center justify-end gap-3 pt-3.5 border-t border-[#232326] mt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl text-xs font-semibold text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer font-sans"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2.5 rounded-xl bg-white hover:bg-zinc-200 disabled:opacity-50 text-black font-bold text-xs shadow-sm flex items-center gap-2 transition-all cursor-pointer font-sans tracking-tight"
            >
              {saving ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-black" />
                  <span>Sealing Key...</span>
                </>
              ) : (
                <span>Save to Encrypted Vault</span>
              )}
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
};
