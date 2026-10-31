// Catálogo oficial de avatares y mascotas profesionales de Hubzy
import capyMedicaF from '../assets/mascots/capy_medica_f.webp';
import capyMedicoM from '../assets/mascots/capy_medico_m.webp';
import capyEnfermeraF from '../assets/mascots/capy_enfermera_f.webp';
import capyEnfermeroM from '../assets/mascots/capy_enfermero_m.webp';
import capyOdontologoM from '../assets/mascots/capy_odontologo_m.webp';
import capyFarmaceuticaF from '../assets/mascots/capy_farmaceutica_f.webp';
import capyVeterinariaF from '../assets/mascots/capy_veterinaria_f.webp';
import capyAbogadoM from '../assets/mascots/capy_abogado_m.webp';
import capyAbogadaF from '../assets/mascots/capy_abogada_f.webp';
import capyProgramadoraF from '../assets/mascots/capy_programadora_f.webp';
import capyProgramadorM from '../assets/mascots/capy_programador_m.webp';
import capyIngenieroCivilM from '../assets/mascots/capy_ingeniero_civil_m.webp';
import capyIngenieraCivilF from '../assets/mascots/capy_ingeniera_civil_f.webp';
import capyArquitectoM from '../assets/mascots/capy_arquitecto_m.webp';
import capyMatematicaF from '../assets/mascots/capy_matematica_f.webp';
import capyQuimicoM from '../assets/mascots/capy_quimico_m.webp';
import capyPsicologoM from '../assets/mascots/capy_psicologo_m.webp';
import capyAdministradoraF from '../assets/mascots/capy_administradora_f.webp';
import capyArtistaF from '../assets/mascots/capy_artista_f.webp';
import capyEscolarNinaF from '../assets/mascots/capy_escolar_nina_f.webp';
import capyEscolarNinoM from '../assets/mascots/capy_escolar_nino_m.webp';
import capyEconomistaM from '../assets/mascots/capy_economista_m.webp';
import capyBiologoM from '../assets/mascots/capy_biologo_m.webp';
import capyAstronomoM from '../assets/mascots/capy_astronomo_m.webp';
import capyHistoriadorM from '../assets/mascots/capy_historiador_m.webp';
import capyChefM from '../assets/mascots/capy_chef_m.webp';
import capyElectricoM from '../assets/mascots/capy_electrico_m.webp';
import capyCiberseguridadM from '../assets/mascots/capy_ciberseguridad_m.webp';
import capyMecanicoM from '../assets/mascots/capy_mecanico_m.webp';
import capyContadorM from '../assets/mascots/capy_contador_m.webp';
import capyProfesorM from '../assets/mascots/capy_profesor_m.webp';
import capyDisenadorM from '../assets/mascots/capy_disenador_m.webp';
import capyPeriodistaM from '../assets/mascots/capy_periodista_m.webp';

