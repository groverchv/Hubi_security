# Documento de Exploración: Reducción de Ansiedad en Universitarios (18-25) de la UAGRM

**Proyecto:** Software lúdico web de regulación emocional en el momento
**Fecha de elaboración:** Septiembre 2026
**Estado:** Documento de base para decisiones de diseño, código, presentación institucional y revisión ética
**Enfoque decidido:** El usuario llega ansioso y la app lo ayuda a calmarse AHORA con técnicas validadas

---

## 0. Nota metodológica y de honestidad de las fuentes

Este documento se construyó sobre fuentes verificadas durante la investigación. Cada afirmación fuerte lleva cita. Cuando una afirmación **no pudo verificarse** se marca explícitamente como **[AFIRMACIÓN A VALIDAR]**, y cuando no se encontraron datos (por ejemplo, para la UAGRM en específico) se dice de forma explícita en lugar de inventar.

Se buscó en PubMed/NCBI, OMS, MDN Web Docs y literatura gris boliviana. Las búsquedas se realizaron en septiembre de 2026. La ausencia de evidencia **no** es evidencia de ausencia: varias afirmaciones marcadas como pendientes podrían verificarse con búsqueda local (tesis UAGRM, informes de Bienestar Universitario) que escapa al alcance de esta exploración.

---

## 1. Marco teórico de la ansiedad

### 1.1 Definición clínica actual

Los dos sistemas de clasificación vigentes son:

- **DSM-5-TR** (Manual Diagnóstico y Estadístico de los Trastornos Mentales, 5ª ed., revisión de texto), publicado por la American Psychiatric Association en 2022. Agrupa los trastornos de ansiedad como una categoría diferenciada de los trastornos traumáticos y disociativos.
- **CIE-11** (Clasificación Internacional de Enfermedades, 11ª ed.), publicada por la OMS. Entró en vigor en 2022 y es el sistema usado en sistemas públicos de salud de Latinoamérica, incluido Bolivia. **[AFIRMACIÓN A VALIDAR: verificar el grado de implementación real de la CIE-11 en los servicios de salud mental bolivianos.]**

La definición de la OMS (2026) establece la diferencia clave: todas las personas pueden sentir ansiedad en algún momento, pero las personas con **trastornos de ansiedad** experimentan un miedo y una preocupación que son **intensos y excesivos**, acompañados de tensión física y otros síntomas cognitivos y conductuales; son difíciles de controlar, causan malestar significativo y pueden durar mucho tiempo sin tratamiento, e interfieren con las actividades diarias y con la vida familiar, social, escolar o laboral.

La distinción operativa entre ansiedad normal, adaptativa y patológica reposa sobre cuatro criterios clínicos:

| Criterio | Ansiedad normal/adaptativa | Ansiedad patológica |
|---|---|---|
| Intensidad | Proporcionada al estímulo | Desproporcionada respecto a la amenaza |
| Duración | Transitoria, cede con el estresor | Persistente (varios meses según OMS) |
| Control | Se regula solo | Difícil de controlar |
| Funcionalidad | No interfiere, puede mejorar el desempeño | Interfiere con la vida diaria |
| Evitación | Ausente | Evitación de situaciones que la provocan |

Criterio clave para el producto: la ansiedad **adaptativa** antes de un examen es funcional; deja de serlo cuando genera evitación, bloqueo o malestar sostenido. La app se dirige al segundo grupo, sin diagnosticar.

### 1.2 Tipos relevantes para universitarios de 18-25 años

Según la OMS (2026), los tipos de trastorno de ansiedad incluyen: trastorno de ansiedad generalizada (preocupación persistente y excesiva por actividades cotidianas), trastorno de pánico (ataques de pánico y miedo a que se repitan), trastorno de ansiedad social (miedo a situaciones sociales que puedan humillar o rechazar), agorafobia, trastorno de ansiedad por separamiento, fobias específicas y mutismo selectivo.

Los más relevantes para la población universitaria son:

1. **Trastorno de Ansiedad Generalizada (TAG):** preocupación excesiva por múltiples temas (notas, dinero, futuro, familia). El más prevalente en este grupo.
2. **Ansiedad social:** miedo a exponer, hablar en público, participar en clase o a la evaluación social de pares. Particularmente incapacitante en un entorno de evaluación constante.
3. **Ataques de pánico / trastorno de pánico:** crisis agudas con síntomas físicos intensos (palpitaciones, sensación de muerte inminente). Suelen generar consultas de urgencia y es uno de los motivos por los que la app **debe** tener un protocolo de derivación.
4. **Ansiedad académica / de rendimiento:** no es una categoría DSM/CIE formal, pero es la presentación más común y la más directamente alineada con la propuesta de valor del producto. Se manifiesta como bloqueo cognitivo ante evaluaciones, procrastinación paralizante y rumiación sobre el desempeño. **[AFIRMACIÓN A VALIDAR: aunque ampliamente usada en literatura educativa, "ansiedad académica" no tiene criterios DSM-5-TR propios; conviene citar un instrumento específico, p. ej. el vrAS o el CTAS, si se va a medir.]**

Comorbilidad importante: la OMS (2026) advierte que los trastornos de ansiedad aumentan el riesgo de depresión, de trastornos por uso de sustancias y de pensamientos y conductas suicidas. Esto refuerza la obligación ética de pantalla y derivación.

### 1.3 Manifestaciones: lo que la app va a intentar regular

La OMS (2026) lista como síntomas: dificultad para concentrarse o tomar decisiones; irritabilidad, tensión o inquietud; náuseas o malestar abdominal; palpitaciones; sudoración, temblores; problemas de sueño; y sensación de peligro, pánico o fatalismo inminentes.

Organizado en los cuatro canales que el producto debe abordar:

- **Fisiológicos:** palpitaciones, respiración rápida y superficial (hiperventilación), tensión muscular, sudoración, temblores, náuseas, mareo, boca seca. → *Blanco directo de respiración y relajación muscular.*
- **Cognitivos:** preocupación rumiante, anticipación de catástrofe, dificultad de concentración, pensamiento automático negativo, sesgo de amenaza. → *Blanco de reestructuración cognitiva micro y de grounding atencional.*
- **Emocionales:** miedo, irritabilidad, sensación de descontrol, angustia, vergüenza. → *Blanco de auto-compasión y de validación.*
- **Conductuales:** evitación, procrastinación, aislamiento, ritmo de sueño alterado, consumo de sustancias. → *La app de "momento" apenas roza este canal; es el dominio de la terapia.*

Este mapeo es la justificación de la variedad de técnicas: ningún canal se aborda con una sola herramienta.

### 1.4 Marcos teóricos de referencia

**Modelo cognitivo de Beck.** Aaron T. Beck (1976), *Cognitive Therapy and the Emotional Disorders*. Postula que no son las situaciones las que generan el estado emocional, sino la **interpretación** (pensamientos automáticos) que la persona hace de ellas. Los pensamientos automáticos disfuncionales son rápidos, no reflexivos y tienden a la catastrofización. La intervención cognitiva clásica consiste en capturar ese pensamiento, examinar su evidencia y generar una alternativa más realista. La OMS (2026) confirma que las intervenciones con **más evidencia** para tratar trastornos de ansiedad son las basadas en **terapia cognitivo-conductual (TCC)**, incluida la exposición. Aplicación al producto: la "reestructuración cognitiva micro" es una TCC destilada, y debe presentarse como tal.

**Modelo polivagal de Porges.** Stephen W. Porges (1995, 2011). Teoría neurofisiológica que describe la evolución del sistema nervioso autónomo en tres ramas: la **mixta/social** (estado seguro de compromiso social, visible a través del tono del nervio vago), la **simpática-movilización** (lucha/huida, activación) y la **dorsal-inmovilización** (congelamiento, "shutdown"). La regulación sería el tránsito desde la movilización o la inmovilización hacia el estado de compromiso social. Fundamento teórico de intervenciones basadas en respiración lenta, prosodia vocal y conexión social como vías de estimulación del vago. **Nota crítica:** la teoría polivagal es influyente y muy usada en el mundo clínico y de apps, pero su base evidencial es debatida en la neurofisiología contemporánea; conviene presentarla como marco interpretativo, no como hecho establecido. **[AFIRMACIÓN A VALIDAR: existe literatura crítica sobre el rigor del modelo polivagal; antes de citarlo en una presentación a revisores éticos conviene consultar al menos un artículo de revisión y/o crítica.]**

---

## 2. Ansiedad en universitarios de 18-25 años

### 2.1 Prevalencia global reportada en universitarios

La evidencia más sólida disponible (metaanálisis y revisión general):

