import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import {
  School,
  GraduationCap,
  Users,
  Copy,
  Check,
  Plus,
  BookOpen,
  BarChart3,
  ArrowLeft,
  X,
  Loader2,
  KeyRound,
  Palmtree,
  Star,
  CheckCircle2,
  FileText,
  AlertTriangle,
  Pin,
} from "lucide-react";
import { fetchWithAuth } from "../lib/api";

/**
 * Panel institucional de Hubzy para Colegios:
 *  - Sin institución: crear colegio (admin) o unirse con código (clase/prof).
 *  - Admin/docente: grados, códigos de matrícula, materias, panel de progreso.
 *  - Estudiante: sus grados y materias (solo lectura de estructura).
 *  Privacidad: el panel docente muestra SOLO métricas pedagógicas.
 */
export default function InstitutionModal({ isOpen, onClose }) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [instData, setInstData] = useState(null); // {institution, grades, role}
  const [view, setView] = useState("home"); // home | dashboard
  const [dashboard, setDashboard] = useState(null);
  const [dashLoading, setDashLoading] = useState(false);
  const [dashGrade, setDashGrade] = useState(null);
  const [schoolName, setSchoolName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [newGradeName, setNewGradeName] = useState("");
  const [newSubject, setNewSubject] = useState({}); // grade_id -> nombre materia
  const [copied, setCopied] = useState(null);
  const [busy, setBusy] = useState(false);
  // Asignación de tarea (docente): materia + isla opcional + fecha objetivo
  const [assignGrade, setAssignGrade] = useState(null); // grade_id abierto
  const [assignForm, setAssignForm] = useState({
    folder_id: "",
    island_id: "",
    title: "",
    due_date: "",
  });
  const [teacherFolders, setTeacherFolders] = useState(null);
  const [seatsInput, setSeatsInput] = useState("30");
  // Matrícula masiva (CSV pegado: "nombre[, edad][, contraseña]" por línea)
  const [enrollGrade, setEnrollGrade] = useState(null); // grade_id abierto
  const [enrollText, setEnrollText] = useState("");
  const [enrollResult, setEnrollResult] = useState(null); // credenciales generadas

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchWithAuth("/api/v1/institutions/mine");
      if (res.ok) setInstData(await res.json());
      else setInstData({ institution: null, grades: [], role: "individual" });
    } catch {
      setInstData({ institution: null, grades: [], role: "individual" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      setView("home");
      setDashboard(null);
      load();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const copy = async (text, tag) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(tag);
      setTimeout(() => setCopied(null), 1600);
    } catch {
      // Portapapeles no disponible (permiso denegado): el código sigue visible.
    }
  };

  const handleCreate = async () => {
    if (schoolName.trim().length < 3 || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetchWithAuth("/api/v1/institutions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: schoolName.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || "No se pudo crear la institución.");
      setNotice("¡Colegio creado! Comparte el código PROF- con tus docentes.");
      setSchoolName("");
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const handleJoin = async () => {
    if (!joinCode.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetchWithAuth("/api/v1/institutions/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: joinCode.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || "Código no válido.");
      setNotice(
        data.role === "student"
          ? `¡Matriculado en ${data.grade?.name}! Ya ves sus materias en tu baúl.`
          : "¡Bienvenido, docente! Ya puedes crear grados y materias.",
      );
      setJoinCode("");
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const handleCreateGrade = async () => {
    if (newGradeName.trim().length < 2 || busy || !instData?.institution) return;
    setBusy(true);
    try {
      const res = await fetchWithAuth(
        `/api/v1/institutions/${instData.institution.id}/grades`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: newGradeName.trim() }),
        },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || "No se pudo crear el grado.");
      setNewGradeName("");
      setNotice(`Grado creado — código de clase: ${data.grade.join_code}`);
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const handleCreateSubject = async (gradeId) => {
    const name = (newSubject[gradeId] || "").trim();
    if (name.length < 2 || busy) return;
    setBusy(true);
    try {
      const res = await fetchWithAuth(
        `/api/v1/institutions/grades/${gradeId}/folders`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name }),
        },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || "No se pudo crear la materia.");
      setNewSubject((p) => ({ ...p, [gradeId]: "" }));
      setNotice(`Materia "${name}" creada — súbele documentos desde tu baúl de carpetas.`);
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const loadTeacherFolders = async () => {
    if (teacherFolders !== null) return teacherFolders;
    try {
      const res = await fetchWithAuth("/api/v1/folders");
      const data = await res.json().catch(() => ({}));
      const list = res.ok ? data.folders || [] : [];
      setTeacherFolders(list);
      return list;
    } catch {
      setTeacherFolders([]);
      return [];
    }
  };

  const toggleAssign = async (grade) => {
    if (assignGrade === grade.id) {
      setAssignGrade(null);
      return;
    }
    setAssignForm({ folder_id: "", island_id: "", title: "", due_date: "" });
    setAssignGrade(grade.id);
    await loadTeacherFolders();
  };

  const handleAssign = async (grade) => {
    if (!assignForm.folder_id || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetchWithAuth(
        `/api/v1/institutions/grades/${grade.id}/assign`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            folder_id: assignForm.folder_id,
            island_id: assignForm.island_id || null,
            title: assignForm.title.trim(),
            due_date: assignForm.due_date || null,
          }),
        },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || "No se pudo asignar la tarea.");
      setNotice(t("school.assign_notice"));
      setAssignGrade(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const handleSchoolCheckout = async () => {
    const seats = parseInt(seatsInput, 10);
    if (!inst?.id || busy || !Number.isFinite(seats) || seats < 30) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetchWithAuth(
        `/api/v1/institutions/${inst.id}/checkout`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ seats }),
        },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || "No se pudo iniciar el pago.");
      if (data.checkout_url) window.location.href = data.checkout_url;
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  };

  const handleBulkEnroll = async (grade) => {
    if (busy) return;
    const rows = enrollText
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
      .map((l) => {
        const [username, age, password] = l.split(/[;,\t]/).map((s) => s.trim());
        return {
          username,
          age: age && /^\d+$/.test(age) ? parseInt(age, 10) : null,
          password: password || null,
        };
      })
      .filter((r) => r.username && r.username.length >= 2);
    if (!rows.length) {
      setError("Escribe al menos un nombre por línea.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetchWithAuth(
        `/api/v1/institutions/grades/${grade.id}/students/bulk`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ students: rows }),
        },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || "No se pudo matricular.");
      setEnrollResult(data.created || []);
      setEnrollText("");
      setNotice(
        `${data.count} estudiantes matriculados — reparte las credenciales.`,
      );
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const openReport = async (grade, studentId) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetchWithAuth(
        `/api/v1/institutions/grades/${grade.id}/students/${studentId}/report`,
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || "No se pudo generar el reporte.");
      printReport(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  // Reporte imprimible en ventana limpia (el diálogo de impresión guarda a PDF)
  const printReport = (r) => {
    const win = window.open("", "_blank", "width=720,height=900");
    if (!win) return;
    // La ventana comparte el origen — escapar todo lo interpolado (nombres
    // de estudiante/institución/materia vienen del usuario y del LLM).
    const esc = (v) =>
      String(v ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
    const rows = (r.student.subjects || [])
      .map(
        (s) => `
      <tr><td style="font-weight:700">${esc(s.subject)}</td>
      <td>${(s.islands || [])
        .map(
          (i) =>
            `${esc(i.island_name)}: Nivel ${i.current_level}/${i.total_levels} · ★${i.stars}${i.completed ? " ✓" : ""}`,
        )
        .join("<br>") || "—"}</td>
      <td>${s.folder_progress ? `Nivel ${s.folder_progress.current_level || 1} · ${s.folder_progress.total_xp || 0} XP` : "Sin actividad"}</td></tr>`,
      )
      .join("");
    win.document.write(`<!doctype html><html><head><meta charset="utf-8">
      <title>Reporte — ${esc(r.student.username)}</title>
      <style>body{font-family:system-ui,Arial;padding:32px;color:#0f172a}
      h1{font-size:20px} h2{font-size:13px;color:#475569;font-weight:600;margin:4px 0 20px}
      table{width:100%;border-collapse:collapse;font-size:13px}
      td{border:1px solid #cbd5e1;padding:8px;vertical-align:top}
      .foot{margin-top:24px;font-size:11px;color:#64748b}</style></head><body>
      <h1>${esc(r.institution.name)} — Reporte de aprendizaje</h1>
      <h2>Estudiante: <b>${esc(r.student.username)}</b> · Grado: ${esc(r.grade.name)} · Generado: ${new Date(r.generated_at).toLocaleDateString("es-ES")}</h2>
      <table><tr style="background:#f1f5f9"><td>Materia</td><td>Islas / temas</td><td>Progreso general</td></tr>${rows}</table>
      <p class="foot">Hubzy Escuelas — métricas pedagógicas de juego (niveles, estrellas, XP). Sin contenido emocional ni conversaciones.</p>
      </body></html>`);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 400);
  };

  const openDashboard = async (grade) => {
    setDashLoading(true);
    setError(null);
    setDashboard(null);
    setDashGrade(grade);
    setView("dashboard"); // el esqueleto se muestra mientras llega la data
    try {
      const res = await fetchWithAuth(
        `/api/v1/institutions/grades/${grade.id}/dashboard`,
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || "No se pudo cargar el panel.");
      setDashboard(data);
    } catch (e) {
      setError(e.message);
      setView("home");
    } finally {
      setDashLoading(false);
    }
  };

  // Prioridad docente: primero quien más necesita atención
  // (sin actividad > inactivo 7+ días > islas sin superar con 0★).
  const studentAlertScore = (s) => {
    const subjects = s.subjects || [];
    const noActivity = subjects.every(
      (x) => (x.islands || []).length === 0 && !x.folder_progress,
    );
    let stale = false;
    let zeroStars = 0;
    for (const sub of subjects) {
      for (const isl of sub.islands || []) {
        if (!isl.completed && (isl.stars || 0) === 0) zeroStars += 1;
        const lp = isl.last_played_at || sub.folder_progress?.last_played_at;
        if (lp && Date.now() - new Date(lp).getTime() > 7 * 86400000)
          stale = true;
      }
    }
    return (noActivity ? 4 : 0) + (stale ? 2 : 0) + Math.min(zeroStars, 3);
  };

  if (!isOpen) return null;

  const inst = instData?.institution;
  const role = instData?.role || "individual";
  const isStaff = role === "admin" || role === "teacher";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md select-none font-sans"
      role="dialog"
      aria-modal="true"
      aria-label={t("school.title")}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.92, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="relative w-full max-w-2xl max-h-[88vh] rounded-arcade-lg bg-[#f1f6fd] border-4 border-[var(--color-arcade-navy-dark)] text-slate-800 shadow-modal-2xl flex flex-col overflow-hidden"
      >
        {/* Cabecera */}
        <div className="p-5 border-b-arcade-xs border-[#bfd2ea] bg-[#e2ecf9] flex items-center justify-between">
          <div className="flex items-center gap-3">
            {view === "dashboard" && (
              <button
                onClick={() => setView("home")}
                className="p-2 rounded-arcade-sm bg-[var(--color-arcade-navy)] hover:bg-[var(--color-arcade-navy-hover)] border-2 border-[var(--color-arcade-navy-light)] cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
            <div className="w-10 h-10 rounded-arcade bg-[var(--color-arcade-yellow)]/15 border-2 border-[var(--color-arcade-yellow)]/50 flex items-center justify-center">
              <School className="w-5 h-5 text-[var(--color-arcade-yellow)]" />
            </div>
            <div>
              <h2 className="text-lg font-black uppercase tracking-wide">
                {view === "dashboard"
                  ? t("school.panel_title", { grade: dashGrade?.name || "—" })
                  : inst
                    ? inst.name
                    : t("school.title")}
              </h2>
              <p className="text-[11px] text-slate-500 font-bold">
                {role === "admin" && t("school.role_admin")}
                {role === "teacher" && t("school.role_teacher")}
                {role === "student" && t("school.role_student")}
                {!inst && t("school.subtitle")}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label={t("school.close_dialog")}
            className="p-2 rounded-arcade bg-[var(--color-arcade-navy)] hover:bg-rose-900/70 border-2 border-[var(--color-arcade-navy-light)] text-slate-300 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Mensajes */}
        {(error || notice) && (
          <div
            className={`mx-5 mt-3 p-2.5 rounded-arcade-sm text-xs font-bold text-center border-2 ${
              error
                ? "bg-rose-50 border-rose-300 text-rose-700"
                : "bg-emerald-50 border-emerald-300 text-emerald-700"
            }`}
          >
            {error || notice}
          </div>
        )}

        <div className="p-5 overflow-y-auto flex-1 space-y-4">
          {loading ? (
            <div className="py-14 flex items-center justify-center gap-2 text-slate-500 font-bold text-sm">
              <Loader2 className="w-5 h-5 animate-spin" /> {t("common.loading")}
            </div>
          ) : view === "dashboard" ? (
            /* ============ PANEL DOCENTE ============ */
            dashLoading || !dashboard ? (
              /* Esqueleto mientras carga el panel */
              <div className="space-y-3 animate-pulse" aria-busy="true">
                <div className="h-14 rounded-arcade bg-white border-2 border-slate-200" />
                {[...Array(4)].map((_, i) => (
                  <div
                    key={i}
                    className="h-20 rounded-arcade bg-white border-2 border-slate-200"
                  />
                ))}
                <p className="text-center text-xs text-slate-500 font-bold">
                  {t("school.dash_loading")}
                </p>
              </div>
            ) : (
            <>
              {(dashboard.weak_topics || []).length > 0 && (
                <div className="p-3.5 rounded-arcade bg-amber-50 border-2 border-amber-300">
                  <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wide text-amber-700 mb-2">
                    <Pin className="w-3 h-3" />
                    {t("school.weak_topics")}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {dashboard.weak_topics.slice(0, 8).map((topic, i) => (
                      <span
                        key={i}
                        className="px-2 py-0.5 rounded-lg bg-white border border-amber-300 text-[10px] font-bold text-amber-700"
                      >
                        {topic.topic} · {topic.students}{" "}
                        {topic.students !== 1
                          ? t("school.students_other")
                          : t("school.students_one")}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {dashboard.students.length === 0 ? (
                <div className="py-10 px-4 rounded-arcade-lg border-2 border-dashed border-slate-300 bg-white/70 text-center flex flex-col items-center gap-3">
                  <GraduationCap className="w-10 h-10 text-slate-400" />
                  <p className="text-sm text-slate-600 font-bold max-w-xs">
                    {t("school.no_students")}
                  </p>
                  <button
                    onClick={() => copy(dashGrade?.join_code, `dash_${dashGrade?.id}`)}
                    className="px-4 py-2 rounded-arcade-sm bg-cyan-50 hover:bg-cyan-100 border-2 border-cyan-300 font-mono font-black text-cyan-700 text-sm tracking-widest transition-all cursor-pointer"
                  >
                    {copied === `dash_${dashGrade?.id}` ? t("school.copied") : dashGrade?.join_code}
                  </button>
                  <p className="text-[10px] text-slate-500">
                    {t("school.copy_hint")}
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {[...dashboard.students]
                    .sort((a, b) => studentAlertScore(b) - studentAlertScore(a))
                    .map((s) => (
                    <div
                      key={s.student_id}
                      className="rounded-arcade bg-white border-2 border-slate-200 p-3.5"
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <GraduationCap className="w-4 h-4 text-cyan-700" />
                        <span className="font-black text-sm text-slate-800">
                          {s.username}
                        </span>
                        {studentAlertScore(s) >= 2 && (
                          <span
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-amber-50 border border-amber-300 text-[9px] font-black text-amber-700 uppercase"
                            title={t("school.needs_followup_title")}
                          >
                            <AlertTriangle className="w-2.5 h-2.5" />
                            {t("school.needs_followup")}
                          </span>
                        )}
                        <button
                          onClick={() => openReport(dashGrade, s.student_id)}
                          disabled={busy}
                          className="ml-auto flex items-center gap-1 px-2 py-0.5 rounded-lg bg-slate-100 hover:bg-slate-200 border border-slate-300 text-[10px] font-black text-slate-600 uppercase cursor-pointer disabled:opacity-50"
                          title={t("school.report_title")}
                        >
                          <FileText className="w-3 h-3" />
                          {t("school.report_btn")}
                        </button>
                      </div>
                      {s.subjects.every((x) => x.islands.length === 0 && !x.folder_progress) ? (
                        <p className="text-[11px] text-slate-500 font-bold">
                          {t("school.no_activity")}
                        </p>
                      ) : (
                        <div className="space-y-1.5">
                          {s.subjects.map((sub) => (
                            <div key={sub.folder_id} className="text-[11px]">
                              <span className="font-black text-slate-700 uppercase tracking-wide">
                                {sub.subject}
                              </span>
                              {sub.folder_progress && (
                                <span className="ml-2 inline-flex items-center gap-1 text-amber-600 font-bold">
                                  Nivel {sub.folder_progress.current_level || 1}
                                  {" · "}
                                  <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                                  {Object.values(
                                    sub.folder_progress.level_stars || {},
                                  ).reduce((a, b) => a + b, 0)}
                                  {" · "}
                                  {sub.folder_progress.total_xp || 0} XP
                                </span>
                              )}
                              {sub.islands.map((isl) => (
                                <div
                                  key={isl.island_id}
                                  className="mt-1 ml-3 flex items-center gap-2 text-slate-500"
                                >
                                  <Palmtree className="w-3.5 h-3.5 text-cyan-500 shrink-0" />
                                  <span className="font-bold">{isl.island_name}</span>
                                  <span className="text-slate-500">·</span>
                                  <span>
                                    {t("school.level_fmt", {
                                      current: isl.current_level,
                                      total: isl.total_levels,
                                    })}
                                  </span>
                                  <span className="inline-flex items-center gap-0.5 text-amber-400">
                                    <Star className="w-3 h-3 fill-amber-400" />{isl.stars}
                                  </span>
                                  {isl.completed && (
                                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                                  )}
                                </div>
                              ))}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </>
            )
          ) : !inst ? (
            /* ============ SIN INSTITUCIÓN ============ */
            <>
              <div className="p-4 rounded-arcade bg-white border-2 border-slate-200">
                <h3 className="font-black text-sm uppercase tracking-wide text-amber-600 mb-1.5 flex items-center gap-2">
                  <School className="w-4 h-4" /> {t("school.create_school_title")}
                </h3>
                <p className="text-[11px] text-slate-500 font-bold mb-3">
                  {t("school.create_school_desc")}
                </p>
                <div className="flex gap-2">
                  <input
                    value={schoolName}
                    onChange={(e) => setSchoolName(e.target.value)}
                    placeholder={t("school.create_school_ph")}
                    className="flex-1 rounded-arcade-sm bg-white border-2 border-slate-300 px-3 py-2 text-sm font-bold text-slate-800 placeholder:text-slate-500 outline-none focus:border-[var(--color-arcade-yellow)]"
                  />
                  <button
                    onClick={handleCreate}
                    disabled={busy || schoolName.trim().length < 3}
                    className="px-4 py-2 rounded-arcade-sm bg-[var(--color-arcade-orange)] hover:bg-[var(--color-arcade-orange-bright)] border-b-arcade border-b-[var(--color-arcade-orange-shadow)] font-black text-xs uppercase cursor-pointer disabled:opacity-50"
                  >
                    {t("school.create_btn")}
                  </button>
                </div>
              </div>
              <div className="p-4 rounded-arcade bg-white border-2 border-dashed border-slate-300">
                <h3 className="font-black text-sm uppercase tracking-wide text-cyan-700 mb-1.5 flex items-center gap-2">
                  <KeyRound className="w-4 h-4" /> {t("school.join_code_title")}
                </h3>
                <p className="text-[11px] text-slate-500 font-bold mb-3">
                  {t("school.join_code_desc")}
                </p>
                <div className="flex gap-2">
                  <input
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                    placeholder={t("school.join_code_ph")}
                    className="flex-1 rounded-arcade-sm bg-white border-2 border-slate-300 px-3 py-2 text-sm font-bold text-slate-800 placeholder:text-slate-500 outline-none focus:border-cyan-400 tracking-widest"
                  />
                  <button
                    onClick={handleJoin}
                    disabled={busy || !joinCode.trim()}
                    className="px-4 py-2 rounded-arcade-sm bg-cyan-600 hover:bg-cyan-500 border-b-arcade border-b-cyan-800 font-black text-xs uppercase cursor-pointer disabled:opacity-50"
                  >
                    {t("school.join_btn")}
                  </button>
                </div>
              </div>
            </>
          ) : (
            /* ============ VISTA DE INSTITUCIÓN ============ */
            <>
              {/* Licencia por seats (solo admin) */}
              {role === "admin" && (
                <div className="p-3.5 rounded-arcade bg-white border-2 border-slate-200">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-[10px] font-black uppercase text-slate-500">
                        {t("school.license_label")}
                      </p>
                      <p className="text-xs font-bold text-slate-800">
                        {inst.subscription?.status === "active" ? (
                          <>
                            <span className="text-emerald-600">
                              {t("school.license_active")}
                            </span>{" "}
                            —{" "}
                            {t("school.license_active_fmt", {
                              seats: inst.subscription.seats,
                            })}
                          </>
                        ) : (
                          <>
                            <span className="text-amber-600">
                              {t("school.license_trial")}
                            </span>{" "}
                            — {t("school.license_trial_fmt")}
                          </>
                        )}
                      </p>
                      <p className="text-[10px] text-slate-500 font-bold mt-0.5">
                        {t("school.enrolled_label")}:{" "}
                        {(instData?.grades || []).reduce(
                          (a, g) => a + (g.student_count ?? (g.student_ids || []).length),
                          0,
                        )}
                      </p>
                    </div>
                    {inst.subscription?.status !== "active" && (
                      <div className="flex items-center gap-1.5 shrink-0">
                        <input
                          type="number"
                          min={30}
                          value={seatsInput}
                          onChange={(e) => setSeatsInput(e.target.value)}
                          className="w-16 rounded-lg bg-white border-slate-300 px-2 py-1.5 text-[11px] font-bold text-slate-800 outline-none focus:border-emerald-400"
                          title={t("school.seats_title")}
                        />
                        <button
                          onClick={handleSchoolCheckout}
                          disabled={busy}
                          className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-emerald-950 border-b-arcade-xs border-b-emerald-700 text-[10px] font-black uppercase cursor-pointer disabled:opacity-50"
                          title={t("school.pay_title")}
                        >
                          {t("school.pay_btn")}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Código de docentes (solo staff) */}
              {isStaff && inst.teacher_code && (
                <div className="p-3.5 rounded-arcade bg-white border-2 border-slate-200 flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-black uppercase text-slate-500">
                      {t("school.teacher_code_label")}
                    </p>
                    <p className="font-black text-cyan-700 tracking-widest">
                      {inst.teacher_code}
                    </p>
                  </div>
                  <button
                    onClick={() => copy(inst.teacher_code, "prof")}
                    className="p-2 rounded-arcade-sm bg-slate-100 hover:bg-slate-200 border border-slate-300 cursor-pointer"
                    title={t("school.copy_title")}
                  >
                    {copied === "prof" ? (
                      <Check className="w-4 h-4 text-emerald-500" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </button>
                </div>
              )}

              {/* Unirse a otro grado (estudiantes ya dentro pueden sumar más) */}
              {!isStaff && (
                <div className="p-3.5 rounded-arcade bg-white border-2 border-dashed border-slate-300 flex gap-2">
                  <input
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                    placeholder={t("school.join_another_ph")}
                    className="flex-1 rounded-arcade-sm bg-white border-2 border-slate-300 px-3 py-2 text-xs font-bold text-slate-800 placeholder:text-slate-500 outline-none focus:border-cyan-400 tracking-widest"
                  />
                  <button
                    onClick={handleJoin}
                    disabled={busy || !joinCode.trim()}
                    className="px-3 py-2 rounded-arcade-sm bg-cyan-600 hover:bg-cyan-500 font-black text-[11px] uppercase cursor-pointer disabled:opacity-50"
                  >
                    {t("school.join_btn")}
                  </button>
                </div>
              )}

              {/* Lista de grados */}
              <div>
                <h3 className="font-black text-xs uppercase tracking-wider text-slate-600 mb-2 flex items-center gap-2">
                  <Users className="w-4 h-4 text-amber-500" /> {t("school.grades_title")}
                </h3>
                {(instData?.grades || []).length === 0 ? (
                  <p className="text-xs text-slate-500 font-bold py-3">
                    {isStaff
                      ? t("school.grades_empty_staff")
                      : t("school.grades_empty_student")}
                  </p>
                ) : (
                  <div className="space-y-2.5">
                    {instData.grades.map((g) => (
                      <div
                        key={g.id}
                        className="rounded-arcade bg-white border-2 border-slate-200 p-3.5"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <GraduationCap className="w-4 h-4 text-cyan-700 shrink-0" />
                            <span className="font-black text-sm text-slate-800 truncate">
                              {g.name}
                            </span>
                            <span className="text-[10px] font-bold text-slate-500 shrink-0">
                              {g.student_count ?? (g.student_ids || []).length}{" "}
                              {(g.student_count ?? (g.student_ids || []).length) !== 1
                                ? t("school.students_other")
                                : t("school.students_one")}{" "}
                              · {(g.folder_ids || []).length}{" "}
                              {(g.folder_ids || []).length !== 1
                                ? t("school.subjects_other")
                                : t("school.subjects_one")}
                            </span>
                          </div>
                          {isStaff && (
                            <div className="flex items-center gap-1.5 shrink-0">
                              <button
                                onClick={() => copy(g.join_code, g.id)}
                                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 border border-slate-300 text-[10px] font-black text-cyan-700 tracking-wider cursor-pointer"
                                title={t("school.join_code_title")}
                              >
                                {copied === g.id ? (
                                  <Check className="w-3 h-3 text-emerald-500" />
                                ) : (
                                  <Copy className="w-3 h-3" />
                                )}
                                {g.join_code}
                              </button>
                              <button
                                onClick={() => openDashboard(g)}
                                disabled={busy}
                                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 text-[10px] font-black text-emerald-700 uppercase cursor-pointer disabled:opacity-50"
                              >
                                <BarChart3 className="w-3 h-3" /> {t("school.panel_btn")}
                              </button>
                              <button
                                onClick={() => toggleAssign(g)}
                                disabled={busy || (g.folder_ids || []).length === 0}
                                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 border border-amber-300 text-[10px] font-black text-amber-700 uppercase cursor-pointer disabled:opacity-50"
                                title={
                                  (g.folder_ids || []).length === 0
                                    ? t("school.assign_no_subject")
                                    : t("school.assign_title_attr")
                                }
                              >
                                <Pin className="w-3 h-3" />
                                {t("school.assign_btn")}
                              </button>
                              <button
                                onClick={() => {
                                  setEnrollResult(null);
                                  setEnrollText("");
                                  setEnrollGrade(
                                    enrollGrade === g.id ? null : g.id,
                                  );
                                }}
                                disabled={busy}
                                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-cyan-50 hover:bg-cyan-100 border border-cyan-300 text-[10px] font-black text-cyan-700 uppercase cursor-pointer disabled:opacity-50"
                                title={t("school.csv_title")}
                              >
                                <Users className="w-3 h-3" /> {t("school.csv_btn")}
                              </button>
                            </div>
                          )}
                        </div>

                        {/* Matrícula masiva CSV (staff) */}
                        {isStaff && enrollGrade === g.id && (
                          <div className="mt-2.5 p-3 rounded-arcade-sm bg-cyan-50 border border-cyan-300 space-y-2">
                            <p className="text-[10px] font-black uppercase text-cyan-700">
                              {t("school.bulk_title")}
                            </p>
                            <textarea
                              value={enrollText}
                              onChange={(e) => setEnrollText(e.target.value)}
                              rows={4}
                              placeholder={t("school.bulk_ph")}
                              className="w-full rounded-lg bg-white border-slate-300 px-2.5 py-2 text-[11px] font-bold text-slate-800 placeholder:text-slate-500 outline-none focus:border-cyan-400 font-mono"
                            />
                            <p className="text-[10px] text-slate-500 font-bold">
                              {t("school.bulk_format")}
                            </p>
                            <div className="flex gap-2 justify-end">
                              <button
                                onClick={() => setEnrollGrade(null)}
                                className="px-3 py-1.5 rounded-lg text-[10px] font-black uppercase text-slate-500 hover:text-slate-800 cursor-pointer"
                              >
                                {t("school.close_btn")}
                              </button>
                              <button
                                onClick={() => handleBulkEnroll(g)}
                                disabled={busy || !enrollText.trim()}
                                className="px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 border-b-arcade-xs border-b-cyan-800 text-[10px] font-black uppercase cursor-pointer disabled:opacity-50"
                              >
                                {t("school.enroll_btn")}
                              </button>
                            </div>
                            {enrollResult && (
                              <div className="max-h-36 overflow-y-auto rounded-lg bg-white border border-emerald-300 p-2 space-y-1">
                                <div className="flex items-center justify-between">
                                  <p className="text-[10px] font-black text-emerald-700 uppercase">
                                    {t("school.creds_title")}
                                  </p>
                                  <button
                                    onClick={() =>
                                      copy(
                                        enrollResult
                                          .map(
                                            (c) =>
                                              `${c.username} → ${c.email} / ${c.password}`,
                                          )
                                          .join("\n"),
                                        "csv",
                                      )
                                    }
                                    className="text-[10px] font-black text-cyan-700 hover:text-cyan-800 cursor-pointer"
                                  >
                                    {copied === "csv" ? t("school.copied") : t("school.copy_all")}
                                  </button>
                                </div>
                                {enrollResult.map((c, i) => (
                                  <p key={i} className="text-[10px] font-mono text-slate-600">
                                    {c.username} → {c.email} / {c.password}
                                  </p>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                        {/* Crear materia dentro del grado (staff) */}
                        {isStaff && (
                          <div className="mt-2.5 flex gap-2">
                            <input
                              value={newSubject[g.id] || ""}
                              onChange={(e) =>
                                setNewSubject((p) => ({
                                  ...p,
                                  [g.id]: e.target.value,
                                }))
                              }
                              placeholder={t("school.new_subject_ph")}
                              className="flex-1 rounded-lg bg-white border-slate-300 px-2.5 py-1.5 text-[11px] font-bold text-slate-800 placeholder:text-slate-500 outline-none focus:border-cyan-400"
                            />
                            <button
                              onClick={() => handleCreateSubject(g.id)}
                              disabled={busy || (newSubject[g.id] || "").trim().length < 2}
                              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[var(--color-arcade-orange)] hover:bg-[var(--color-arcade-orange-bright)] border-b-arcade-xs border-b-[var(--color-arcade-orange-shadow)] text-[10px] font-black uppercase cursor-pointer disabled:opacity-50"
                            >
                              <Plus className="w-3 h-3" /> {t("school.subject_btn")}
                            </button>
                          </div>
                        )}

                        {/* Formulario de asignación 📌 (sin presión: es un objetivo visible, no un castigo) */}
                        {isStaff && assignGrade === g.id && (
                          <div className="mt-2.5 p-3 rounded-arcade-sm bg-amber-50 border border-amber-300 space-y-2">
                            <p className="text-[10px] font-black uppercase text-amber-700">
                              {t("school.assign_panel_title")}
                            </p>
                            <div className="grid grid-cols-2 gap-2">
                              <select
                                value={assignForm.folder_id}
                                onChange={(e) =>
                                  setAssignForm((p) => ({
                                    ...p,
                                    folder_id: e.target.value,
                                    island_id: "",
                                  }))
                                }
                                className="rounded-lg bg-white border-slate-300 px-2 py-1.5 text-[11px] font-bold text-slate-800 outline-none focus:border-amber-400"
                              >
                                <option value="">{t("school.subject_opt")}</option>
                                {(teacherFolders || [])
                                  .filter((f) => (g.folder_ids || []).includes(f.id))
                                  .map((f) => (
                                    <option key={f.id} value={f.id}>
                                      {f.subject || f.name}
                                    </option>
                                  ))}
                              </select>
                              <select
                                value={assignForm.island_id}
                                onChange={(e) =>
                                  setAssignForm((p) => ({
                                    ...p,
                                    island_id: e.target.value,
                                  }))
                                }
                                className="rounded-lg bg-white border-slate-300 px-2 py-1.5 text-[11px] font-bold text-slate-800 outline-none focus:border-amber-400"
                              >
                                <option value="">{t("school.all_subject_opt")}</option>
                                {(
                                  (teacherFolders || []).find(
                                    (f) => f.id === assignForm.folder_id,
                                  )?.islands || []
                                ).map((isl) => (
                                  <option key={isl.id} value={isl.id}>
                                    {isl.name}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div className="flex gap-2">
                              <input
                                value={assignForm.title}
                                onChange={(e) =>
                                  setAssignForm((p) => ({
                                    ...p,
                                    title: e.target.value,
                                  }))
                                }
                                placeholder={t("school.assign_ph")}
                                className="flex-1 rounded-lg bg-white border-slate-300 px-2 py-1.5 text-[11px] font-bold text-slate-800 placeholder:text-slate-500 outline-none focus:border-amber-400"
                              />
                              <input
                                type="date"
                                value={assignForm.due_date}
                                onChange={(e) =>
                                  setAssignForm((p) => ({
                                    ...p,
                                    due_date: e.target.value,
                                  }))
                                }
                                className="rounded-lg bg-white border-slate-300 px-2 py-1.5 text-[11px] font-bold text-slate-800 outline-none focus:border-amber-400"
                              />
                            </div>
                            <div className="flex gap-2 justify-end">
                              <button
                                onClick={() => setAssignGrade(null)}
                                className="px-3 py-1.5 rounded-lg text-[10px] font-black uppercase text-slate-500 hover:text-slate-800 cursor-pointer"
                              >
                                {t("common.cancel")}
                              </button>
                              <button
                                onClick={() => handleAssign(g)}
                                disabled={busy || !assignForm.folder_id}
                                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-amber-950 border-b-arcade-xs border-b-amber-700 text-[10px] font-black uppercase cursor-pointer disabled:opacity-50"
                              >
                                <Pin className="w-3 h-3" />
                                {t("school.assign_submit")}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Crear grado (staff) */}
              {isStaff && (
                <div className="p-3.5 rounded-arcade bg-white border-2 border-dashed border-slate-300">
                  <p className="text-[10px] font-black uppercase text-slate-500 mb-2 flex items-center gap-1.5">
                    <Plus className="w-3.5 h-3.5" /> {t("school.new_grade_label")}
                  </p>
                  <div className="flex gap-2">
                    <input
                      value={newGradeName}
                      onChange={(e) => setNewGradeName(e.target.value)}
                      placeholder={t("school.new_grade_ph")}
                      className="flex-1 rounded-arcade-sm bg-white border-2 border-slate-300 px-3 py-2 text-xs font-bold text-slate-800 placeholder:text-slate-500 outline-none focus:border-[var(--color-arcade-yellow)]"
                    />
                    <button
                      onClick={handleCreateGrade}
                      disabled={busy || newGradeName.trim().length < 2}
                      className="px-4 py-2 rounded-arcade-sm bg-[var(--color-arcade-yellow)] hover:bg-[#ffbf1a] text-[var(--color-arcade-navy)] border-b-arcade border-b-[var(--color-arcade-yellow-shadow)] font-black text-xs uppercase cursor-pointer disabled:opacity-50"
                    >
                      {t("school.new_grade_btn")}
                    </button>
                  </div>
                </div>
              )}

              <p className="text-[10px] text-slate-500 font-bold text-center pt-1">
                <BookOpen className="w-3.5 h-3.5 inline mr-1" />
                {t("school.footer_note")}
              </p>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}
