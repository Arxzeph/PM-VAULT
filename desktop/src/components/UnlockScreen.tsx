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
  ShieldCheck,
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
          "An encrypted vault already exists for this email! Please click 'Sync Existing' instead."
        );
      }

      setStatusMessage("Generating cryptographic keys (Argon2id + ChaCha20)...");
      const initRes = await api.initVault(cleanEmail, password);

      setStatusMessage("Registering zero-knowledge cloud account...");
      const authRes = await supabaseService.signUpOrSignIn(
        cleanEmail,
        initRes.auth_verifier
      );
      if (!authRes.user) {
        throw new Error("Failed to register user in Supabase cloud.");
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
        // Authenticate background Supabase session if email exists
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
        setError("Incorrect master password. Please try again.");
      }
    } catch (err: any) {
      setError(err?.message || "Failed to unlock vault.");
    } finally {
      setLoading(false);
    }
  };

  const handleResetVault = async () => {
    if (
      window.confirm(
        "DANGER: This will delete your local vault database from this computer. You can reconnect it if you remember your Master Password. Continue?"
      )
    ) {
      try {
        await api.resetVault();
        window.location.reload();
      } catch (err: any) {
        setError("Failed to reset local database: " + err?.message);
      }
    }
  };

  return (
    <div className="min-h-screen w-screen bg-[#09090b] flex flex-col items-center justify-center p-4 selection:bg-zinc-800 selection:text-emerald-300">
      {/* Decorative radial glow */}
      <div className="absolute top-1/3 w-96 h-96 bg-emerald-500/5 blur-[120px] rounded-full pointer-events-none" />

      <div className="w-full max-w-md bg-[#121316] border border-white/[0.08] rounded-2xl p-7 shadow-2xl relative z-10 backdrop-blur-xl">
        {/* Header Branding */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className="w-12 h-12 rounded-xl bg-zinc-900 border border-white/[0.08] flex items-center justify-center mb-3 shadow-inner">
            <Lock className="w-5 h-5 text-emerald-400" />
          </div>
          <h1 className="text-lg font-semibold tracking-tight text-white">PM Vault</h1>
          <p className="text-xs text-zinc-500 mt-1 font-mono">
            {isInitialized
              ? "Vault locked · Enter master password"
              : "Zero-Knowledge Personal Vault"}
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-start gap-2.5">
            <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <span className="leading-relaxed">{error}</span>
          </div>
        )}

        {isInitialized ? (
          /* ================= ALREADY INITIALIZED (UNLOCK VIEW) ================= */
          <form onSubmit={handleUnlock} className="space-y-4">
            {savedEmail && (
              <div className="p-2.5 rounded-xl bg-[#0c0d10] border border-white/[0.06] text-xs text-zinc-300 flex items-center gap-2">
                <Mail className="w-3.5 h-3.5 text-zinc-500" />
                <span className="truncate font-mono text-[11px]">{savedEmail}</span>
              </div>
            )}

            <div>
              <label className="block text-[11px] font-medium text-zinc-400 mb-1">
                Master Password
              </label>
              <input
                type="password"
                autoFocus
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••••••"
                className="w-full px-3.5 py-2.5 bg-[#0c0d10] border border-white/[0.08] rounded-xl text-xs font-mono text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-500 transition"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 bg-zinc-100 hover:bg-white text-zinc-950 rounded-xl text-xs font-semibold shadow-md flex items-center justify-center gap-2 transition disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Deriving Argon2id Key...</span>
                </>
              ) : (
                <>
                  <span>Unlock Vault</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>

            <div className="pt-2 text-center">
              <button
                type="button"
                onClick={handleResetVault}
                className="text-[11px] text-zinc-500 hover:text-rose-400 transition"
              >
                Reset local vault cache
              </button>
            </div>
          </form>
        ) : (
          /* ================= UNINITIALIZED (FIRST RUN ON NEW PC) ================= */
          <div className="space-y-4">
            {/* Raycast Segmented Control */}
            <div className="grid grid-cols-2 p-1 bg-[#0c0d10] border border-white/[0.06] rounded-xl text-xs font-medium">
              <button
                type="button"
                onClick={() => {
                  setInitMode("connect");
                  setError(null);
                }}
                className={`py-1.5 rounded-lg flex items-center justify-center gap-1.5 transition text-[11px] ${
                  initMode === "connect"
                    ? "bg-zinc-800 text-white shadow-sm border border-white/[0.08]"
                    : "text-zinc-400 hover:text-zinc-200 border border-transparent"
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
                className={`py-1.5 rounded-lg flex items-center justify-center gap-1.5 transition text-[11px] ${
                  initMode === "create"
                    ? "bg-zinc-800 text-white shadow-sm border border-white/[0.08]"
                    : "text-zinc-400 hover:text-zinc-200 border border-transparent"
                }`}
              >
                <PlusCircle className="w-3.5 h-3.5" />
                <span>Create New</span>
              </button>
            </div>

            {initMode === "connect" ? (
              /* CONNECT EXISTING FORM */
              <form onSubmit={handleConnect} className="space-y-3.5">
                <div>
                  <label className="block text-[11px] font-medium text-zinc-400 mb-1">
                    Account Email
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="your.email@example.com"
                    className="w-full px-3 py-2 bg-[#0c0d10] border border-white/[0.08] rounded-xl text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-500 transition"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-zinc-400 mb-1">
                    Master Password
                  </label>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter master password"
                    className="w-full px-3 py-2 bg-[#0c0d10] border border-white/[0.08] rounded-xl text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-500 transition"
                  />
                </div>

                {/* Advanced Salt Toggle */}
                <div>
                  <button
                    type="button"
                    onClick={() => setShowAdvancedSalt(!showAdvancedSalt)}
                    className="text-[10px] text-zinc-500 hover:text-zinc-300 flex items-center gap-1 transition"
                  >
                    <span>Advanced: Master Salt</span>
                    {showAdvancedSalt ? (
                      <ChevronUp className="w-3 h-3" />
                    ) : (
                      <ChevronDown className="w-3 h-3" />
                    )}
                  </button>

                  {showAdvancedSalt && (
                    <div className="mt-1.5">
                      <input
                        type="text"
                        value={manualSalt}
                        onChange={(e) => setManualSalt(e.target.value)}
                        placeholder="Base64 Salt"
                        className="w-full px-3 py-1.5 bg-[#0c0d10] border border-white/[0.08] rounded-lg text-xs font-mono text-zinc-300 placeholder-zinc-600 focus:outline-none focus:border-zinc-500"
                      />
                      <p className="text-[10px] text-zinc-500 mt-1">
                        Auto-detected from cloud. Only modify if offline or using a custom salt.
                      </p>
                    </div>
                  )}
                </div>

                <div className="p-3 bg-zinc-900/60 border border-white/[0.06] rounded-xl text-[11px] text-zinc-400 leading-relaxed">
                  <span className="font-semibold text-zinc-200">Device Sync:</span> Logging in imports your encrypted vault and syncs all passwords in real-time.
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 px-4 bg-zinc-100 hover:bg-white text-zinc-950 rounded-xl text-xs font-semibold shadow-md flex items-center justify-center gap-2 transition disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>{statusMessage || "Connecting..."}</span>
                    </>
                  ) : (
                    <>
                      <CloudDownload className="w-3.5 h-3.5" />
                      <span>Connect & Sync Vault</span>
                    </>
                  )}
                </button>
              </form>
            ) : (
              /* CREATE NEW VAULT FORM */
              <form onSubmit={handleInit} className="space-y-3.5">
                <div>
                  <label className="block text-[11px] font-medium text-zinc-400 mb-1">
                    Account Email
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="your.email@example.com"
                    className="w-full px-3 py-2 bg-[#0c0d10] border border-white/[0.08] rounded-xl text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-500 transition"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-zinc-400 mb-1">
                    Master Password
                  </label>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Choose a strong master password"
                    className="w-full px-3 py-2 bg-[#0c0d10] border border-white/[0.08] rounded-xl text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-500 transition"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-zinc-400 mb-1">
                    Confirm Master Password
                  </label>
                  <input
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter master password"
                    className="w-full px-3 py-2 bg-[#0c0d10] border border-white/[0.08] rounded-xl text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-500 transition"
                  />
                </div>

                <div className="p-3 bg-zinc-900/60 border border-white/[0.06] rounded-xl text-[11px] text-zinc-400 leading-relaxed">
                  <span className="font-semibold text-zinc-200">Zero-Knowledge:</span> Your password never leaves this device. A new random DEK and salt are generated locally.
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 px-4 bg-zinc-100 hover:bg-white text-zinc-950 rounded-xl text-xs font-semibold shadow-md flex items-center justify-center gap-2 transition disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>{statusMessage || "Creating Vault..."}</span>
                    </>
                  ) : (
                    <>
                      <KeyRound className="w-3.5 h-3.5" />
                      <span>Create Encrypted Vault</span>
                    </>
                  )}
                </button>
              </form>
            )}
          </div>
        )}
      </div>

      <div className="mt-5 text-[11px] font-mono text-zinc-500 flex items-center gap-2">
        <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
        <span>Client-Side XChaCha20-Poly1305 · Argon2id</span>
      </div>
    </div>
  );
};
