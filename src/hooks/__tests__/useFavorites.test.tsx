import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useFavorites } from "../useFavorites";

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
    getUserFavorites.mockResolvedValue({ email: "admin@icpladda.com", paths: ["/stock"] });
    saveUserFavorites.mockResolvedValue({ email: "admin@icpladda.com", paths: [] });
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
    saveUserFavorites.mockRejectedValue(new Error("boom"));
    const { result } = renderHook(() => useFavorites(), { wrapper });
    await waitFor(() => expect(result.current.favorites).toEqual(["/stock"]));

    act(() => result.current.toggle("/petition"));

    await waitFor(() => expect(toastError).toHaveBeenCalled());
    await waitFor(() => expect(result.current.favorites).toEqual(["/stock"]));
  });

  it("ไม่ยิง PUT เมื่อย้ายตัวที่อยู่หัวแถวขึ้นไปอีก", async () => {
    const { result } = renderHook(() => useFavorites(), { wrapper });
    await waitFor(() => expect(result.current.favorites).toEqual(["/stock"]));

    act(() => result.current.move("/stock", "up"));

    expect(saveUserFavorites).not.toHaveBeenCalled();
  });

  it("เตือนและไม่ยิง PUT เมื่อเกิน 20 รายการ", async () => {
    const full = Array.from({ length: 20 }, (_, i) => `/page-${i}`);
    getUserFavorites.mockResolvedValue({ email: "admin@icpladda.com", paths: full });
    const { result } = renderHook(() => useFavorites(), { wrapper });
    await waitFor(() => expect(result.current.favorites).toHaveLength(20));

    act(() => result.current.toggle("/petition"));

    expect(toastError).toHaveBeenCalled();
    expect(saveUserFavorites).not.toHaveBeenCalled();
  });
});
