import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import AppLayout from "../AppLayout";

vi.mock("@/components/lis/AppSidebar", () => ({
  default: () => <aside data-testid="app-sidebar" />,
}));

vi.mock("@/components/lis/NotificationBell", () => ({
  default: () => <button type="button" aria-label="Notifications" />,
}));

vi.mock("@/context/AuthContext", () => ({
  useAuth: () => ({
    user: {
      email: "admin@example.com",
      name: "Admin User",
      roles: ["admin"],
      department: "Lab",
      position: "Manager",
      status: "active",
    },
    logout: vi.fn(),
  }),
}));

vi.mock("@/lib/api", () => ({
  api: {
    get: vi.fn().mockResolvedValue({
      data: {
        data: {
          roles: [{ id: "admin", name: "Administrator" }],
          groups: [],
          permissions: {},
        },
      },
    }),
  },
}));

function renderLayout() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/home"]}>
        <AppLayout>
          <div>Page content</div>
        </AppLayout>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("AppLayout profile placement", () => {
  it("renders the user profile from the topbar", async () => {
    renderLayout();

    const profileButtons = screen.getAllByRole("button", { name: "User profile" });
    expect(profileButtons.length).toBeGreaterThan(0);

    fireEvent.click(profileButtons[0]);

    expect(await screen.findByText("Admin User")).toBeInTheDocument();
    expect(screen.getByText("admin@example.com")).toBeInTheDocument();
  });
});
