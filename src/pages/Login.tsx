import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import labCover from "@/assets/lab-cover.jpg";

const Login = () => {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      toast.error("กรุณากรอกชื่อผู้ใช้และรหัสผ่าน");
      return;
    }
    toast.success("เข้าสู่ระบบสำเร็จ");
    navigate("/");
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
             <img src="/logo.png" alt="ICP Logo" className="w-14 h-14 rounded-full object-contain" />
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

      {/* Right - Login Form */}
      <div className="flex-1 flex items-center justify-center p-8 bg-background">
        <div className="w-full max-w-md space-y-8">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-3 justify-center mb-4">
             <img src="/logo.png" alt="ICP Logo" className="w-12 h-12 rounded-full object-contain" />
            <div>
              <h2 className="text-xl font-bold text-foreground">LIS</h2>
              <p className="text-[10px] text-muted-foreground tracking-widest">LAB INFORMATION SYSTEM</p>
            </div>
          </div>

          <div className="text-center lg:text-left">
            <h1 className="text-2xl font-bold text-foreground">เข้าสู่ระบบ</h1>
            <p className="text-sm text-muted-foreground mt-1">
              กรุณาเข้าสู่ระบบเพื่อใช้งานระบบจัดการห้องปฏิบัติการ
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="username">ชื่อผู้ใช้</Label>
              <Input
                id="username"
                placeholder="กรอกชื่อผู้ใช้"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">รหัสผ่าน</Label>
              <Input
                id="password"
                type="password"
                placeholder="กรอกรหัสผ่าน"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="remember"
                  checked={remember}
                  onCheckedChange={(v) => setRemember(v === true)}
                />
                <Label htmlFor="remember" className="text-sm font-normal cursor-pointer">
                  จดจำการเข้าสู่ระบบ
                </Label>
              </div>
              <button
                type="button"
                className="text-sm text-primary hover:underline"
                onClick={() => toast.info("กรุณาติดต่อผู้ดูแลระบบ")}
              >
                ลืมรหัสผ่าน?
              </button>
            </div>
            <Button type="submit" className="w-full">
              เข้าสู่ระบบ
            </Button>
          </form>

          <p className="text-center text-xs text-muted-foreground">
            © 2026 ICP Laboratory Information System
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
