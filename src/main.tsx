import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { installAuthRecovery } from "./lib/authRecovery";

// Install global Supabase auth-session recovery (handles expired refresh tokens
// after long inactivity so the app doesn't get stuck on "Algo deu errado").
installAuthRecovery();

createRoot(document.getElementById("root")!).render(<App />);
