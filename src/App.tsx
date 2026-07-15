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
import RoutePointerLockGuard from "@/components/RoutePointerLockGuard";
import { DevRoleSwitcher } from "@/components/DevRoleSwitcher";
import EmployeeLinkGate from "@/components/lis/EmployeeLinkGate";
import { RouteLoading } from "@/components/RouteLoading";
import { StartupLoadingGate } from "@/components/StartupLoadingGate";

// Route-level code splitting: each page is its own chunk, loaded on demand.
// Keeps the initial bundle to the app shell + only the landing route.
const Home = lazy(() => import("./pages/Home"));
const QueueDisplay = lazy(() => import("./pages/QueueDisplay"));
const Login = lazy(() => import("./pages/Login"));
const Logout = lazy(() => import("./pages/Logout"));
const AnalysisResults = lazy(() => import("./pages/AnalysisResults"));
const LabResults = lazy(() => import("./pages/LabResults"));
const LabResultDetailPage = lazy(() => import("./pages/LabResultDetailPage"));
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
const DailyCheckRecordsPage = lazy(() => import("./pages/daily-check/DailyCheckRecordsPage"));
const VirtualLabPage = lazy(() => import("./pages/VirtualLabPage"));
const StandardTimePage = lazy(() => import("./pages/StandardTimePage"));
const NotFound = lazy(() => import("./pages/NotFound"));
const ScannerPage = lazy(() => import("./pages/ScannerPage"));
const PetitionListPage = lazy(() => import("./pages/PetitionListPage"));
const PetitionTimelinePage = lazy(() => import("./pages/PetitionTimelinePage"));
const PetitionTimelineDetailPage = lazy(() => import("./pages/PetitionTimelineDetailPage"));
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
const DensityResultPage = lazy(() => import('./pages/DensityResultPage'));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchInterval: 10000,
      refetchIntervalInBackground: false,
      // Reuse cached data across remounts/route changes within this window so
      // navigating back to a page doesn't refire a fetch the 10s poll just ran.
      staleTime: 10000,
      gcTime: 5 * 60 * 1000,
      refetchOnWindowFocus: false,
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
        <RoutePointerLockGuard />
        <AuthProvider>
          <DevRoleSwitcher />
          <EmployeeLinkGate />
          <NotificationProvider>
            <DailyCheckReminderWatcher />
            <SampleProvider>
              <StartupLoadingGate minimumDurationMs={1500}>
              <Suspense fallback={<RouteLoading />}>
              <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/logout" element={<Logout />} />
              <Route path="/scanner" element={<ScannerPage />} />
              <Route path="/" element={<PrivateRoute><Home /></PrivateRoute>} />
              <Route path="/dashboard/lab" element={<PrivateRoute><Navigate to="/home" replace /></PrivateRoute>} />
              <Route path="/dashboard/qc" element={<PrivateRoute><Navigate to="/home" replace /></PrivateRoute>} />
              <Route path="/queue/lab" element={<QueueDisplay mode="lab" />} />
              <Route path="/queue/qc" element={<QueueDisplay mode="qc" />} />
              <Route path="/home" element={<PrivateRoute><Home /></PrivateRoute>} />
              <Route path="/stock-deduction" element={<PrivateRoute><StockDeduction /></PrivateRoute>} />
              <Route path="/record-results" element={<PrivateRoute><AnalysisResults /></PrivateRoute>} />
              <Route path="/record-results/:id" element={<PrivateRoute><PetitionDetailPage mode="result" /></PrivateRoute>} />
              <Route path="/lab-results" element={<PrivateRoute><LabResults /></PrivateRoute>} />
              <Route path="/lab-results/:id" element={<PrivateRoute><LabResultDetailPage /></PrivateRoute>} />
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
                <Route path="documents" element={<Navigate to="/daily-check/records" replace />} />
              </Route>
              <Route path="/virtual-lab" element={<PrivateRoute><VirtualLabPage /></PrivateRoute>} />
              <Route path="/standard-time" element={<PrivateRoute><StandardTimePage /></PrivateRoute>} />
              <Route path="/stock" element={<PrivateRoute><Stock /></PrivateRoute>} />
              <Route path="/stock/scan/:qrId" element={<PrivateRoute><StockUnitScanPage /></PrivateRoute>} />
              <Route path="/master-items" element={<PrivateRoute><MasterItems /></PrivateRoute>} />
              <Route path="/simple-method" element={<PrivateRoute><SimpleMethodPage /></PrivateRoute>} />
              <Route path="/machines" element={<PrivateRoute><MachinesPage /></PrivateRoute>} />
              <Route path="/admin-data" element={<PrivateRoute><AdminData /></PrivateRoute>} />
              <Route path="/access-control" element={<PrivateRoute><AccessControl /></PrivateRoute>} />
              <Route path="/settings" element={<PrivateRoute><SettingsPage /></PrivateRoute>} />
              <Route path="/parameter-settings" element={<PrivateRoute><ParameterSettings /></PrivateRoute>} />
              <Route path="/petitions" element={<PrivateRoute><PetitionListPage /></PrivateRoute>} />
              <Route path="/petition-timeline" element={<PrivateRoute><PetitionTimelinePage /></PrivateRoute>} />
              <Route path="/petition-timeline/:id" element={<PrivateRoute><PetitionTimelineDetailPage /></PrivateRoute>} />
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
              <Route path="/density-results" element={<PrivateRoute><DensityResultPage /></PrivateRoute>} />
              <Route path="*" element={<NotFound />} />
            </Routes>
              </Suspense>
              </StartupLoadingGate>
            </SampleProvider>
          </NotificationProvider>
        </AuthProvider>
      </BrowserRouter>
      </ConfirmProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
