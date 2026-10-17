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
    if (length < 24) return { label: "Strong", color: "bg-zinc-300", text: "text-zinc-200" };
    return { label: "Very Strong", color: "bg-white", text: "text-white" };
  };

  const strength = getStrength();

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96, y: 12 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96, y: 12 }}
      transition={{ type: "spring", damping: 25, stiffness: 350 }}
      className="bg-[#121214] border border-[#232326] rounded-xl p-5 shadow-2xl text-zinc-100 w-full max-w-md"
    >
      <div className="flex items-center justify-between pb-3 border-b border-[#232326]">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-[#18181B] border border-[#27272A] flex items-center justify-center">
            <Sparkles className="w-3.5 h-3.5 text-zinc-300" />
          </div>
          <h3 className="font-display font-bold text-xs tracking-tight text-white">Cryptographic Password Generator</h3>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="p-1 rounded-md text-zinc-400 hover:text-white hover:bg-zinc-800 transition"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Generated Password Display */}
      <div className="mt-4 relative bg-[#18181B] border border-[#27272A] rounded-lg p-3 flex items-center justify-between font-mono text-xs break-all">
        <span className="text-zinc-100 select-all pr-14 tracking-wide font-mono">{password}</span>
        <div className="flex items-center gap-1 absolute right-2">
          <button
            onClick={generate}
            title="Generate New Password"
            className="p-1.5 rounded-md hover:bg-zinc-800 text-zinc-400 hover:text-white transition cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={copyToClipboard}
            title="Copy Password"
            className="p-1.5 rounded-md hover:bg-zinc-800 text-zinc-400 hover:text-white transition cursor-pointer"
          >
            {copied ? (
              <Check className="w-3.5 h-3.5 text-white" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
      </div>

      {/* Strength indicator */}
      <div className="mt-3">
        <div className="flex justify-between text-[11px] font-mono text-zinc-400 mb-1">
          <span>Entropy</span>
          <span className={`font-medium ${strength.text}`}>{strength.label} ({length} chars)</span>
        </div>
        <div className="w-full bg-zinc-800 rounded-full h-1 overflow-hidden">
          <div
            className={`h-full transition-all duration-300 ${strength.color}`}
            style={{ width: `${Math.min(100, (length / 32) * 100)}%` }}
          />
        </div>
      </div>

      {/* Controls */}
      <div className="mt-4 space-y-3">
        <div>
          <div className="flex justify-between text-[11px] font-medium text-zinc-400 mb-1.5">
            <span>Password Length</span>
            <span className="font-mono text-white text-xs">{length}</span>
          </div>
          <input
            type="range"
            min="8"
            max="64"
            value={length}
            onChange={(e) => setLength(parseInt(e.target.value))}
            className="w-full accent-white cursor-pointer h-1.5 bg-[#18181B] rounded-lg appearance-none"
          />
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs">
          <label className="flex items-center gap-2 cursor-pointer bg-[#18181B] p-2 rounded-lg border border-[#27272A] hover:border-zinc-700 transition">
            <input
              type="checkbox"
              checked={uppercase}
              onChange={(e) => setUppercase(e.target.checked)}
              className="rounded accent-white"
            />
            <span className="text-[11px] text-zinc-300">A-Z (Uppercase)</span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer bg-[#18181B] p-2 rounded-lg border border-[#27272A] hover:border-zinc-700 transition">
            <input
              type="checkbox"
              checked={lowercase}
              onChange={(e) => setLowercase(e.target.checked)}
              className="rounded accent-white"
            />
            <span className="text-[11px] text-zinc-300">a-z (Lowercase)</span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer bg-[#18181B] p-2 rounded-lg border border-[#27272A] hover:border-zinc-700 transition">
            <input
              type="checkbox"
              checked={numbers}
              onChange={(e) => setNumbers(e.target.checked)}
              className="rounded accent-white"
            />
            <span className="text-[11px] text-zinc-300">0-9 (Numbers)</span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer bg-[#18181B] p-2 rounded-lg border border-[#27272A] hover:border-zinc-700 transition">
            <input
              type="checkbox"
              checked={symbols}
              onChange={(e) => setSymbols(e.target.checked)}
              className="rounded accent-white"
            />
            <span className="text-[11px] text-zinc-300">!@#$ (Symbols)</span>
          </label>
        </div>
      </div>

      {onSelectPassword && (
        <div className="mt-4 pt-3 border-t border-[#232326] flex justify-end gap-2">
          {onClose && (
            <button
              onClick={onClose}
              className="px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-400 hover:text-white hover:bg-zinc-800 transition"
            >
              Cancel
            </button>
          )}
          <button
            onClick={() => onSelectPassword(password)}
            className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-white hover:bg-zinc-200 text-black transition flex items-center gap-1.5 shadow-sm cursor-pointer"
          >
            <span>Use Password</span>
          </button>
        </div>
      )}
    </motion.div>
  );
};