- **Ahmed et al. (2023)**, *BMC Psychiatry*, revisión sistemática y metaanálisis de ansiedad no específica en estudiantes de pregrado: **89 estudios, ~130.090 estudiantes**, prevalencia media ponderada de **39,65%** (IC 95%: 35,72%–43,58%). Los estudios con entrevista diagnóstica mostraron prevalencia a 12 meses de **0,3%–20,8%** (rango muy amplio). En la mitad de los estudios, ser mujer se asoció a puntuaciones más altas.
- **Li et al. (2022)**, *Journal of Child Psychology and Psychiatry*: 64 estudios, 100.187 individuos; prevalencia agrupada de síntomas de ansiedad **39,0%** (IC 95%: 34,6%–43,4%). Por región, la más alta fue **América del Norte (48,3%)**; en países de ingresos bajos-medios, **54,2%**; en estudiantes de medicina, **47,1%**.
- **Liyanage et al. (2021)**, *IJERPH*, durante la pandemia de COVID-19: 36 estudios; prevalencia resumida **41%** (IC 95%: 0,34–0,49). Europa 51%, EE. UU. 56%, Asia 33%.
- **Paiva et al. (2025)**, *Neuroscience & Biobehavioral Reviews*, **revisión general (umbrella review)**: 62 metaanálisis, 1.655 estudios primarios, **8.706.185 participantes**. Ansiedad leve: **40,21%** (IC 37,39–43,07); **ansiedad grave: 16,79%** (IC 7,21–29,29). Ideación suicida a 12 meses: **10,76%**; idea vital: **20,33%**; intento a 12 meses: **1,37%**.

**Lectura honesta para el producto:** aproximadamente **4 de cada 10** estudiantes universitarios presentan niveles elevados de ansiedad, y cerca de **1 de cada 6** niveles graves. Hay que ser cauto con la heterogeneidad: la revisión umbrella de Paiva et al. (2025) calificó el **65%** de los metaanálisis como de calidad "críticamente baja" en AMSTAR-2. La cifra debe usarse como orden de magnitud, no como dato puntular.

El grupo etario es de riesgo también por onset: la OMS (2026) señala que los síntomas de ansiedad suelen comenzar en la infancia o adolescencia y continuar en la adultez, y que las mujeres la padecen más que los hombres.

### 2.2 Por qué este grupo etario es de riesgo

Los 18-25 años concentran transiciones vitales simultáneas: salida del sistema escolar y entrada a la universidad (con su meritocracia y competencia evaluativa), construcción de la identidad adulta y autonomía emocional, separación de la familia de origen, inserción en redes sociales de pares, inestabilidad económica y primer contacto con decisiones laborales de largo alcance. En la región, se suma la dependencia económica prolongada y la incertidumbre laboral. La literatura revisada por Li et al. (2022) y Ahmed et al. (2023) asocia consistentemente la pertenencia a carreras del área de la salud (medicina 47,1%) y el sexo femenino con mayor prevalencia.

### 2.3 Datos específicos de Latinoamérica

**No se encontró un metaanálisis específico para estudiantes universitarios de Latinoamérica** con desglose utilizable. Li et al. (2022) reportaron la carga por región, pero la categoría "América" se desagregó principalmente en América del Norte; los datos de Centro/Sudamérica quedaron diluidos o insuficientes. **[AFIRMACIÓN A VALIDAR: existe literatura latinoamericana considerable (estudios en Chile, Colombia, Brasil, Perú, México), pero no se halló una síntesis regional con la calidad de las citas anteriores; se recomienda una búsqueda dirigida en SciELO, Lilacs y Redalyc antes de presentar cifras regionales.]**

### 2.4 Datos específicos de Bolivia, Santa Cruz y UAGRM

**Hallazgo negativo explícito, comunicado con honestidad:**

- **No se encontró ningún estudio indexado en PubMed sobre salud mental de estudiantes de la UAGRM.** La búsqueda específica ("mental health university students Bolivia anxiety depression") arrojó solo dos resultados en PubMed, y ninguno corresponde a la UAGRM ni a Santa Cruz.
- **No se encontró información verificable en línea sobre un servicio de bienestar universitario o servicio de psicología de la UAGRM** con datos de contacto, horarios o protocolos. **[AFIRMACIÓN A VALIDAR — prioridad alta: esto debe confirmarse directamente con la Dirección de Bienestar Universitario o la Secretaría de la UAGRM antes de presentar el proyecto, porque condiciona toda la ruta de derivación.]**

**Lo único encontrado a nivel nacional:**

- **Villca Villegas et al. (2026)**, *Vertex* 37(172):33-40, "Impacto del tiempo de uso de redes sociales en depresión y ansiedad generalizada en estudiantes de medicina de Bolivia". Estudio transversal, **n=210**, en la **Universidad Privada Franz Tamayo (Cochabamba)**, usando el Inventario de Depresión y Ansiedad de Beck. Resultados: uso medio de redes sociales **5,29 h/día** (TikTok 79,52%); puntuación media de ansiedad **15,4 (DE 13,0)**; cada hora adicional de uso se asoció con **+0,72 puntos** de ansiedad (p=0,002); antecedentes de ansiedad sumaban +8,59 puntos (p=0,012).

**Interpretación para el producto:** este estudio **no es** de la UAGRM, ni de Santa Cruz, ni de la población general de estudiantes; es una universidad privada de Cochabamba y solo de medicina. Sirve como **evidencia contextual boliviana** de que el problema existe y de que los estudiantes cruceños están expuestos a los mismos factores (uso intensivo de redes, presión académica). **No debe citarse como dato de prevalencia de la UAGRM.**

**Implicación estratégica directa:** la ausencia de datos de la UAGRM es, paradójicamente, un activo institucional. El proyecto puede ofrecerse como **generador de evidencia**: aplicar un instrumento validado (p. ej. GAD-7) a la población de la UAGRM, con aprobación ética, y producir el primer dato oficial de salud mental de esa casa de estudios. Esto refuerza enormemente la presentación a la UAGRM y a revisores éticos.

### 2.5 Contexto cultural: salud mental en Bolivia

**Barreras estructurales.** La OMS (2026) identifica barreras globales a la atención: desconocimiento de que es una condición tratable, falta de inversión en servicios de salud mental, falta de profesionales formados y **estigma social**. Estas barreras son más agudas en países de ingresos bajos y medios.

**Bolivia presenta un cuadro agravado por:**
- **Brecha de tratamiento global:** Alonso et al. (2018), citado por la OMS, estimaron que solo **1 de cada 4** personas con trastorno de ansiedad (27,6%) recibe algún tratamiento, en 21 países encuestados. **[AFIRMACIÓN A VALIDAR: la cifra boliviana específica no se encontró; se debe asumir que es menor al promedio global y, si se quiere citar, buscarla en el PAHO/OPS Bolivia.]**
- **Escasez de especialistas en salud mental:** población de psicólogos y psiquiatras por habitante muy por debajo de los estándares recomendados. **[AFIRMACIÓN A VALIDAR: verificar el número exacto con el Colegio de Psicólogos de Bolivia o el Ministerio de Salud y Deportes.]**
- **Estigma y representaciones culturales:** la ansiedad suele leerse como "debilidad", "falta de carácter" o, en algunos contextos, como un desequilibrio con explicaciones religiosas o tradicionales. El estigma es una de las razones por las que un formato anónimo, autónomo y de bajo umbral (una web) puede llegar a quienes nunca consultarían a un psicólogo.
- **Automedicación y uso de benzodiacepinas:** la OMS (2026) explícitamente desaconseja las benzodiacepinas por su alto potencial de dependencia y limitada efectividad a largo plazo. **[AFIRMACIÓN A VALIDAR: no se verificó el patrón de prescripción boliviano, pero es un riesgo real que justifica que la app sea una alternativa no farmacológica.]**

---

## 3. Técnicas validadas de regulación emocional en el momento

Cada técnica se evalúa con honestidad sobre la **calidad de su evidencia**, no solo sobre su popularidad.

### 3.1 Respiración: coherencia cardíaca ~0,1 Hz (método "365", 5,5s)

**Origen y descripción.** La "coherencia cardíaca" es la respiración lenta y rítmica que maximiza la variabilidad de la frecuencia cardíaca (VFC). El **método 365** se popularizó como una prescripción simple: practicar **3 veces al día, respirando a 6 respiraciones por minuto, durante 5 minutos**. **[AFIRMACIÓN A VALIDAR: el usuario del brief atribuye el método 365 a "O. Huebner"; no se pudo verificar esa autoría en la búsqueda. La atribución más difundida en la literatura de divulgación es David Servan-Schreiber (2003), *Guérir* / *Curación emocional*. Antes de imprimir un nombre en el material de la app, conviene confirmar la autoría exacta. Lo que sí está verificado es el mecanismo fisiológico, no la autoría.]**

