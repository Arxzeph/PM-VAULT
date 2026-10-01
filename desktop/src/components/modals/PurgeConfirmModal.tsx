import React, { useState } from "react";
import { motion } from "motion/react";
import { api } from "../../services/api";
import { AlertTriangle, X, RefreshCw, Eye, EyeOff } from "lucide-react";

interface PurgeConfirmModalProps {
  onPurgeConfirmed: () => Promise<void>;
  onClose: () => void;
}

export const PurgeConfirmModal: React.FC<PurgeConfirmModalProps> = ({
  onPurgeConfirmed,
  onClose,
}) => {
  const [masterPassword, setMasterPassword] = useState("");
  const [typedConfirmation, setTypedConfirmation] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [purging, setPurging] = useState(false);

  const handlePurge = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (typedConfirmation.trim().toUpperCase() !== "PURGE") {
      setError("Please type 'PURGE' exactly to confirm deletion.");
      return;
    }

    if (!masterPassword) {
      setError("Master password is required to mathematically authorize enclave purge.");
      return;
    }

    setPurging(true);
    try {
      // Authenticate password with Rust backend
      const unlockRes = await api.unlockVault(masterPassword);
      if (!unlockRes) {
        throw new Error("Incorrect master password. Authorization rejected.");
      }

      await onPurgeConfirmed();
    } catch (err: any) {
      setError(err?.message || "Failed to authorize vault purge.");
      setPurging(false);
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
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0D0F17]/90 backdrop-blur-md select-none"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.94, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.94, y: 12 }}
        transition={{ type: "spring", damping: 26, stiffness: 360 }}
        className="bg-[#161B26] border border-rose-900/60 rounded-2xl shadow-2xl max-w-lg w-full p-6 relative overflow-hidden flex flex-col gap-5 text-white shadow-rose-950/20"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-rose-900/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-500">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white">Confirm Account & Enclave Purge</h2>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-rose-500/20 text-rose-400 border border-rose-500/40 uppercase font-semibold">
                  IRREVERSIBLE
                </span>
              </div>
              <span className="text-xs font-mono text-slate-400">
                Cryptographic zero-fill and hardware enclave wipe.
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

        {/* Warning Callout */}
        <div className="bg-rose-950/25 border border-rose-900/50 rounded-xl p-4 flex flex-col gap-2">
          <span className="text-xs font-bold text-rose-300">
            You are about to permanently destroy all cryptographic keys, wipe local zero-knowledge blobs, and delete your cloud sync identity.
          </span>
          <ul className="text-[11px] text-slate-300 space-y-1 list-disc list-inside">
            <li>Local AES-256-GCM vault blobs on this device will be securely shredded.</li>
            <li>Hardware-backed Argon2id master key will be wiped from TPM / Secure Enclave.</li>
            <li>Zero recovery: Data cannot be restored by PM-VAULT support.</li>
          </ul>
        </div>

        {/* Error notification */}
        {error && (
          <div className="p-3 bg-rose-950/40 border border-rose-800/80 rounded-xl text-xs text-rose-300 font-medium">
            {error}
          </div>
        )}

        {/* Form Body */}
        <form onSubmit={handlePurge} className="flex flex-col gap-4">
          {/* Master Password Input */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-slate-300">
              Enter Master Password to Authorize Purge
            </label>
            <div className="flex items-center bg-[#0D0F17] border border-rose-800/60 focus-within:border-rose-500 rounded-xl px-3.5 py-2.5">
              <input
                type={showPassword ? "text" : "password"}
                required
                value={masterPassword}
                onChange={(e) => setMasterPassword(e.target.value)}
                placeholder="Enter current master password"
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
            <span className="text-[11px] font-mono text-slate-400">
              Master password is required to mathematically authorize key destruction.
            </span>
          </div>

          {/* Typed Safeguard Input */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-slate-300">
              Type <strong className="text-rose-400 font-mono">PURGE</strong> to confirm:
            </label>
            <input
              type="text"
              required
              value={typedConfirmation}
              onChange={(e) => setTypedConfirmation(e.target.value)}
              placeholder="PURGE"
              className="w-full bg-[#0D0F17] border border-slate-700/80 focus:border-rose-500 rounded-xl px-3.5 py-2.5 text-sm font-mono uppercase tracking-widest text-white placeholder-slate-600 focus:outline-none"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800/80 mt-2">
            <motion.button
              type="button"
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-700 border border-slate-700/60 transition-colors cursor-pointer"
            >
              Cancel, Keep Vault Safe
            </motion.button>
            <motion.button
              type="submit"
              disabled={purging}
              whileHover={!purging ? { scale: 1.03 } : undefined}
              whileTap={!purging ? { scale: 0.97 } : undefined}
              className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-lg shadow-rose-950/60 border border-rose-500/50 transition-all cursor-pointer flex items-center gap-2"
            >
              {purging ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Destroying Enclave...</span>
                </>
              ) : (
                <span>Permanently Destroy Vault</span>
              )}
            </motion.button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
};
