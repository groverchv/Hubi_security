/**
 * Contexto global del Protocolo de Crisis.
 * Cualquier respuesta del backend con is_crisis=true (capy-ask, psychology/analyze)
 * debe pasar por reportCrisis() → abre CrisisModal con recursos de ayuda.
 * Ref: docs/exploracion-ansiedad-uagrm.md — obligación ética de derivación.
 */
import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import CrisisModal from "../components/CrisisModal";

const CrisisContext = createContext({ reportCrisis: () => {} });

export function CrisisProvider({ children }) {
  const [open, setOpen] = useState(false);
  const [resources, setResources] = useState([]);

  useEffect(() => {
    fetch("/api/v1/psychology/crisis-resources")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => setResources(data?.resources || []))
      .catch(() => setResources([]));
  }, []);

  const reportCrisis = useCallback(() => setOpen(true), []);

  return (
    <CrisisContext.Provider value={{ reportCrisis }}>
      {children}
      <CrisisModal isOpen={open} onClose={() => setOpen(false)} resources={resources} />
    </CrisisContext.Provider>
  );
}

export function useCrisis() {
  return useContext(CrisisContext);
}

/**
 * Helper: inspecciona una respuesta del backend y dispara el protocolo si procede.
 * Devuelve true si se detectó crisis.
 */
export function checkCrisisFlag(payload, reportCrisis) {
  const flagged =
    payload?.is_crisis === true ||
    payload?.psychology?.is_crisis === true ||
    payload?.analysis?.is_crisis === true;
  if (flagged) reportCrisis();
  return flagged;
}
