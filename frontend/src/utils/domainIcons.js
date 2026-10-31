import { 
  // 1. DERECHO, LEYES, JUSTICIA & CIENCIAS JURÍDICAS
  Scale,          // Derecho / Leyes / Balanza / Principios de Justicia
  Gavel,          // Juzgado / Penal / Civil / Sentencia / Juez / Veredicto
  Scroll,         // Contratos / Normas / Jurisprudencia / Constitución / Tratados
  ShieldAlert,    // Derecho Penal / Delitos / Faltas / Infracciones
  BookMarked,     // Códigos Legales / Doctrina / Artículos / Leyes

  // 2. CONTADURÍA, AUDITORÍA & TRIBUTARIO
  Calculator,     // Contaduría / Balance / Operaciones / Partida Doble
  PieChart,       // Contabilidad / Costos / Distribución / Ratios
  Building2,      // Sociedades / Tributario / Hacienda / SAT / Entidades
  Receipt,        // Facturas / Auditoría / Nómina / Retenciones / Comprobantes
  FileSpreadsheet,// Libros Contables / Estados Financieros / Asientos

  // 3. FINANZAS, ECONOMÍA & BANCA
  DollarSign,     // Finanzas / Liquidez / Tesorería / Capital / Valor
  TrendingUp,     // Mercados / Acciones / Inversión / Rentabilidad / Crecimiento
  Coins,          // Banca / Activos / Cripto / Divisas / Dinero
  Landmark,       // Banco Central / Wall Street / Fondos / Instituciones
  Wallet,         // Presupuesto / Flujo de Efectivo / Cartera

  // 4. MEDICINA, CIENCIAS DE LA SALUD, ANATOMÍA & BIOLOGÍA
  Stethoscope,    // Medicina General / Clínica / Diagnóstico / Médico
  Dna,            // Genética / Biología / ADN / Célula / Genoma
  Pill,           // Farmacia / Medicamentos / Farmacología / Dosis
  HeartPulse,     // Cardiología / Signos Vitales / Fisiología / Salud
  Microscope,     // Laboratorio / Microbiología / Investigación Médica
  Syringe,        // Vacunas / Tratamientos / Inmunología / Inyecciones
  Activity,       // Monitoreo / Síntomas / Pulsaciones / Estado Clínico

  // 5. PSICOLOGÍA, HUMANIDADES & CIENCIAS SOCIALES
  Brain,          // Psicología / Cognición / Neurociencia / Salud Mental
  Users,          // Sociología / Recursos Humanos / Relaciones Humanas
  Eye,            // Percepción / Conducta / Observación Clínica
  MessageSquare,  // Psicoterapia / Lingüística / Comunicación

  // 6. ADMINISTRACIÓN, NEGOCIOS, GESTIÓN & MARKETING
  Briefcase,      // Negocios / Administración / Management / Empresa
  Target,         // Marketing / Estrategia / Ventas / Objetivos
  Award,          // Liderazgo / Calidad / Certificación / Mérito
  Compass,        // Dirección Estratégica / Misión / Visión

  // 7. EDUCACIÓN, HISTORIA, FILOSOFÍA & LETRAS
  GraduationCap,  // Educación Universitaria / Grado / Pedagogía / Examen
  BookOpen,       // Historia / Literatura / Lectura / Textos
  Library,        // Bibliografía / Fuentes Académicas / Archivo
  PenTool,        // Redacción / Filosofía / Epistemología

  // 8. CIENCIAS EXACTAS, QUÍMICA & FÍSICA
  Atom,           // Física / Química Cuántica / Partículas / Elementos
  FlaskConical,   // Química Orgánica / Reacciones / Compuestos
  Binary,         // Matemáticas Discretas / Álgebra / Cálculo / Lógica

  // 9. INGENIERÍA, INDUSTRIA & ARQUITECTURA
  Wrench,         // Ingeniería Mecánica / Mantenimiento / Herramientas
  Factory,        // Ingeniería Industrial / Procesos / Producción
  HardHat,        // Construcción / Ingeniería Civil / Obras
  Layers,         // Estructuras / Arquitectura / Capas

  // 10. ECOLOGÍA, AGRONOMÍA & AMBIENTE
  Leaf,           // Agronomía / Ecología / Botánica / Medio Ambiente
  Globe,          // Geografía / Clima / Ecosistemas / Biodiversidad

  // 11. ARTE, DISEÑO & AUDIOVISUAL
  Palette,        // Arte / Diseño Gráfico / Teoría del Color
  Camera,         // Audiovisual / Fotografía / Medios
  Music,          // Música / Acústica / Composición

  // 12. TECNOLOGÍA, COMPUTACIÓN & SOFTWARE (SOLO CUANDO EL TEMA SEA REALMENTE TECH)
  Cpu,            // Microprocesadores / Hardware / Arquitectura de Computadoras
  Code,           // Programación / Software / Algoritmos / Desarrollo
  Database,       // Bases de Datos / SQL / Big Data / Almacenamiento
  ShieldCheck,    // Ciberseguridad / Firewall / Criptografía
  Terminal,       // Servidores / Linux / DevOps / Línea de Comandos
  Radio,          // Redes / Telecomunicaciones / Señales

  // GENERAL & NEUTRO (SIN COMPUTADORAS)
  FileText,       // Documento General / Documento Escrito
  Sparkles        // Punto Clave / Destacado / Neutro
} from 'lucide-react';

