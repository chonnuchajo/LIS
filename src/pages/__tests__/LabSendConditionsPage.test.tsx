import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import LabSendConditionsPage from "../LabSendConditionsPage";

vi.mock("@/components/lis/AppLayout", () => ({
  default: ({ children }: { children: ReactNode }) => <main>{children}</main>,
}));

describe("LabSendConditionsPage", () => {
  it("lists every lab sending condition without listing petitions", () => {
    render(<LabSendConditionsPage />, { wrapper: MemoryRouter });

    expect(screen.getByRole("heading", { name: "เงื่อนไขการส่ง Lab" })).toBeInTheDocument();
    expect(screen.getByText("ผู้ส่งเป็นแผนก R&D")).toBeInTheDocument();
    expect(screen.getByText("สินค้าอยู่ในกลุ่มบังคับส่ง Lab")).toBeInTheDocument();
    expect(screen.getByText("เลข batch ลงท้าย 1 หรือ 6")).toBeInTheDocument();
    expect(screen.getByText("ยา MF หลังเว้นช่วง 30 วันขึ้นไป")).toBeInTheDocument();
    expect(screen.getByText("ผู้ใช้กำหนด sendToLab เอง")).toBeInTheDocument();
    expect(screen.getByText("คำร้องถือว่ามีเส้นทาง Lab")).toBeInTheDocument();
    expect(screen.queryByText("รายการคำร้อง")).not.toBeInTheDocument();
  });

  it("links the MF gap condition card to the MF medicine list page", () => {
    render(<LabSendConditionsPage />, { wrapper: MemoryRouter });

    expect(
      screen.getByRole("link", { name: /ยา MF หลังเว้นช่วง 30 วันขึ้นไป/ }),
    ).toHaveAttribute("href", "/mf-gap-medicines");
  });
});
