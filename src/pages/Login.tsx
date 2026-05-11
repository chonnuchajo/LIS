import { useState } from "react";
import { Navigate } from "react-router-dom";
import { useIsAuthenticated } from "@azure/msal-react";
import { useAuth } from "@/context/AuthContext";
import labCover from "@/assets/lab-cover.jpg";
import { ICP_LADDA_LOGO_URL } from "@/lib/branding";

const MicrosoftIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 21 21" width="20" height="20">
    <rect x="1" y="1" width="9" height="9" fill="#f25022" />
    <rect x="11" y="1" width="9" height="9" fill="#7fba00" />
    <rect x="1" y="11" width="9" height="9" fill="#00a4ef" />
    <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
  </svg>
);

const Login = () => {
  const isAuthenticated = useIsAuthenticated();
  const { login } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (isAuthenticated) return <Navigate to="/" replace />;

  const handleLogin = async () => {
    setError("");
    setLoading(true);
    try {
      await login();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "เกิดข้อผิดพลาด กรุณาลองใหม่";
      if (!msg.includes("user_cancelled") && !msg.includes("popup_window_error")) {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen">
      {/* Left - Cover Image */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden">
        <img
          src={labCover}
          alt="ห้องปฏิบัติการเคมี"
          className="absolute inset-0 w-full h-full object-cover"
          width={960}
          height={1080}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-primary/80 via-primary/40 to-transparent" />
        <div className="relative z-10 flex flex-col justify-end p-12 text-primary-foreground">
          <div className="flex items-center gap-3 mb-6">
            <img src={ICP_LADDA_LOGO_URL} alt="ICP Logo" className="w-14 h-14 rounded-full object-contain" />
            <div>
              <h2 className="text-2xl font-bold leading-tight">LIS</h2>
              <p className="text-xs tracking-widest opacity-80">LAB INFORMATION SYSTEM</p>
            </div>
          </div>
          <h1 className="text-3xl font-bold mb-2">ระบบจัดการห้องปฏิบัติการ</h1>
          <p className="text-sm opacity-90 max-w-md">
            ระบบบริหารจัดการข้อมูลห้องปฏิบัติการเคมีเกษตรภัณฑ์ สำหรับการตรวจวิเคราะห์คุณภาพสารเคมีทางการเกษตร
          </p>
        </div>
      </div>

      {/* Right - Login */}
      <div className="flex-1 flex items-center justify-center p-8 bg-background">
        <div className="w-full max-w-md space-y-8">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-3 justify-center mb-4">
            <img src={ICP_LADDA_LOGO_URL} alt="ICP Logo" className="w-12 h-12 rounded-full object-contain" />
            <div>
              <h2 className="text-xl font-bold text-foreground">LIS</h2>
              <p className="text-[10px] text-muted-foreground tracking-widest">LAB INFORMATION SYSTEM</p>
            </div>
          </div>

          <div className="text-center lg:text-left">
            <h1 className="text-2xl font-bold text-foreground">เข้าสู่ระบบ</h1>
            <p className="text-sm text-muted-foreground mt-1">
              ใช้บัญชี Microsoft องค์กรของคุณเพื่อเข้าสู่ระบบ
            </p>
          </div>

          <div className="space-y-4">
            <button
              onClick={handleLogin}
              disabled={loading}
              className="w-full flex items-center justify-center gap-3 px-6 py-3 bg-[#2F2F2F] hover:bg-[#1a1a1a] disabled:opacity-60 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors shadow-sm border border-[#2F2F2F]"
            >
              <MicrosoftIcon />
              {loading ? "กำลังเข้าสู่ระบบ..." : "Sign in with Microsoft"}
            </button>

            {error && (
              <p className="text-sm text-destructive text-center bg-destructive/10 rounded-lg px-4 py-2">
                {error}
              </p>
            )}

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="bg-background px-3 text-muted-foreground">
                  เข้าสู่ระบบด้วยบัญชีองค์กร ICP Ladda เท่านั้น
                </span>
              </div>
            </div>

            <div className="rounded-lg bg-muted/50 border border-border p-4 space-y-1.5">
              <p className="text-xs font-medium text-foreground">หมายเหตุ</p>
              <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
                <li>ใช้ได้เฉพาะบัญชี Microsoft ของ ICP Ladda เท่านั้น</li>
                <li>หากไม่สามารถเข้าสู่ระบบได้ กรุณาติดต่อผู้ดูแลระบบ</li>
              </ul>
            </div>
          </div>

          <p className="text-center text-xs text-muted-foreground">
            © 2026 ICP Laboratory Information System
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
