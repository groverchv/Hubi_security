import React, { useEffect, useRef, useState } from "react";

let katexPromise = null;
function loadKatex() {
  if (!katexPromise) {
    katexPromise = Promise.all([
      import("katex"),
      import("katex/dist/katex.min.css"),
    ]).then(([m]) => m.default);
  }
  return katexPromise;
}

/**
 * Renderiza LaTeX con KaTeX (lazy: la lib solo se descarga si hay matemática).
 * fallback: muestra el texto plano mientras carga o si falla el parseo.
 */
export default function KaTeXText({ tex, className = "", displayMode = false }) {
  const ref = useRef(null);
  const [err, setErr] = useState(false);

  useEffect(() => {
    if (!tex) return;
    let mounted = true;
    loadKatex()
      .then((katex) => {
        if (!mounted || !ref.current) return;
        try {
          katex.render(tex, ref.current, {
            throwOnError: true,
            displayMode,
            output: "html",
          });
        } catch (e) {
          setErr(true);
        }
      })
      .catch(() => setErr(true));
    return () => { mounted = false; };
  }, [tex, displayMode]);

  if (!tex || err) return <span className={className}>{tex}</span>;
  return <span ref={ref} className={className} />;
}
