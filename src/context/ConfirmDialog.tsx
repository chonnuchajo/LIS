import * as React from "react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type ConfirmOptions = {
  title?: React.ReactNode;
  description?: React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  /** `danger` ใช้ปุ่มยืนยันสีแดง สำหรับการลบ/ทำลายข้อมูล */
  variant?: "default" | "danger";
};

type ConfirmFn = (options?: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = React.createContext<ConfirmFn | null>(null);

/**
 * Radix locks the page while a modal is open by setting
 * `document.body.style.pointerEvents = "none"`, and only restores it once the
 * close animation finishes. If the caller does `await confirm()` then
 * `navigate()` straight away, the next page mounts inside that window with the
 * whole body — sidebar nav included — still unclickable (sometimes permanently,
 * Radix issues #1241 / #2122). Clearing it the instant we close removes that
 * dead window. No-op when nothing is stuck.
 */
export function releaseBodyPointerLock() {
  if (typeof document !== "undefined" && document.body.style.pointerEvents === "none") {
    document.body.style.pointerEvents = "";
  }
}

/**
 * Global confirm dialog แบบ promise — แทน window.confirm ด้วย popup กลางจอ
 * ที่หน้าตาเหมือนกันทั้งแอป เรียกใช้ผ่าน useConfirm():
 *
 *   const confirm = useConfirm();
 *   if (await confirm({ description: "ยืนยัน?" })) { ... }
 */
export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false);
  const [options, setOptions] = React.useState<ConfirmOptions>({});
  const resolverRef = React.useRef<((value: boolean) => void) | null>(null);

  const confirm = React.useCallback<ConfirmFn>((opts) => {
    setOptions(opts ?? {});
    setOpen(true);
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
    });
  }, []);

  const settle = React.useCallback((value: boolean) => {
    setOpen(false);
    // Unlock the body now, synchronously, so a navigate() fired right after the
    // returned promise resolves doesn't land on a still-locked page.
    releaseBodyPointerLock();
    resolverRef.current?.(value);
    resolverRef.current = null;
  }, []);

  // Belt-and-suspenders: whenever the dialog is closed, make sure Radix didn't
  // leave the body lock behind (covers Esc / click-outside paths too).
  React.useEffect(() => {
    if (!open) releaseBodyPointerLock();
  }, [open]);

  const {
    title = "ยืนยันการทำรายการ",
    description,
    confirmText = "ยืนยัน",
    cancelText = "ยกเลิก",
    variant = "default",
  } = options;

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <AlertDialog
        open={open}
        onOpenChange={(next) => {
          // ปิดด้วย Esc / คลิกนอกกล่อง = ยกเลิก
          if (!next) settle(false);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{title}</AlertDialogTitle>
            {description ? (
              <AlertDialogDescription className="whitespace-pre-wrap">
                {description}
              </AlertDialogDescription>
            ) : null}
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => settle(false)}>
              {cancelText}
            </AlertDialogCancel>
            <AlertDialogAction
              className={cn(variant === "danger" && buttonVariants({ variant: "danger" }))}
              onClick={() => settle(true)}
            >
              {confirmText}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const ctx = React.useContext(ConfirmContext);
  if (!ctx) {
    throw new Error("useConfirm must be used within a ConfirmProvider");
  }
  return ctx;
}
