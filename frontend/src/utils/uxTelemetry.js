/**
 * Telemetría UX (Fase 4.6) — sin LLM, sin datos sensibles.
 * Funnel de abandono real: folder_created → doc_uploaded → gen_started
 * → first_move → level_done (+ errores/offline).
 *
 * Los eventos se encolan en memoria + espejo localStorage (sobreviven a
 * recargas) y se intentan enviar a /api/v1/telemetry/events en segundo
 * plano; si el backend cae se reintentan con el próximo evento — nunca
 * bloquean ni rompen la UX.
 */
const STORAGE_KEY = "hubzy_ux_events";
const MAX_BUFFER = 200;
let queue = [];
try {
  queue = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
} catch (_) {
  queue = [];
}
let flushing = false;

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(queue.slice(-MAX_BUFFER)));
  } catch (_) {}
}

async function flush() {
  if (flushing || !queue.length || typeof fetch === "undefined") return;
  flushing = true;
  const batch = queue.slice(0, 25);
  try {
    const res = await fetch("/api/v1/telemetry/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ events: batch }),
      keepalive: true,
    });
    if (res.ok) {
      queue = queue.slice(batch.length);
      persist();
    }
  } catch (_) {
    // Backend caído: los eventos quedan en cola para el próximo intento.
  } finally {
    flushing = false;
  }
}

/**
 * Registra un evento del funnel. `props` debe ser pequeño y anónimo
 * (nivel, carpeta-id, duración) — nunca texto del usuario ni contenido.
 */
export function track(event, props = {}) {
  queue.push({ event, props, at: new Date().toISOString() });
  if (queue.length > MAX_BUFFER) queue = queue.slice(-MAX_BUFFER);
  persist();
  void flush();
}

// Vaciar al ocultar la pestaña (keepalive sobrevive al backgrounding).
if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") void flush();
  });
}
