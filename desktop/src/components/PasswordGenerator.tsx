import React, { useState, useEffect, useCallback } from "react";
import { api } from "../services/api";
import { Copy, Check, RefreshCw, X, ShieldCheck } from "lucide-react";

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
    await navigator.clipboard.writeText(password);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getStrength = () => {
    if (length < 12) return { label: "Weak", color: "bg-rose-500", w: "w-1/4" };
    if (length < 16) return { label: "Moderate", color: "bg-amber-500", w: "w-2/4" };
    if (length < 24) return { label: "Strong", color: "bg-emerald-500", w: "w-3/4" };
    return { label: "Very Strong", color: "bg-cyan-400", w: "w-full" };
  };

  const strength = getStrength();

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-2xl text-slate-100 w-full max-w-md">
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-indigo-400" />
          <h3 className="font-semibold text-base">Password Generator</h3>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="p-1 rounded-md text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Generated Password Display */}
      <div className="mt-4 relative bg-slate-950 border border-slate-800 rounded-lg p-3 flex items-center justify-between font-mono text-sm break-all">
        <span className="text-indigo-200 select-all pr-12">{password}</span>
        <div className="flex items-center gap-1 absolute right-2">
          <button
            onClick={generate}
            title="Regenerate"
            className="p-1.5 rounded-md hover:bg-slate-800 text-slate-400 hover:text-indigo-400 transition"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={copyToClipboard}
            title="Copy Password"
            className="p-1.5 rounded-md hover:bg-slate-800 text-slate-400 hover:text-emerald-400 transition"
          >
            {copied ? (
              <Check className="w-4 h-4 text-emerald-400" />
            ) : (
              <Copy className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>

      {/* Strength indicator */}
      <div className="mt-3">
        <div className="flex justify-between text-xs text-slate-400 mb-1">
          <span>Security Score</span>
          <span className="font-medium text-slate-300">{strength.label} ({length} chars)</span>
        </div>
        <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
          <div className={`h-full transition-all duration-300 ${strength.color} ${strength.w}`} />
        </div>
      </div>

      {/* Controls */}
      <div className="mt-5 space-y-4">
        <div>
          <div className="flex justify-between text-xs text-slate-400 mb-1">
            <span>Length</span>
            <span className="font-mono text-slate-200">{length}</span>
          </div>
          <input
            type="range"
            min="8"
            max="64"
            value={length}
            onChange={(e) => setLength(parseInt(e.target.value))}
            className="w-full accent-indigo-500 cursor-pointer"
          />
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs">
          <label className="flex items-center gap-2 cursor-pointer bg-slate-950/60 p-2 rounded-lg border border-slate-800/80 hover:border-slate-700 transition">
            <input
              type="checkbox"
              checked={uppercase}
              onChange={(e) => setUppercase(e.target.checked)}
              className="rounded accent-indigo-500"
            />
            <span>A-Z (Uppercase)</span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer bg-slate-950/60 p-2 rounded-lg border border-slate-800/80 hover:border-slate-700 transition">
            <input
              type="checkbox"
              checked={lowercase}
              onChange={(e) => setLowercase(e.target.checked)}
              className="rounded accent-indigo-500"
            />
            <span>a-z (Lowercase)</span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer bg-slate-950/60 p-2 rounded-lg border border-slate-800/80 hover:border-slate-700 transition">
            <input
              type="checkbox"
              checked={numbers}
              onChange={(e) => setNumbers(e.target.checked)}
              className="rounded accent-indigo-500"
            />
            <span>0-9 (Numbers)</span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer bg-slate-950/60 p-2 rounded-lg border border-slate-800/80 hover:border-slate-700 transition">
            <input
              type="checkbox"
              checked={symbols}
              onChange={(e) => setSymbols(e.target.checked)}
              className="rounded accent-indigo-500"
            />
            <span>!@#$ (Symbols)</span>
          </label>
        </div>
      </div>

      {onSelectPassword && (
        <div className="mt-5 pt-3 border-t border-slate-800 flex justify-end gap-2">
          {onClose && (
            <button
              onClick={onClose}
              className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition"
            >
              Cancel
            </button>
          )}
          <button
            onClick={() => onSelectPassword(password)}
            className="px-4 py-1.5 rounded-lg text-xs font-medium bg-indigo-600 hover:bg-indigo-500 text-white transition flex items-center gap-1.5"
          >
            <span>Use Password</span>
          </button>
        </div>
      )}
    </div>
  );
};