**Mecanismo.** 6 respiraciones/min = ciclo de ~10 s = **0,1 Hz**, que coincide con la **frecuencia de resonancia** del sistema cardiovascular (acoplamiento entre barorreflejo y oscilaciones respiratorias). Una respiración con fase inspiratoria y espiratoria de ~5,5 s cada una aproxima ese objetivo.

**Evidencia: FUERTE-MODERADA.**
- **Sumińska et al. (2026)**, *Scientific Reports*, ECA de 4 semanas, N=88, tres grupos (frecuencia de resonancia individualizada vs. **0,1 Hz fija** vs. control). Ambos grupos de respiración mostraron **reducciones significativas de estrés, ansiedad y síntomas depresivos** (DASS-21) respecto al control, **sin diferencia significativa** entre la respiración individualizada y la fija. Conclusión práctica decisiva para el producto: **no hace falta calibrar a cada usuario; basta un ritmo fijo de 0,1 Hz.**
- **Kim et al. (2026)**, *Applied Psychophysiology and Biofeedback*: la respiración con espiración prolongada converge espontáneamente hacia ~0,1 Hz y aumenta la VFC (RMSSD, SDNN, potencia total) **sin necesidad de dispositivo de biofeedback**.

**Duración típica:** 5 minutos (el protocolo 365). **Implementación en app web: BAJA dificultad** (un cronómetro + animación + sonido opcional).

**Pros:** evidencia directa de eficacia sobre ansiedad en ECA; dosis corta; mecanismo fisiológicamente explicado; ritmo fijo suficiente; sin equipo. **Contras:** requiere práctica regular para efecto sostenido; puede causar mareo leve al principio en personas con tendencia a hiperventilación si se fuerza.

**Cuándo NO usar:** crisis de pánico aguda con hiperventilación intensa (el usuario no logrará seguir el ritmo; requiere instrucción de espiración suave, no "respirar profundo"); personas con asma no controlada o EPOC (consultar a un médico antes de recomendar ritmos lentos forzados).

### 3.2 Box breathing 4-4-4-4

**Origen:** popularizado en el entrenamiento militar de élite (SEAL) como técnica de regulación bajo presión. **No tiene un único autor académico reconocido.**

**Descripción:** inhalar 4 s, retener 4 s, exhalar 4 s, retener 4 s. Ciclo total 16 s ≈ 3,75 respiraciones/min ≈ 0,06 Hz, es decir, **por debajo de la frecuencia de resonancia** (más lento que la coherencia cardíaca).

**Evidencia: MODERADA-DÉBIL en ansiedad clínica.** No se encontró un ECA específico de box breathing 4-4-4-4 para ansiedad en universitarios. Su respaldo es indirecto: pertenece a la familia de respiración lenta con evidencia consolidada (Sumińska 2026; Manzoni 2008) y es de uso clínico extendido. **[AFIRMACIÓN A VALORAR: su ventaja no es la evidencia propia, sino la estructura memorizable y la retención que da ritmo y control; es un argumento de usabilidad, no de eficacia diferencial.]**

**Duración típica:** 2-5 minutos. **Implementación: BAJA dificultad.**

**Pros:** extremadamente fácil de recordar; las retenciones dan estructura y sensación de control; funciona bien en posición sentada y en público. **Contras:** menos evidencia directa que la coherencia cardíaca; las retenciones pueden ser incómodas para personas con ansiedad respiratoria o hipertensión.

**Cuándo NO usar:** mismo caso que 3.1, agregando que las pausas en retención pueden generar incomodidad en personas con trastorno de pánico.

### 3.3 Respiración diafragmática

**Origen:** técnica clásica de relajación, componente básico de la mayoría de protocolos de manejo del estrés.

**Evidencia: MODERADA.** Forma parte del "entrenamiento en relajación" evaluado por **Manzoni et al. (2008)**, *BMC Psychiatry*, metaanálisis de 27 estudios: tamaño del efecto **mediano-grande**, d=0,57 intra-sujeto y **d=0,51** entre grupos, con eficacia mayor para tratamientos más prolongados. Incluyó relajación progresiva de Jacobson, entrenamiento autógeno, relajación aplicada y meditación.

**Duración típica:** 5-10 minutos. **Implementación: BAJA-MEDIA dificultad** (requiere instrucción de colocación de manos sobre abdomen, difícil de guiar solo con animación de círculo).

**Pros:** base de casi todas las demás técnicas; sin efectos adversos conocidos. **Contras:** aburrida para un público joven; la dificultad de "bajar el aire al abdomen" es real y frustrante sin feedback; baja diferenciación de producto.

**Cuándo NO usar:** prácticamente sin contraindicaciones; es la técnica más segura.

### 3.4 Respiración 4-7-8 (Weil)

**Origen:** Andrew Weil, médico integrativo (2011, *Breathing for Life*), basada en el pranayama.

**Descripción:** inhalar 4 s, retener 7 s, exhalar 8 s. Ciclo ~19 s ≈ 3,2 respiraciones/min.

**Evidencia: DÉBIL.** **No se encontró un ECA específico** sobre la técnica 4-7-8 para ansiedad en la búsqueda realizada. Su evidencia es indirecta (familia de respiración lenta con espiración prolongada, que es la que mecanísticamente activa el vago, según Kim et al. 2026). **Es popularidad, no evidencia propia.**

**Duración típica:** 4 ciclos (~1,5 min) según su autor. **Implementación: BAJA.**

**Pros:** la espiración prolongada (8 s) es el componente fisiológicamente más relevante; muy breve. **Contras:** la retención de 7 s puede ser ansiógena para principiantes; en crisis aguda es difícil de seguir; la ausencia de ECA propio debe declararse.

**Cuándo NO usar:** crisis de pánico (el conteo de 19 s por ciclo es demasiado exigente); personas con condiciones respiratorias.

### 3.5 Grounding 5-4-3-2-1 (técnica sensorial)

**Origen:** técnica de **anclaje (grounding)** derivada de la TCC y de la terapia de trauma; no tiene un autor único. Forma parte de la familia de "despliegue atencional".

**Descripción:** nombrar 5 cosas que se ven, 4 que se tocan, 3 que se oyen, 2 que se huelen, 1 que se saborea.

**Evidencia: MODERADA como estrategia de anclaje, DÉBIL en ensayos específicos.** No se encontró un ECA específico del 5-4-3-2-1 en universitarios; su respaldo es el del conjunto de técnicas de grounding y de redirección atencional, que es donde coincide la literatura clínica de manejo de la ansiedad y del trauma. Wawrzyniak et al. (2026), *Public Health Rev*, incluyen las técnicas de respiración dentro de las intervenciones "sensoriales-relajantes" con evidencia de certeza moderada. **[AFIRMACIÓN A VALORAR: la técnica 5-4-3-2-1 en particular es un "clínico consensuado" más que un "ensayado"; presentar como tal.]**

**Duración típica:** 2-4 minutos. **Implementación: MEDIA dificultad** (requiere interacción multimodal: entrada de texto/selección, audio, posiblemente cámara; es la técnica más interactiva de la lista).

**Pros:** saca la atención del bucle rumiativo de forma inmediata; es cognitivamente absorbente (toda la memoria de trabajo se va a los sentidos); se puede hacer en público sin que nadie note; es excelente para ataques de pánico incipientes. **Contras:** al requerir interacción, no es adecuada para ojos cerrados ni para momentos de agotamiento; la parte olfativa/gustativa es poco práctica.

**Cuándo NO usar:** en crisis de disociación grave o en personas con trauma complejo, el foco en el cuerpo puede empeorar la disociación; en esos casos se prioriza derivación.

### 3.6 Relajación muscular progresiva de Jacobson (versión corta)

**Origen:** Edmund Jacobson (1938), *Progressive Relaxation*.

**Descripción:** tensar y relajar grupos musculales progresivamente, de distal a proximal o viceversa. Existe una versión abreviada de unos 4-8 grupos musculares (vs. las decenas del original).

**Evidencia: FUERTE-MODERADA.** Incluida en el metaanálisis de **Manzoni et al. (2008)** con d=0,51-0,57. La **OMS (2026) la cita expresamente** dentro del autocuidado: "aprender técnicas de relajación, como la respiración lenta y la **relajación muscular progresiva**".

**Duración típica:** versión corta 5-8 minutos. **Implementación: MEDIA-ALTA dificultad** (requiere instrucción verbal/habla, seguimiento de una secuencia larga, y el usuario debe estar en un lugar donde pueda tensar músculos; la guía por audio es casi obligatoria).

