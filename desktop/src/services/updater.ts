import { openUrl } from "@tauri-apps/plugin-opener";

export interface ReleaseAsset {
  name: string;
  downloadUrl: string;
  size: number;
}

export interface UpdateInfo {
  currentVersion: string;
  latestVersion: string;
  releaseName: string;
  releaseNotes: string;
  publishedAt: string;
  htmlUrl: string;
  assets: ReleaseAsset[];
}

export const CURRENT_VERSION = "2.0.0";
const GITHUB_REPO = "Arxzeph/PM-VAULT";

/**
 * Compare two semver strings (e.g. "2.0.1" vs "2.0.0").
 * Returns 1 if v1 > v2, -1 if v1 < v2, 0 if equal.
 */
function compareSemver(v1: string, v2: string): number {
  const clean1 = v1.replace(/^v/, "").trim().split(".").map(Number);
  const clean2 = v2.replace(/^v/, "").trim().split(".").map(Number);

  for (let i = 0; i < Math.max(clean1.length, clean2.length); i++) {
    const num1 = clean1[i] || 0;
    const num2 = clean2[i] || 0;
    if (num1 > num2) return 1;
    if (num1 < num2) return -1;
  }
  return 0;
}

export async function checkForAppUpdate(): Promise<UpdateInfo | null> {
  try {
    const res = await fetch(
      `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`,
      {
        headers: {
          Accept: "application/vnd.github.v3+json",
        },
      }
    );

    if (!res.ok) {
      if (res.status === 404) return null; // No releases yet
      console.warn("[Updater] GitHub releases API status:", res.status);
      return null;
    }

    const data = await res.json();
    const latestTag = (data.tag_name || "").replace(/^v/, "");

    if (!latestTag) return null;

    if (compareSemver(latestTag, CURRENT_VERSION) > 0) {
      const assets: ReleaseAsset[] = (data.assets || []).map((a: any) => ({
        name: a.name,
        downloadUrl: a.browser_download_url,
        size: a.size,
      }));

      return {
        currentVersion: CURRENT_VERSION,
        latestVersion: latestTag,
        releaseName: data.name || `Version ${latestTag}`,
        releaseNotes: data.body || "A new update is available with security enhancements.",
        publishedAt: data.published_at || new Date().toISOString(),
        htmlUrl: data.html_url,
        assets,
      };
    }

    return null;
  } catch (err) {
    console.warn("[Updater] Failed to check for updates:", err);
    return null;
  }
}

export async function openReleaseDownload(url: string) {
  try {
    await openUrl(url);
  } catch {
    window.open(url, "_blank");
  }
}
