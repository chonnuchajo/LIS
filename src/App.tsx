import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SampleProvider } from "@/context/SampleContext";
import { AuthProvider } from "@/context/AuthContext";
import Home from "./pages/Home";
import Index from "./pages/Index";
import Login from "./pages/Login";
import SendingSample from "./pages/SendingSample";
import SendSample from "./pages/SendSample";
import RecordResults from "./pages/RecordResults";
import Report from "./pages/Report";
import Stock from "./pages/Stock";
import QCApproval from "./pages/QCApproval";
import AdminData from "./pages/AdminData";
import SettingsPage from "./pages/SettingsPage";
import StockDeduction from "./pages/StockDeduction";
import PhysicalInspection from "./pages/PhysicalInspection";
import DailyCheck from "./pages/DailyCheck";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <SampleProvider>
            <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/home" element={<Home />} />
            <Route path="/login" element={<Login />} />
            <Route path="/sending-sample" element={<SendingSample />} />
            <Route path="/send-sample" element={<SendSample />} />
            <Route path="/physical-inspection" element={<PhysicalInspection />} />
            <Route path="/stock-deduction" element={<StockDeduction />} />
            <Route path="/record-results" element={<RecordResults />} />
            <Route path="/qc-approval" element={<QCApproval />} />
            <Route path="/report" element={<Report />} />
            <Route path="/daily-check" element={<DailyCheck />} />
            <Route path="/stock" element={<Stock />} />
            <Route path="/admin-data" element={<AdminData />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="*" element={<NotFound />} />
            </Routes>
          </SampleProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
