import React, { useState } from "react";
import { motion } from "motion/react";
import { api } from "../services/api";
import { supabaseService, getSupabase } from "../services/supabase";
import { KeyRound, ShieldCheck, ShieldAlert, X, Loader2, Check } from "lucide-react";

interface ChangePasswordModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

export const ChangePasswordModal: React.FC<ChangePasswordModalProps> = ({
  onClose,
  onSuccess,
}) => {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!currentPassword) {
      setError("Please enter your current master password.");
      return;
    }
    if (newPassword.length < 8) {
      setError("New master password must be at least 8 characters long.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("New passwords do not match.");
      return;
    }
    if (currentPassword === newPassword) {
      setError("New password must be different from current password.");
      return;
    }

    setLoading(true);
    try {
      const res = await api.changeMasterPassword(currentPassword, newPassword);

      // In background, update Supabase metadata if logged in
      const supabase = getSupabase();
      if (supabase) {
        const { data } = await supabase.auth.getSession();
        const userId = data?.session?.user?.id;
        if (userId) {
          await supabaseService.saveRemoteVaultMeta(
            userId,
            res.master_salt,
            res.encrypted_dek,
            res.dek_nonce
          );
        }
      }

      setSuccess(true);
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 1500);
    } catch (err: unknown) {
      setError(typeof err === "string" ? err : "Failed to change master password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.16 }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 bg-[#0D0F17]/85 backdrop-blur-md z-50 flex items-center justify-center p-4 select-none"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.94, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.94, y: 15 }}
        transition={{ type: "spring", damping: 25, stiffness: 350 }}
        className="w-full max-w-md bg-[#161B26] border border-[#242B3D] rounded-2xl p-6 shadow-2xl text-slate-100 relative"
      >
        <div className="flex items-center justify-between pb-3 border-b border-[#242B3D]">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center">
              <KeyRound className="w-3.5 h-3.5 text-indigo-400" />
            </div>
            <h3 className="font-semibold text-xs tracking-tight text-white">Change Master Password</h3>
          </div>
          <motion.button
            whileHover={{ scale: 1.1, rotate: 90 }}
            whileTap={{ scale: 0.9 }}
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </motion.button>
        </div>

        {error && (
          <div className="mt-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-start gap-2">
            <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {success ? (
          <div className="py-8 text-center space-y-2">
            <div className="w-10 h-10 rounded-full bg-indigo-500/15 border border-indigo-500/30 text-[#38BDF8] flex items-center justify-center mx-auto">
              <Check className="w-5 h-5" />
            </div>
            <h4 className="font-semibold text-sm text-white">Master Password Updated</h4>
            <p className="text-xs text-slate-400">
              Your vault encryption keys have been securely re-encrypted.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-4 space-y-3.5">
            <div>
              <label className="block text-[11px] font-medium text-slate-400 mb-1">
                Current Master Password
              </label>
              <input
                type="password"
                required
                autoFocus
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Enter current password"
                className="w-full px-3 py-2 bg-[#0D0F17] border border-[#242B3D] rounded-xl text-xs text-white placeholder-slate-600 focus:outline-none focus:border-[#6366F1] transition"
              />
            </div>

            <div>
              <label className="block text-[11px] font-medium text-slate-400 mb-1">
                New Master Password
              </label>
              <input
                type="password"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="At least 8 characters"
                className="w-full px-3 py-2 bg-[#0D0F17] border border-[#242B3D] rounded-xl text-xs text-white placeholder-slate-600 focus:outline-none focus:border-[#6366F1] transition"
              />
            </div>

            <div>
              <label className="block text-[11px] font-medium text-slate-400 mb-1">
                Confirm New Master Password
              </label>
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter new password"
                className="w-full px-3 py-2 bg-[#0D0F17] border border-[#242B3D] rounded-xl text-xs text-white placeholder-slate-600 focus:outline-none focus:border-[#6366F1] transition"
              />
            </div>

            <div className="p-3 bg-[#0D0F17] border border-[#242B3D] rounded-xl text-[11px] text-slate-400 leading-relaxed">
              <ShieldCheck className="w-3.5 h-3.5 text-[#38BDF8] inline mr-1 -mt-0.5" />
              Only the 32-byte data encryption key is re-wrapped. Your saved passwords remain intact.
            </div>

            <div className="pt-2 flex justify-end gap-2">
              <motion.button
                type="button"
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={onClose}
                className="px-3.5 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Cancel
              </motion.button>
              <motion.button
                type="submit"
                disabled={loading}
                whileHover={!loading ? { scale: 1.03 } : undefined}
                whileTap={!loading ? { scale: 0.97 } : undefined}
                className="px-4 py-1.5 bg-[#6366F1] hover:bg-[#5254e0] text-white rounded-xl text-xs font-semibold transition-all shadow-sm flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Re-encrypting Keys...</span>
                  </>
                ) : (
                  <span>Update Password</span>
                )}
              </motion.button>
            </div>
          </form>
        )}
      </motion.div>
    </motion.div>
  );
};
