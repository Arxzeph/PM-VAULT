import React, { useState } from "react";
import { api } from "../services/api";
import { supabaseService } from "../services/supabase";
import {
  Lock,
  KeyRound,
  Mail,
  ShieldAlert,
  ArrowRight,
  Loader2,
  CloudDownload,
  PlusCircle,
  ChevronDown,
  ChevronUp,
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
  const [manualSalt, setManualSalt] = useState("");
  const [showAdvancedSalt, setShowAdvancedSalt] = useState(false);
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Connect to an existing vault on Supabase
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
      setStatusMessage("Checking cloud account...");
      let salt = await supabaseService.fetchUserSalt(cleanEmail);
      if (!salt && manualSalt.trim()) {
        salt = manualSalt.trim();
      }

      if (!salt) {
        throw new Error(
          "No cloud vault found for this email. If this is a new setup, click 'Create New Vault'."
        );
      }

      setStatusMessage("Deriving Argon2id Master Key...");
      const authVerifier = await api.deriveAuthVerifierFromSalt(
        cleanEmail,
        password,
        salt
      );

      setStatusMessage("Authenticating with cloud vault...");
      const authRes = await supabaseService.signUpOrSignIn(
        cleanEmail,
        authVerifier
      );
      if (!authRes.user) {
        throw new Error("Invalid master password or cloud authentication failed.");
      }

      setStatusMessage("Downloading encrypted vault keys...");
      const remoteMeta = await supabaseService.fetchRemoteVaultMeta(authRes.user.id);
      if (
        !remoteMeta ||
        !remoteMeta.encrypted_dek ||
        !remoteMeta.dek_nonce
      ) {
        throw new Error(
          "Vault metadata missing in cloud. Please verify your master password and salt."
        );
      }

      setStatusMessage("Decrypting vault and initializing local database...");
      await api.importRemoteVaultMeta(
        cleanEmail,
        password,
        salt,
        remoteMeta.encrypted_dek,
        remoteMeta.dek_nonce
      );

      onUnlocked();
    } catch (err: unknown) {
      console.error("[Connect] Error:", err);
      setError(
        typeof err === "string"
          ? err
          : (err as Error).message || "Failed to connect to vault."
      );
    } finally {
      setLoading(false);
      setStatusMessage(null);
    }
  };

  // Create a brand new vault
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
      setStatusMessage("Generating cryptographic keys (Argon2id + DEK)...");
      const res = await api.initVault(cleanEmail, password);

      setStatusMessage("Syncing metadata with cloud...");
      try {
        const authRes = await supabaseService.signUpOrSignIn(cleanEmail, res.auth_verifier);
        if (authRes.user) {
          await supabaseService.saveRemoteVaultMeta(
            authRes.user.id,
            res.master_salt,
            res.encrypted_dek,
            res.dek_nonce
          );
        }
      } catch (authErr) {
        console.warn("Supabase auth sync skipped/failed:", authErr);
      }

      onUnlocked();
    } catch (err: unknown) {
      setError(
        typeof err === "string" ? err : (err as Error).message || "Failed to initialize vault"
      );
    } finally {
      setLoading(false);
      setStatusMessage(null);
    }
  };

  // Standard unlock for already-initialized vault
  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!password) {
      setError("Please enter your master password.");
      return;
    }

    setLoading(true);
    try {
      const res = await api.unlockVault(password);

      // Connect to Supabase and ensure metadata is stored in cloud
      if (res.email && res.auth_verifier) {
        try {
          const authRes = await supabaseService.signUpOrSignIn(res.email, res.auth_verifier);
          if (authRes.user) {
            await supabaseService.saveRemoteVaultMeta(
              authRes.user.id,
              res.master_salt,
              res.encrypted_dek,
              res.dek_nonce
            );
          }
        } catch (authErr) {
          console.warn("[UnlockScreen] Supabase auth/metadata sync warning:", authErr);
        }
      }

      onUnlocked();
    } catch (err: unknown) {
      setError(typeof err === "string" ? err : "Incorrect master password. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleResetVault = async () => {
    const confirmed = window.confirm(
      "Are you sure you want to reset your local vault? This will delete local encrypted data so you can set a brand new master password."
    );
    if (!confirmed) return;

    setLoading(true);
    try {
      await api.resetVault();
      window.location.reload();
    } catch {
      setError("Failed to reset vault.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-slate-100 select-none">
      {/* Decorative background glow */}
      <div className="absolute w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none -top-20" />
      <div className="absolute w-96 h-96 bg-cyan-600/10 rounded-full blur-3xl pointer-events-none -bottom-20" />

      <div className="w-full max-w-md bg-slate-900/90 backdrop-blur-xl border border-slate-800 rounded-2xl p-8 shadow-2xl relative z-10">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-indigo-600 to-cyan-500 shadow-lg shadow-indigo-500/20 mb-4">
            <Lock className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">PM Vault</h1>
          <p className="text-sm text-slate-400 mt-1">
            {isInitialized
              ? "Your vault is locked. Enter master password."
              : "Zero-Knowledge Personal Password Manager"}
          </p>
        </div>

        {error && (
          <div className="mb-5 p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2.5">
            <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {isInitialized ? (
          /* ================= ALREADY INITIALIZED (UNLOCK VIEW) ================= */
          <form onSubmit={handleUnlock} className="space-y-4">
            {savedEmail && (
              <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800/80 text-xs text-slate-300 flex items-center gap-2">
                <Mail className="w-4 h-4 text-slate-500" />
                <span className="truncate">{savedEmail}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Master Password
              </label>
              <div className="relative">
                <input
                  type="password"
                  autoFocus
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••••••"
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white rounded-xl text-sm font-semibold shadow-lg shadow-indigo-600/25 flex items-center justify-center gap-2 transition disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Deriving Argon2id Key...</span>
                </>
              ) : (
                <>
                  <span>Unlock Vault</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>

            <div className="pt-2 text-center">
              <button
                type="button"
                onClick={handleResetVault}
                className="text-xs text-slate-500 hover:text-rose-400 transition"
              >
                Forgot Master Password? Reset Vault
              </button>
            </div>
          </form>
        ) : (
          /* ================= UNINITIALIZED (FIRST RUN ON NEW PC) ================= */
          <div className="space-y-5">
            {/* Mode Selector Tabs */}
            <div className="grid grid-cols-2 p-1 bg-slate-950 border border-slate-800 rounded-xl text-xs font-medium">
              <button
                type="button"
                onClick={() => {
                  setInitMode("connect");
                  setError(null);
                }}
                className={`py-2 rounded-lg flex items-center justify-center gap-1.5 transition ${
                  initMode === "connect"
                    ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <CloudDownload className="w-3.5 h-3.5" />
                <span>Sync Existing</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setInitMode("create");
                  setError(null);
                }}
                className={`py-2 rounded-lg flex items-center justify-center gap-1.5 transition ${
                  initMode === "create"
                    ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <PlusCircle className="w-3.5 h-3.5" />
                <span>Create New</span>
              </button>
            </div>

            {initMode === "connect" ? (
              /* CONNECT EXISTING FORM */
              <form onSubmit={handleConnect} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Account Email
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="your.email@example.com"
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Master Password
                  </label>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your master password"
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition"
                  />
                </div>

                {/* Advanced Salt Toggle */}
                <div>
                  <button
                    type="button"
                    onClick={() => setShowAdvancedSalt(!showAdvancedSalt)}
                    className="text-[11px] text-slate-500 hover:text-slate-300 flex items-center gap-1 transition"
                  >
                    <span>Advanced: Master Salt</span>
                    {showAdvancedSalt ? (
                      <ChevronUp className="w-3 h-3" />
                    ) : (
                      <ChevronDown className="w-3 h-3" />
                    )}
                  </button>

                  {showAdvancedSalt && (
                    <div className="mt-2">
                      <input
                        type="text"
                        value={manualSalt}
                        onChange={(e) => setManualSalt(e.target.value)}
                        placeholder="Base64 Salt"
                        className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono text-slate-300 placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                      />
                      <p className="text-[10px] text-slate-500 mt-1">
                        Auto-detected from cloud. Only modify if offline or using a custom salt.
                      </p>
                    </div>
                  )}
                </div>

                <div className="p-3 bg-indigo-950/30 border border-indigo-500/20 rounded-xl text-[11px] text-indigo-300/80 leading-relaxed">
                  <span className="font-semibold text-indigo-200">New Device Sync:</span> Logging in on this PC will securely import your encrypted vault and sync all passwords in real-time.
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 px-4 bg-gradient-to-r from-indigo-600 to-cyan-500 hover:from-indigo-500 hover:to-cyan-400 text-white rounded-xl text-sm font-semibold shadow-lg shadow-indigo-600/25 flex items-center justify-center gap-2 transition disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>{statusMessage || "Connecting..."}</span>
                    </>
                  ) : (
                    <>
                      <CloudDownload className="w-4 h-4" />
                      <span>Connect & Sync Vault</span>
                    </>
                  )}
                </button>
              </form>
            ) : (
              /* CREATE NEW VAULT FORM */
              <form onSubmit={handleInit} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Account Email
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="your.email@example.com"
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Master Password
                  </label>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Choose a strong master password"
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Confirm Master Password
                  </label>
                  <input
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter master password"
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition"
                  />
                </div>

                <div className="p-3 bg-indigo-950/30 border border-indigo-500/20 rounded-xl text-[11px] text-indigo-300/80 leading-relaxed">
                  <span className="font-semibold text-indigo-200">Zero-Knowledge Guarantee:</span> Your master password never leaves this device. A new random DEK and salt will be generated locally.
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 px-4 bg-gradient-to-r from-indigo-600 to-cyan-500 hover:from-indigo-500 hover:to-cyan-400 text-white rounded-xl text-sm font-semibold shadow-lg shadow-indigo-600/25 flex items-center justify-center gap-2 transition disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>{statusMessage || "Creating Vault..."}</span>
                    </>
                  ) : (
                    <>
                      <KeyRound className="w-4 h-4" />
                      <span>Create Encrypted Vault</span>
                    </>
                  )}
                </button>
              </form>
            )}
          </div>
        )}
      </div>

      <div className="mt-6 text-xs text-slate-500 flex items-center gap-2">
        <span className="inline-block w-2 h-2 rounded-full bg-emerald-500" />
        <span>Local-first · Client-Side XChaCha20-Poly1305 · Argon2id</span>
      </div>
    </div>
  );
};
