import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Scale, ShieldCheck, Baby } from 'lucide-react';

/**
 * Páginas legales estáticas: /legal/terminos y /legal/privacidad.
 * Contenido base en español — debe revisarse con asesoría legal antes
 * de producción (especialmente la sección de menores, estilo COPPA).
 */
const CONTENT = {
  terminos: {
    icon: <Scale className="w-8 h-8 text-[var(--color-arcade-yellow)]" />,
    title: 'Términos de Servicio',
    sections: [
      {
        h: '1. El servicio',
        p: 'Hubzy es una plataforma educativa que convierte materiales de estudio (documentos, apuntes, textos) en experiencias de aprendizaje interactivas. El servicio está dirigido a estudiantes de 5 a 30 años y se ofrece "tal cual", en evolución continua.',
      },
      {
        h: '2. Cuentas de menores',
        p: 'Los usuarios menores de 11 años solo pueden registrarse con el consentimiento verificable de un padre, madre o tutor legal, quien es responsable de supervisar el uso de la plataforma. Podemos suspender cuentas que incumplan esta condición.',
      },
      {
        h: '3. Tu contenido',
        p: 'Conservas todos los derechos sobre los documentos que subes. Nos otorgas una licencia limitada para procesarlos con el único fin de generar tus materiales de juego. No usamos tus documentos para entrenar modelos de terceros sin tu permiso.',
      },
      {
        h: '4. Uso aceptable',
        p: 'No puedes subir contenido ilegal, que infrinja derechos de autor de terceros, ni contenido dañino dirigido a menores. Nos reservamos el derecho de eliminar contenido y cuentas que violen estas reglas.',
      },
      {
        h: '5. Planes y pagos',
        p: 'El plan gratuito tiene límites de uso (carpetas, documentos, preguntas). El plan Pro se cobra por suscripción mediante Stripe y puedes cancelarlo en cualquier momento; conservas el acceso hasta el fin del período pagado.',
      },
      {
        h: '6. Limitación de responsabilidad',
        p: 'Hubzy es una herramienta de apoyo al estudio, no un sustituto de la enseñanza formal ni de atención psicológica profesional. Los contenidos generados por IA pueden contener errores; verifica siempre con tus fuentes oficiales.',
      },
    ],
  },
  privacidad: {
    icon: <ShieldCheck className="w-8 h-8 text-[var(--color-arcade-green)]" />,
    title: 'Política de Privacidad',
    sections: [
      {
        h: '1. Datos que recopilamos',
        p: 'Correo electrónico, nombre de usuario, edad (convertida a banda de edad), género declarado, documentos que subes y datos de progreso de juego. No recopilamos datos de localización precisa ni contactos.',
      },
      {
        h: '2. Minimización para menores',
        p: 'Para usuarios menores almacenamos la banda de edad, no la fecha de nacimiento exacta. La analítica de producto para menores se anonimiza: nunca enviamos el identificador de usuario real a servicios de terceros.',
      },
      {
        h: '3. Uso de los datos',
        p: 'Usamos tus datos para: autenticar tu cuenta, generar tus tableros de juego, adaptar la dificultad a tu desempeño y mejorar el producto. No vendemos datos personales.',
      },
      {
        h: '4. Terceros',
        p: 'Procesadores actuales: modelos de lenguaje (Gemini/Groq) para generar preguntas a partir de tu texto, Stripe para pagos, y PostHog/Sentry para analítica y errores (anonimizados para menores). Cada uno recibe solo lo mínimo necesario.',
      },
      {
        h: '5. Tus derechos',
        p: 'Puedes exportar o eliminar tu cuenta y todos tus datos desde el panel de usuario (zona de peligro → eliminar cuenta). La eliminación es irreversible y cubre documentos, vectores y progreso.',
      },
      {
        h: '6. Menores (estilo COPPA)',
        p: 'Requerimos consentimiento parental para cuentas de menores de 11 años. Los padres pueden solicitar revisión o eliminación de los datos de su hijo escribiendo a nuestro contacto de soporte. No mostramos publicidad comportamental a menores.',
      },
    ],
  },
};

export default function LegalPage({ type = 'terminos' }) {
  const c = CONTENT[type] || CONTENT.terminos;
  return (
    <div className="min-h-screen bg-[var(--color-arcade-navy-dark)] text-white font-sans">
      <div className="max-w-2xl mx-auto px-5 py-10">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-xs font-bold text-slate-400 hover:text-white transition-colors mb-8"
        >
          <ArrowLeft className="w-4 h-4" /> Volver a Hubzi
        </Link>

        <div className="flex items-center gap-4 mb-8">
          <div className="w-14 h-14 rounded-arcade bg-[var(--color-arcade-navy)] border-3 border-[var(--color-arcade-navy-dark)] flex items-center justify-center">
            {c.icon}
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-wide">{c.title}</h1>
            <p className="text-xs text-slate-400">Última actualización: octubre 2026</p>
          </div>
        </div>

        <div className="space-y-6">
          {c.sections.map((s) => (
            <section key={s.h} className="p-5 rounded-arcade bg-[var(--color-arcade-navy)] border-2 border-[var(--color-arcade-navy-light)]">
              <h2 className="text-sm font-black text-[var(--color-arcade-yellow)] uppercase tracking-wide mb-2">{s.h}</h2>
              <p className="text-sm text-slate-300 leading-relaxed">{s.p}</p>
            </section>
          ))}
        </div>

        <div className="mt-8 p-4 rounded-arcade bg-amber-950/40 border border-amber-500/40 text-xs text-amber-200 flex gap-3">
          <Baby className="w-5 h-5 shrink-0 text-amber-400" />
          <span>
            Documento base en revisión. Antes del lanzamiento público este texto debe
            validarse con asesoría legal en la jurisdicción de operación.
          </span>
        </div>
      </div>
    </div>
  );
}
