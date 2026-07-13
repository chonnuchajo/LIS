import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import ActionTable from "./ActionTable";
import type { Petition } from "@/types/petition.types";

const petition: Petition = {
  _id: "petition-1",
  petitionNo: "QC-001",
  dept: "production",
  status: "inProgress",
  submittedBy: { name: "Requester", submittedAt: "2026-07-13T00:00:00.000Z" },
  items: [{ seq: 1, sampleName: "Sample", batchNo: "B-001" }],
  createdAt: "2026-07-13T00:00:00.000Z",
  updatedAt: "2026-07-13T00:00:00.000Z",
};

describe("ActionTable", () => {
  it("does not render the sample-count column", () => {
    render(
      <MemoryRouter>
        <ActionTable
          petitions={[petition]}
          actionLabel="Open"
          actionPathPrefix="/petitions"
          urgentIds={new Set()}
        />
      </MemoryRouter>,
    );

    expect(screen.queryByRole("columnheader", { name: "ตย." })).not.toBeInTheDocument();
    expect(screen.getAllByRole("columnheader")).toHaveLength(6);
    expect(screen.getAllByRole("cell")).toHaveLength(6);
  });

  it("orders urgent petitions before older normal petitions", () => {
    const urgent: Petition = {
      ...petition,
      _id: "urgent",
      petitionNo: "P-URGENT",
      priority: 1,
      createdAt: "2026-07-13T00:00:00.000Z",
    };
    const normal: Petition = {
      ...petition,
      _id: "normal",
      petitionNo: "P-NORMAL",
      priority: 0,
      createdAt: "2026-07-01T00:00:00.000Z",
    };

    const { container } = render(
      <MemoryRouter>
        <ActionTable
          petitions={[normal, urgent]}
          actionLabel="Open"
          actionPathPrefix="/petitions"
          urgentIds={new Set(["urgent"])}
        />
      </MemoryRouter>,
    );

    expect(Array.from(container.querySelectorAll("tbody tr")).map((row) => row.textContent)).toEqual([
      expect.stringContaining("P-URGENT"),
      expect.stringContaining("P-NORMAL"),
    ]);
  });
});
