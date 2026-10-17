import React, { useState, useEffect, useRef } from "react";
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
  Edit3,
  Check,
  Trash2,
} from "lucide-react";
import { PurgeConfirmModal } from "./PurgeConfirmModal";
import {
  getStoredUsername,
  setStoredUsername,
  formatDefaultUsername,
  getStoredAvatar,
  setStoredAvatar,
} from "../../services/profile";

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
  const [username, setUsername] = useState<string>(() => getStoredUsername(userEmail));
  const [avatarUrl, setAvatarUrl] = useState<string | null>(() => getStoredAvatar(userEmail));
  const [isEditingUsername, setIsEditingUsername] = useState(false);
  const [tempUsername, setTempUsername] = useState("");
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [avatarMessage, setAvatarMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setUsername(getStoredUsername(userEmail));
    setAvatarUrl(getStoredAvatar(userEmail));
  }, [userEmail]);

  const handleStartEdit = () => {
    setTempUsername(username);
    setIsEditingUsername(true);
  };

  const handleSaveUsername = async (customName?: string) => {
    const candidate = customName !== undefined ? customName : tempUsername;
    const clean = candidate.trim() || formatDefaultUsername(userEmail);
    setUsername(clean);
    setIsEditingUsername(false);
    setTempUsername("");
    await setStoredUsername(clean, userEmail);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2000);
  };

  const handleCancelEdit = () => {
    setIsEditingUsername(false);
    setTempUsername("");
  };

  // Upload Photo File Handler with Canvas Scaling
  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setAvatarMessage("Please select a valid image file (PNG, JPG, WebP)");
      setTimeout(() => setAvatarMessage(null), 3000);
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const src = event.target?.result as string;
      if (!src) return;

      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const size = 256;
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          // Center crop to square
          const minSide = Math.min(img.width, img.height);
          const startX = (img.width - minSide) / 2;
          const startY = (img.height - minSide) / 2;
          ctx.drawImage(img, startX, startY, minSide, minSide, 0, 0, size, size);

          const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
          setStoredAvatar(dataUrl, userEmail);
          setAvatarUrl(dataUrl);
          setAvatarMessage("Photo avatar updated successfully");
          setTimeout(() => setAvatarMessage(null), 2500);
        }
      };
      img.src = src;
    };
    reader.readAsDataURL(file);

    // Reset input value so same file can be re-selected if desired
    e.target.value = "";
  };

  const handleRemovePhoto = () => {
    setStoredAvatar(null, userEmail);
    setAvatarUrl(null);
    setAvatarMessage("Photo removed; initials restored");
    setTimeout(() => setAvatarMessage(null), 2500);
  };

  return (
    <>
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
          transition={{ type: "spring", damping: 26, stiffness: 360 }}
          className="bg-[#121214] border border-[#232326] rounded-2xl shadow-2xl max-w-2xl w-full p-6 relative overflow-hidden flex flex-col gap-5 text-white max-h-[90vh] overflow-y-auto"
        >
          {/* Hidden File Input for Real Photo Uploads */}
          <input
            type="file"
            ref={fileInputRef}
            accept="image/png, image/jpeg, image/webp"
            onChange={handlePhotoSelect}
            className="hidden"
          />

          {/* Header */}
          <div className="flex items-center justify-between pb-3.5 border-b border-[#232326]">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-[#18181B] border border-[#27272A] flex items-center justify-center text-zinc-200">
                <Settings className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-white">Vault Settings & Security</h2>
                <span className="text-xs font-mono text-zinc-500">
                  ID: SEC-8941-B92D • TPM 2.0 Hardware Enclave
                </span>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation Tabs */}
          <div className="flex items-center gap-1.5 border-b border-[#232326] pb-2">
            {[
              { id: "general", label: "General & Identity" },
              { id: "security", label: "Security & Enclave" },
              { id: "master_key", label: "Master Password" },
              { id: "danger", label: "Danger Zone", isDanger: true },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  activeTab === tab.id
                    ? tab.isDanger
                      ? "bg-rose-600/20 text-rose-300 border border-rose-500/40"
                      : "bg-white text-black shadow-sm"
                    : tab.isDanger
                    ? "text-rose-400 hover:text-rose-300 hover:bg-rose-950/20"
                    : "text-zinc-400 hover:text-white hover:bg-zinc-800/60"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab 1: General & Profile */}
          {activeTab === "general" && (
            <div className="flex flex-col gap-4 py-1">
              {/* Profile Card with Real Photo Avatar */}
              <div className="bg-[#18181B] border border-[#27272A] rounded-xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4 min-w-0">
                  <div className="w-14 h-14 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-white font-bold text-lg select-none flex-shrink-0 overflow-hidden">
                    {avatarUrl ? (
                      <img
                        src={avatarUrl}
                        alt="User Avatar"
                        className="w-full h-full object-cover"
                      />
                    ) : username ? (
                      username.charAt(0).toUpperCase()
                    ) : (
                      <User className="w-6 h-6 text-zinc-300" />
                    )}
                  </div>

                  <div className="flex flex-col min-w-0">
                    {isEditingUsername ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          autoFocus
                          value={tempUsername}
                          onChange={(e) => setTempUsername(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleSaveUsername();
                            if (e.key === "Escape") handleCancelEdit();
                          }}
                          placeholder="Enter username"
                          maxLength={32}
                          className="bg-[#121214] border border-zinc-600 text-white text-sm font-semibold rounded-lg px-2.5 py-1 focus:outline-none focus:ring-1 focus:ring-zinc-400 font-sans"
                        />
                        <button
                          type="button"
                          onClick={() => handleSaveUsername()}
                          title="Save Username"
                          className="p-1.5 rounded-lg bg-white hover:bg-zinc-200 text-black transition-colors cursor-pointer"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={handleCancelEdit}
                          title="Cancel"
                          className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white transition-colors cursor-pointer"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-base text-white truncate max-w-[200px]">
                          {username}
                        </span>
                        <button
                          type="button"
                          onClick={handleStartEdit}
                          title="Edit Username"
                          className="p-1 rounded-md text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-300 border border-zinc-700 font-semibold whitespace-nowrap">
                          • Verified Enclave
                        </span>
                        {saveSuccess && (
                          <span className="text-[10px] font-mono text-zinc-300 font-semibold">
                            ✓ Saved
                          </span>
                        )}
                      </div>
                    )}
                    <span className="text-xs font-mono text-zinc-400 mt-0.5 truncate">
                      {userEmail || "Local Hardware Enclave"}
                    </span>
                    {avatarMessage && (
                      <span className="text-[11px] font-mono text-zinc-300 mt-1">
                        ✓ {avatarMessage}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
                  {!isEditingUsername && (
                    <button
                      type="button"
                      onClick={handleStartEdit}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 hover:text-white text-xs font-semibold border border-zinc-700 transition-colors cursor-pointer"
                    >
                      <Edit3 className="w-3.5 h-3.5 text-zinc-300" />
                      <span>Edit Username</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white hover:bg-zinc-200 text-black text-xs font-semibold transition-colors cursor-pointer shadow-sm"
                  >
                    <Upload className="w-3.5 h-3.5 text-black" />
                    <span>{avatarUrl ? "Change Photo" : "Upload Photo"}</span>
                  </button>

                  {avatarUrl && (
                    <button
                      type="button"
                      onClick={handleRemovePhoto}
                      title="Remove profile photo"
                      className="p-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-rose-400 border border-zinc-700 transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Set Username Form Card */}
              <div className="bg-[#18181B] border border-[#27272A] rounded-xl p-4 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-zinc-300" />
                    <span className="text-xs font-bold text-white uppercase tracking-wider font-mono">
                      Vault Username & Identity
                    </span>
                  </div>
                  <span className="text-[10px] font-mono text-zinc-500">
                    Custom identity display name
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex-1 relative">
                    <input
                      type="text"
                      value={tempUsername !== "" ? tempUsername : isEditingUsername ? "" : username}
                      onChange={(e) => setTempUsername(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && tempUsername.trim() && tempUsername.trim() !== username) {
                          handleSaveUsername(tempUsername);
                        }
                      }}
                      placeholder="Enter custom username"
                      maxLength={32}
                      className="w-full bg-[#121214] border border-[#27272A] rounded-xl px-3.5 py-2 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-500 font-sans"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => handleSaveUsername(tempUsername)}
                    disabled={!tempUsername.trim() || tempUsername.trim() === username}
                    className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                      tempUsername.trim() && tempUsername.trim() !== username
                        ? "bg-white hover:bg-zinc-200 text-black shadow-sm"
                        : "bg-zinc-800 text-zinc-500 cursor-not-allowed border border-zinc-700/50"
                    }`}
                  >
                    Set Username
                  </button>
                </div>
              </div>

              {/* Hardware & Enclave Spec Strip */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-[#18181B] border border-[#27272A] rounded-xl p-3.5 flex flex-col gap-1">
                  <span className="text-[10px] font-mono text-zinc-500">HARDWARE ENCLAVE</span>
                  <span className="text-xs font-bold text-white font-mono mt-0.5">
                    TPM 2.0 Module Active
                  </span>
                </div>

                <div className="bg-[#18181B] border border-[#27272A] rounded-xl p-3.5 flex flex-col gap-1">
                  <span className="text-[10px] font-mono text-zinc-500">CRYPTOGRAPHIC ALGORITHM</span>
                  <span className="text-xs font-bold text-white font-mono mt-0.5">
                    ChaCha20-Poly1305 + Argon2id
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Tab 2: Security & Enclave */}
          {activeTab === "security" && (
            <div className="flex flex-col gap-4 py-1">
              <div className="bg-[#18181B] border border-[#27272A] rounded-xl p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Clock className="w-5 h-5 text-zinc-300" />
                  <div>
                    <span className="text-xs font-bold text-white">Auto-Lock Inactivity Timeout</span>
                    <p className="text-[11px] text-zinc-400">
                      Locks memory vault after 5 minutes of inactivity on this device.
                    </p>
                  </div>
                </div>
                <span className="text-xs font-mono px-2.5 py-1 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-200">
                  5 Minutes
                </span>
              </div>

              <div className="bg-[#18181B] border border-[#27272A] rounded-xl p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Laptop className="w-5 h-5 text-zinc-300" />
                  <div>
                    <span className="text-xs font-bold text-white">Smart Clipboard Auto-Clear</span>
                    <p className="text-[11px] text-zinc-400">
                      Automatically shreds copied passwords from system memory after 30 seconds.
                    </p>
                  </div>
                </div>
                <span className="text-xs font-mono px-2.5 py-1 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-200">
                  30 Seconds
                </span>
              </div>
            </div>
          )}

          {/* Tab 3: Master Key */}
          {activeTab === "master_key" && (
            <div className="flex flex-col gap-4 py-1">
              <div className="bg-[#18181B] border border-[#27272A] rounded-xl p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <KeyRound className="w-5 h-5 text-zinc-300" />
                  <div>
                    <span className="text-xs font-bold text-white">Change Master Password</span>
                    <p className="text-[11px] text-zinc-400">
                      Re-encrypts all vault DEKs with a new Argon2id key and updates cloud verifier.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    onClose();
                    onOpenChangePassword();
                  }}
                  className="px-3.5 py-2 rounded-xl bg-white hover:bg-zinc-200 text-black text-xs font-semibold shadow-sm transition-all cursor-pointer"
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

                <p className="text-xs text-zinc-300 leading-relaxed">
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
          <div className="flex items-center justify-between pt-3.5 border-t border-[#232326] mt-2">
            <span className="text-[11px] font-mono text-zinc-500">
              • Hardware Security Module Attached
            </span>
            <button
              onClick={onClose}
              className="px-5 py-2 rounded-xl bg-white hover:bg-zinc-200 text-black text-xs font-semibold shadow-sm transition-all cursor-pointer"
            >
              Done
            </button>
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