export const MASCOT_CATALOG = [
  // --- SALUD & CIENCIAS MÉDICAS ---
  {
    id: 'capy_medica_f',
    name: 'Dra. Hubzi',
    role: 'Medicina & Cirugía',
    gender: 'female',
    category: 'Salud',
    image: capyMedicaF,
    greeting: '¡Hola! Lista para repasar anatomía, patología y casos clínicos con serenidad.'
  },
  {
    id: 'capy_medico_m',
    name: 'Dr. Hubzi',
    role: 'Medicina General',
    gender: 'male',
    category: 'Salud',
    image: capyMedicoM,
    greeting: '¡Buen día! Diagnóstico claro: ¡hoy dominamos cada tema del examen!'
  },
  {
    id: 'capy_enfermera_f',
    name: 'Lic. Hubzi Enfermera',
    role: 'Enfermería & Cuidados',
    gender: 'female',
    category: 'Salud',
    image: capyEnfermeraF,
    greeting: '¡Hola! La empatía y el rigor clínico nos acompañan en cada respuesta.'
  },
  {
    id: 'capy_enfermero_m',
    name: 'Lic. Hubzi Enfermero',
    role: 'Enfermería Hospitalaria',
    gender: 'male',
    category: 'Salud',
    image: capyEnfermeroM,
    greeting: '¡Atención y precisión constante para que tu estudio rinda al máximo!'
  },
  {
    id: 'capy_odontologo_m',
    name: 'Dr. Hubzi Dental',
    role: 'Odontología',
    gender: 'male',
    category: 'Salud',
    image: capyOdontologoM,
    greeting: '¡Sonrisa brillante y mente despejada! Vamos por el puntaje perfecto.'
  },
  {
    id: 'capy_farmaceutica_f',
    name: 'Q.F. Hubzi',
    role: 'Farmacia & Bioquímica',
    gender: 'female',
    category: 'Salud',
    image: capyFarmaceuticaF,
    greeting: '¡Fórmulas exactas y principios activos clave para asegurar tu meta!'
  },
  {
    id: 'capy_veterinaria_f',
    name: 'Dra. Hubzi Vet',
    role: 'Medicina Veterinaria',
    gender: 'female',
    category: 'Salud',
    image: capyVeterinariaF,
    greeting: '¡Cuidando la vida con ciencia y ternura! Repasemos juntos.'
  },

  // --- DERECHO & CIENCIAS JURÍDICAS ---
  {
    id: 'capy_abogado_m',
    name: 'Lic. Hubzi',
    role: 'Derecho Procesal & Penal',
    gender: 'male',
    category: 'Leyes',
    image: capyAbogadoM,
    greeting: '¡Saludos! La jurisprudencia y los argumentos sólidos están de nuestra parte.'
  },
  {
    id: 'capy_abogada_f',
    name: 'Dra. Hubzi Jurista',
    role: 'Derecho Constitucional & Civil',
    gender: 'female',
    category: 'Leyes',
    image: capyAbogadaF,
    greeting: '¡Justicia y convicción! Resolvamos cada dilema legal con precisión.'
  },

  // --- INGENIERÍA & TECNOLOGÍA ---
  {
    id: 'capy_programadora_f',
    name: 'Hubzi Dev',
    role: 'Ingeniería de Software & IA',
    gender: 'female',
    category: 'Tecnología',
    image: capyProgramadoraF,
    greeting: '¡Compilando conocimientos! 0 errores, máxima optimización.'
  },
  {
    id: 'capy_programador_m',
    name: 'Hubzi Hacker',
    role: 'Sistemas & Algoritmos',
    gender: 'male',
    category: 'Tecnología',
    image: capyProgramadorM,
    greeting: '¡Todo bajo control! Vamos a debugear cualquier duda en segundos.'
  },
  {
    id: 'capy_ingeniero_civil_m',
    name: 'Ing. Hubzi Civil',
    role: 'Ingeniería Civil',
    gender: 'male',
    category: 'Ingeniería',
    image: capyIngenieroCivilM,
    greeting: '¡Estructuras firmes! Construyamos una base inquebrantable de conocimientos.'
  },
  {
    id: 'capy_ingeniera_civil_f',
    name: 'Ing. Hubzi Obras',
    role: 'Estructuras & Geotecnia',
    gender: 'female',
    category: 'Ingeniería',
    image: capyIngenieraCivilF,
    greeting: '¡Cálculo estructural perfecto! Nada detiene nuestro avance.'
  },
  {
    id: 'capy_arquitecto_m',
    name: 'Arq. Hubzi',
    role: 'Arquitectura & Urbanismo',
    gender: 'male',
    category: 'Diseño',
    image: capyArquitectoM,
    greeting: '¡Diseñando el futuro con estética y rigor técnico!'
  },

  // --- CIENCIAS EXACTAS & SOCIALES ---
  {
    id: 'capy_matematica_f',
    name: 'Profa. Hubzi Math',
    role: 'Matemáticas & Cálculo',
    gender: 'female',
    category: 'Ciencias',
    image: capyMatematicaF,
    greeting: '¡Los teoremas no mienten! Cada problema tiene su elegante solución.'
  },
  {
    id: 'capy_quimico_m',
    name: 'Dr. Hubzi Químico',
    role: 'Química & Laboratorio',
    gender: 'male',
    category: 'Ciencias',
    image: capyQuimicoM,
    greeting: '¡Reacción de alto impacto! La ciencia molecular nunca fue tan clara.'
  },
  {
    id: 'capy_psicologo_m',
    name: 'Lic. Hubzi Psi',
    role: 'Psicología & Neurociencias',
    gender: 'male',
    category: 'Humanidades',
    image: capyPsicologoM,
    greeting: '¡Respira profundo! Con enfoque y calma alcanzamos el máximo potencial.'
  },
  {
    id: 'capy_administradora_f',
    name: 'Mg. Hubzi Business',
    role: 'Administración & Finanzas',
    gender: 'female',
    category: 'Negocios',
    image: capyAdministradoraF,
    greeting: '¡Estrategia, métricas y liderazgo para liderar cada reto!'
  },
  {
    id: 'capy_artista_f',
    name: 'Hubzi Artista',
    role: 'Artes Visuales & Creatividad',
    gender: 'female',
    category: 'Artes',
    image: capyArtistaF,
    greeting: '¡Inspiremos la mente con colores vivos y creatividad sin límites!'
  },

  // --- NUEVAS ÁREAS & ESPECIALIDADES PROFESIONALES ---
  {
    id: 'capy_economista_m',
    name: 'Lic. Hubzi Econ',
    role: 'Economía & Finanzas',
    gender: 'male',
    category: 'Negocios',
    image: capyEconomistaM,
    greeting: '¡Análisis macro y microeconómico en verde! Cada dato suma a tu éxito.'
  },
  {
    id: 'capy_biologo_m',
    name: 'Dr. Hubzi Bio',
    role: 'Biología & Genética',
    gender: 'male',
    category: 'Ciencias',
    image: capyBiologoM,
    greeting: '¡El código de la vida a nuestro favor! Dominemos cada concepto biológico.'
  },
  {
    id: 'capy_astronomo_m',
    name: 'Hubzi Cosmos',
    role: 'Astronomía & Astrofísica',
    gender: 'male',
    category: 'Ciencias',
    image: capyAstronomoM,
    greeting: '¡El universo no tiene límites y tu potencial tampoco! A explorar.'
  },
  {
    id: 'capy_historiador_m',
    name: 'Prof. Hubzi Arqueo',
    role: 'Historia & Arqueología',
    gender: 'male',
    category: 'Humanidades',
    image: capyHistoriadorM,
    greeting: '¡Descifrando el pasado para conquistar el presente! Cada fecha y hecho cuenta.'
  },
  {
    id: 'capy_chef_m',
    name: 'Chef Hubzi Gourmet',
    role: 'Gastronomía & Nutrición',
    gender: 'male',
    category: 'Artes',
    image: capyChefM,
    greeting: '¡La receta perfecta para el 100%: foco, pasión y técnica impecable!'
  },
  {
    id: 'capy_electrico_m',
    name: 'Ing. Hubzi Volt',
    role: 'Ingeniería Eléctrica & Electrónica',
    gender: 'male',
    category: 'Ingeniería',
    image: capyElectricoM,
    greeting: '¡100% cargados de energía! Circuitos sin fallas y máxima potencia.'
  },
  {
    id: 'capy_ciberseguridad_m',
    name: 'Hubzi CyberShield',
    role: 'Ciberseguridad & Redes',
    gender: 'male',
    category: 'Tecnología',
    image: capyCiberseguridadM,
    greeting: '¡Protocolos blindados y cifrado activo! Cero vulnerabilidades en tu examen.'
  },
  {
    id: 'capy_mecanico_m',
    name: 'Ing. Hubzi Torque',
    role: 'Ingeniería Mecánica & Automotriz',
    gender: 'male',
    category: 'Ingeniería',
    image: capyMecanicoM,
    greeting: '¡Ajuste milimétrico y engranajes perfectos! Todo el sistema funciona al 100%.'
  },
  {
    id: 'capy_contador_m',
    name: 'C.P. Hubzi Balance',
    role: 'Contaduría Pública & Auditoría',
    gender: 'male',
    category: 'Negocios',
    image: capyContadorM,
    greeting: '¡Partida doble impecable! Cada concepto cuadra a la perfección.'
  },
  {
    id: 'capy_profesor_m',
    name: 'Prof. Hubzi Maestro',
    role: 'Educación & Pedagogía',
    gender: 'male',
    category: 'Educación',
    image: capyProfesorM,
    greeting: '¡Aprender paso a paso con paciencia es la clave del verdadero dominio!'
  },
  {
    id: 'capy_disenador_m',
    name: 'Hubzi UX/UI',
    role: 'Diseño Gráfico & Experiencia de Usuario',
    gender: 'male',
    category: 'Diseño',
    image: capyDisenadorM,
    greeting: '¡Composición armónica y creatividad visual! Diseñemos tu mejor resultado.'
  },
  {
    id: 'capy_periodista_m',
    name: 'Lic. Hubzi Prensa',
    role: 'Periodismo & Comunicación',
    gender: 'male',
    category: 'Humanidades',
    image: capyPeriodistaM,
    greeting: '¡Noticia de última hora! ¡Estás a punto de dominar todo el temario!'
  },

  // --- ESCOLARES & GENERAL ---
  {
    id: 'capy_escolar_nina_f',
    name: 'Hubzi Colegiala',
    role: 'Primaria & Secundaria',
    gender: 'female',
    category: 'Escolar',
    image: capyEscolarNinaF,
    greeting: '¡Hola amigui! Aprender jugando y compitiendo es genial.'
  },
  {
    id: 'capy_escolar_nino_m',
    name: 'Hubzi Estudiante',
    role: 'Colegio & Bachillerato',
    gender: 'male',
    category: 'Escolar',
    image: capyEscolarNinoM,
    greeting: '¡Cuaderno listo y lápiz afilado! ¡Vamos por la mejor nota!'
  }
];

