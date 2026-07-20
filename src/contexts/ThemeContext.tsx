import { createContext, useContext, useEffect, useState, ReactNode } from "react";

type Theme = "light" | "dark";

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

// Dark mode is enabled ONLY inside the CRM/admin area. The public marketing
// site is light-only by brand decision. We scope the `.dark` class on <html>
// to admin routes and observe URL changes so navigating out of /admin cleanly
// removes it.
const isAdminPath = (path: string) =>
  path.startsWith("/admin") || path.startsWith("/cliente");

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const [theme, setThemeState] = useState<Theme>(() => {
    try {
      const stored = localStorage.getItem("theme");
      if (stored === "dark" || stored === "light") return stored;
    } catch {
      /* ignore */
    }
    return "light";
  });

  useEffect(() => {
    const root = document.documentElement;
    const apply = () => {
      const adminArea = isAdminPath(window.location.pathname);
      if (adminArea && theme === "dark") {
        root.classList.add("dark");
      } else {
        root.classList.remove("dark");
      }
    };
    apply();

    // React to SPA route changes (pushState/replaceState/popstate).
    const origPush = history.pushState;
    const origReplace = history.replaceState;
    history.pushState = function (...args) {
      const r = origPush.apply(this, args as Parameters<typeof origPush>);
      apply();
      return r;
    };
    history.replaceState = function (...args) {
      const r = origReplace.apply(this, args as Parameters<typeof origReplace>);
      apply();
      return r;
    };
    window.addEventListener("popstate", apply);
    return () => {
      history.pushState = origPush;
      history.replaceState = origReplace;
      window.removeEventListener("popstate", apply);
    };
  }, [theme]);

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
    try {
      localStorage.setItem("theme", newTheme);
    } catch {
      /* ignore */
    }
  };

  const toggleTheme = () => setTheme(theme === "dark" ? "light" : "dark");

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
};
