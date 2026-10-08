import { api } from "./api";

const USERNAME_EVENT = "pm-vault-username-changed";

export function formatDefaultUsername(email?: string | null): string {
  if (!email || !email.trim()) return "Vault Member";
  const prefix = email.split("@")[0].trim();
  if (!prefix) return "Vault Member";
  // Capitalize first character if alphabetic for friendly presentation
  return prefix.charAt(0).toUpperCase() + prefix.slice(1);
}

export function getStoredUsername(userEmail?: string | null): string {
  try {
    if (userEmail) {
      const emailSpecific = localStorage.getItem(`pm_vault_username_${userEmail}`);
      if (emailSpecific && emailSpecific.trim()) return emailSpecific.trim();
    }
    const globalName = localStorage.getItem("pm_vault_username");
    if (globalName && globalName.trim()) return globalName.trim();
  } catch (err) {
    console.warn("[Profile] Failed to read username from localStorage:", err);
  }

  return formatDefaultUsername(userEmail);
}

export async function setStoredUsername(
  username: string,
  userEmail?: string | null
): Promise<void> {
  const cleanName = username.trim() || formatDefaultUsername(userEmail);

  try {
    if (userEmail) {
      localStorage.setItem(`pm_vault_username_${userEmail}`, cleanName);
    }
    localStorage.setItem("pm_vault_username", cleanName);
  } catch (err) {
    console.warn("[Profile] Failed to save username to localStorage:", err);
  }

  try {
    await api.setUsername(cleanName);
  } catch (err) {
    console.warn("[Profile] Failed to persist username to SQLite backend:", err);
  }

  // Notify all listening components immediately
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent(USERNAME_EVENT, { detail: cleanName })
    );
  }
}

export async function syncUsernameFromBackend(
  userEmail?: string | null
): Promise<string> {
  try {
    const backendName = await api.getUsername();
    if (backendName && backendName.trim()) {
      const clean = backendName.trim();
      if (userEmail) {
        localStorage.setItem(`pm_vault_username_${userEmail}`, clean);
      }
      localStorage.setItem("pm_vault_username", clean);
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent(USERNAME_EVENT, { detail: clean })
        );
      }
      return clean;
    }
  } catch (err) {
    console.warn("[Profile] Could not fetch username from backend:", err);
  }

  return getStoredUsername(userEmail);
}

export function subscribeUsernameChange(
  callback: (newUsername: string) => void
): () => void {
  if (typeof window === "undefined") return () => {};

  const handler = (e: Event) => {
    const custom = e as CustomEvent<string>;
    if (custom.detail) {
      callback(custom.detail);
    }
  };

  window.addEventListener(USERNAME_EVENT, handler);
  return () => {
    window.removeEventListener(USERNAME_EVENT, handler);
  };
}
