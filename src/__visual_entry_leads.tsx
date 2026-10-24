import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import AdminLeads from "@/pages/admin/Leads";
const qc = new QueryClient();
createRoot(document.getElementById("root")!).render(
  <MemoryRouter><QueryClientProvider client={qc}><AdminLeads /></QueryClientProvider></MemoryRouter>
);