export function getMascotByDomain(domainCategory = 'general', userGender = null) {
  const normalized = (domainCategory || '').toLowerCase();

  if (normalized.includes('ciber') || normalized.includes('cyber') || normalized.includes('hacker') || normalized.includes('seguridad') || normalized.includes('redes')) {
    return MASCOT_CATALOG.find(m => m.id === 'capy_ciberseguridad_m') || MASCOT_CATALOG[0];
  }
  if (normalized.includes('mecanic') || normalized.includes('automot') || normalized.includes('mantenim')) {
    return MASCOT_CATALOG.find(m => m.id === 'capy_mecanico_m') || MASCOT_CATALOG[0];
  }
  if (normalized.includes('contab') || normalized.includes('auditor') || normalized.includes('tribut') || normalized.includes('impuest') || normalized.includes('balance') || normalized.includes('sat')) {
    return MASCOT_CATALOG.find(m => m.id === 'capy_contador_m') || MASCOT_CATALOG[0];
  }
  if (normalized.includes('pedagog') || normalized.includes('docen') || normalized.includes('educac') || normalized.includes('profesor') || normalized.includes('maestr')) {
    return MASCOT_CATALOG.find(m => m.id === 'capy_profesor_m') || MASCOT_CATALOG[0];
  }
  if (normalized.includes('disen') || normalized.includes('grafic') || normalized.includes('ux') || normalized.includes('ui') || normalized.includes('ilustrac')) {
    return MASCOT_CATALOG.find(m => m.id === 'capy_disenador_m') || MASCOT_CATALOG[0];
  }
  if (normalized.includes('periodis') || normalized.includes('comunicac') || normalized.includes('prensa') || normalized.includes('noticia')) {
    return MASCOT_CATALOG.find(m => m.id === 'capy_periodista_m') || MASCOT_CATALOG[0];
  }
  if (normalized.includes('veterin')) {
    return MASCOT_CATALOG.find(m => m.id === 'capy_veterinaria_f') || MASCOT_CATALOG[0];
  }
  if (normalized.includes('odont') || normalized.includes('dent')) {
    return MASCOT_CATALOG.find(m => m.id === 'capy_odontologo_m') || MASCOT_CATALOG[0];
  }
  if (normalized.includes('farmac') || normalized.includes('bioquim')) {
    return MASCOT_CATALOG.find(m => m.id === 'capy_farmaceutica_f') || MASCOT_CATALOG[0];
  }
  if (normalized.includes('biolog') || normalized.includes('genetic') || normalized.includes('ecolog')) {
    return MASCOT_CATALOG.find(m => m.id === 'capy_biologo_m') || MASCOT_CATALOG[0];
  }
  if (normalized.includes('astron') || normalized.includes('espacio') || normalized.includes('cosmos')) {
    return MASCOT_CATALOG.find(m => m.id === 'capy_astronomo_m') || MASCOT_CATALOG[0];
  }
  if (normalized.includes('histor') || normalized.includes('arqueol') || normalized.includes('antropol') || normalized.includes('social')) {
    return MASCOT_CATALOG.find(m => m.id === 'capy_historiador_m') || MASCOT_CATALOG[0];
  }
  if (normalized.includes('gastron') || normalized.includes('cocina') || normalized.includes('culinar') || normalized.includes('nutric')) {
    return MASCOT_CATALOG.find(m => m.id === 'capy_chef_m') || MASCOT_CATALOG[0];
  }
  if (normalized.includes('electr') || normalized.includes('circuito') || normalized.includes('robot')) {
    return MASCOT_CATALOG.find(m => m.id === 'capy_electrico_m') || MASCOT_CATALOG[0];
  }
  if (normalized.includes('econom') || normalized.includes('finanz') || normalized.includes('bolsa') || normalized.includes('contab')) {
    return MASCOT_CATALOG.find(m => m.id === 'capy_economista_m') || MASCOT_CATALOG[0];
  }
  if (normalized.includes('enferm')) {
    if (userGender === 'male') return MASCOT_CATALOG.find(m => m.id === 'capy_enfermero_m') || MASCOT_CATALOG[0];
    return MASCOT_CATALOG.find(m => m.id === 'capy_enfermera_f') || MASCOT_CATALOG[0];
  }
  if (normalized.includes('medicin') || normalized.includes('salud') || normalized.includes('cirug')) {
    if (userGender === 'male') return MASCOT_CATALOG.find(m => m.id === 'capy_medico_m') || MASCOT_CATALOG[0];
    return MASCOT_CATALOG.find(m => m.id === 'capy_medica_f') || MASCOT_CATALOG[0];
  }
  if (normalized.includes('derech') || normalized.includes('ley') || normalized.includes('justic') || normalized.includes('penal') || normalized.includes('jurid')) {
    if (userGender === 'female') return MASCOT_CATALOG.find(m => m.id === 'capy_abogada_f') || MASCOT_CATALOG[1];
    return MASCOT_CATALOG.find(m => m.id === 'capy_abogado_m') || MASCOT_CATALOG[1];
  }
  if (normalized.includes('program') || normalized.includes('soft') || normalized.includes('comput') || normalized.includes('tecno') || normalized.includes('codigo')) {
    if (userGender === 'male') return MASCOT_CATALOG.find(m => m.id === 'capy_programador_m') || MASCOT_CATALOG[2];
    return MASCOT_CATALOG.find(m => m.id === 'capy_programadora_f') || MASCOT_CATALOG[2];
  }
  if (normalized.includes('arquit') || normalized.includes('disen')) {
    return MASCOT_CATALOG.find(m => m.id === 'capy_arquitecto_m') || MASCOT_CATALOG[3];
  }
  if (normalized.includes('ingenier') || normalized.includes('civil') || normalized.includes('obras')) {
    if (userGender === 'female') return MASCOT_CATALOG.find(m => m.id === 'capy_ingeniera_civil_f') || MASCOT_CATALOG[3];
    return MASCOT_CATALOG.find(m => m.id === 'capy_ingeniero_civil_m') || MASCOT_CATALOG[3];
  }
  if (normalized.includes('matemat') || normalized.includes('calcul') || normalized.includes('algebr') || normalized.includes('estadist')) {
    return MASCOT_CATALOG.find(m => m.id === 'capy_matematica_f') || MASCOT_CATALOG[0];
  }
  if (normalized.includes('quimic') || normalized.includes('laborat') || normalized.includes('fisic')) {
    return MASCOT_CATALOG.find(m => m.id === 'capy_quimico_m') || MASCOT_CATALOG[0];
  }
  if (normalized.includes('psicol') || normalized.includes('terap') || normalized.includes('mente')) {
    return MASCOT_CATALOG.find(m => m.id === 'capy_psicologo_m') || MASCOT_CATALOG[0];
  }
  if (normalized.includes('admin') || normalized.includes('negoc') || normalized.includes('market') || normalized.includes('comerc')) {
    return MASCOT_CATALOG.find(m => m.id === 'capy_administradora_f') || MASCOT_CATALOG[0];
  }
  if (normalized.includes('arte') || normalized.includes('pintur') || normalized.includes('creativ')) {
    return MASCOT_CATALOG.find(m => m.id === 'capy_artista_f') || MASCOT_CATALOG[0];
  }
  if (normalized.includes('escolar') || normalized.includes('primari') || normalized.includes('secundari') || normalized.includes('coleg')) {
    if (userGender === 'female') return MASCOT_CATALOG.find(m => m.id === 'capy_escolar_nina_f') || MASCOT_CATALOG[0];
    return MASCOT_CATALOG.find(m => m.id === 'capy_escolar_nino_m') || MASCOT_CATALOG[0];
  }
  if (userGender === 'female') {
    return MASCOT_CATALOG.find(m => m.id === 'capy_escolar_nina_f') || MASCOT_CATALOG.find(m => m.id === 'capy_administradora_f') || MASCOT_CATALOG[0];
  }
  return MASCOT_CATALOG.find(m => m.id === 'capy_escolar_nino_m') || MASCOT_CATALOG.find(m => m.id === 'capy_profesor_m') || MASCOT_CATALOG[0];
}
