import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import FullSpecPage from "../FullSpecPage";

vi.mock("@/components/lis/AppLayout", () => ({
  default: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/lis/PageHeader", () => ({
  default: ({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) => (
    <header>
      <h1>{title}</h1>
      {description ? <p>{description}</p> : null}
      {actions}
    </header>
  ),
}));

describe("FullSpecPage", () => {
  it("renders a skeleton and disabled create button", () => {
    render(<FullSpecPage />);

    expect(screen.getByRole("heading", { name: "Full spec" })).toBeInTheDocument();
    expect(screen.getByText("โครง UI สำหรับรวบรวม spec แบบเต็ม")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "สร้างใหม่" })).toBeDisabled();
  });
});
