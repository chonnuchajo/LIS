import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  APP_PREFERENCES_STORAGE_KEY,
  DEFAULT_APP_PREFERENCES,
  applyAppPreferences,
  normalizeAppPreferences,
  readAppPreferences,
  writeAppPreferences,
  type AppPreferences,
  type NotificationSoundPreference,
} from "@/lib/appPreferences";

interface AppPreferencesContextValue {
  preferences: AppPreferences;
  setPreference: <K extends keyof AppPreferences>(key: K, value: AppPreferences[K]) => void;
  setNotificationSound: (key: NotificationSoundPreference, enabled: boolean) => void;
  resetPreferences: () => void;
}

const AppPreferencesContext = createContext<AppPreferencesContextValue | null>(null);

export const AppPreferencesProvider = ({ children }: { children: ReactNode }) => {
  const [preferences, setPreferences] = useState(() => readAppPreferences());

  useEffect(() => {
    writeAppPreferences(preferences);
    applyAppPreferences(preferences);
  }, [preferences]);

  useEffect(() => {
    const syncFromStorage = (event: StorageEvent) => {
      if (event.key === APP_PREFERENCES_STORAGE_KEY) setPreferences(readAppPreferences());
    };
    window.addEventListener("storage", syncFromStorage);
    return () => {
      window.removeEventListener("storage", syncFromStorage);
    };
  }, []);

  const setPreference = useCallback(<K extends keyof AppPreferences,>(key: K, value: AppPreferences[K]) => {
    setPreferences((current) => normalizeAppPreferences({ ...current, [key]: value }));
  }, []);

  const setNotificationSound = useCallback((key: NotificationSoundPreference, enabled: boolean) => {
    setPreferences((current) =>
      normalizeAppPreferences({
        ...current,
        notificationSounds: { ...current.notificationSounds, [key]: enabled },
      }),
    );
  }, []);

  const resetPreferences = useCallback(() => {
    setPreferences(DEFAULT_APP_PREFERENCES);
  }, []);

  const value = useMemo(
    () => ({ preferences, setPreference, setNotificationSound, resetPreferences }),
    [preferences, resetPreferences, setNotificationSound, setPreference],
  );

  return <AppPreferencesContext.Provider value={value}>{children}</AppPreferencesContext.Provider>;
};

export function useAppPreferences() {
  const context = useContext(AppPreferencesContext);
  if (!context) throw new Error("useAppPreferences must be inside AppPreferencesProvider");
  return context;
}