// DICCIONARIO DE ICONOS DIRECTOS
export const DOMAIN_ICONS = {
  // DERECHO & CIENCIAS JURÍDICAS
  law: Scale,
  derecho: Scale,
  legal: Scale,
  abogacia: Scale,
  abogado: Scale,
  constitucion: Scale,
  justicia: Gavel,
  penal: ShieldAlert,
  juez: Gavel,
  tribunal: Gavel,
  delito: ShieldAlert,
  contrato: Scroll,
  jurisprudencia: Scroll,
  norma: Scroll,
  doctrina: BookMarked,
  codigo_ley: BookMarked,

  // CONTADURÍA & AUDITORÍA
  contaduria: Calculator,
  contabilidad: Calculator,
  balance: Calculator,
  impuestos: Building2,
  tributario: Building2,
  sat: Building2,
  costos: PieChart,
  auditoria: Receipt,
  factura: Receipt,
  nomina: Receipt,
  estados_financieros: FileSpreadsheet,
  asiento: FileSpreadsheet,

  // FINANZAS & ECONOMÍA
  finanzas: DollarSign,
  dinero: Coins,
  moneda: Coins,
  inversion: TrendingUp,
  mercados: TrendingUp,
  bolsa: TrendingUp,
  rentabilidad: TrendingUp,
  banca: Landmark,
  banco: Landmark,
  tesoreria: Wallet,
  presupuesto: Wallet,
  liquidez: DollarSign,
  capital: TrendingUp,

  // MEDICINA & CIENCIAS DE LA SALUD
  medicina: Stethoscope,
  clinica: Stethoscope,
  salud: HeartPulse,
  hospital: HeartPulse,
  paciente: Stethoscope,
  farmacia: Pill,
  farmacologia: Pill,
  medicamento: Pill,
  biologia: Dna,
  genetica: Dna,
  adn: Dna,
  laboratorio: Microscope,
  investigacion: Microscope,
  vacuna: Syringe,
  inmunologia: Syringe,
  fisiologia: Activity,

  // PSICOLOGÍA & CIENCIAS COGNITIVAS
  psicologia: Brain,
  cognitivo: Brain,
  conducta: Eye,
  salud_mental: Brain,
  terapia: MessageSquare,

  // ADMINISTRACIÓN & NEGOCIOS
  administracion: Briefcase,
  negocios: Briefcase,
  empresa: Briefcase,
  marketing: Target,
  estrategia: Target,
  ventas: Target,
  rrhh: Users,
  liderazgo: Award,

  // EDUCACIÓN & HUMANIDADES
  educacion: GraduationCap,
  universidad: GraduationCap,
  filosofia: Compass,
  historia: BookOpen,
  literatura: BookOpen,
  biblioteca: Library,
  pedagogia: GraduationCap,

  // CIENCIAS EXACTAS
  quimica: FlaskConical,
  fisica: Atom,
  matematicas: Binary,

  // INGENIERÍA
  ingenieria: Wrench,
  mecanica: Wrench,
  industrial: Factory,
  civil: HardHat,
  construccion: HardHat,
  ambiente: Leaf,
  ecologia: Leaf,

  // ARTE
  arte: Palette,
  diseno: Palette,
  musica: Music,
  audiovisual: Camera,

  // TECNOLOGÍA
  tecnologia: Cpu,
  hardware: Cpu,
  codigo: Code,
  programacion: Code,
  software: Code,
  datos: Database,
  database: Database,
  redes: Globe,
  ciberseguridad: ShieldCheck,
  devops: Terminal,
  servidor: Terminal,

  // GENERAL
  documento: FileText,
  general: FileText,
  default: Sparkles
};

