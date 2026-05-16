import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SampleProvider } from "@/context/SampleContext";
import { AuthProvider } from "@/context/AuthContext";
import PrivateRoute from "@/components/PrivateRoute";
import Home from "./pages/Home";
import LabDashboard from "./pages/LabDashboard";
import QCDashboard from "./pages/QCDashboard";
import QueueDisplay from "./pages/QueueDisplay";
import Login from "./pages/Login";
import SendSample from "./pages/SendSample";
import RecordResults from "./pages/RecordResults";
import Report from "./pages/Report";
import Stock from "./pages/Stock";
import MasterItems, { MachinesPage, SimpleMethodPage } from "./pages/MasterItems";
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
import PetitionAuditLogPage from "./pages/PetitionAuditLogPage";
import { DevRoleSwitcher } from "@/components/DevRoleSwitcher";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter basename={import.meta.env.BASE_URL}>
      
        <AuthProvider>
          <DevRoleSwitcher />
          <SampleProvider>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/scanner" element={<ScannerPage />} />
<<<<<<< HEAD
              <Route path="/" element={<PrivateRoute><Home/></PrivateRoute>} />
=======
              <Route path="/" element={<PrivateRoute><Home /></PrivateRoute>} />
>>>>>>> origin/main
              <Route path="/dashboard/lab" element={<PrivateRoute><LabDashboard /></PrivateRoute>} />
              <Route path="/dashboard/qc" element={<PrivateRoute><QCDashboard /></PrivateRoute>} />
              <Route path="/queue/lab" element={<QueueDisplay mode="lab" />} />
              <Route path="/queue/qc" element={<QueueDisplay mode="qc" />} />
              <Route path="/home" element={<PrivateRoute><Home /></PrivateRoute>} />
              <Route path="/send-sample" element={<PrivateRoute><SendSample /></PrivateRoute>} />
              <Route path="/physical-inspection" element={<PrivateRoute><PhysicalInspection /></PrivateRoute>} />
              <Route path="/stock-deduction" element={<PrivateRoute><StockDeduction /></PrivateRoute>} />
              <Route path="/record-results" element={<PrivateRoute><RecordResults /></PrivateRoute>} />
              <Route path="/qc-approval" element={<PrivateRoute><QCApproval /></PrivateRoute>} />
              <Route path="/report" element={<PrivateRoute><Report /></PrivateRoute>} />
              <Route path="/daily-check" element={<PrivateRoute><DailyCheck /></PrivateRoute>} />
              <Route path="/stock" element={<PrivateRoute><Stock /></PrivateRoute>} />
              <Route path="/master-items" element={<PrivateRoute><MasterItems /></PrivateRoute>} />
              <Route path="/simple-method" element={<PrivateRoute><SimpleMethodPage /></PrivateRoute>} />
              <Route path="/machines" element={<PrivateRoute><MachinesPage /></PrivateRoute>} />
              <Route path="/admin-data" element={<PrivateRoute><AdminData /></PrivateRoute>} />
              <Route path="/access-control" element={<PrivateRoute><AccessControl /></PrivateRoute>} />
              <Route path="/settings" element={<PrivateRoute><SettingsPage /></PrivateRoute>} />
              <Route path="/petitions" element={<PrivateRoute><PetitionListPage /></PrivateRoute>} />
              <Route path="/adutuilog" element={<PrivateRoute><PetitionAuditLogPage /></PrivateRoute>} />
              <Route path="/auditlog" element={<PrivateRoute><PetitionAuditLogPage /></PrivateRoute>} />
              <Route path="/petitions/assign" element={<PrivateRoute><PetitionAssignPage /></PrivateRoute>} />
              <Route path="/petitions/new" element={<PrivateRoute><PetitionNewPage /></PrivateRoute>} />
              <Route path="/petitions/:id" element={<PrivateRoute><PetitionDetailPage /></PrivateRoute>} />
              <Route path="/petitions/:id/edit" element={<PrivateRoute><PetitionEditPage /></PrivateRoute>} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </SampleProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
