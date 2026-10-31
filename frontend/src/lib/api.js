/**
 * Cliente API centralizado de Hubzy.
 * - Inyecta automáticamente el JWT (Authorization: Bearer) en cada request.
 * - Normaliza errores del backend (detail → Error.message).
 * - Soporta FormData (uploads) sin forzar Content-Type.
 */
import { useAuthStore } from "../store/authStore";

export class ApiError extends Error {
  constructor(status, message, payload = null) {
    super(message);
    this.status = status;
    this.payload = payload;
  }
}

function getToken() {
  return (
    useAuthStore.getState().token ||
    localStorage.getItem("hubzy_auth_token") ||
    null
  );
}

/** Header Authorization listo para mezclar; el JWT siempre tiene precedencia. */
function authHeaders() {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/** Token expirado/invalido: limpiar sesión local. */
function handleUnauthorized(res) {
  if (res.status === 401 && getToken()) {
    localStorage.removeItem("hubzy_auth_token");
    useAuthStore.getState().logout?.();
  }
}

/**
 * Drop-in replacement de fetch() que inyecta el JWT.
 * Usar en componentes existentes: fetchWithAuth('/api/v1/...', {method, body})
 */
export async function fetchWithAuth(path, options = {}) {
  const headers = new Headers(options.headers || {});
  const token = getToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const res = await fetch(path, { ...options, headers });
  handleUnauthorized(res);
  return res;
}

/**
 * Sube un archivo con progreso real (XMLHttpRequest reporta upload progress;
 * fetch no lo soporta). Devuelve el JSON parseado; respeta AbortSignal.
 */
export function uploadWithProgress(path, formData, { onProgress, signal } = {}) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", path);

    const token = getToken();
    if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);

    if (signal) {
      if (signal.aborted) return reject(new DOMException("Aborted", "AbortError"));
      signal.addEventListener("abort", () => {
        xhr.abort();
        reject(new DOMException("Aborted", "AbortError"));
      });
    }

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    };

    xhr.onload = () => {
      if (xhr.status === 401) handleUnauthorized({ status: 401 });
      let data = null;
      try {
        data = JSON.parse(xhr.responseText || "null");
      } catch (_) {
        /* respuesta no JSON */
      }
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(data);
      } else {
        reject(
          new ApiError(
            xhr.status,
            (data && (data.detail || data.message)) || `Error del servidor (${xhr.status})`,
            data,
          ),
        );
      }
    };
    xhr.onerror = () => reject(new ApiError(0, "Error de red al subir el archivo."));
    xhr.send(formData);
  });
}

export async function apiFetch(path, { method = "GET", body, headers = {}, raw = false } = {}) {
  const finalHeaders = { ...headers, ...authHeaders() };

  const isFormData = body instanceof FormData;
  if (body && !isFormData && !finalHeaders["Content-Type"]) {
    finalHeaders["Content-Type"] = "application/json";
  }

  const res = await fetch(path, {
    method,
    headers: finalHeaders,
    body: body ? (isFormData ? body : JSON.stringify(body)) : undefined,
  });

  if (raw) return res;

  handleUnauthorized(res);

  const contentType = res.headers.get("content-type") || "";
  const data = contentType.includes("application/json") ? await res.json().catch(() => null) : null;

  if (!res.ok) {
    const message =
      (data && (data.detail || data.message)) ||
      `Error del servidor (${res.status})`;
    throw new ApiError(res.status, message, data);
  }

  return data;
}
