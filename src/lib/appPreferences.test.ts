import { beforeEach, describe, expect, it } from "vitest";
import {
  DEFAULT_APP_PREFERENCES,
  applyAppPreferences,
  isNotificationSoundEnabled,
  readAppPreferences,
  writeAppPreferences,
} from "./appPreferences";

describe("appPreferences", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.className = "";
    document.documentElement.lang = "";
    document.documentElement.style.cssText = "";
  });

  it("reads defaults when nothing is saved", () => {
    expect(readAppPreferences()).toEqual(DEFAULT_APP_PREFERENCES);
  });

  it("applies display preferences to the document", () => {
    applyAppPreferences({
      ...DEFAULT_APP_PREFERENCES,
      fontFamily: "sarabun",
      fontSize: "17px",
      language: "en",
      theme: "dark",
    });

    expect(document.documentElement).toHaveClass("dark");
    expect(document.documentElement.lang).toBe("en");
    expect(document.documentElement.style.getPropertyValue("--lis-font-family")).toContain("Sarabun");
    expect(document.documentElement.style.fontSize).toBe("17px");
  });

  it("migrates old text font sizes to pixel values", () => {
    expect(readAppPreferences()).toEqual(DEFAULT_APP_PREFERENCES);

    localStorage.setItem("lis.appPreferences.v1", JSON.stringify({ fontSize: "large" }));

    expect(readAppPreferences().fontSize).toBe("17px");
  });

  it("accepts font sizes from 14px through 24px", () => {
    localStorage.setItem("lis.appPreferences.v1", JSON.stringify({ fontSize: "14px" }));

    expect(readAppPreferences().fontSize).toBe("14px");

    localStorage.setItem("lis.appPreferences.v1", JSON.stringify({ fontSize: "24px" }));

    expect(readAppPreferences().fontSize).toBe("24px");

    localStorage.setItem("lis.appPreferences.v1", JSON.stringify({ fontSize: "13px" }));

    expect(readAppPreferences().fontSize).toBe(DEFAULT_APP_PREFERENCES.fontSize);

    localStorage.setItem("lis.appPreferences.v1", JSON.stringify({ fontSize: "25px" }));

    expect(readAppPreferences().fontSize).toBe(DEFAULT_APP_PREFERENCES.fontSize);
  });

  it("respects global and per-sound notification settings", () => {
    writeAppPreferences({
      ...DEFAULT_APP_PREFERENCES,
      notificationSounds: { ...DEFAULT_APP_PREFERENCES.notificationSounds, labAssigned: false },
    });

    expect(isNotificationSoundEnabled("sampleArrival")).toBe(true);
    expect(isNotificationSoundEnabled("labAssigned")).toBe(false);

    writeAppPreferences({
      ...DEFAULT_APP_PREFERENCES,
      soundEnabled: false,
    });

    expect(isNotificationSoundEnabled("sampleArrival")).toBe(false);
  });
});
