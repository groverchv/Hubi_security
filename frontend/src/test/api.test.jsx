import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fetchWithAuth, apiFetch, ApiError } from "../lib/api";
import { useAuthStore } from "../store/authStore";

function mockResponse(status, body = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("fetchWithAuth", () => {
  beforeEach(() => {
    localStorage.clear();
    useAuthStore.setState({ user: null, token: null });
    vi.restoreAllMocks();
  });

  it("inyecta el JWT del store en el header Authorization", async () => {
    useAuthStore.setState({ token: "jwt-de-prueba", user: { id: "u1" } });
    const spy = vi.spyOn(globalThis, "fetch").mockResolvedValue(mockResponse(200));

    await fetchWithAuth("/api/v1/folders");

    const headers = spy.mock.calls[0][1].headers;
    expect(headers.get("Authorization")).toBe("Bearer jwt-de-prueba");
  });

  it("lee el token de localStorage cuando el store está vacío", async () => {
    localStorage.setItem("hubzy_auth_token", "jwt-legado");
    const spy = vi.spyOn(globalThis, "fetch").mockResolvedValue(mockResponse(200));

    await fetchWithAuth("/api/v1/auth/me");

    expect(spy.mock.calls[0][1].headers.get("Authorization")).toBe("Bearer jwt-legado");
  });

  it("no envía Authorization si no hay token", async () => {
    const spy = vi.spyOn(globalThis, "fetch").mockResolvedValue(mockResponse(200));

    await fetchWithAuth("/api/v1/auth/me");

    expect(spy.mock.calls[0][1].headers.get("Authorization")).toBeNull();
  });

  it("cierra sesión local cuando el servidor responde 401", async () => {
    useAuthStore.setState({ token: "jwt-expirado", user: { id: "u1" } });
    vi.spyOn(globalThis, "fetch").mockResolvedValue(mockResponse(401));

    await fetchWithAuth("/api/v1/auth/me");

    expect(useAuthStore.getState().user).toBeNull();
    expect(useAuthStore.getState().token).toBeNull();
    expect(localStorage.getItem("hubzy_auth_token")).toBeNull();
  });
});

describe("apiFetch", () => {
  beforeEach(() => {
    localStorage.clear();
    useAuthStore.setState({ user: null, token: null });
    vi.restoreAllMocks();
  });

  it("serializa el body como JSON y devuelve los datos", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      mockResponse(200, { ok: true }),
    );

    const data = await apiFetch("/api/v1/folders", {
      method: "POST",
      body: { name: "Carpeta" },
    });

    expect(data).toEqual({ ok: true });
    const [_, opts] = globalThis.fetch.mock.calls[0];
    expect(JSON.parse(opts.body)).toEqual({ name: "Carpeta" });
    expect(opts.headers["Content-Type"]).toBe("application/json");
  });

  it("lanza ApiError con el detail del backend en errores", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      mockResponse(402, { detail: "Límite del plan alcanzado" }),
    );

    await expect(apiFetch("/api/v1/folders", { method: "POST" })).rejects.toMatchObject({
      status: 402,
      message: "Límite del plan alcanzado",
    });
    await expect(apiFetch("/api/v1/folders", { method: "POST" })).rejects.toBeInstanceOf(ApiError);
  });
});
