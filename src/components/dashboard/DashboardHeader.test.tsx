import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import DashboardHeader from "./DashboardHeader";
import { formatThaiDate } from "@/lib/dateShift";

vi.mock("@/context/AuthContext", () => ({
  useAuth: () => ({
    user: {
      department: "QC",
      roles: ["lab", "qc"],
      status: "active",
    },
  }),
}));

describe("DashboardHeader", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders the title without top action controls", () => {
    render(
      <MemoryRouter>
        <DashboardHeader
          titleEn="QC Dashboard"
          subtitleTh=""
        />
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { name: "QC Dashboard" })).toBeInTheDocument();
    expect(screen.queryAllByRole("combobox")).toHaveLength(0);
    expect(screen.queryAllByRole("button")).toHaveLength(0);
    expect(screen.queryByText("Export")).not.toBeInTheDocument();
  });

  it("renders only the date under the title", () => {
    const now = new Date("2026-07-13T09:00:00+07:00");
    vi.useFakeTimers();
    vi.setSystemTime(now);

    render(
      <MemoryRouter>
        <DashboardHeader
          titleEn="Dashboard"
          subtitleTh="Ignored subtitle"
        />
      </MemoryRouter>,
    );

    const expectedDate = formatThaiDate(now);
    const dateLine = screen.getByText((content, element) =>
      element?.tagName.toLowerCase() === "p" && content.includes(expectedDate),
    );

    expect(dateLine.textContent).toBe(expectedDate);
  });
});
