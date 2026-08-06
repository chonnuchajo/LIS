import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useFavorites } from "../useFavorites";
// import ตัวจริงของ server แทนการเขียน sanitizePaths ซ้ำเป็นก็อปที่ 3 (นอกเหนือจาก
// server/lib/favorites.js กับ src/lib/favorites.ts) — ถ้า MAX_PATH_LENGTH ฝั่ง server เปลี่ยน
// ทีหลัง double ตัวนี้จะเปลี่ยนตาม ไม่ใช่ค้างค่าคงที่แยกที่ลืมอัปเดตแล้วเทสต์ยังผ่านทั้งที่ของจริงเพี้ยนไปแล้ว
// Vitest (vite-node) require ไฟล์ CJS ธรรมดาแบบนี้ได้ตรง ๆ
import { sanitizePaths, MAX_FAVORITES } from "../../../server/lib/favorites";

const EMAIL = "admin@icpladda.com";

// double แบบ stateful จำลอง backend จริง (server/routes/userFavorites.js): เก็บค่าที่ "persist" แล้วไว้ใน
// ตัวแปร module-scope — GET คืนค่าปัจจุบัน (sanitize แล้ว), PUT sanitize แล้วเขียนทับ + คืนค่าที่เพิ่งเขียนจริง
// ต้อง stateful เพราะ hook ยิง invalidateQueries หลัง PUT สำเร็จ แล้ว refetch ทันที (refetchType เริ่มต้น
// = active) — refetch นั้นต้องเห็นค่าที่เพิ่ง PUT ไปจริง ๆ ไม่ใช่ mock ค่าคงที่ที่ไม่ผูกกับ PUT ก่อนหน้า
let persistedPaths: string[];

const getUserFavorites = vi.fn();
const saveUserFavorites = vi.fn();

vi.mock("@/lib/api", () => ({
  api: {
    getUserFavorites: (...args: unknown[]) => getUserFavorites(...args),
    saveUserFavorites: (...args: unknown[]) => saveUserFavorites(...args),
  },
}));

vi.mock("@/context/AuthContext", () => ({
  useAuth: () => ({ user: { email: "Admin@ICPLadda.com" } }),
}));

const toastError = vi.fn();
vi.mock("sonner", () => ({ toast: { error: (...args: unknown[]) => toastError(...args) } }));

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

