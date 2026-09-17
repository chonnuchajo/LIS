import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import MfGapMedicinesPage from "../MfGapMedicinesPage";

const navigateMock = vi.hoisted(() => vi.fn());

vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

vi.mock("@/components/lis/AppLayout", () => ({
  default: ({ children }: { children: ReactNode }) => <main>{children}</main>,
}));

vi.mock("@/lib/api", () => ({
  api: {
    get: vi.fn().mockResolvedValue({ data: { data: [] } }),
  },
}));

vi.mock("@/lib/mfGapMedicines", () => ({
  buildMfGapMedicineRows: vi.fn(() => []),
}));

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <MfGapMedicinesPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("MfGapMedicinesPage", () => {
  beforeEach(() => {
    navigateMock.mockClear();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve([]) }));
  });

  it("goes back to the previous page when clicking back", () => {
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: "กลับ" }));

    expect(navigateMock).toHaveBeenCalledWith(-1);
  });
});
