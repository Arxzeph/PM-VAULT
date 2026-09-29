// Security Hardening: Auto-clearing clipboard after 30 seconds to protect secrets

let wipeTimer: ReturnType<typeof setTimeout> | null = null;
let lastCopiedSecret: string | null = null;
let wipeListeners: Array<() => void> = [];

export function onClipboardWiped(callback: () => void) {
  wipeListeners.push(callback);
  return () => {
    wipeListeners = wipeListeners.filter((cb) => cb !== callback);
  };
}

export function copyWithAutoWipe(
  text: string,
  wipeDelayMs: number = 30000
): Promise<void> {
  if (!text) return Promise.resolve();

  lastCopiedSecret = text;

  if (wipeTimer) {
    clearTimeout(wipeTimer);
    wipeTimer = null;
  }

  wipeTimer = setTimeout(async () => {
    try {
      const current = await navigator.clipboard.readText().catch(() => null);
      if (current === null || current === lastCopiedSecret) {
        await navigator.clipboard.writeText("");
        wipeListeners.forEach((cb) => cb());
      }
    } catch {
      await navigator.clipboard.writeText("").catch(() => {});
      wipeListeners.forEach((cb) => cb());
    } finally {
      lastCopiedSecret = null;
      wipeTimer = null;
    }
  }, wipeDelayMs);

  return navigator.clipboard.writeText(text);
}
