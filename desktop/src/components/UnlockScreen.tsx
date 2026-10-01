import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { api } from "../services/api";
import { supabaseService } from "../services/supabase";
import {
  Lock,
  Eye,
  EyeOff,
  Shield,
  ArrowRight,
  RefreshCw,
  ChevronDown,
  PlusCircle,
  AlertCircle,
} from "lucide-react";

interface UnlockScreenProps {
  isInitialized: boolean;
  savedEmail?: string | null;
  onUnlocked: () => void;
}

export const UnlockScreen: React.FC<UnlockScreenProps> = ({
  isInitialized,
  savedEmail,
  onUnlocked,
}) => {
  const [initMode, setInitMode] = useState<"connect" | "create">("connect");
  const [email, setEmail] = useState(savedEmail || "");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Switch menu state (collapsed by default as requested in Fix #1)
  const [showSwitchMenu, setShowSwitchMenu] = useState(false);

  // Connect / Sync existing vault from Supabase cloud
  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setStatusMessage(null);

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes("@")) {
      setError("Please enter a valid email address.");
      return;
    }
    if (password.length < 8) {
      setError("Master password must be at least 8 characters long.");
      return;
    }

    setLoading(true);
    try {
      setStatusMessage("Checking cloud enclave...");
      const salt = await supabaseService.fetchUserSalt(cleanEmail);
      if (!salt) {
        throw new Error(
          "No cloud vault found for this email. If this is a new setup, select 'Create New Vault'."
        );
      }

      setStatusMessage("Deriving Argon2id Master Key...");
      const authVerifier = await api.deriveAuthVerifierFromSalt(cleanEmail, password, salt);

      setStatusMessage("Authenticating with cloud vault...");
      const authRes = await supabaseService.signIn(cleanEmail, authVerifier);
      if (authRes.error) {
        throw new Error(
          authRes.error.toLowerCase().includes("invalid login credentials")
            ? "Incorrect Master Password. Please check your password and try again."
            : authRes.error
        );
      }
      if (!authRes.user) {
        throw new Error("Invalid master password or cloud authentication failed.");
      }

      setStatusMessage("Downloading zero-knowledge vault keys...");
      const remoteMeta = await supabaseService.fetchRemoteVaultMeta(authRes.user.id);
      if (!remoteMeta || !remoteMeta.encrypted_dek || !remoteMeta.dek_nonce) {
        throw new Error("Vault metadata missing in cloud. Please verify your credentials.");
      }

      setStatusMessage("Decrypting vault and initializing enclave...");
      await api.importRemoteVaultMeta(
        cleanEmail,
        password,
        salt,
        remoteMeta.encrypted_dek,
        remoteMeta.dek_nonce
      );

      onUnlocked();
    } catch (err: any) {
      console.error("Connect failed:", err);
      setError(err?.message || "Failed to connect to existing vault. Please verify your password.");
    } finally {
      setLoading(false);
      setStatusMessage(null);
    }
  };

  // Initialize a brand new vault
  const handleInit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setStatusMessage(null);

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes("@")) {
      setError("Please enter a valid email address.");
      return;
    }
    if (password.length < 8) {
      setError("Master password must be at least 8 characters long.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      setStatusMessage("Checking if account already exists...");
      const existingSalt = await supabaseService.fetchUserSalt(cleanEmail);
      if (existingSalt) {
        throw new Error(
          "An encrypted vault already exists for this email! Please click 'Connect Existing' instead."
        );
      }

      setStatusMessage("Generating cryptographic keys (Argon2id + AES-256)...");
      const initRes = await api.initVault(cleanEmail, password);

      setStatusMessage("Registering zero-knowledge cloud account...");
      const authRes = await supabaseService.signUpOrSignIn(cleanEmail, initRes.auth_verifier);
      if (!authRes.user) {
        throw new Error("Failed to register cloud account.");
      }

      await supabaseService.saveRemoteVaultMeta(
        authRes.user.id,
        initRes.master_salt,
        initRes.encrypted_dek,
        initRes.dek_nonce
      );

      onUnlocked();
    } catch (err: any) {
      console.error("Init failed:", err);
      setError(err?.message || "Failed to initialize vault.");
    } finally {
      setLoading(false);
      setStatusMessage(null);
    }
  };

  // Unlock existing initialized local database
  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) return;

    setLoading(true);
    setError(null);

    try {
      const success = await api.unlockVault(password);
      if (success) {
        if (savedEmail) {
          try {
            const creds = await api.getSessionCredentials();
            if (creds && creds.auth_verifier) {
              await supabaseService.signUpOrSignIn(savedEmail, creds.auth_verifier);
            }
          } catch (cloudErr) {
            console.warn("Background cloud sign-in warning:", cloudErr);
          }
        }
        onUnlocked();
      } else {
        setError("Incorrect master password. Please verify and try again.");
      }
    } catch (err: any) {
      setError(err?.message || "Failed to unlock vault.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-screen w-screen bg-[#0D0F17] flex flex-col justify-between items-center relative overflow-hidden select-none font-sans text-white">
      {/* Top Enclave Telemetry Strip */}
      <header className="w-full py-2.5 px-6 border-b border-[#242B3D]/70 bg-[#0C0E16]/80 flex items-center justify-between text-[11px] font-mono text-slate-400 z-10">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 text-slate-300">
            <span className="w-2 h-2 rounded-full bg-[#38BDF8] animate-pulse" />
            NODE://LOCAL_ENCLAVE_ISOLATED
          </span>
          <span className="text-slate-600">•</span>
          <span className="text-slate-300">TPM 2.0 ACTIVE</span>
        </div>

        <div className="flex items-center gap-4 text-slate-400">
          <span>ARGON2ID-AES-256-GCM</span>
          <span className="text-slate-600">•</span>
          <span className="text-[#38BDF8]">ZERO-KNOWLEDGE STRICT</span>
        </div>
      </header>

      {/* Main Centered Unlock Security Card */}
      <main className="flex-1 flex items-center justify-center p-4 w-full z-10">
        <motion.div
          initial={{ opacity: 0, scale: 0.94, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ type: "spring", damping: 25, stiffness: 350 }}
          className="bg-[#161B26] border border-[#242B3D] rounded-3xl p-8 max-w-md w-full shadow-2xl relative overflow-hidden flex flex-col gap-6"
        >
          {/* Brand Header */}
          <div className="flex flex-col items-center text-center gap-3">
            <div className="w-14 h-14 rounded-2xl bg-[#6366F1]/15 border border-[#6366F1]/30 flex items-center justify-center text-[#6366F1] shadow-xl shadow-[#6366F1]/10">
              <Shield className="w-7 h-7" />
            </div>

            <div className="flex flex-col">
              <div className="flex items-center justify-center gap-2">
                <h1 className="text-xl font-bold tracking-wider text-white">PM-VAULT</h1>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-semibold">
                  v2.4
                </span>
              </div>
              <p className="text-xs font-mono text-slate-400 mt-1">
                HARDWARE ENCLAVE ENCRYPTED STORAGE
              </p>
            </div>
          </div>

          {/* Active Vault Identity Bar with Collapsed Switch Dropdown */}
          {isInitialized && (
            <div className="relative">
              <div
                onClick={() => setShowSwitchMenu((prev) => !prev)}
                className="bg-[#0D0F17] border border-[#242B3D] hover:border-slate-700 rounded-xl px-3.5 py-2.5 flex items-center justify-between cursor-pointer transition-colors"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-6 h-6 rounded-md bg-indigo-500/20 flex items-center justify-center text-indigo-400">
                    <Lock className="w-3.5 h-3.5" />
                  </div>
                  <div className="flex flex-col text-left">
                    <span className="text-xs font-semibold text-slate-200">
                      {savedEmail || "alex@dev.io"}
                    </span>
                    <span className="text-[10px] font-mono text-slate-400">
                      Personal Vault (Master)
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 text-xs text-slate-400">
                  <span>Switch</span>
                  <ChevronDown className="w-3.5 h-3.5" />
                </div>
              </div>

              {/* Collapsed switch menu (only renders if clicked!) */}
              <AnimatePresence>
                {showSwitchMenu && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.94, y: -6 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.94, y: -6 }}
                    transition={{ duration: 0.14 }}
                    className="absolute left-0 top-full mt-1.5 w-full bg-[#161B26] border border-[#242B3D] rounded-xl shadow-2xl p-2 z-50 flex flex-col gap-1 backdrop-blur-md"
                  >
                    <div className="px-2.5 py-1 text-[10px] font-mono text-slate-400 uppercase">
                      Select Identity / Vault
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowSwitchMenu(false)}
                      className="flex items-center justify-between px-2.5 py-2 rounded-lg bg-indigo-600/20 text-white text-xs font-medium cursor-pointer"
                    >
                      <span>{savedEmail || "Personal Vault (Master)"}</span>
                      <span className="text-[10px] text-[#38BDF8] font-mono">Active</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowSwitchMenu(false);
                        setInitMode("connect");
                      }}
                      className="flex items-center gap-2 px-2.5 py-2 rounded-lg hover:bg-slate-800 text-slate-300 text-xs font-medium transition-colors text-left cursor-pointer"
                    >
                      <PlusCircle className="w-3.5 h-3.5 text-indigo-400" />
                      <span>Connect Other Cloud Vault</span>
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          {/* Error Banner */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                className="p-3 bg-rose-950/40 border border-rose-800/80 rounded-xl text-xs text-rose-300 flex items-center gap-2"
              >
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{error}</span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Status Message */}
          <AnimatePresence>
            {statusMessage && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                className="p-3 bg-indigo-950/40 border border-indigo-800/60 rounded-xl text-xs text-indigo-300 flex items-center gap-2"
              >
                <RefreshCw className="w-4 h-4 animate-spin text-[#38BDF8]" />
                <span>{statusMessage}</span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Form: Unlock vs Connect/Init */}
          {isInitialized ? (
            <form onSubmit={handleUnlock} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-slate-400">Master Password</label>
                <div className="flex items-center bg-[#0D0F17] border border-[#242B3D] focus-within:border-[#6366F1] focus-within:ring-1 focus-within:ring-[#6366F1] rounded-xl px-3.5 py-2.5 transition-all">
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    autoFocus
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter Master Password"
                    className="w-full bg-transparent text-sm text-white placeholder-slate-500 focus:outline-none font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="p-1 text-slate-400 hover:text-white transition-colors cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <motion.button
                type="submit"
                disabled={loading || !password}
                whileHover={!loading && password ? { scale: 1.02 } : undefined}
                whileTap={!loading && password ? { scale: 0.98 } : undefined}
                className="w-full py-3 rounded-xl bg-[#6366F1] hover:bg-[#5254e0] disabled:opacity-50 text-white font-semibold text-sm shadow-xl shadow-[#6366F1]/25 flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Deriving Keys...</span>
                  </>
                ) : (
                  <>
                    <Lock className="w-4 h-4" />
                    <span>Unlock Vault</span>
                  </>
                )}
              </motion.button>
            </form>
          ) : (
            /* First-time setup / Connect cloud vault form */
            <form onSubmit={initMode === "connect" ? handleConnect : handleInit} className="flex flex-col gap-4">
              {/* Mode Switcher */}
              <div className="flex items-center gap-2 bg-[#0D0F17] p-1 rounded-xl border border-[#242B3D]">
                <button
                  type="button"
                  onClick={() => setInitMode("connect")}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    initMode === "connect"
                      ? "bg-[#6366F1] text-white shadow-sm"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  Sync Existing
                </button>
                <button
                  type="button"
                  onClick={() => setInitMode("create")}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    initMode === "create"
                      ? "bg-[#6366F1] text-white shadow-sm"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  Create New
                </button>
              </div>

              {/* Email Input */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-slate-400">Account Email</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="alex@domain.com"
                  className="w-full bg-[#0D0F17] border border-[#242B3D] rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#6366F1] font-sans"
                />
              </div>

              {/* Master Password Input */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-slate-400">Master Password</label>
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min 8 characters (Argon2id derived)"
                  className="w-full bg-[#0D0F17] border border-[#242B3D] rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#6366F1] font-mono"
                />
              </div>

              {/* Confirm Password if creating new */}
              {initMode === "create" && (
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-slate-400">Confirm Master Password</label>
                  <input
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter master password"
                    className="w-full bg-[#0D0F17] border border-[#242B3D] rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#6366F1] font-mono"
                  />
                </div>
              )}

              <motion.button
                type="submit"
                disabled={loading}
                whileHover={!loading ? { scale: 1.02 } : undefined}
                whileTap={!loading ? { scale: 0.98 } : undefined}
                className="w-full py-3 rounded-xl bg-[#6366F1] hover:bg-[#5254e0] disabled:opacity-50 text-white font-semibold text-sm shadow-xl shadow-[#6366F1]/25 flex items-center justify-center gap-2 transition-all cursor-pointer mt-1"
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Connecting...</span>
                  </>
                ) : (
                  <>
                    <span>{initMode === "connect" ? "Authenticate & Sync Vault" : "Create Master Enclave"}</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </motion.button>
            </form>
          )}
        </motion.div>
      </main>

      {/* Bottom Footer Strip */}
      <footer className="w-full py-3 px-6 border-t border-[#242B3D]/70 bg-[#0C0E16]/80 flex items-center justify-between text-xs font-mono text-slate-400 z-10">
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-[#38BDF8]" />
          <span>Zero-Knowledge Architecture: Master key is derived locally and never transmitted.</span>
        </div>

        <div className="flex items-center gap-4 text-xs font-sans text-slate-400">
          <button
            type="button"
            onClick={() => alert("Emergency Access Kit is available in Settings when unlocked.")}
            className="hover:text-white transition-colors cursor-pointer"
          >
            Emergency Access Kit
          </button>
          <span>•</span>
          <button
            type="button"
            onClick={() => alert("For security, Master Passwords cannot be reset remotely without cloud keys or recovery codes.")}
            className="hover:text-white transition-colors cursor-pointer"
          >
            Forgot Master Password?
          </button>
        </div>
      </footer>
    </div>
  );
};
