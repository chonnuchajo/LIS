import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Index from "./pages/Index";
import Login from "./pages/Login";
import SendSample from "./pages/SendSample";
import RecordResults from "./pages/RecordResults";
import Report from "./pages/Report";
import StockStandard from "./pages/StockStandard";
import StockSolvent from "./pages/StockSolvent";
import SettingsPage from "./pages/SettingsPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/login" element={<Login />} />
          <Route path="/send-sample" element={<SendSample />} />
          <Route path="/record-results" element={<RecordResults />} />
          <Route path="/report" element={<Report />} />
          <Route path="/stock-standard" element={<StockStandard />} />
          <Route path="/stock-solvent" element={<StockSolvent />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