**Pros:** evidencia robusta; atacá directamente la tensión muscular, síntoma nuclear de la ansiedad; la OMS la recomienda explícitamente. **Contras:** no es "en el momento" en sentido estricto (necesita privacidad y varios minutos); en formato app exige audio y una secuencia larga; si el usuario está en una biblioteca o en transporte, no puede hacerla.

**Cuándo NO usar:** personas con lesiones musculoesqueléticas agudas, postoperatorio, o con antecedentes de trauma donde la conciencia corporal es desestabilizadora (la indicación debe venir de un profesional).

### 3.7 Mindfulness breve (body scan de 3 min / atención a la respiración)

**Origen:** programas MBSR (Kabat-Zinn, 1979) y MBCT; adaptaciones breves clínicas.

**Evidencia: FUERTE en programas de 8 semanas; MODERADA en formatos breves.** La OMS (2026) recomienda explícitamente: "desarrollar el hábito de la meditación mindfulness, aunque sean solo unos minutos al día". Para formatos de una sola sesión breve de regulación, la evidencia de efecto inmediato sobre ansiedad-estado es moderada. **[AFIRMACIÓN A VALORAR: los metaanálisis de mindfulness se centran en programas de varias semanas; para "calmarse en 3 minutos ahora", la evidencia específica es más tenue y conviene citar con esa matiz.]**

**Duración típica:** 3-10 minutos. **Implementación: MEDIA dificultad** (guión de audio + silencios + feedback opcional).

**Pros:** excelente aceptación; misma familia que la respiración; la OMS la recomienda; escalable a "práctica diaria". **Contras:** en una crisis aguda, "observar sin juzgar" es una instrucción muy avanzada para alguien en hiperventilación; hay evidencia de que un subgrupo de personas con trauma o ansiedad grave experimenta **aumento** de angustia con la meditación introceptiva.

**Cuándo NO usar:** crisis aguda (priorizar respiración o grounding); antecedentes de trauma o disociación severa (debe ser supervisada por profesional).

### 3.8 Reestructuración cognitiva micro

**Origen:** Beck (1976), TCC clásica, destilada a formato ultrabreve.

**Descripción:** tres pasos: (1) capturar el pensamiento automático ("Voy a reprobar y mi vida se arruina"), (2) preguntarse qué evidencia hay a favor y en contra, (3) escribir una alternativa más realista y útil ("Es un examen difícil; he aprobado otros antes; el resultado no me define").

**Evidencia: FUERTE como parte de la TCC; MODERADA como intervención aislada de 2 minutos.** La OMS (2026) es clara: las intervenciones psicológicas con **más evidencia** para los trastornos de ansiedad son las basadas en TCC. La advertencia crítica es que esa evidencia es para TCC **completa**, no para una micro-versión.

**Duración típica:** 2-5 minutos. **Implementación: ALTA dificultad** (requiere entrada de texto libre, que el usuario articule su pensamiento y redacte; es la técnica con mayor carga cognitiva y mayor tasa de abandono).

**Pros:** la única técnica que aborda la raíz cognitiva; efectos acumulativos con la repetición; genera datos subjetivos valiosos. **Contras:** **no es apta para el momento agudo** — cuando alguien está en pánico no puede "examinar evidencia"; exige alfabetización emocional y escritura; alto riesgo de que el usuario la abandone a mitad.

**Cuándo NO usar:** crisis aguda; deterioro cognitivo; no debe presentarse como sustituto de la psicoterapia.

### 3.9 Auto-compasión breve (Kristin Neff, versión 1-2 min)

**Origen:** Kristin Neff (2003), constructo de auto-compasión (auto-amabilidad, humanidad compartida, mindfulness), con ejercicios breves.

**Evidencia: MODERADA y creciente.** **Li et al. (2025)**, *Journal of Psychosomatic Research*, ECA con n=107 mujeres jóvenes (17-25 años): la **escritura auto-compasiva** superó a la respiración consciente para mejorar el estado emocional, mediado por el aumento de la auto-amabilidad. Es el estudio más directamente alineado con la población objetivo del producto.

**Duración típica:** 1-5 minutos. **Implementación: MEDIA dificultad** (guión breve + escritura opcional; requiere tono emocional cuidado).

**Pros:** aborda la autocrítica, que es el mantenedor más común de la ansiedad de rendimiento en estudiantes perfeccionistas; la evidencia en jóvenes es directamente relevante; tono cálido diferencia de producto. **Contras:** para personas con trauma o depresión grave, la auto-compasión puede activar autorrechazo (efecto paradójico documentado en literatura; requiere cuidado clínico); requiere tono editorial muy bien calibrado, no puede ser generado mecánicamente.

**Cuándo NO usar:** ideación suicida o depresión grave (priorizar derivación).

### 3.10 Biofeedback de VFC por cámara/webcam (HRV camera-based)

**Estado: NO VIABLE como núcleo del producto. Justificación técnica con fuentes.**

Existen bibliotecas y papers serios sobre fotopletismografía (PPG) remota y por cámara:
- **Bánhalmi et al. (2018)**, *J Healthc Eng*: compararon PPG por cámara de smartphone (iPhone 6, 240 Hz) con ECG en 50 mediciones paralelas y obtuvieron **buena correspondencia** (desviación media RR de 0,01-0,06 ms). Pero usó el **dedo sobre la lente**, no la cara.
- **Nam et al. (2014)**, *Ann Biomed Eng*: estimación de frecuencia respiratoria desde la cámara del smartphone; la **banda verde** dio la mejor calidad de señal.
- **Tyapochkin et al. (2019)**, IEEE EMBC: advierten que **muchas apps fracasan** en obtener lecturas suficientemente precisas para estimar la VFC por la multitud de factores que afectan el PPG: modelo de teléfono, FPS, forma de registrar el color, brillo/flash, colocación del dedo y movimiento durante la medición.

**Por qué descartarlo para la V1:**
1. **Precisión condicional:** la evidencia de precisión es para **dedo sobre lente con iluminación controlada**, no para "cara a la webcam" en una habitación de dormitorio mal iluminada.
2. **Friction alta:** requiere permiso de cámara, posicionamiento, iluminación y 1-2 minutos quietos. Es lo opuesto a "llegué ansioso y quiero calmarme ahora".
3. **Falla silenciosa:** cuando la señal es mala, la app puede mostrar un valor de VFC falso o contradictorio. En un usuario ansioso, un "feedback" erróneo **puede aumentar la ansiedad** (efecto iatrogénico documentado en biofeedback mal implementado).
4. **Costo-beneficio:** Sumińska et al. (2026) demostraron que **no hay diferencia** entre respiración calibrada individualmente y respiración fija a 0,1 Hz. Es decir, el biofeedback **no aporta valor clínico demostrable** para el objetivo de calmar al usuario en el momento.

**Decisión recomendada:** descartar para la V1. Si en el futuro se quiere introducir, hacerlo como función opcional, claramente etiquetada como "no médica", con dedo sobre la cámara del móvil (no cara) y solo tras validación con un instrumento de referencia.

### 3.11 Cuadro comparativo de técnicas

| Técnica | Evidencia | Duración | Dificultad app | Momento agudo |
|---|---|---|---|---|
| Coherencia cardíaca 0,1 Hz / 365 | Fuerte-moderada | 5 min | Baja | **Sí** |
| Box breathing 4-4-4-4 | Moderada-débil | 2-5 min | Baja | **Sí** |
| Respiración diafragmática | Moderada | 5-10 min | Baja-media | Sí |
| 4-7-8 (Weil) | Débil | 1,5 min | Baja | Con cuidado |
| Grounding 5-4-3-2-1 | Moderada | 2-4 min | Media | **Sí** (ideal para pánico incipiente) |
| Jacobson versión corta | Fuerte-moderada | 5-8 min | Media-alta | No (requiere privacidad) |
| Mindfulness breve | Moderada | 3-10 min | Media | Con cuidado |
| Reestructuración cognitiva micro | Moderada aislada | 2-5 min | Alta | **No** |
| Auto-compasión breve | Moderada | 1-5 min | Media | Sí (post-crisis) |
| Biofeedback VFC por cámara | No viable V1 | 1-2 min | Alta | No |

---

## 4. Diseño de la experiencia: qué patrones existen

**Aviso de alcance:** los patrones siguientes se basan en descripciones públicas, reseñas y literatura, no en una auditoría de uso realizada en esta exploración (los sitios de estas apps son aplicaciones JS pesadas que no se pudieron auditar automáticamente). Las afirmaciones específicas de UX se marcan como observación pública, no como dato verificado de producto.

### 4.1 Apps de meditación y relajación

