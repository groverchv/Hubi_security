/**
 * Store global de autenticación (Zustand + persistencia en localStorage).
 * Mantiene compatibilidad con las claves legadas 'hubzy_current_user' / 'hubzy_auth_token'.
 */
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { fetchWithAuth } from "../lib/api";

const LEGACY_USER_KEY = "hubzy_current_user";
const LEGACY_TOKEN_KEY = "hubzy_auth_token";

function loadLegacySession() {
  try {
    const user = JSON.parse(localStorage.getItem(LEGACY_USER_KEY) || "null");
    // Las sesiones de invitado ya no existen: limpiarlas al cargar.
    if (user?.is_guest) {
      localStorage.removeItem(LEGACY_USER_KEY);
      return { user: null, token: null };
    }
    const token = localStorage.getItem(LEGACY_TOKEN_KEY);
    return { user, token };
  } catch {
    return { user: null, token: null };
  }
}

export const useAuthStore = create(
  persist(
    (set, get) => ({
      user: loadLegacySession().user,
      token: loadLegacySession().token,

      setSession: ({ user, token }) => {
        if (user) localStorage.setItem(LEGACY_USER_KEY, JSON.stringify(user));
        if (token) localStorage.setItem(LEGACY_TOKEN_KEY, token);
        set({ user, token });
      },

      setUser: (user) => {
        if (user) localStorage.setItem(LEGACY_USER_KEY, JSON.stringify(user));
        set({ user });
      },

      logout: () => {
        localStorage.removeItem(LEGACY_USER_KEY);
        localStorage.removeItem(LEGACY_TOKEN_KEY);
        set({ user: null, token: null });
      },

      // Revalida el usuario persistido contra /auth/me: el objeto en
      // localStorage puede ser viejo (p. ej. creado en modo degradado sin
      // Mongo, con created_at fresco que reinicia el trial). Si el backend
      // responde 401 la sesión se cierra; si está caído, se conserva.
      refreshUser: async () => {
        if (!get().token) return;
        try {
          const res = await fetchWithAuth("/api/v1/auth/me");
          if (res.status === 401) {
            get().logout();
            return;
          }
          if (res.ok) {
            const user = await res.json();
            if (user?.id) get().setUser(user);
          }
        } catch {
          // sin conexión: conservar la sesión local
        }
      },

      get isPro() {
        return get().user?.plan === "pro";
      },
      get isAuthenticated() {
        return Boolean(get().user);
      },
    }),
    {
      name: "hubzy-auth",
      partialize: (s) => ({ user: s.user, token: s.token }),
    }
  )
);
