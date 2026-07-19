import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { AuthProvider } from "./AuthContext";
import { useAuth } from "./auth-context";

vi.mock("../lib/api", () => ({
  auth: {
    me: vi.fn(),
    login: vi.fn(),
    register: vi.fn(),
  },
}));

import { auth as authApi } from "../lib/api";

const mockedMe = vi.mocked(authApi.me);

function Probe() {
  const { user, token, loading } = useAuth();
  return (
    <div>
      <span data-testid="loading">{String(loading)}</span>
      <span data-testid="token">{token ?? "null"}</span>
      <span data-testid="user">{user?.name ?? "null"}</span>
    </div>
  );
}

describe("AuthProvider", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it("is not loading and unauthenticated when no token is stored", () => {
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>
    );
    expect(screen.getByTestId("loading").textContent).toBe("false");
    expect(screen.getByTestId("token").textContent).toBe("null");
    expect(screen.getByTestId("user").textContent).toBe("null");
    expect(mockedMe).not.toHaveBeenCalled();
  });

  it("starts loading with a stored token, then resolves the user", async () => {
    localStorage.setItem("token", "tok-123");
    mockedMe.mockResolvedValueOnce({
      user: { id: "u1", email: "r@x.dev", name: "Ravi" } as never,
    });

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>
    );
    expect(screen.getByTestId("loading").textContent).toBe("true");

    await waitFor(() =>
      expect(screen.getByTestId("loading").textContent).toBe("false")
    );
    expect(screen.getByTestId("user").textContent).toBe("Ravi");
    expect(screen.getByTestId("token").textContent).toBe("tok-123");
  });

  it("clears the stored token when the session is invalid", async () => {
    localStorage.setItem("token", "stale-token");
    mockedMe.mockRejectedValueOnce(new Error("401"));

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>
    );

    await waitFor(() =>
      expect(screen.getByTestId("token").textContent).toBe("null")
    );
    expect(localStorage.getItem("token")).toBeNull();
    expect(screen.getByTestId("user").textContent).toBe("null");
  });
});

describe("useAuth", () => {
  it("throws when used outside AuthProvider", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<Probe />)).toThrow(
      "useAuth must be used within AuthProvider"
    );
    spy.mockRestore();
  });
});
