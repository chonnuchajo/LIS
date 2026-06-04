import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SampleProvider } from "@/context/SampleContext";
import { AuthProvider } from "@/context/AuthContext";
import { NotificationProvider } from "@/context/NotificationContext";
import { ConfirmProvider } from "@/context/ConfirmDialog";
import DailyCheckReminderWatcher from "@/components/lis/DailyCheckReminderWatcher";
import PrivateRoute from "@/components/PrivateRoute";
import Home from "./pages/Home";
import LabDashboard from "./pages/LabDashboard";
import QCDashboard from "./pages/QCDashboard";
import QueueDisplay from "./pages/QueueDisplay";
import Login from "./pages/Login";
import RecordResults from "./pages/RecordResults";
import Report from "./pages/Report";
import Stock from "./pages/Stock";
import MasterItems, { MachinesPage, SimpleMethodPage } from "./pages/MasterItems";
import QCApproval from "./pages/QCApproval";
import AdminData from "./pages/AdminData";
import SettingsPage from "./pages/SettingsPage";
import ParameterSettings from "./pages/ParameterSettings";
import AccessControl from "./pages/AccessControl";
import StockDeduction from "./pages/StockDeduction";
import DailyCheckLayout from "./pages/daily-check/DailyCheckLayout";
import BalanceRoomPage from "./pages/daily-check/BalanceRoomPage";
import RoomPlaceholderPage from "./pages/daily-check/RoomPlaceholderPage";
import EnvironmentCheckPage from "./pages/daily-check/EnvironmentCheckPage";
import DocumentsPage from "./pages/daily-check/DocumentsPage";
import NotFound from "./pages/NotFound";
import ScannerPage from "./pages/ScannerPage";
import PetitionListPage from "./pages/PetitionListPage";
import PetitionNewPage from "./pages/PetitionNewPage";
import ProductionIntegrationPetitionNewPage from "./pages/petitions/ProductionIntegrationPetitionNewPage";
import PetitionDetailPage from "./pages/PetitionDetailPage";
import PetitionEditPage from "./pages/PetitionEditPage";
import PetitionAssignPage from "./pages/PetitionAssignPage";
import PetitionAuditLogPage from "./pages/PetitionAuditLogPage";
import QCTestingPage from "./pages/QCTestingPage";
import QCTestingDetailPage from "./pages/QCTestingDetailPage";
import LabTestingPage from "./pages/LabTestingPage";
import LabTestingDetailPage from "./pages/LabTestingDetailPage";
import StandardConfig from "./pages/StandardConfig";
import { DevRoleSwitcher } from "@/components/DevRoleSwitcher";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchInterval: 10000,
      refetchIntervalInBackground: false,
    },
  },
});

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <ConfirmProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter basename={import.meta.env.BASE_URL}>
      
        <AuthProvider>
          <DevRoleSwitcher />
          <NotificationProvider>
            <DailyCheckReminderWatcher />
            <SampleProvider>
              <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/scanner" element={<ScannerPage />} />
              <Route path="/" element={<PrivateRoute><Home /></PrivateRoute>} />
              <Route path="/dashboard/lab" element={<PrivateRoute><LabDashboard /></PrivateRoute>} />
              <Route path="/dashboard/qc" element={<PrivateRoute><QCDashboard /></PrivateRoute>} />
              <Route path="/queue/lab" element={<QueueDisplay mode="lab" />} />
              <Route path="/queue/qc" element={<QueueDisplay mode="qc" />} />
              <Route path="/home" element={<PrivateRoute><Home /></PrivateRoute>} />
              <Route path="/stock-deduction" element={<PrivateRoute><StockDeduction /></PrivateRoute>} />
              <Route path="/record-results" element={<PrivateRoute><RecordResults /></PrivateRoute>} />
              <Route path="/qc-approval" element={<PrivateRoute><QCApproval /></PrivateRoute>} />
              <Route path="/report" element={<PrivateRoute><Report /></PrivateRoute>} />
              <Route path="/daily-check" element={<PrivateRoute><DailyCheckLayout /></PrivateRoute>}>
                <Route index element={<Navigate to="/daily-check/environment" replace />} />
                <Route path="environment" element={<EnvironmentCheckPage />} />
                <Route path="balance" element={<BalanceRoomPage />} />
                <Route path="sample-prep" element={<RoomPlaceholderPage slug="sample-prep" />} />
                <Route path="analysis" element={<RoomPlaceholderPage slug="analysis" />} />
                <Route path="extraction" element={<RoomPlaceholderPage slug="extraction" />} />
                <Route path="documents" element={<DocumentsPage />} />
              </Route>
              <Route path="/stock" element={<PrivateRoute><Stock /></PrivateRoute>} />
              <Route path="/master-items" element={<PrivateRoute><MasterItems /></PrivateRoute>} />
              <Route path="/simple-method" element={<PrivateRoute><SimpleMethodPage /></PrivateRoute>} />
              <Route path="/machines" element={<PrivateRoute><MachinesPage /></PrivateRoute>} />
              <Route path="/admin-data" element={<PrivateRoute><AdminData /></PrivateRoute>} />
              <Route path="/access-control" element={<PrivateRoute><AccessControl /></PrivateRoute>} />
              <Route path="/settings" element={<PrivateRoute><SettingsPage /></PrivateRoute>} />
              <Route path="/parameter-settings" element={<PrivateRoute><ParameterSettings /></PrivateRoute>} />
              <Route path="/standard-config" element={<PrivateRoute><StandardConfig /></PrivateRoute>} />
              <Route path="/petitions" element={<PrivateRoute><PetitionListPage /></PrivateRoute>} />
              <Route path="/adutuilog" element={<PrivateRoute><PetitionAuditLogPage /></PrivateRoute>} />
              <Route path="/auditlog" element={<PrivateRoute><PetitionAuditLogPage /></PrivateRoute>} />
              <Route path="/petitions/assign" element={<PrivateRoute><PetitionAssignPage /></PrivateRoute>} />
              <Route path="/petitions/new" element={<PrivateRoute><PetitionNewPage /></PrivateRoute>} />
              <Route path="/petitions/production/new" element={<PrivateRoute><ProductionIntegrationPetitionNewPage /></PrivateRoute>} />
              <Route path="/petitions/:id" element={<PrivateRoute><PetitionDetailPage /></PrivateRoute>} />
              <Route path="/petitions/:id/edit" element={<PrivateRoute><PetitionEditPage /></PrivateRoute>} />
              <Route path="/qc-testing" element={<PrivateRoute><QCTestingPage /></PrivateRoute>} />
              <Route path="/qc-testing/:id" element={<PrivateRoute><QCTestingDetailPage /></PrivateRoute>} />
              <Route path="/lab-testing" element={<PrivateRoute><LabTestingPage /></PrivateRoute>} />
              <Route path="/lab-testing/:id" element={<PrivateRoute><LabTestingDetailPage /></PrivateRoute>} />
              <Route path="*" element={<NotFound />} />
            </Routes>
            </SampleProvider>
          </NotificationProvider>
        </AuthProvider>
      </BrowserRouter>
      </ConfirmProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