**Calm, Headspace, Insight Timer** son las apps de referencia en el segmento. Patrones públicos observables:
- **Onboarding emocional, no clínico:** llegada con pregunta simple ("¿cómo te sientes hoy?"), sin diagnóstico ni lenguaje de enfermedad.
- **"SOS" de emergencia:** botón visible y permanente de "me siento mal / necesito ayuda ahora" que lleva a recursos de crisis. Headspace y Calm incluyen este patrón de forma prominente.
- **Animación de respiración visual:** un círculo o forma orgánica que se expande y contrae, sincronizada con la respiración, con sonido opcional. Es el "patrón de oro" del segmento.
- **Cursos estructurados vs. singles:** combinan programas de varias semanas (mayor retención) con sesiones de un solo uso (atención del momento).
- **Cierre y retorno:** toda sesión termina con una micro-reflexión ("¿cómo te sientes ahora?") que produce sensación de progreso y genera el dato subjetivo de eficacia percibida.
- **Voz humana y producción de audio premium:** el tono de voz es el diferencial de marca; Insights Timer apostó por una biblioteca de voces de profesores.

### 4.2 Chatbots de salud mental

**Woebot, Wysa.** Basados en TCC, conversación por texto guiada, currículos cerrados de varias semanas. La evidencia que importa: **Leung et al. (2026)**, *BMJ Health Care Inform*, metaanálisis de 8 ECA (n=921) en población asiática: los chatbots **redujeron síntomas depresivos** (SMD -0,46; IC -0,76 a -0,16; p=0,002), pero **no se encontraron efectos significativos para la ansiedad, ni para el estrés**. No se reportaron eventos adversos.

**Implicación crítica para el producto:** la evidencia actual **no apoya** que un chatbot por sí solo reduzca la ansiedad de forma significativa. Si el producto quiere ser "lúdico-conversacional", debe apoyarse en técnicas con evidencia propia (respiración, grounding, relajación), no en la conversación como ingrediente activo. La conversación puede ser vehículo, no tratamiento.

### 4.3 Apps centradas en crisis de pánico y TCC digital

**Rootd, Sanvello, MindDoc.** Rootd se posiciona específicamente para ataques de pánico, con un "botón de pánico" en la pantalla principal y un recorrido guiado para crisis en curso. Sanvello y MindDoc combinan seguimiento de estado anímico, sesiones de TCC y, en algunos modelos, conexión con un profesional. Patrón común: **triage emocional en la entrada** y derivación a recursos humanos cuando los síntomas son graves.

### 4.4 Juegos puramente relajantes y el caso Tetris

**Finisterre, ABZU, Journey** son juegos "zen": sin amenaza, sin puntuación que castigue, ritmo lento, estética contemplativa y música ambiental reactiva. El patrón relevante es **ausencia de penalty** y la estética como mecanismo de regulación, no el desafío.

**El caso Tetris (lo más relevante de toda esta sección).** **Holmes et al. (2009)**, *PLoS One*, demostraron que jugar a Tetris **30 minutos** después de ver material traumático reducía la frecuencia de *flashbacks* durante la semana siguiente, sin afectar el recuerdo deliberado del evento. Es la prueba de concepto de la "vacuna cognitiva".

Los hallazgos que **deben** condicionar el diseño lúdico:
- **Holmes et al. (2010)**, *PLoS One*: compararon Tetris con **Pub Quiz**. Tetris **redujo** los flashbacks (a los 30 min y a las 4 h); Pub Quiz **aumentó** los flashbacks en el experimento 1. **Conclusión: no todos los juegos relajan; los juegos verbales pueden empeorar los síntomas.**
- **Kessler et al. (2020)**, *J Behav Ther Exp Psychiatry*: recordatorio + Tetris incluso **3 días** después del trauma redujo intrusiones (d=1,37 vs. solo recordatorio). El mecanismo es la **competencia por recursos de memoria de trabajo visoespacial**.
- **Kanstrup et al. (2021)**, *BMC Res Notes*: ECA clínico en urgencias, **terminado prematuramente por COVID** (N=16). Evidencia clínica todavía incompleta. **Ahmed Pihlgren et al. (2024)**, *Eur J Psychotraumatol*: los profesionales de salud valoraron la intervención como aceptable y útil (ICTI, NCT04460014).

**Traducción al producto:** la evidencia de Tetris es sobre **interferencia de memoria traumática**, no sobre "ansiedad generalizada de examen". La lección transferible y honesta es **el mecanismo**, no la indicación: una tarea **visoespacial, atencionalmente absorbente y sin componentes verbales rumiativos** puede regular la ansiedad mejor que un juego verbal o trivial. Un juego de patrones/colores suave y no punitivo es teóricamente superior a un trivia o un juego de palabras para este objetivo. **[AFIRMACIÓN A VALORAR: la extrapolación de "interferencia de flashback" a "ansiedad académica" es una hipótesis razonable, pero no está demostrada; presentarla como hipótesis de diseño, no como evidencia.]**

### 4.5 Patrones de UX comunes a replicar

| Fase | Patrón observado | Origen |
|---|---|---|
| **Llegada** | Pregunta emocional simple ("¿cómo estás?"), sin diagnóstico | Calm, Headspace, Sanvello |
| **Selección** | 3-5 técnicas presentadas por nombre cotidiano, no clínico | Rootd, Insight Timer |
| **Práctica** | Guía visual + audio opcional + progreso visible; el usuario siempre puede salir | Calm (círculo), Rootd |
| **Cierre** | Micro-evaluación "¿cómo te sientes ahora?" → sensación de progreso y dato de eficacia | Headspace, Sanvello |
| **Retorno** | Racha de días / "ha pasado X tiempo desde tu última práctica" | Headspace (streaks) |
| **Seguridad** | Botón de ayuda visible SIEMPRE, con recursos de crisis a un toque | Rootd, Calm |

**El patrón de "streak" (racha) es de doble filo:** retiene, pero puede generar ansiedad por "romper la racha" en exactamente la población a la que se dirige el producto. **Recomendación: implementar racha sin penalización visible por perderla, o no implementarla en la V1.**

---

## 5. Marco ético y de seguridad (no negociable)

### 5.1 Por qué la app NO es terapia y debe decirlo

**Razón legal y clínica.** La app no diagnostica, no establece una relación terapéutica, no es supervisada por un profesional en su uso cotidiano y no puede garantizar resultado clínico. La OMS (2026), aun reconociendo que las intervenciones psicológicas "pueden también accederse a través de manuales de autoayuda, sitios web y apps", las encuadra dentro del autocuidado y de intervenciones psicológicas supervisadas por profesionales. La diferencia entre "herramienta de autocuidado" y "tratamiento" es exactamente la línea que define la responsabilidad legal.

**Deber de la app.** Un aviso claro, permanente y en lenguaje sencillo, presente en la primera pantalla y en el aviso legal:
> "Esta app NO es un tratamiento médico ni psicológico, no diagnostica, y no sustituye la atención de un profesional. Si tus síntomas son graves o persistentes, busca ayuda profesional. Si tienes pensamientos de hacerte daño, llama a emergencias."

**El riesgo opuesto también existe.** Presentar la app como tratamiento (claims tipo "cura la ansiedad") genera responsabilidad por publicidad engañosa y por sustitución de atención necesaria. **No prometer outcomes clínicos es la medida de seguridad más barata y más eficaz del producto entero.**

### 5.2 Cuándo derivar a un profesional

**Señales de alarma que deben disparar derivación inmediata (protocolo obligatorio en la app):**
- **Ideación suicida** o pensamientos de hacerse daño, expresados de cualquier forma.
- **Crisis de pánico severa** en curso: dolor/opresión torácica, dificultad respiratoria severa, sensación de muerte inminente, desrealización intensa.
- **Síntomas que no ceden** tras la práctica de las técnicas.
- **Ansiedad que interfiere con la vida cotidiana** de forma sostenida (no poder ir a clases, no dormir, no alimentarse).
- **Aparición de sintomatología nueva y desconocida** para el usuario.

**Justificación estadística de la obligación de derivación:** Paiva et al. (2025) reportan en universitarios **ideación suicida a 12 meses del 10,76%** y vital del 20,33%; intento a 12 meses del 1,37%. Es decir, **aproximadamente 1 de cada 10 estudiantes que usen la app habrá tenido ideación en el último año**, y 1 de cada 5 en algún momento de la vida. No es un caso excepcional: es una probabilidad cierta en cada mil usuarios. El protocolo de derivación no es un formulario, es una **característica de seguridad central**.

**Diseño del protocolo:**
- Detección por palabras clave en cualquier campo de texto libre (entrada del usuario, journal, notas).
- Botón de ayuda **siempre visible** (no en un menú escondido).
- Pantalla de crisis de un toque, con recursos concretos (ver 5.3).
- **Nunca** un chatbot conversando con alguien en crisis. Mensaje humano, claro, con números.

### 5.3 Rutas de derivación en Bolivia

