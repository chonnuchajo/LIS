import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import Login from "./Login";

const authMocks = vi.hoisted(() => ({
  login: vi.fn(),
  loginWithHint: vi.fn(),
  loginWithProductionToken: vi.fn(),
}));

vi.mock("@azure/msal-react", () => ({
  useIsAuthenticated: () => false,
}));

vi.mock("@/context/AuthContext", () => ({
  useAuth: () => ({
    user: null,
    login: authMocks.login,
    loginWithHint: authMocks.loginWithHint,
    loginWithProductionToken: authMocks.loginWithProductionToken,
  }),
}));

describe("Login mobile layout", () => {
  it("keeps the Microsoft sign-in action in a mobile-safe scroll area", () => {
    render(
      <MemoryRouter initialEntries={["/login"]}>
        <Login />
      </MemoryRouter>,
    );

    expect(screen.getByRole("button", { name: /sign in with microsoft/i })).toBeInTheDocument();
    expect(screen.getByTestId("login-shell")).toHaveClass("min-h-dvh", "overflow-y-auto");
    expect(screen.getByTestId("login-panel")).toHaveClass("items-start", "sm:items-center", "py-8");
  });
});
