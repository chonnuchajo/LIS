import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SampleProvider } from "@/context/SampleContext";
import { AuthProvider } from "@/context/AuthContext";
import PrivateRoute from "@/components/PrivateRoute";
import Home from "./pages/Home";
import DashboardRedirect from "./pages/DashboardRedirect";
import LabDashboard from "./pages/LabDashboard";
import QCDashboard from "./pages/QCDashboard";
import Login from "./pages/Login";
import SendSample from "./pages/SendSample";
import RecordResults from "./pages/RecordResults";
import Report from "./pages/Report";
import Stock from "./pages/Stock";
import MasterItems from "./pages/MasterItems";
import QCApproval from "./pages/QCApproval";
import AdminData from "./pages/AdminData";
import SettingsPage from "./pages/SettingsPage";
import AccessControl from "./pages/AccessControl";
import StockDeduction from "./pages/StockDeduction";
import PhysicalInspection from "./pages/PhysicalInspection";
import DailyCheck from "./pages/DailyCheck";
import NotFound from "./pages/NotFound";
import ScannerPage from "./pages/ScannerPage";
import PetitionListPage from "./pages/PetitionListPage";
import PetitionNewPage from "./pages/PetitionNewPage";
import PetitionDetailPage from "./pages/PetitionDetailPage";
import PetitionEditPage from "./pages/PetitionEditPage";
import PetitionAssignPage from "./pages/PetitionAssignPage";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter basename="/LIS">
      
        <AuthProvider>
          <SampleProvider>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/scanner" element={<ScannerPage />} />
              <Route path="/" element={<PrivateRoute moduleId="dashboard"><DashboardRedirect /></PrivateRoute>} />
              <Route path="/dashboard/lab" element={<PrivateRoute moduleId="dashboard"><LabDashboard /></PrivateRoute>} />
              <Route path="/dashboard/qc" element={<PrivateRoute moduleId="qc"><QCDashboard /></PrivateRoute>} />
              <Route path="/home" element={<PrivateRoute moduleId="dashboard"><Home /></PrivateRoute>} />
              <Route path="/send-sample" element={<PrivateRoute moduleId="samples"><SendSample /></PrivateRoute>} />
              <Route path="/physical-inspection" element={<PrivateRoute moduleId="samples"><PhysicalInspection /></PrivateRoute>} />
              <Route path="/stock-deduction" element={<PrivateRoute moduleId="results"><StockDeduction /></PrivateRoute>} />
              <Route path="/record-results" element={<PrivateRoute moduleId="results"><RecordResults /></PrivateRoute>} />
              <Route path="/qc-approval" element={<PrivateRoute moduleId="qc"><QCApproval /></PrivateRoute>} />
              <Route path="/report" element={<PrivateRoute moduleId="reports"><Report /></PrivateRoute>} />
              <Route path="/daily-check" element={<PrivateRoute moduleId="results"><DailyCheck /></PrivateRoute>} />
              <Route path="/stock" element={<PrivateRoute moduleId="stock"><Stock /></PrivateRoute>} />
              <Route path="/master-items" element={<PrivateRoute moduleId="stock"><MasterItems /></PrivateRoute>} />
              <Route path="/admin-data" element={<PrivateRoute moduleId="admin"><AdminData /></PrivateRoute>} />
              <Route path="/access-control" element={<PrivateRoute moduleId="access"><AccessControl /></PrivateRoute>} />
              <Route path="/settings" element={<PrivateRoute moduleId="access"><SettingsPage /></PrivateRoute>} />
              <Route path="/petitions" element={<PrivateRoute moduleId="samples"><PetitionListPage /></PrivateRoute>} />
              <Route path="/petitions/assign" element={<PrivateRoute moduleId="qc"><PetitionAssignPage /></PrivateRoute>} />
              <Route path="/petitions/new" element={<PrivateRoute moduleId="samples"><PetitionNewPage /></PrivateRoute>} />
              <Route path="/petitions/:id" element={<PrivateRoute moduleId={["samples", "qc"]}><PetitionDetailPage /></PrivateRoute>} />
              <Route path="/petitions/:id/edit" element={<PrivateRoute moduleId="samples"><PetitionEditPage /></PrivateRoute>} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </SampleProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
