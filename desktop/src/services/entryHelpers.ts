import { VaultEntry, SaveEntryInput, PaymentCardData, PersonalIdData, EntryType } from "../types";

/**
 * Auto-detects well-known online service brands from user input
 * to update icons, colors, and suggested URLs dynamically.
 */
export interface DetectedBrand {
  name: string;
  domain: string;
  autofillUrl: string;
  iconName: string;
  accentColor: string;
}

const KNOWN_BRANDS: Record<string, DetectedBrand> = {
  netflix: {
    name: "Netflix",
    domain: "netflix.com",
    autofillUrl: "https://www.netflix.com/login",
    iconName: "netflix",
    accentColor: "#E50914",
  },
  spotify: {
    name: "Spotify",
    domain: "spotify.com",
    autofillUrl: "https://accounts.spotify.com/login",
    iconName: "spotify",
    accentColor: "#1DB954",
  },
  youtube: {
    name: "YouTube Music",
    domain: "music.youtube.com",
    autofillUrl: "https://music.youtube.com",
    iconName: "youtube",
    accentColor: "#FF0000",
  },
  "yt music": {
    name: "YouTube Music",
    domain: "music.youtube.com",
    autofillUrl: "https://music.youtube.com",
    iconName: "youtube",
    accentColor: "#FF0000",
  },
  apple: {
    name: "Apple ID",
    domain: "apple.com",
    autofillUrl: "https://appleid.apple.com",
    iconName: "apple",
    accentColor: "#A3AAAE",
  },
  github: {
    name: "GitHub",
    domain: "github.com",
    autofillUrl: "https://github.com/login",
    iconName: "github",
    accentColor: "#6366F1",
  },
  google: {
    name: "Google Account",
    domain: "google.com",
    autofillUrl: "https://accounts.google.com",
    iconName: "google",
    accentColor: "#4285F4",
  },
  amazon: {
    name: "Amazon",
    domain: "amazon.com",
    autofillUrl: "https://www.amazon.com/ap/signin",
    iconName: "amazon",
    accentColor: "#FF9900",
  },
  twitter: {
    name: "X (Twitter)",
    domain: "x.com",
    autofillUrl: "https://x.com/i/flow/login",
    iconName: "twitter",
    accentColor: "#FFFFFF",
  },
  discord: {
    name: "Discord",
    domain: "discord.com",
    autofillUrl: "https://discord.com/login",
    iconName: "discord",
    accentColor: "#5865F2",
  },
};

export function detectBrandFromInput(input: string): DetectedBrand | null {
  const clean = input.trim().toLowerCase();
  if (!clean) return null;

  for (const [key, brand] of Object.entries(KNOWN_BRANDS)) {
    if (clean.includes(key) || clean.includes(brand.domain)) {
      return brand;
    }
  }
  return null;
}

export function detectCardBrand(pan: string): "visa" | "mastercard" | "amex" | "discover" | "other" {
  const clean = pan.replace(/\s+/g, "");
  if (/^4/.test(clean)) return "visa";
  if (/^(5[1-5]|2[2-7])/.test(clean)) return "mastercard";
  if (/^3[47]/.test(clean)) return "amex";
  if (/^6(?:011|5)/.test(clean)) return "discover";
  return "other";
}

export function formatCardPan(pan: string): string {
  const digits = pan.replace(/\D/g, "").slice(0, 16);
  return digits.replace(/(\d{4})(?=\d)/g, "$1 ").trim();
}

export function getEntryCategory(entry: VaultEntry): EntryType {
  const tags = entry.tags || [];
  if (tags.some((t) => t === "type:card" || t === "card" || t === "payment")) return "card";
  if (tags.some((t) => t === "type:id" || t === "id" || t === "identity")) return "id";
  return "login";
}

export function isEntryArchived(entry: VaultEntry): boolean {
  return (entry.tags || []).some((t) => t === "status:archived" || t === "archived");
}

export function isEntryTrash(entry: VaultEntry): boolean {
  return entry.is_deleted === true || (entry.tags || []).some((t) => t === "status:trash" || t === "trash");
}

export function serializeCardToEntryInput(
  data: PaymentCardData,
  title: string,
  existingId?: string,
  isFavorite: boolean = false
): SaveEntryInput {
  const meta = {
    type: "card",
    expMonth: data.expMonth,
    expYear: data.expYear,
    cvv: data.cvv,
    pin: data.pin || "",
    brand: data.brand,
    billingAddress: data.billingAddress,
  };

  return {
    id: existingId,
    title: title || `${data.brand.toUpperCase()} •••• ${data.cardNumber.slice(-4)}`,
    username: data.cardholderName,
    password: data.cardNumber.replace(/\s+/g, ""),
    url: data.brand,
    notes: JSON.stringify(meta),
    tags: ["type:card"],
    favorite: isFavorite,
  };
}

export function parseCardData(entry: VaultEntry): PaymentCardData {
  let meta: any = {};
  try {
    if (entry.notes?.startsWith("{")) {
      meta = JSON.parse(entry.notes);
    }
  } catch {
    // fallback
  }

  const rawPan = entry.password || "";
  return {
    cardholderName: entry.username || "CARDHOLDER",
    cardNumber: rawPan,
    expMonth: meta.expMonth || "12",
    expYear: meta.expYear || "28",
    cvv: meta.cvv || "•••",
    pin: meta.pin || "",
    brand: meta.brand || detectCardBrand(rawPan),
    billingAddress: meta.billingAddress,
  };
}

export function serializeIdToEntryInput(
  data: PersonalIdData,
  existingId?: string,
  isFavorite: boolean = false
): SaveEntryInput {
  const meta = {
    type: "id",
    idType: data.idType,
    issuingAuthority: data.issuingAuthority,
    issueDate: data.issueDate,
    expiryDate: data.expiryDate,
    dateOfBirth: data.dateOfBirth,
    nationality: data.nationality,
    address: data.address,
  };

  const idTitles: Record<string, string> = {
    passport: "Passport",
    driver_license: "Driver License",
    national_id: "National ID / SSN",
    residence_permit: "Residence Permit",
  };

  return {
    id: existingId,
    title: `${idTitles[data.idType] || "Identity Document"} (${data.fullName})`,
    username: data.fullName,
    password: data.documentNumber,
    url: data.issuingAuthority,
    notes: JSON.stringify(meta),
    tags: ["type:id"],
    favorite: isFavorite,
  };
}

export function parseIdData(entry: VaultEntry): PersonalIdData {
  let meta: any = {};
  try {
    if (entry.notes?.startsWith("{")) {
      meta = JSON.parse(entry.notes);
    }
  } catch {
    // fallback
  }

  return {
    idType: meta.idType || "driver_license",
    fullName: entry.username || "ALEX DEV",
    documentNumber: entry.password || "DOC-89210",
    issuingAuthority: entry.url || meta.issuingAuthority || "State Authority",
    issueDate: meta.issueDate || "2020-01-01",
    expiryDate: meta.expiryDate || "2030-01-01",
    dateOfBirth: meta.dateOfBirth || "1995-05-15",
    nationality: meta.nationality || "United States",
    address: meta.address || "742 Market Street, San Francisco, CA",
  };
}