// PALETAS TEMÁTICAS DINÁMICAS (Icons Rotation per Theme)
// Si el documento trata de una disciplina específica, rotará entre iconos representativos de ESA disciplina
export const THEMATIC_ICON_PACKS = {
  derecho: [Scale, Gavel, Scroll, ShieldAlert, BookMarked, Landmark],
  medicina: [Stethoscope, HeartPulse, Dna, Pill, Microscope, Syringe, Activity],
  psicologia: [Brain, Eye, Users, MessageSquare, Compass, HeartPulse],
  contaduria: [Calculator, PieChart, Receipt, FileSpreadsheet, Building2, Coins],
  finanzas: [DollarSign, TrendingUp, Coins, Landmark, Wallet, PieChart],
  administracion: [Briefcase, Target, Award, Users, Compass, Building2],
  educacion: [GraduationCap, BookOpen, Library, PenTool, Compass, Award],
  historia: [BookOpen, Scroll, Library, Landmark, Compass],
  quimica: [FlaskConical, Atom, Microscope, Dna],
  fisica: [Atom, Binary, Wrench, Compass],
  ingenieria: [Wrench, Factory, HardHat, Layers, Atom],
  ecologia: [Leaf, Globe, FlaskConical, Microscope],
  arte: [Palette, Camera, Music, PenTool],
  tecnologia: [Code, Database, Cpu, Terminal, ShieldCheck, Globe],
  general: [FileText, BookOpen, Scroll, Sparkles, Award, Target]
};

// DETECTOR DE CATEGORÍA DISCIPLINAR SEGÚN TEXTO
export function detectDomainCategory(text) {
  if (!text) return 'general';
  const str = String(text).toLowerCase();

  if (/(ley|abogad|jurid|juez|penal|constituc|fiscal|sentenc|demanda|civil|normat|doctrin|tribunal|delito|litigio|contrat|decreto|jurisprud)/i.test(str)) {
    return 'derecho';
  }
  if (/(medic|pacient|salud|enferm|clinic|cirug|sintom|anatomi|farmac|dosis|pildor|medicament|terapi|inmun|patolog|organo|fisiolog|viru|bacteri|celul|ad[nm]|genet)/i.test(str)) {
    return 'medicina';
  }
  if (/(psicol|psiquiatr|conduct|cognit|emocion|mente|mental|trastorn|terapia|psicoanalis|ansiedad|trauma)/i.test(str)) {
    return 'psicologia';
  }
  if (/(contab|asiento|partida|debe|haber|balance|auditor|factur|tribut|sat|iva|retenc|costo|activo|pasivo|patrimonio)/i.test(str)) {
    return 'contaduria';
  }
  if (/(finanz|ebitda|wacc|invers|accion|bono|interes|bolsa|dinero|capital|banco|liquidez|mercado financiero)/i.test(str)) {
    return 'finanzas';
  }
  if (/(administr|gestion|gerenci|negocio|empresa|marketing|ventas|client|campana|publicid|liderazgo|estrategi|mercado)/i.test(str)) {
    return 'administracion';
  }
  if (/(educ|pedagog|estudiant|docent|alumn|colegio|univers|ensenanza|aprendizaje|curricul)/i.test(str)) {
    return 'educacion';
  }
  if (/(histor|siglo|imperio|revoluc|guerra|antigu|arqueol|cronolog)/i.test(str)) {
    return 'historia';
  }
  if (/(quimic|molecul|reaccion|enlace|valencia|compuesto|solucion|acido|base)/i.test(str)) {
    return 'quimica';
  }
  if (/(fisic|mecanic quant|termodinam|newton|energia|cinetica|fuerza|gravedad|optica)/i.test(str)) {
    return 'fisica';
  }
  if (/(ingen|mecanic|estructur|maquin|robot|civil|hidraulic|fabrica|industrial)/i.test(str)) {
    return 'ingenieria';
  }
  if (/(ecolog|ambient|biodivers|botan|fauna|clima|sostenib|planeta|ecosistem)/i.test(str)) {
    return 'ecologia';
  }
  if (/(arte|pintur|disen|color|dibuj|grafic|musica|escultur|fotograf)/i.test(str)) {
    return 'arte';
  }
  if (/(codig|software|program|python|react|java|html|script|api|algorit|data lake|sql|base de datos|servidor|linux|devops|firewall|ciberseg)/i.test(str)) {
    return 'tecnologia';
  }

  return 'general';
}

