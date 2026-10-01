import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Settings,
  X,
  KeyRound,
  AlertTriangle,
  Upload,
  User,
  Clock,
  Laptop,
} from "lucide-react";
import { PurgeConfirmModal } from "./PurgeConfirmModal";

interface SettingsModalProps {
  userEmail?: string | null;
  onClose: () => void;
  onOpenChangePassword: () => void;
  onPurgeAccount: () => Promise<void>;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  userEmail,
  onClose,
  onOpenChangePassword,
  onPurgeAccount,
}) => {
  const [activeTab, setActiveTab] = useState<"general" | "security" | "master_key" | "danger">("general");
  const [showPurgeModal, setShowPurgeModal] = useState(false);

  return (
    <>
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
          className="bg-[#161B26] border border-slate-700/70 rounded-2xl shadow-2xl max-w-2xl w-full p-6 relative overflow-hidden flex flex-col gap-5 text-white max-h-[90vh] overflow-y-auto"
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-3 border-b border-[#242B3D]">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-indigo-400">
                <Settings className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-white">Vault Settings & Security</h2>
                <span className="text-xs font-mono text-slate-400">
                  ID: SEC-8941-B92D • TPM 2.0 Hardware Enclave
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

          {/* Navigation Tabs */}
          <div className="flex items-center gap-2 border-b border-[#242B3D] pb-2">
            {[
              { id: "general", label: "General & Identity" },
              { id: "security", label: "Security & Enclave" },
              { id: "master_key", label: "Master Password" },
              { id: "danger", label: "Danger Zone", isDanger: true },
            ].map((tab) => (
              <motion.button
                key={tab.id}
                type="button"
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  activeTab === tab.id
                    ? tab.isDanger
                      ? "bg-rose-600/20 text-rose-300 border border-rose-500/40"
                      : "bg-[#6366F1] text-white shadow-md shadow-[#6366F1]/20"
                    : tab.isDanger
                    ? "text-rose-400 hover:text-rose-300 hover:bg-rose-950/20"
                    : "text-slate-400 hover:text-white hover:bg-slate-800/40"
                }`}
              >
                {tab.label}
              </motion.button>
            ))}
          </div>

          {/* Tab 1: General & Profile */}
          {activeTab === "general" && (
            <div className="flex flex-col gap-5 py-1">
              {/* Profile Card (Without the Geometric Avatar Gimmick!) */}
              <div className="bg-[#0D0F17] border border-[#242B3D] rounded-2xl p-5 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-full bg-gradient-to-tr from-indigo-600 to-sky-500 p-0.5 shadow-xl">
                    <div className="w-full h-full rounded-full bg-[#161B26] flex items-center justify-center text-slate-200">
                      <User className="w-7 h-7 text-indigo-400" />
                    </div>
                  </div>

                  <div className="flex flex-col">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-white">Alex Dev</span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#38BDF8]/15 text-[#38BDF8] border border-[#38BDF8]/30 font-semibold">
                        • Verified Enclave
                      </span>
                    </div>
                    <span className="text-xs font-mono text-slate-400 mt-0.5">
                      {userEmail || "alex@dev.io"}
                    </span>
                  </div>
                </div>

                {/* Clean Single Upload Photo Button (No generic avatar button!) */}
                <button
                  type="button"
                  onClick={() => alert("Photo upload feature ready in desktop file picker.")}
                  className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white text-xs font-semibold border border-slate-700 transition-colors cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Upload Photo</span>
                </button>
              </div>

              {/* Hardware & Enclave Spec Strip */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-[#0D0F17] border border-[#242B3D] rounded-xl p-3.5 flex flex-col gap-1">
                  <span className="text-[10px] font-mono text-slate-400">HARDWARE ENCLAVE</span>
                  <span className="text-xs font-bold text-white font-mono mt-0.5">
                    TPM 2.0 Module Active
                  </span>
                </div>

                <div className="bg-[#0D0F17] border border-[#242B3D] rounded-xl p-3.5 flex flex-col gap-1">
                  <span className="text-[10px] font-mono text-slate-400">CRYPTOGRAPHIC ALGORITHM</span>
                  <span className="text-xs font-bold text-white font-mono mt-0.5">
                    AES-256-GCM + Argon2id
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Tab 2: Security & Enclave */}
          {activeTab === "security" && (
            <div className="flex flex-col gap-4 py-1">
              <div className="bg-[#0D0F17] border border-[#242B3D] rounded-xl p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Clock className="w-5 h-5 text-indigo-400" />
                  <div>
                    <span className="text-xs font-bold text-white">Auto-Lock Inactivity Timeout</span>
                    <p className="text-[11px] text-slate-400">
                      Locks memory vault after 5 minutes of inactivity on this device.
                    </p>
                  </div>
                </div>
                <span className="text-xs font-mono px-2.5 py-1 rounded-lg bg-slate-800 border border-slate-700 text-slate-200">
                  5 Minutes
                </span>
              </div>

              <div className="bg-[#0D0F17] border border-[#242B3D] rounded-xl p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Laptop className="w-5 h-5 text-[#38BDF8]" />
                  <div>
                    <span className="text-xs font-bold text-white">Smart Clipboard Auto-Clear</span>
                    <p className="text-[11px] text-slate-400">
                      Automatically shreds copied passwords from system memory after 30 seconds.
                    </p>
                  </div>
                </div>
                <span className="text-xs font-mono px-2.5 py-1 rounded-lg bg-slate-800 border border-slate-700 text-slate-200">
                  30 Seconds
                </span>
              </div>
            </div>
          )}

          {/* Tab 3: Master Key */}
          {activeTab === "master_key" && (
            <div className="flex flex-col gap-4 py-1">
              <div className="bg-[#0D0F17] border border-[#242B3D] rounded-xl p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <KeyRound className="w-5 h-5 text-indigo-400" />
                  <div>
                    <span className="text-xs font-bold text-white">Change Master Password</span>
                    <p className="text-[11px] text-slate-400">
                      Re-encrypts all vault DEKs with a new Argon2id key and updates cloud verifier.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    onClose();
                    onOpenChangePassword();
                  }}
                  className="px-3.5 py-2 rounded-xl bg-[#6366F1] hover:bg-[#5254e0] text-white text-xs font-semibold shadow-md shadow-[#6366F1]/20 transition-all cursor-pointer"
                >
                  Change Password
                </button>
              </div>
            </div>
          )}

          {/* Tab 4: Danger Zone */}
          {activeTab === "danger" && (
            <div className="flex flex-col gap-4 py-1">
              <div className="bg-rose-950/20 border border-rose-900/50 rounded-2xl p-5 flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-rose-500" />
                    <span className="text-xs font-mono font-bold tracking-wider text-rose-300 uppercase">
                      DANGER ZONE • ACCOUNT & ENCLAVE PURGE
                    </span>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-rose-500/20 text-rose-400 border border-rose-500/40 uppercase font-semibold">
                    IRREVERSIBLE
                  </span>
                </div>

                <p className="text-xs text-slate-300 leading-relaxed">
                  Permanently wipe local cryptographic keys, destroy vault blobs, and delete cloud sync identity. This action cannot be undone. All offline data on this machine will be wiped.
                </p>

                <div className="flex justify-end pt-2">
                  <button
                    type="button"
                    onClick={() => setShowPurgeModal(true)}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-lg shadow-rose-950/50 border border-rose-500/50 transition-all cursor-pointer"
                  >
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>Delete Account & Purge Vault</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center justify-between pt-3 border-t border-[#242B3D] mt-2">
            <span className="text-[11px] font-mono text-[#38BDF8]">
              • Hardware Security Module Attached
            </span>
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={onClose}
              className="px-5 py-2 rounded-xl bg-[#6366F1] hover:bg-[#5254e0] text-white text-xs font-semibold shadow-md shadow-[#6366F1]/20 transition-all cursor-pointer"
            >
              Done
            </motion.button>
          </div>
        </motion.div>
      </motion.div>

      {/* Nested Purge Confirmation Modal */}
      <AnimatePresence>
        {showPurgeModal && (
          <PurgeConfirmModal
            onPurgeConfirmed={async () => {
              setShowPurgeModal(false);
              onClose();
              await onPurgeAccount();
            }}
            onClose={() => setShowPurgeModal(false)}
          />
        )}
      </AnimatePresence>
    </>
  );
};
