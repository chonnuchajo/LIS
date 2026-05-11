import { Navigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";

export default function DashboardRedirect() {
  const { user } = useAuth();

  if (user?.role === "qc") {
    return <Navigate to="/dashboard/qc" replace />;
  }

  return <Navigate to="/dashboard/lab" replace />;
}