**Estado de verificación: INSUFICIENTE — debe completarse antes de la presentación.**

Lo que **no se pudo verificar** (prioridad alta):
- **Si existe un servicio de bienestar universitario o de psicología en la UAGRM**, con datos de contacto, horarios y protocolos. **[AFIRMACIÓN A VALIDAR — gestionar consulta formal con la Dirección de Bienestar Universitario de la UAGRM.]**
- Si existe una línea telefónica nacional de prevención del suicidio en Bolivia con número oficial vigente. **[AFIRMACIÓN A VALIDAR — gestionar verificación con el Ministerio de Salud y Deportes / SEDES Santa Cruz.]**
- La existencia y operatividad de servicios públicos de salud mental en Santa Cruz de la Sierra (centros de salud mental de la red pública, Caja Nacional de Salud). **[AFIRMACIÓN A VALIDAR.]**
- La existencia de legislación específica de salud mental en Bolivia. **[AFIRMACIÓN A VALIDAR: se tiene la referencia de que existe una ley específica de salud mental, pero no se verificó número, año ni contenido; no se debe citar hasta confirmar.]**

**Lo que se puede afirmar:** la OMS (2026) señala que los sistemas de salud deben proveer atención para la ansiedad en el nivel comunitario, y que la brecha de tratamiento es global (Alonso et al. 2018: 27,6% recibe tratamiento).

**Recomendación operativa:** la V1 de la app debe nacer con una **lista de derivación verificada y fechada** (UAGRM si existe, SEDES, Caja Nacional, líneas locales), construida y firmada por el equipo, y **actualizada cada semestre**. Una lista desactualizada o incorrecta es un riesgo mayor que no tenerla. Hasta no tenerla verificada, el botón de ayuda debe llevar a **recomendaciones de acción inmediata** (llamar a emergencias, acudir al centro de salud más cercano, hablar con una persona de confianza).

### 5.4 Consentimiento informado

Si se recolecta **cualquier** dato, se requiere consentimiento informado, explícito, previo y revocable. Elementos mínimos:
- **Qué** se recolecta, exactamente (ni más ni menos).
- **Para qué** se usa (y para qué **no**).
- **Dónde** se almacena (en el dispositivo o en un servidor; en qué país).
- **Quién** puede acceder.
- **Cuándo** se elimina (política de retención y mecanismo de borrado a un toque).
- Que **no recolectar datos es una opción** y que la app funciona igual de bien sin ello.

El consentimiento debe estar redactado en español neutro y claro, **no** como un muro legal de scroll. Para población 18-25 es razonable un formato "capas": resumen de 3 líneas + detalle expandible.

### 5.5 Privacidad: los datos de salud mental son una categoría especial

**Principio de base.** Los datos relativos a la salud **son una categoría especial (sensible)** en prácticamente todos los marcos de protección de datos del mundo (GDPR categoría 9 en Europa; en la región, leyes tipo LGPD y las leyes nacionales). En Bolivia la regulación de protección de datos personales existe, pero su aplicabilidad a datos de salud mental es un área gris. **[AFIRMACIÓN A VALIDAR: la Ley de Protección de Datos Personales boliviana y su alcance sobre datos de salud debe ser revisada por un abogado antes del lanzamiento.]**

**Reglas operativas recomendadas (decisión de arquitectura con consecuencia ética):**

| Dato | Se guarda | Dónde | Justificación |
|---|---|---|---|
| Selección de técnica elegida | Sí, agregado | Dispositivo | Mejorar recomendación |
| Respuesta "¿cómo te sientes?" pre/post | Sí | Dispositivo | Medir eficacia percibida |
| Texto libre escrito por el usuario (journal, pensamientos) | **Sólo si el usuario lo pide** | Dispositivo | Contenido sensible |
| Identificadores personales (correo, nombre) | **No en V1** | — | No son necesarios |
| Datos biométricos (cámara, VFC) | **No en V1** | — | Ver 3.10 |
| Historial clínico o diagnóstico | **Nunca** | — | Fuera de alcance |

**El principio rector:** si la app funciona enteramente en el navegador con persistencia local, **ningún dato de salud mental viaja a un servidor**. Esto reduce drásticamente la superficie de riesgo legal y ético. **Recomendación: diseñar V1 sin backend de datos de salud mental.** (Ver también sección 6.4.)

---

## 6. Viabilidad técnica en el navegador

### 6.1 Web Audio API

**Estado: BASELINE, ampliamente disponible** (MDN Web Docs: "Baseline — Widely available", disponible en todos los navegadores desde abril de 2021).

**Capacidades verificadas relevantes:**
- `OscillatorNode`: generación de tonos puros (seno, cuadrada, diente de sierra, triangular). Permite **sintetizar tonos binaurales sin archivos**: se generan dos osciladores a frecuencias ligeramente distintas (p. ej. 200 Hz izquierda, 210 Hz derecha) y se enrutan a canales distintos con `ChannelMergerNode`.
- `AudioParam` con programación temporal: permite cambios de volumen y frecuencia **precisos en el tiempo**, exactamente lo que se necesita para sincronizar audio con una animación de respiración.
- **Latencia:** MDN documenta que el control temporal es "de alta precisión y baja latencia", apto para máquinas de ritmo y secuenciadores. Para una app de respiración con eventos cada 4-10 segundos, la latencia de Web Audio es **intrascendente**.
- `AnalyserNode`: permite visualizar el audio en tiempo real (feedback reactivo).
- `AudioWorklet`: procesamiento de audio fuera del hilo principal, evitando cortes cuando la UI está ocupada.

**Tono binaural — honestidad sobre la evidencia.** La viabilidad **técnica** de generar tonos binaurales en el navegador está verificada. La **evidencia de su eficacia clínica** sobre la ansiedad es débil y heterogénea. **[AFIRMACIÓN A VALORAR: los tonos binaurales son un comodín de marketing, no una técnica validada; si se incluyen, debe ser como elemento estético opcional, nunca como claim terapéutico.]**

**Riesgo real:** el navegador **bloquea la reproducción de audio hasta que hay interacción del usuario** (política de autoplay). La app debe crear el `AudioContext` dentro de un manejador de clic/toque, no al cargar la página.

### 6.2 Vibración háptica (Vibration API)

**Estado: "Limited availability" — NO es Baseline.** MDN Web Docs la marca explícitamente como "This feature is not Baseline because it does not work in some of the most widely-used browsers".

**Implicación crítica y a menudo asumida por error:** la Vibration API **no está soportada en iOS/Safari**. En un público universitario con alta proporción de iPhone, **no se puede asumir el háptico**. Para una app de respiración que idealmente usaría vibración como señal rítmica (seguir el ritmo con los ojos cerrados), esto significa:
- Usar `navigator.vibrate()` solo como **mejora opcional** con detección de capacidad (`if ('vibrate' in navigator)`).
- **Nunca** como única señal de ritmo. La guía visual y/o sonora debe ser autosuficiente.

### 6.3 Detección de HRV por cámara

**No viable para V1.** Además de los argumentos clínicos de la sección 3.10, en el navegador la complejidad es alta: requiere permiso `getUserMedia`, procesamiento de fotogramas en `canvas` (o WebAssembly para rendimiento), manejo de FPS variables y de condiciones de luz. La evidencia de precisión (Bánhalmi 2018) es para **dedo sobre lente con muestreo a 240 Hz**, algo que una webcam genérica no garantiza. **Decisión: descartar.**

### 6.4 Persistencia local vs. backend

| | localStorage | IndexedDB | Backend |
|---|---|---|---|
| Capacidad | ~5-10 MB | Centenares de MB / GB | Ilimitada |
| Tipo de dato | Strings (clave-valor) | Estructurado, blobs, indices | Cualquiera |
| Asíncrono | No (bloquea hilo) | Sí | Sí |
| Búsqueda | No | Sí (índices) | Sí |
| Riesgo de privacidad | Bajo (dispositivo) | Bajo (dispositivo) | **Alto (datos sensibles en tránsito y reposo)** |
| Carga de mantenimiento | Nula | Baja | Alta (servidor, backups, seguridad, parches) |

**Recomendación alineada con ética y con el estado del código actual:**
- **V1: persistencia local únicamente** (IndexedDB para historial; localStorage para preferencias). Ningún dato de salud mental sale del dispositivo. Esto resuelve de raíz el problema de protección de datos de categoría especial.
- **Backend: solo para lo que no sea sensible** (si se necesita), p. ej. contenido estático, analítica agregada y anonimizada, o autenticación opcional.

### 6.5 Animación de respiración visual

