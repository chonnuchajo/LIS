import type { ReactNode } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import PetitionTimelinePage from "./PetitionTimelinePage";
import type { ParameterItem } from "@/lib/api";
import type { Petition } from "@/types/petition.types";

const mocks = vi.hoisted(() => {
  const labPetition: Petition = {
    _id: "petition-lab-1",
    petitionNo: "P-LAB-1",
    dept: "production",
    status: "inProgress",
    submittedBy: {
      name: "Requester",
      submittedAt: "2026-07-01T01:00:00.000Z",
    },
    items: [
      {
        seq: 1,
        sampleName: "Lab Sample",
        batchNo: "BATCH-016",
        sampleId: "sample-1",
        testItems: "Active Ingredient",
      },
    ],
    createdAt: "2026-07-01T01:00:00.000Z",
    updatedAt: "2026-07-01T01:00:00.000Z",
  } as Petition;

  return {
    getParameters: vi.fn<() => Promise<ParameterItem[]>>(),
    labPetition,
    refresh: vi.fn(),
  };
});

vi.mock("@/components/lis/AppLayout", () => ({
  default: ({ children }: { children: ReactNode }) => <main>{children}</main>,
}));

vi.mock("@/components/lis/PageHeader", () => ({
  default: ({ title, description, actions }: { title: ReactNode; description?: ReactNode; actions?: ReactNode }) => (
    <header>
      <h1>{title}</h1>
      {description && <p>{description}</p>}
      {actions}
    </header>
  ),
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: {
      employeeId: "L001",
      email: "lab@example.test",
      name: "Lab User",
      roles: ["lab"],
    },
  }),
}));

vi.mock("@/hooks/useItemGroupMembership", () => ({
  useItemGroupMembership: () => new Map([["sample-1", ["Active Ingredient"]]]),
}));

vi.mock("@/hooks/usePetition", () => ({
  usePetitionList: () => ({
    data: { items: [mocks.labPetition], total: 1 },
    loading: false,
    error: null,
    refresh: mocks.refresh,
  }),
}));

vi.mock("@/lib/api", () => ({
  api: {
    getParameters: mocks.getParameters,
  },
}));

function renderPage() {
  return render(
    <MemoryRouter
      initialEntries={["/petition-timeline"]}
      future={{ v7_relativeSplatPath: true, v7_startTransition: true }}
    >
      <PetitionTimelinePage />
    </MemoryRouter>,
  );
}

describe("PetitionTimelinePage", () => {
  it("does not expose lab-only rows while readable parameter filtering is still loading", () => {
    mocks.getParameters.mockReturnValue(new Promise<ParameterItem[]>(() => {}));

    renderPage();

    expect(screen.queryByText(/P-LAB-1/)).not.toBeInTheDocument();
  });

  it("prevents the live filter form from submitting the page", () => {
    mocks.getParameters.mockReturnValue(new Promise<ParameterItem[]>(() => {}));

    const { container } = renderPage();
    const form = container.querySelector("form");

    expect(form).not.toBeNull();
    expect(fireEvent.submit(form as HTMLFormElement)).toBe(false);
  });
});
