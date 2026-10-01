import React, { useState, useEffect, useCallback } from "react";
import { motion } from "motion/react";
import { api } from "../services/api";
import { copyWithAutoWipe } from "../services/clipboard";
import { Copy, Check, RefreshCw, X, Sparkles } from "lucide-react";

interface PasswordGeneratorProps {
  onSelectPassword?: (pwd: string) => void;
  onClose?: () => void;
}

export const PasswordGenerator: React.FC<PasswordGeneratorProps> = ({
  onSelectPassword,
  onClose,
}) => {
  const [password, setPassword] = useState("");
  const [length, setLength] = useState(20);
  const [uppercase, setUppercase] = useState(true);
  const [lowercase, setLowercase] = useState(true);
  const [numbers, setNumbers] = useState(true);
  const [symbols, setSymbols] = useState(true);
  const [copied, setCopied] = useState(false);

  const generate = useCallback(async () => {
    try {
      const pwd = await api.generatePassword({
        length,
        uppercase,
        lowercase,
        numbers,
        symbols,
      });
      setPassword(pwd);
      setCopied(false);
    } catch (err) {
      console.error("Failed to generate password:", err);
    }
  }, [length, uppercase, lowercase, numbers, symbols]);

  useEffect(() => {
    generate();
  }, [generate]);

  const copyToClipboard = async () => {
    if (!password) return;
    await copyWithAutoWipe(password);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getStrength = () => {
    if (length < 12) return { label: "Weak", color: "bg-rose-500", text: "text-rose-400" };
    if (length < 16) return { label: "Fair", color: "bg-amber-500", text: "text-amber-400" };
    if (length < 24) return { label: "Strong", color: "bg-[#6366F1]", text: "text-[#818CF8]" };
    return { label: "Very Strong", color: "bg-[#38BDF8]", text: "text-[#38BDF8]" };
  };

  const strength = getStrength();

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.94, y: 15 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.94, y: 15 }}
      transition={{ type: "spring", damping: 25, stiffness: 350 }}
      className="bg-[#161B26] border border-[#242B3D] rounded-2xl p-5 shadow-2xl text-slate-100 w-full max-w-md backdrop-blur-xl"
    >
      <div className="flex items-center justify-between pb-3 border-b border-[#242B3D]">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-[#0D0F17] border border-[#242B3D] flex items-center justify-center">
            <Sparkles className="w-3.5 h-3.5 text-[#38BDF8]" />
          </div>
          <h3 className="font-semibold text-xs tracking-tight text-white">Cryptographic Password Generator</h3>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.04] transition"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Generated Password Display */}
      <div className="mt-4 relative bg-[#0D0F17] border border-[#242B3D] rounded-xl p-3 flex items-center justify-between font-mono text-xs break-all">
        <span className="text-slate-100 select-all pr-14 tracking-wide font-mono">{password}</span>
        <div className="flex items-center gap-1 absolute right-2">
          <button
            onClick={generate}
            title="Generate New Password"
            className="p-1.5 rounded-lg hover:bg-white/[0.06] text-slate-400 hover:text-white transition"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={copyToClipboard}
            title="Copy Password"
            className="p-1.5 rounded-lg hover:bg-white/[0.06] text-slate-400 hover:text-[#38BDF8] transition"
          >
            {copied ? (
              <Check className="w-3.5 h-3.5 text-[#38BDF8]" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
      </div>

      {/* Strength indicator */}
      <div className="mt-3">
        <div className="flex justify-between text-[11px] font-mono text-slate-400 mb-1">
          <span>Entropy</span>
          <span className={`font-medium ${strength.text}`}>{strength.label} ({length} chars)</span>
        </div>
        <div className="w-full bg-[#0D0F17] rounded-full h-1 overflow-hidden border border-[#242B3D]">
          <div
            className={`h-full transition-all duration-300 ${strength.color}`}
            style={{ width: `${Math.min(100, (length / 32) * 100)}%` }}
          />
        </div>
      </div>

      {/* Controls */}
      <div className="mt-4 space-y-3.5">
        <div>
          <div className="flex justify-between text-[11px] font-medium text-slate-400 mb-1.5">
            <span>Password Length</span>
            <span className="font-mono text-white text-xs">{length}</span>
          </div>
          <input
            type="range"
            min="8"
            max="64"
            value={length}
            onChange={(e) => setLength(parseInt(e.target.value))}
            className="w-full accent-[#6366F1] cursor-pointer h-1.5 bg-[#0D0F17] rounded-lg appearance-none"
          />
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs">
          <label className="flex items-center gap-2 cursor-pointer bg-[#0D0F17] p-2 rounded-xl border border-[#242B3D] hover:border-slate-600 transition">
            <input
              type="checkbox"
              checked={uppercase}
              onChange={(e) => setUppercase(e.target.checked)}
              className="rounded accent-[#6366F1]"
            />
            <span className="text-[11px] text-slate-300">A-Z (Uppercase)</span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer bg-[#0D0F17] p-2 rounded-xl border border-[#242B3D] hover:border-slate-600 transition">
            <input
              type="checkbox"
              checked={lowercase}
              onChange={(e) => setLowercase(e.target.checked)}
              className="rounded accent-[#6366F1]"
            />
            <span className="text-[11px] text-slate-300">a-z (Lowercase)</span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer bg-[#0D0F17] p-2 rounded-xl border border-[#242B3D] hover:border-slate-600 transition">
            <input
              type="checkbox"
              checked={numbers}
              onChange={(e) => setNumbers(e.target.checked)}
              className="rounded accent-[#6366F1]"
            />
            <span className="text-[11px] text-slate-300">0-9 (Numbers)</span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer bg-[#0D0F17] p-2 rounded-xl border border-[#242B3D] hover:border-slate-600 transition">
            <input
              type="checkbox"
              checked={symbols}
              onChange={(e) => setSymbols(e.target.checked)}
              className="rounded accent-[#6366F1]"
            />
            <span className="text-[11px] text-slate-300">!@#$ (Symbols)</span>
          </label>
        </div>
      </div>

      {onSelectPassword && (
        <div className="mt-4 pt-3 border-t border-[#242B3D] flex justify-end gap-2">
          {onClose && (
            <button
              onClick={onClose}
              className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-white hover:bg-white/[0.04] transition"
            >
              Cancel
            </button>
          )}
          <button
            onClick={() => onSelectPassword(password)}
            className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-[#6366F1] hover:bg-[#4F46E5] text-white transition flex items-center gap-1.5 shadow-sm"
          >
            <span>Use Password</span>
          </button>
        </div>
      )}
    </motion.div>
  );
};
