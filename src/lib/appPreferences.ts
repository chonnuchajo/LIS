export type AppThemePreference = "light" | "dark";
export type AppLanguagePreference = "th" | "en";
export type AppFontFamilyPreference = "kanit" | "sarabun" | "system";
export type AppFontSizePreference = `${number}px`;
export type NotificationSoundPreference = "sampleArrival" | "labAssigned" | "queueNew" | "timerDone";

export interface AppPreferences {
  theme: AppThemePreference;
  language: AppLanguagePreference;
  fontFamily: AppFontFamilyPreference;
  fontSize: AppFontSizePreference;
  soundEnabled: boolean;
  notificationSounds: Record<NotificationSoundPreference, boolean>;
}

export const APP_PREFERENCES_STORAGE_KEY = "lis.appPreferences.v1";

export const NOTIFICATION_SOUND_KEYS: NotificationSoundPreference[] = [
  "sampleArrival",
  "labAssigned",
  "queueNew",
  "timerDone",
];

export const DEFAULT_APP_PREFERENCES: AppPreferences = {
  theme: "light",
  language: "th",
  fontFamily: "kanit",
  fontSize: "16px",
  soundEnabled: true,
  notificationSounds: {
    sampleArrival: true,
    labAssigned: true,
    queueNew: true,
    timerDone: true,
  },
};

const THEMES: AppThemePreference[] = ["light", "dark"];
const LANGUAGES: AppLanguagePreference[] = ["th", "en"];
const FONT_FAMILIES: AppFontFamilyPreference[] = ["kanit", "sarabun", "system"];
const MIN_FONT_SIZE_PX = 10;
const MAX_FONT_SIZE_PX = 48;

export const FONT_SIZE_OPTIONS: AppFontSizePreference[] = Array.from(
  { length: MAX_FONT_SIZE_PX - MIN_FONT_SIZE_PX + 1 },
  (_, index) => `${MIN_FONT_SIZE_PX + index}px` as AppFontSizePreference,
);

const LEGACY_FONT_SIZE_VALUES: Record<string, AppFontSizePreference> = {
  small: "15px",
  normal: "16px",
  large: "17px",
};

const FONT_FAMILY_VALUES: Record<AppFontFamilyPreference, string> = {
  kanit: "'Kanit', sans-serif",
  sarabun: "'Sarabun', 'Noto Sans Thai', sans-serif",
  system: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const pick = <T extends string>(value: unknown, allowed: T[], fallback: T): T =>
  typeof value === "string" && allowed.includes(value as T) ? (value as T) : fallback;

const normalizeFontSize = (value: unknown): AppFontSizePreference => {
  if (typeof value !== "string") return DEFAULT_APP_PREFERENCES.fontSize;
  if (FONT_SIZE_OPTIONS.includes(value as AppFontSizePreference)) return value as AppFontSizePreference;
  return LEGACY_FONT_SIZE_VALUES[value] ?? DEFAULT_APP_PREFERENCES.fontSize;
};

export function normalizeAppPreferences(value: unknown): AppPreferences {
  const raw = isRecord(value) ? value : {};
  const rawSounds = isRecord(raw.notificationSounds) ? raw.notificationSounds : {};

  return {
    theme: pick(raw.theme, THEMES, DEFAULT_APP_PREFERENCES.theme),
    language: pick(raw.language, LANGUAGES, DEFAULT_APP_PREFERENCES.language),
    fontFamily: pick(raw.fontFamily, FONT_FAMILIES, DEFAULT_APP_PREFERENCES.fontFamily),
    fontSize: normalizeFontSize(raw.fontSize),
    soundEnabled: typeof raw.soundEnabled === "boolean" ? raw.soundEnabled : DEFAULT_APP_PREFERENCES.soundEnabled,
    notificationSounds: NOTIFICATION_SOUND_KEYS.reduce(
      (sounds, key) => ({
        ...sounds,
        [key]: typeof rawSounds[key] === "boolean" ? rawSounds[key] : DEFAULT_APP_PREFERENCES.notificationSounds[key],
      }),
      {} as Record<NotificationSoundPreference, boolean>,
    ),
  };
}

export function readAppPreferences(): AppPreferences {
  try {
    const raw = localStorage.getItem(APP_PREFERENCES_STORAGE_KEY);
    return normalizeAppPreferences(raw ? JSON.parse(raw) : null);
  } catch {
    return normalizeAppPreferences(null);
  }
}

export function writeAppPreferences(preferences: AppPreferences) {
  try {
    localStorage.setItem(APP_PREFERENCES_STORAGE_KEY, JSON.stringify(normalizeAppPreferences(preferences)));
  } catch {
    return;
  }
}

export function applyAppPreferences(preferences: AppPreferences) {
  if (typeof document === "undefined") return;

  const normalized = normalizeAppPreferences(preferences);
  const root = document.documentElement;
  root.classList.toggle("dark", normalized.theme === "dark");
  root.lang = normalized.language;
  root.style.setProperty("--lis-font-family", FONT_FAMILY_VALUES[normalized.fontFamily]);
  root.style.fontSize = normalized.fontSize;
}

export function isNotificationSoundEnabled(sound: NotificationSoundPreference) {
  const preferences = readAppPreferences();
  return preferences.soundEnabled && preferences.notificationSounds[sound];
}
