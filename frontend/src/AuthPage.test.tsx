import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiRequest } from "./api";
import AuthPage from "./AuthPage";

vi.mock("./api", () => ({ apiRequest: vi.fn() }));

describe("AuthPage", () => {
  beforeEach(() => vi.mocked(apiRequest).mockReset());

  it("registers with the entered profile and authenticates the new session", async () => {
    vi.mocked(apiRequest).mockResolvedValue({} as never);
    const onAuthenticated = vi.fn().mockResolvedValue(undefined);
    render(
      <MemoryRouter>
        <AuthPage mode="register" onAuthenticated={onAuthenticated} />
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByLabelText("Full name"), { target: { value: "Jordan Example" } });
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "jordan@example.com" } });
    fireEvent.change(screen.getByLabelText(/Password/), { target: { value: "test-password-2026" } });
    fireEvent.click(screen.getByRole("button", { name: /create account/i }));

    await waitFor(() => expect(onAuthenticated).toHaveBeenCalledTimes(1));
    expect(apiRequest).toHaveBeenCalledWith("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({
        full_name: "Jordan Example",
        email: "jordan@example.com",
        password: "test-password-2026",
      }),
    });
  });

  it("submits the sign-in form and refreshes the authenticated session", async () => {
    vi.mocked(apiRequest).mockResolvedValue({} as never);
    const onAuthenticated = vi.fn().mockResolvedValue(undefined);
    render(
      <MemoryRouter>
        <AuthPage mode="login" onAuthenticated={onAuthenticated} />
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "jordan@example.com" } });
    fireEvent.change(screen.getByLabelText(/Password/), { target: { value: "wrong-password" } });
    fireEvent.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => expect(onAuthenticated).toHaveBeenCalledTimes(1));
    expect(apiRequest).toHaveBeenCalledWith("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: "jordan@example.com", password: "wrong-password" }),
    });
  });
});
