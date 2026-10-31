import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";

// Mock del service worker y matchMedia para jsdom
beforeEach(() => {
  localStorage.clear();
});

describe("CrisisModal", () => {
  it("muestra recursos de ayuda cuando está abierto", async () => {
    const { default: CrisisModal } = await import("../components/CrisisModal");
    render(
      <CrisisModal
        isOpen={true}
        onClose={() => {}}
        resources={[{ name: "Emergencias", phone: "911", detail: "Llama ya" }]}
      />
    );
    expect(screen.getByText("Emergencias")).toBeInTheDocument();
    expect(screen.getByText("911")).toBeInTheDocument();
  });

  it("no renderiza nada cuando está cerrado", async () => {
    const { default: CrisisModal } = await import("../components/CrisisModal");
    const { container } = render(
      <CrisisModal isOpen={false} onClose={() => {}} resources={[]} />
    );
    expect(container.innerHTML).toBe("");
  });
});

describe("authStore", () => {
  it("setSession guarda usuario y token", async () => {
    const { useAuthStore } = await import("../store/authStore");
    useAuthStore.getState().setSession({
      user: { id: "u1", username: "Test", plan: "free" },
      token: "tok123",
    });
    expect(useAuthStore.getState().user.username).toBe("Test");
    expect(useAuthStore.getState().token).toBe("tok123");
    expect(localStorage.getItem("hubzy_auth_token")).toBe("tok123");
  });

  it("logout limpia la sesión", async () => {
    const { useAuthStore } = await import("../store/authStore");
    useAuthStore.getState().logout();
    expect(useAuthStore.getState().user).toBeNull();
    expect(useAuthStore.getState().token).toBeNull();
    expect(localStorage.getItem("hubzy_auth_token")).toBeNull();
  });
});