describe("useFavorites", () => {
  beforeEach(() => {
    persistedPaths = ["/stock"];
    getUserFavorites.mockImplementation(() =>
      Promise.resolve({ email: EMAIL, paths: sanitizePaths(persistedPaths) }),
    );
    saveUserFavorites.mockImplementation((_email: string, paths: string[]) => {
      persistedPaths = sanitizePaths(paths);
      return Promise.resolve({ email: EMAIL, paths: persistedPaths });
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("โหลดรายการโปรดด้วย email ตัวพิมพ์เล็ก", async () => {
    const { result } = renderHook(() => useFavorites(), { wrapper });
    await waitFor(() => expect(result.current.favorites).toEqual(["/stock"]));
    expect(getUserFavorites).toHaveBeenCalledWith("admin@icpladda.com");
  });

  it("toggle อัปเดตทันทีแบบ optimistic แล้วยิง PUT", async () => {
    const { result } = renderHook(() => useFavorites(), { wrapper });
    await waitFor(() => expect(result.current.favorites).toEqual(["/stock"]));

    act(() => result.current.toggle("/petition"));

    await waitFor(() => expect(result.current.favorites).toEqual(["/stock", "/petition"]));
    expect(saveUserFavorites).toHaveBeenCalledWith("admin@icpladda.com", ["/stock", "/petition"]);
  });

  it("rollback กลับค่าเดิมเมื่อ PUT ล้มเหลว", async () => {
    saveUserFavorites.mockImplementation(() => Promise.reject(new Error("boom")));
    const { result } = renderHook(() => useFavorites(), { wrapper });
    await waitFor(() => expect(result.current.favorites).toEqual(["/stock"]));

    act(() => result.current.toggle("/petition"));

    await waitFor(() => expect(toastError).toHaveBeenCalled());
    await waitFor(() => expect(result.current.favorites).toEqual(["/stock"]));
    // PUT ที่ล้มเหลวต้องไม่เขียนทับค่าที่ persist ไว้ — เหมือน API จริงที่ปฏิเสธ request แล้วไม่บันทึกอะไรเลย
    expect(persistedPaths).toEqual(["/stock"]);
  });

  it("ไม่ยิง PUT เมื่อย้ายตัวที่อยู่หัวแถวขึ้นไปอีก", async () => {
    const { result } = renderHook(() => useFavorites(), { wrapper });
    await waitFor(() => expect(result.current.favorites).toEqual(["/stock"]));

    act(() => result.current.move("/stock", "up"));

    expect(saveUserFavorites).not.toHaveBeenCalled();
  });

  it("เตือนและไม่ยิง PUT เมื่อเกิน 20 รายการ", async () => {
    const full = Array.from({ length: MAX_FAVORITES }, (_, i) => `/page-${i}`);
    persistedPaths = full;
    const { result } = renderHook(() => useFavorites(), { wrapper });
    await waitFor(() => expect(result.current.favorites).toHaveLength(MAX_FAVORITES));

    act(() => result.current.toggle("/petition"));

    expect(toastError).toHaveBeenCalled();
    expect(saveUserFavorites).not.toHaveBeenCalled();
  });

  it("path เก่าที่ไม่รู้จัก (stale, ไม่มีใน knownPaths) ถูกตัดออกจาก payload เมื่อ toggle ครั้งถัดไป", async () => {
    const knownPaths = ["/stock", "/petition"];
    // "/ไม่มีหน้านี้แล้ว" เคยเป็นรายการโปรดที่ถูกต้อง แต่ path ถูกลบ/เปลี่ยนชื่อใน NAV_ITEMS ไปแล้ว
    persistedPaths = ["/stock", "/ไม่มีหน้านี้แล้ว"];
    const { result } = renderHook(() => useFavorites(knownPaths), { wrapper });
    await waitFor(() =>
      expect(result.current.favorites).toEqual(["/stock", "/ไม่มีหน้านี้แล้ว"]),
    );

    act(() => result.current.toggle("/petition"));

    // เขียนทับด้วย base ที่ normalize แล้ว (ตัด stale ทิ้ง) + toggle ต่อท้าย — ไม่ใช่ raw+toggle
    await waitFor(() =>
      expect(saveUserFavorites).toHaveBeenCalledWith("admin@icpladda.com", [
        "/stock",
        "/petition",
      ]),
    );
  });

  it("cap 20 รายการนับเฉพาะ path ที่ยังรู้จัก (knownPaths) ไม่นับ path เก่าที่หายไปจาก catalog", async () => {
    const knownPaths = Array.from({ length: MAX_FAVORITES }, (_, i) => `/page-${i}`);
    // raw มี MAX_FAVORITES รายการพอดี (ชนเพดานถ้านับดิบ) แต่ตัวสุดท้ายเป็น path เก่าที่ไม่รู้จักแล้ว —
    // ที่เห็นจริงบน sidebar มีแค่ MAX_FAVORITES - 1 รายการ
    persistedPaths = [...knownPaths.slice(0, MAX_FAVORITES - 1), "/ไม่มีหน้านี้แล้ว"];
    const { result } = renderHook(() => useFavorites(knownPaths), { wrapper });
    await waitFor(() => expect(result.current.favorites).toHaveLength(MAX_FAVORITES));

    act(() => result.current.toggle(`/page-${MAX_FAVORITES - 1}`));

    // ต้องไม่เตือน "เก็บได้สูงสุด MAX_FAVORITES รายการ" เพราะที่ user เห็นจริงมีแค่ MAX_FAVORITES - 1 ยังเพิ่มได้อีก 1
    expect(toastError).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(saveUserFavorites).toHaveBeenCalledWith("admin@icpladda.com", knownPaths),
    );
  });

  it("cache ลู่เข้าค่าที่ server sanitize แล้วหลัง invalidate refetch (ยุบ path ซ้ำที่ต่างกันแค่ whitespace)", async () => {
    persistedPaths = ["/stock", "/petition"];
    const { result } = renderHook(() => useFavorites(), { wrapper });
    await waitFor(() => expect(result.current.favorites).toEqual(["/stock", "/petition"]));

    // client ส่ง path ที่มี whitespace ต่อท้ายมาด้วย — เทียบ string ตรง ๆ ฝั่ง client เลยไม่รู้ว่าซ้ำ
    // (toggleFavorite เทียบด้วย === จึงมองว่าเป็นรายการใหม่ ต่อท้ายให้)
    act(() => result.current.toggle("/petition "));

    // client ส่ง payload "สกปรก" (3 รายการ รวม whitespace) ไปที่ PUT ตรง ๆ โดยไม่ sanitize เอง —
    // sanitize เป็นหน้าที่ server
    await waitFor(() =>
      expect(saveUserFavorites).toHaveBeenCalledWith("admin@icpladda.com", [
        "/stock",
        "/petition",
        "/petition ",
      ]),
    );

    // server sanitize (trim แล้ว dedupe) ยุบ "/petition " ทิ้งเพราะซ้ำกับ "/petition" หลัง trim —
    // onSettled invalidate ทำให้ refetch แล้ว cache ต้องลู่เข้าค่าจริงจาก server (2 รายการ)
    // ไม่ใช่ค่า optimistic ที่ client คำนวณเอง (3 รายการ) ค้างอยู่ตลอดไป
    await waitFor(() => expect(result.current.favorites).toEqual(["/stock", "/petition"]));
    expect(persistedPaths).toEqual(["/stock", "/petition"]);
    // ต้องมีการ refetch จริงหลัง invalidate (นับ initial load 1 ครั้ง + refetch หลัง PUT อีก 1 ครั้ง)
    expect(getUserFavorites).toHaveBeenCalledTimes(2);
  });
});