// RESOLVEDOR DINÁMICO DE ICONO POR CONCEPTO + TEMA + ÍNDICE
export function resolveDynamicIcon({
  label = '',
  question = '',
  hint = '',
  theme = '',
  index = 0
} = {}) {
  // 1. Intentar resolver con la especificidad máxima del concepto individual
  const specificText = `${label} ${hint}`.trim();
  const directIcon = getDomainIcon(specificText);
  
  // Si encontró un icono específico distinto del default neutro, usarlo
  if (directIcon && directIcon !== DOMAIN_ICONS.default && directIcon !== DOMAIN_ICONS.general) {
    return directIcon;
  }

  // 2. Intentar resolver con la pregunta completa
  if (question) {
    const questionIcon = getDomainIcon(question);
    if (questionIcon && questionIcon !== DOMAIN_ICONS.default && questionIcon !== DOMAIN_ICONS.general) {
      return questionIcon;
    }
  }

  // 3. Detectar categoría del tema global del documento / carpeta
  const detectedCategory = detectDomainCategory(`${theme} ${label} ${question}`);
  const pack = THEMATIC_ICON_PACKS[detectedCategory] || THEMATIC_ICON_PACKS.general;

  // 4. Rotar armónicamente entre los iconos de esa disciplina académica
  return pack[Math.abs(index) % pack.length];
}

