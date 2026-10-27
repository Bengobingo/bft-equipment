"use client";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { Languages, Moon, Sun } from "lucide-react";

export type Locale = "zh-TW" | "en";
type Theme = "light" | "dark";
type Preferences = {
  locale: Locale;
  theme: Theme;
  setLocale: (locale: Locale) => void;
  setTheme: (theme: Theme) => void;
  tx: (zh: string, en: string) => string;
};
const Context = createContext<Preferences | null>(null);
export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [locale, setLocale] = useState<Locale>("zh-TW");
  const [theme, setTheme] = useState<Theme>("light");
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let active = true;
    Promise.resolve().then(() => {
    if (!active) return;
    try {
      setLocale(localStorage.getItem("bft.locale") === "en" ? "en" : "zh-TW");
      const saved = localStorage.getItem("bft.theme");
      setTheme(saved === "dark" || (!saved && matchMedia("(prefers-color-scheme: dark)").matches) ? "dark" : "light");
    } catch { /* Storage may be unavailable; this session still works. */ }
    setReady(true);
    });
    const sync = (event: StorageEvent) => {
      if (event.key === "bft.locale") setLocale(event.newValue === "en" ? "en" : "zh-TW");
      if (event.key === "bft.theme") setTheme(event.newValue === "dark" ? "dark" : "light");
    };
    addEventListener("storage", sync);
    return () => { active = false; removeEventListener("storage", sync); };
  }, []);
  useEffect(() => {
    if (!ready) return;
    document.documentElement.lang = locale === "en" ? "en" : "zh-Hant";
    document.documentElement.dataset.theme = theme;
    document.title = locale === "en" ? "BFT PED | Engineering Box Control" : "BFT PED｜工程設備箱管理";
    try {
      localStorage.setItem("bft.locale", locale);
      localStorage.setItem("bft.theme", theme);
    } catch { /* In-memory preferences remain available. */ }
  }, [locale, theme, ready]);
  return <Context.Provider value={{ locale, theme, setLocale, setTheme, tx: (zh, en) => locale === "en" ? en : zh }}>{children}</Context.Provider>;
}
export function usePreferences() {
  const value = useContext(Context);
  if (!value) throw new Error("PreferencesProvider is required");
  return value;
}
export function AppearanceControls() {
  const { locale, theme, setLocale, setTheme, tx } = usePreferences();
  return <div className="appearance-controls">
    <button type="button" className="icon-button theme-toggle" aria-label={tx(theme === "dark" ? "切換淺色模式" : "切換深色模式", theme === "dark" ? "Switch to light theme" : "Switch to dark theme")} title={tx("切換深淺色", "Toggle color theme")} onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
      {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
    </button>
    <button type="button" className="language-toggle" aria-label={tx("Switch to English", "切換繁體中文")} onClick={() => setLocale(locale === "en" ? "zh-TW" : "en")}><Languages size={17} /><span>{locale === "en" ? "繁中" : "EN"}</span></button>
  </div>;
}
