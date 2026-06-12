import { lazy, Suspense } from "react";
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
import { DevRoleSwitcher } from "@/components/DevRoleSwitcher";
import EmployeeLinkGate from "@/components/lis/EmployeeLinkGate";

// Route-level code splitting: each page is its own chunk, loaded on demand.
// Keeps the initial bundle to the app shell + only the landing route.
const Home = lazy(() => import("./pages/Home"));
const LabDashboard = lazy(() => import("./pages/LabDashboard"));
const QCDashboard = lazy(() => import("./pages/QCDashboard"));
const QueueDisplay = lazy(() => import("./pages/QueueDisplay"));
const Login = lazy(() => import("./pages/Login"));
const AnalysisResults = lazy(() => import("./pages/AnalysisResults"));
const Report = lazy(() => import("./pages/Report"));
const Stock = lazy(() => import("./pages/Stock"));
const StockUnitScanPage = lazy(() => import("./pages/StockUnitScanPage"));
const MasterItems = lazy(() => import("./pages/MasterItems"));
const SimpleMethodPage = lazy(() =>
  import("./pages/MasterItems").then((m) => ({ default: m.SimpleMethodPage })),
);
const MachinesPage = lazy(() =>
  import("./pages/MasterItems").then((m) => ({ default: m.MachinesPage })),
);
const QCApproval = lazy(() => import("./pages/QCApproval"));
const QCApprovalReviewPage = lazy(() => import("./pages/QCApprovalReviewPage"));
const LabApproval = lazy(() => import("./pages/LabApproval"));
const LabApprovalReviewPage = lazy(() => import("./pages/LabApprovalReviewPage"));
const AdminData = lazy(() => import("./pages/AdminData"));
const SettingsPage = lazy(() => import("./pages/SettingsPage"));
const ParameterSettings = lazy(() => import("./pages/ParameterSettings"));
const AccessControl = lazy(() => import("./pages/AccessControl"));
const StockDeduction = lazy(() => import("./pages/StockDeduction"));
const DailyCheckLayout = lazy(() => import("./pages/daily-check/DailyCheckLayout"));
const BalanceRoomPage = lazy(() => import("./pages/daily-check/BalanceRoomPage"));
const RoomEquipmentCheckPage = lazy(() => import("./pages/daily-check/RoomEquipmentCheckPage"));
const EnvironmentCheckPage = lazy(() => import("./pages/daily-check/EnvironmentCheckPage"));
const DocumentsPage = lazy(() => import("./pages/daily-check/DocumentsPage"));
const DailyCheckRecordsPage = lazy(() => import("./pages/daily-check/DailyCheckRecordsPage"));
const NotFound = lazy(() => import("./pages/NotFound"));
const ScannerPage = lazy(() => import("./pages/ScannerPage"));
const PetitionListPage = lazy(() => import("./pages/PetitionListPage"));
const PetitionNewPage = lazy(() => import("./pages/PetitionNewPage"));
const ProductionIntegrationPetitionNewPage = lazy(() => import("./pages/petitions/ProductionIntegrationPetitionNewPage"));
const PetitionDetailPage = lazy(() => import("./pages/PetitionDetailPage"));
const PetitionEditPage = lazy(() => import("./pages/PetitionEditPage"));
const PetitionAssignPage = lazy(() => import("./pages/PetitionAssignPage"));
const PetitionAuditLogPage = lazy(() => import("./pages/PetitionAuditLogPage"));
const QCTestingPage = lazy(() => import("./pages/QCTestingPage"));
const QCTestingDetailPage = lazy(() => import("./pages/QCTestingDetailPage"));
const LabTestingPage = lazy(() => import("./pages/LabTestingPage"));
const LabTestingDetailPage = lazy(() => import("./pages/LabTestingDetailPage"));
const StandardConfig = lazy(() => import("./pages/StandardConfig"));

const RouteFallback = () => (
  <div className="flex min-h-screen items-center justify-center">
    <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-300 border-t-gray-600" />
  </div>
);

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
      <BrowserRouter
        basename={import.meta.env.BASE_URL}
        future={{ v7_relativeSplatPath: true, v7_startTransition: true }}
      >
      
        <AuthProvider>
          <DevRoleSwitcher />
          <EmployeeLinkGate />
          <NotificationProvider>
            <DailyCheckReminderWatcher />
            <SampleProvider>
              <Suspense fallback={<RouteFallback />}>
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
              <Route path="/record-results" element={<PrivateRoute><AnalysisResults /></PrivateRoute>} />
              <Route path="/qc-approval" element={<PrivateRoute><QCApproval /></PrivateRoute>} />
              <Route path="/qc-approval/:id" element={<PrivateRoute><QCApprovalReviewPage /></PrivateRoute>} />
              <Route path="/lab-approval" element={<PrivateRoute><LabApproval /></PrivateRoute>} />
              <Route path="/lab-approval/:id" element={<PrivateRoute><LabApprovalReviewPage /></PrivateRoute>} />
              <Route path="/report" element={<PrivateRoute><Report /></PrivateRoute>} />
              <Route path="/daily-check" element={<PrivateRoute><DailyCheckLayout /></PrivateRoute>}>
                <Route index element={<Navigate to="/daily-check/environment" replace />} />
                <Route path="environment" element={<EnvironmentCheckPage />} />
                <Route path="balance" element={<BalanceRoomPage />} />
                <Route path="sample-prep" element={<RoomEquipmentCheckPage roomSlug="sample-prep" />} />
                <Route path="analysis" element={<RoomEquipmentCheckPage roomSlug="analysis" />} />
                <Route path="extraction" element={<RoomEquipmentCheckPage roomSlug="extraction" />} />
                <Route path="records" element={<DailyCheckRecordsPage />} />
                <Route path="documents" element={<DocumentsPage />} />
              </Route>
              <Route path="/stock" element={<PrivateRoute><Stock /></PrivateRoute>} />
              <Route path="/stock/scan/:qrId" element={<PrivateRoute><StockUnitScanPage /></PrivateRoute>} />
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
              <Route path="/petitions/ProductionIntegrationPetitionNewPage" element={<ProductionIntegrationPetitionNewPage />} />
              <Route path="/petitions/:id" element={<PrivateRoute><PetitionDetailPage /></PrivateRoute>} />
              <Route path="/petitions/:id/edit" element={<PrivateRoute><PetitionEditPage /></PrivateRoute>} />
              <Route path="/qc-testing" element={<PrivateRoute><QCTestingPage /></PrivateRoute>} />
              <Route path="/qc-testing/:id" element={<PrivateRoute><QCTestingDetailPage /></PrivateRoute>} />
              <Route path="/lab-testing" element={<PrivateRoute><LabTestingPage /></PrivateRoute>} />
              <Route path="/lab-testing/:id" element={<PrivateRoute><LabTestingDetailPage /></PrivateRoute>} />
              <Route path="*" element={<NotFound />} />
            </Routes>
              </Suspense>
            </SampleProvider>
          </NotificationProvider>
        </AuthProvider>
      </BrowserRouter>
      </ConfirmProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
