import { createContext, useContext, useEffect, useState } from "react";
import { useAuth } from "./AuthContext";

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const { user } = useAuth();
  const [pref, setPref] = useState(localStorage.getItem("theme") || "system");

  // When a signed-in user has a saved theme, use it on this device.
  useEffect(() => {
    if (user?.theme) setPref(user.theme);
  }, [user?.id, user?.theme]);

  useEffect(() => {
    localStorage.setItem("theme", pref);
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      const dark = pref === "dark" || (pref === "system" && media.matches);
      document.documentElement.dataset.theme = dark ? "dark" : "light";
    };
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [pref]);

  return <ThemeContext.Provider value={{ pref, setPref }}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);