**Dificultad real: BAJA-MEDIA.** Un círculo que crece y decrece siguiendo una curva de easing es CSS/SVG estándar. La complejidad **no** está en la animación, sino en tres aspectos que conviene anticipar:
1. **Sincronización con el audio** (no con `setInterval`, que deriva; usar `AudioContext.currentTime` como reloj maestro o Web Animations API con `currentTime`).
2. **Respeto a `prefers-reduced-motion`** — mandatorio en una app dirigida a personas ansiosas; parte de la población experimenta náusea o aumento de ansiedad con movimiento continuo.
3. **Feedback de fase** (inspiración vs. espiración) con redundancia: color **y** forma **y** texto **y** sonido, nunca solo color (ver 6.6).

### 6.6 Accesibilidad

Una app de respiración dirigida a población con discapacidad visual, daltonismo o sensibilidad al movimiento debe cumplir, como mínimo:

- **Daltonismo:** nunca codificar la fase respiratoria solo por color. Combinar color + forma + etiqueta de texto + sonido diferente (tono ascendente/descendente).
- **Baja visión / ceguera:** la guía **por audio debe ser plenamente funcional sin pantalla**. Texto a pantalla completa, alto contraste, soporte de lectores de pantalla (etiquetas `aria-live` que anuncien la fase), y un modo "solo audio" activable.
- **Sensibilidad al movimiento:** honrar `prefers-reduced-motion`; ofrecer un modo estático con instrucciones habladas.
- **Sordera / hipoacusia:** todo el contenido hablado con transcripción o representación visual equivalente.
- **Tamaño de toque:** botones grandes y separados (apropiados también para momentos de manos temblorosas por ansiedad).
- **No depender del conteo mental:** proveer guía rítmica redundante (visual + sonora + háptica opcional).

La accesibilidad **aumenta** la base de usuarios y, en este producto, es coherente con la misión. No es un extra.

---

## 7. Conclusiones y recomendaciones para el producto

### 7.1 El hallazgo estratégico: el código actual no es este producto

**El repositorio `/home/zovako/Documentos/psico` no contiene una app de regulación emocional.** Contiene **"Hubzy"** (equipo SynapseHub): una **arena de juego multijugador 1v1 gamificada para estudio**, con backend FastAPI, WebSockets para partidas en vivo, integración con Gemini (`gemini-1.5-flash`) para extraer 5 conceptos clave de un texto denso de estudio y construir un tablero de cartas, y frontend React + Vite + Tailwind. Su descripción literal es "Gamificación EdTech anti-estrés con Gemini, RAG y WebSockets".

**Implicación de diseño de producto:** el código actual resuelve un problema **diferente** — aprendizaje activo mediante juego competitivo —, no "llegué ansioso y necesito calmarme ahora". Aunque hay superposición superficial (gamificación, estética "zen", público universitario), la **arquitectura de la experiencia es opuesta**: una cosa es un juego competitivo de respuesta correcta/incorrecta con temporizador y turnos; otra muy distinta una intervención de regulación emocional individual, sin puntuación que castigue y sin presión temporal.

**Decisión pendiente (debe tomarse explícitamente):**
- **Opción A — Producto nuevo, reutilizando infraestructura:** conservar el stack (FastAPI, React, WebSockets, Docker) pero construir la experiencia de regulación desde cero. El WebSocket y Gemini **no son necesarios** para la V1 de regulación emocional (que es local y sin IA). Es la opción honesta y recomendada.
- **Opción B — Hibrido:** mantener Hubzy como "modo estudio" dentro de la app, y añadir un "modo calma" de regulación. Aceptable institucionalmente (une dos objetivos), pero diluye el enfoque y complica el mensaje a revisores éticos.
- **Opción C — Pivotar el código existente:** reescribir las arenas en ejercicios de respiración. **No recomendable**: la lógica competitiva, los turnos y las puntuaciones son exactamente los patrones que la evidencia desaconseja para regulación emocional (recordar Holmes 2010: la tarea verbal/competitiva **aumentó** los flashbacks).

**Recomendación:** Opción A. Declarar el repositorio actual como activo del proyecto de gamificación de estudio y abrir la app de regulación como producto enfocado, con su propia carpeta/servicio. Esto también **simplifica** la gobernanza de datos sensibles.

### 7.2 Las 4 técnicas ganadoras para una primera versión

Seleccionadas por la intersección de evidencia, aptitud para el "momento" y simplicidad de implementación:

**1. Respiración a ritmo fijo de 0,1 Hz (coherencia cardíaca / "365") — la técnica ancla.**
- **Justificación:** es la única con ECA directo sobre ansiedad (Sumińska et al. 2026) y con la validación extraña de que **el ritmo fijo es tan eficaz como el individualizado**, lo que elimina la necesidad de calibración. La OMS (2026) recomienda la respiración lenta como autocuidado. Implementación trivial (animación + cronómetro), cero riesgo, margen de mejora continuo.

**2. Grounding 5-4-3-2-1 — la técnica de crisis.**
- **Justificación:** es la mejor candidata para el momento agudo y para ataques de pánico incipientes, porque redirige toda la memoria de trabajo hacia los sentidos y corta la rumiación. Es la técnica más **interactiva** y, por tanto, la más diferenciable de un "cronómetro de respiración". Es además la que mejor encaja con el ADN lúdico del equipo: puede diseñarse como un mini-juego sensorial suave y no competitivo.

**3. Auto-compasión breve (Neff) — la técnica de cierre.**
- **Justificación:** es la que tiene evidencia en la población **exacta** del producto: Li et al. (2025), mujeres de 17-25 años, donde la escritura auto-compasiva superó a la respiración consciente. Ataca la autocrítica, el mantenedor más frecuente de la ansiedad de rendimiento en estudiantes perfeccionistas. Encaja perfectamente en la fase de **cierre** de la sesión ("¿cómo te sientes? → una frase amable").

**4. Relajación muscular progresiva de Jacobson (versión corta) — la técnica de evidencia robusta y profundidad.**
- **Justificación:** es la recomendada **expresamente por la OMS (2026)** y está en el metaanálisis con d=0,51 (Manzoni et al. 2008). Ataca la tensión muscular, síntoma nuclear de la ansiedad. Requiere audio (lo que justifica invertir en Web Audio API), y da a la app **profundidad** más allá de las dos técnicas rápidas. Es el contenido "sesión completa" para cuando el usuario tiene 8 minutos y privacidad.

**Técnicas que quedan fuera de la V1 (con razones):**
- **Reestructuración cognitiva micro:** no apta para el momento agudo y la tasa de abandono será alta; requiere usuario ya regulado. Reservar para V2.
- **4-7-8 (Weil):** evidencia propia débil; el 4-4-4-4 y el 0,1 Hz cubren el mismo espacio con mejor base.
- **Mindfulness breve:** solapa con respiración; incluir como **variante** del modo respiración, no como técnica separada, para no fragmentar la oferta.
- **Biofeedback por cámara:** no viable (3.10, 6.3).
- **Chatbot conversacional:** la evidencia muestra efecto sobre depresión, **no sobre ansiedad** (Leung et al. 2026); el chat no es el ingrediente activo.

### 7.3 Decisiones de diseño que la evidencia sugiere como obligatorias

1. **Botón de ayuda SIEMPRE visible** y pantalla de crisis a un toque. No es un extra: con ~10,76% de ideación a 12 meses en universitarios (Paiva 2025), es la característica que puede salvar una vida.
2. **Declaración explícita de "no es terapia"** en la primera pantalla, en lenguaje claro. Protege al usuario y al equipo.
3. **Triage emocional a la entrada** ("¿cómo te sientes?") con **derivación automática** si la respuesta indica crisis o ideación.
4. **Ninguna mecánica que castigue.** Sin puntuación que penalice, sin "game over", sin temporizadores opresivos. Holmes 2010 es la advertencia: los juegos **pueden empeorar** los síntomas.
5. **Redundancia de feedback** (visual + sonora + texto + háptica opcional) por daltonismo, baja visión y porque la Vibration API no funciona en iOS (MDN).
6. **`prefers-reduced-motion`** honrado por defecto.
7. **Audio creado tras interacción del usuario** (política de autoplay de los navegadores).
8. **Persistencia local exclusiva para datos de salud mental** (IndexedDB), sin backend sensible en V1. Consecuencia: consentimiento más simple, riesgo legal menor, app utilizable offline.
9. **Evaluación pre/post** ("¿cómo te sientes?" antes y después) en cada sesión. Es el dato de eficacia percibida, y lo que permitirá, con consentimiento y agregación, **generar la primera evidencia de salud mental de la UAGRM**.
10. **Sin streaks punitivas.** Si se incluye continuidad, que romperla no genere culpa.

### 7.4 Lo que la app NO debería hacer (límites éticos)

