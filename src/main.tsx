import { createRoot } from "react-dom/client";
import { HelmetProvider } from "react-helmet-async";
import App from "./App.tsx";
import "./index.css";
import { installAuthRecovery } from "./lib/authRecovery";

// Install global Supabase auth-session recovery (handles expired refresh tokens
// after long inactivity so the app doesn't get stuck on "Algo deu errado").
installAuthRecovery();

createRoot(document.getElementById("root")!).render(
  <HelmetProvider>
    <App />
  </HelmetProvider>,
);
