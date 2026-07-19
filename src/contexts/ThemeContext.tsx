import { createContext, useContext, useEffect, useState, ReactNode } from "react";

type Theme = "light" | "dark";

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  // Dark mode was removed from the whole site — the new brand identity
  // is light-only. We keep the ThemeProvider API for backwards compatibility
  // but always force "light" and strip the .dark class from <html>.
  const [theme] = useState<Theme>("light");

  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove("dark");
    try {
      localStorage.setItem("theme", "light");
    } catch {
      /* ignore */
    }
  }, []);

  const toggleTheme = () => {
    /* no-op: dark mode disabled site-wide */
  };

  const setTheme = (_newTheme: Theme) => {
    /* no-op: dark mode disabled site-wide */
  };

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
