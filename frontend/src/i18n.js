import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import es from "./locales/es.json";
import en from "./locales/en.json";
import pt from "./locales/pt.json";

i18n.use(initReactI18next).init({
  resources: {
    es: { translation: es },
    en: { translation: en },
    pt: { translation: pt },
  },
  lng: localStorage.getItem("hubzy_lang") || "es",
  fallbackLng: "es",
  interpolation: { escapeValue: false },
});

// El <html lang> acompaña al idioma activo (lectores de pantalla/SEO).
document.documentElement.lang = i18n.language;
i18n.on("languageChanged", (lng) => {
  document.documentElement.lang = lng;
  try {
    localStorage.setItem("hubzy_lang", lng);
  } catch {}
});

export default i18n;