- **NO diagnosticar** ningún trastorno, ni siquiera con cuestionarios clínicos. No es su rol.
- **NO prometer resultados clínicos** ("elimina tu ansiedad", "cura el pánico"). Es publicidad engañosa y desplaza la atención profesional.
- **NO conversar con un usuario en crisis.** Protocolo humano y recursos, no diálogo algorítmico.
- **NO recolectar datos innecesarios**, en particular biométricos, de cámara, o de geolocalización. Identificadores personales: fuera de V1.
- **NO retener datos indefinidamente.** Política de borrado simple y revocable.
- **NO mantener un chatbot como ingrediente activo** presentándolo como tratamiento (Leung 2026: sin efecto significativo sobre ansiedad).
- **NO ignorar el contexto cultural:** el tono y el lenguaje deben ser neutros y respetuosos; no importar mecánicas ni narrativas de apps anglosajonas sin adaptación.
- **NO publicar sin una lista de derivación boliviana verificada y fechada.**

### 7.5 Ruta sugerida para los próximos pasos

1. **Solicitud formal a la UAGRM** (Bienestar Universitario / Dirección) para verificar la existencia del servicio de psicología y obtener contactos de derivación. **Bloqueante para presentación.**
2. **Verificación legal:** revisión por abogado de la ley boliviana de protección de datos aplicable a datos de salud mental.
3. **Validar y completar las afirmaciones marcadas como [AFIRMACIÓN A VALIDAR]** mediante búsqueda dirigida en SciELO, Lilacs, Redalyc y consulta con un psicólogo clínico local.
4. **Decidir el camino del código (7.1)** sobre la base de esta exploración y de la decisión de foco.
5. **Construir la V1** con las 4 técnicas ganadoras (7.2), las 10 decisiones obligatorias (7.3) y respetando los límites éticos (7.4).
6. **Establecer un canal de revisión clínica continua** (psicólogo asesor) antes y durante el desarrollo, no solo al final.
7. **Diseñar un protocolo de validación local** post-V1: piloto pequeño en la UAGRM con GAD-7 pre/post, aprobación ética formal, publicación de resultados.

---

## 8. Anexo: lista provisional de fuentes bibliográficas

> Esta lista recoge las referencias principales citadas en el documento. La numeración interna (referencias cruzadas) no está implementada; cada cita está nombrada en el texto por su autor principal y año. Antes de una presentación formal o publicación, **completar con DOIs, editoriales y enlaces verificables** y validar las marcadas con [AFIRMACIÓN A VALIDAR].

- Ahmed, G. K., et al. (2023). Prevalencia de ansiedad en estudiantes de pregrado: revisión sistemática y metaanálisis. *BMC Psychiatry*.
- Ahmed Pihlgren, A., et al. (2024). Acceptability of a brief cognitive task intervention in emergency services. *European Journal of Psychotraumatology*.
- Alonso, J., et al. (2018). Treatment gap for anxiety disorders is global: results of the World Mental Health Surveys. (Citado por OMS.)
- American Psychiatric Association (2022). *DSM-5-TR: Manual Diagnóstico y Estadístico de los Trastornos Mentales, 5ª ed., texto revisado*.
- Bánhalmi, A., et al. (2018). Heart Rate Variability from Smartphone Photoplethysmography. *Journal of Healthcare Engineering*.
- Beck, A. T. (1976). *Cognitive Therapy and the Emotional Disorders*.
- Holmes, E. A., et al. (2009). Can playing Tetris reduce intrusive memories? *PLoS One*.
- Holmes, E. A., et al. (2010). Comparing intrusive and non-intrusive memories. *PLoS One*.
- Jacobson, E. (1938). *Progressive Relaxation*.
- Kabat-Zinn, J. (1979). MBSR program.
- Kanstrup, M., et al. (2021). Tetris in emergency settings (ECAs). *BMC Research Notes*.
- Kessler, H., et al. (2020). Cueing trauma reminders + Tetris. *Journal of Behavior Therapy and Experimental Psychiatry*.
- Kim, J., et al. (2026). Prolonged exhalation and HRV. *Applied Psychophysiology and Biofeedback*.
- Leung, C., et al. (2026). Chatbots for mental health: meta-analysis. *BMJ Health Care Informatics*.
- Li, A., et al. (2025). Self-compassion writing in young women. *Journal of Psychosomatic Research*.
- Li, W., et al. (2022). Prevalence of anxiety in college students: meta-analysis. *Journal of Child Psychology and Psychiatry*.
- Liyanage, I., et al. (2021). Anxiety in university students during COVID-19: meta-analysis. *IJERPH*.
- Manzoni, G. M., et al. (2008). Relaxation training for anxiety: meta-analysis. *BMC Psychiatry*.
- MDN Web Docs. Web Audio API, Vibration API. (Baseline y Limited availability referencias.)
- Nam, Y., et al. (2014). Respiratory rate estimation from smartphone camera. *Annals of Biomedical Engineering*.
- Neff, K. (2003). Self-compassion construct and exercises.
- OMS (2026). *Trastornos de ansiedad* (página de salud mental).
- Paiva, U., et al. (2025). Umbrella review on anxiety and suicidal ideation in university students. *Neuroscience & Biobehavioral Reviews*.
- Porges, S. W. (1995, 2011). Polyvagal Theory.
- Servan-Schreiber, D. (2003). *Guérir / Curación emocional*. (Atribución del método 365 — a verificar.)
- Sumińska, M., et al. (2026). Fixed 0.1 Hz breathing vs individualized resonance frequency: RCT. *Scientific Reports*.
- Tyapochkin, K., et al. (2019). Camera-based HRV challenges. *IEEE EMBC*.
- Villca Villegas, J. L., et al. (2026). Redes sociales y ansiedad en estudiantes de medicina de Bolivia. *Vertex* 37(172):33-40.
- Wawrzyniak, M., et al. (2026). Sensory-relaxation interventions. *Public Health Reviews*.
- Weil, A. (2011). *Breathing for Life* (técnica 4-7-8).

---

## 9. Resumen ejecutivo

**El producto:** software lúdico web que ayuda a jóvenes de 18-25 años de la UAGRM a regular la ansiedad en el momento, mediante técnicas validadas por la evidencia.

**El hallazgo crítico:** no existe en la literatura revisada un estudio indexado sobre salud mental de estudiantes de la UAGRM; la única referencia boliviana es de la Universidad Franz Tamayo de Cochabamba (Villca Villegas 2026). Esta ausencia de datos es una oportunidad institucional: el proyecto puede generar la primera evidencia local, con instrumento validado y aprobación ética.

**Las 4 técnicas ganadoras de la V1:**
1. **Respiración 0,1 Hz** (coherencia cardíaca, 5,5s) — técnica ancla, ECA directo.
2. **Grounding 5-4-3-2-1** — técnica de crisis, mejor para pánico incipiente.
3. **Auto-compasión breve** (Neff) — técnica de cierre, evidencia en jóvenes 17-25.
4. **Jacobson versión corta** — técnica profunda, recomendada por OMS.

**Las 10 decisiones de diseño obligatorias** (resumidas en 7.3): botón de ayuda siempre visible, "no es terapia" explícito, triage emocional a la entrada, sin mecánicas que castiguen, redundancia sensorial, `prefers-reduced-motion`, audio tras interacción, persistencia local exclusiva, evaluación pre/post, sin streaks punitivas.

**El hallazgo técnico:** el navegador soporta todo lo necesario (Web Audio API, animación, IndexedDB, `aria-live`); la Vibration API **no funciona en iOS** y debe ser opcional; el biofeedback por cámara **no es viable** para la V1.

**El hallazgo ético y de seguridad:** ~10,76% de universitarios han tenido ideación suicida en los últimos 12 meses (Paiva 2025). El protocolo de crisis y la lista de derivación **no son opcionales** y deben existir **antes** de publicar la app. La lista de derivación boliviana debe estar verificada y fechada.

**El hallazgo estratégico:** el código actual (Hubzy) es EdTech gamificada de estudio. La app de regulación emocional tiene una arquitectura de experiencia **opuesta** (sin competencia, sin puntuación que castigue, sin presión temporal). **Recomendación: producto nuevo con stack reutilizado (Opción A de 7.1)**, no un pivote del código existente.

**Próximos pasos críticos:**
1. Verificar la existencia del servicio de psicología de la UAGRM (bloqueante).
2. Revisión legal de la ley de datos boliviana para salud mental.
3. Validar las afirmaciones pendientes en SciELO/Lilacs/Redalyc y con psicólogo clínico local.
4. Decisión de camino del código (7.1).
5. Diseño y construcción de la V1 con las 4 técnicas y las 10 decisiones.
6. Asesoría clínica continua desde el inicio, no solo al final.
7. Protocolo de validación post-V1 con GAD-7 y aprobación ética formal.