// HELPER: Detectar automáticamente el área/icono por cualquier texto o nombre
export function getDomainIcon(textOrCategory) {
  if (!textOrCategory) return DOMAIN_ICONS.default;
  const str = String(textOrCategory).toLowerCase().trim();

  // Búsqueda directa exacta en el mapa
  if (DOMAIN_ICONS[str]) return DOMAIN_ICONS[str];

  // Búsqueda por subcadena
  for (const key of Object.keys(DOMAIN_ICONS)) {
    if (str.includes(key)) {
      return DOMAIN_ICONS[key];
    }
  }

  // Búsquedas semánticas directas de alta prioridad
  // Derecho & Leyes
  if (/(ley|abogad|jurid|juez|penal|constituc|fiscal|sentenc|demanda|civil|normat|doctrin|tribunal|delito|litigio|contrat|decreto)/i.test(str)) {
    if (/(penal|delito|falta|crimen)/i.test(str)) return ShieldAlert;
    if (/(juez|tribunal|sentenc|fallo|veredicto)/i.test(str)) return Gavel;
    if (/(contrat|norma|decreto|doctrin|jurisprud)/i.test(str)) return Scroll;
    return Scale;
  }

  // Medicina & Salud
  if (/(medic|pacient|salud|enferm|clinic|cirug|sintom|anatomi|patolog|viru|bacteri)/i.test(str)) {
    if (/(farmac|dosis|pildor|medicament|receta)/i.test(str)) return Pill;
    if (/(adn|gen|biolog|celul|genom)/i.test(str)) return Dna;
    if (/(laborator|microscop|analisis)/i.test(str)) return Microscope;
    if (/(vacun|inmun|inyec)/i.test(str)) return Syringe;
    if (/(corazon|cardio|pulso|vital|presion)/i.test(str)) return HeartPulse;
    return Stethoscope;
  }

  // Psicología & Mente
  if (/(psicol|cognit|mental|cerebr|emocion|psiquiatr|conduct)/i.test(str)) {
    return Brain;
  }

  // Contabilidad & Auditoría
  if (/(contab|asiento|partida|debe|haber|balance|auditor|factur|tribut|sat|iva|retenc|costo)/i.test(str)) {
    if (/(factur|comprobant|recibo|auditor)/i.test(str)) return Receipt;
    if (/(libro|financier|balance general|asiento)/i.test(str)) return FileSpreadsheet;
    return Calculator;
  }

  // Finanzas & Economía
  if (/(finanz|ebitda|wacc|invers|accion|bono|interes|bolsa|dinero|capital|banco|liquidez|tesorer)/i.test(str)) {
    if (/(banco|monetario|banca central)/i.test(str)) return Landmark;
    if (/(presupuest|flujo|caja|wallet)/i.test(str)) return Wallet;
    if (/(moneda|divisa|cripto)/i.test(str)) return Coins;
    return DollarSign;
  }

  // Administración & Empresa
  if (/(administr|gerenci|negocio|empresa|liderazgo|gestion)/i.test(str)) {
    return Briefcase;
  }
  if (/(market|ventas|client|campana|publicid|meta|objetivo)/i.test(str)) {
    return Target;
  }
  if (/(recursos humanos|rrhh|personal|equipo|colaborador|comunidad|sociedad|sociolog|etnia|etnico|indigen|pueblo|tribu|poblacion|ciudadania|organizacion social)/i.test(str)) {
    return Users;
  }

  // Educación & Humanidades
  if (/(educ|pedagog|estudiant|docent|alumn|univers|grado|carrera)/i.test(str)) {
    return GraduationCap;
  }
  if (/(histor|literatur|libro|obra|autor|texto)/i.test(str)) {
    return BookOpen;
  }
  if (/(filosof|humanid|geograf|orientac)/i.test(str)) {
    return Compass;
  }

  // Ciencias Exactas & Naturales
  if (/(quimic|molecul|reaccion|compuest|solucion|laboratorio quimico|ciencia|cientific|experimento|investig|metodo)/i.test(str)) {
    return FlaskConical;
  }
  if (/(fisic|atom|particul|cuantic|newton|energia)/i.test(str)) {
    return Atom;
  }
  if (/(ecolog|botan|medio ambiente|agronom|flora|vegetal)/i.test(str)) {
    return Leaf;
  }

  // Ingeniería & Procesos
  if (/(mecanic|maquinaria|mantenim|herramient)/i.test(str)) {
    return Wrench;
  }
  if (/(industrial|planta|produccion|fabrica)/i.test(str)) {
    return Factory;
  }
  if (/(civil|construc|edific|obra)/i.test(str)) {
    return HardHat;
  }

  // Arte & Creatividad
  if (/(arte|pintur|disen|color|dibuj|grafic)/i.test(str)) {
    return Palette;
  }
  if (/(musica|audio|sonido|cancion)/i.test(str)) {
    return Music;
  }
  if (/(foto|fotograf|cine|video|audiovisual)/i.test(str)) {
    return Camera;
  }

  // Tecnología & Programación (SOLO SI EXPLÍCITAMENTE ES DE INFORMÁTICA)
  if (/(program|software|codigo fuente|script|python|javascript|java|html|css|api rest|algoritm)/i.test(str)) {
    return Code;
  }
  if (/(base de datos|sql|nosql|mongodb|data lake|postgresql|mysql)/i.test(str)) {
    return Database;
  }
  if (/(procesador|hardware|microcontrolador|cpu|chip)/i.test(str)) {
    return Cpu;
  }
  if (/(ciberseg|firewall|criptograf|token|seguridad informatica)/i.test(str)) {
    return ShieldCheck;
  }
  if (/(servidor|linux|devops|docker|kubernetes|terminal)/i.test(str)) {
    return Terminal;
  }

  return DOMAIN_ICONS.default;
}
