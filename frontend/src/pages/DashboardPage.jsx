import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Folder, FolderPlus, Play, Wind, Crown, BookOpen, RefreshCw, LogOut, Trash2, Download,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { apiFetch, fetchWithAuth } from "../lib/api";
import { useAuthStore } from "../store/authStore";
import AnimatedCloudsBackground from "../components/AnimatedCloudsBackground";
import capyEscolar from "../assets/mascots/capy_escolar_nino_m.webp";

function FolderSkeleton() {
  return (
    <div className="animate-pulse rounded-arcade-lg bg-white/60 p-5 h-28 border-b-arcade-xl border-slate-200" />
  );
}

export default function DashboardPage() {
  const { t } = useTranslation();
  const { user, logout } = useAuthStore();
  const [folders, setFolders] = useState(null);
  const [zenStats, setZenStats] = useState(null);
  const [error, setError] = useState(null);
  const [plan, setPlan] = useState("free");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleDeleteAccount = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setDeleting(true);
    try {
      await apiFetch("/api/v1/users/me", { method: "DELETE" });
    } catch (e) {
      setError(e.message);
      setDeleting(false);
      setConfirmDelete(false);
      return;
    }
    logout();
  };

  const load = async () => {
    setError(null);
    try {
      const data = await apiFetch("/api/v1/folders");
      setFolders(data?.folders || []);
      if (data?.plan) setPlan(data.plan);
    } catch (e) {
      setError(e.message);
      setFolders([]);
    }
    try {
      const zs = await apiFetch("/api/v1/zen/stats");
      setZenStats(zs);
    } catch {
      setZenStats(null);
    }
  };

  useEffect(() => { load(); }, []);

  const username = user?.username || "Estudiante";
  const isPro = plan === "pro" || user?.plan === "pro";

  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-sky-300 via-sky-200 to-emerald-100 font-sans">
      <AnimatedCloudsBackground />

      <header className="relative z-30 flex items-center justify-between px-6 sm:px-10 py-5">
        <Link to="/" className="flex items-center gap-2">
          <img src={capyEscolar} alt="Hubzi" className="w-9 h-9 rounded-arcade-sm border-2 border-[var(--color-arcade-navy)] object-cover" />
          <span className="text-xl font-black uppercase text-[var(--color-arcade-navy)]">Hubzy</span>
        </Link>
        <div className="flex items-center gap-3">
          <Link to="/zen" className="rounded-arcade bg-white/70 px-4 py-2 text-xs font-black uppercase text-[var(--color-arcade-navy)] hover:bg-white">
            <Wind className="inline w-4 h-4 mr-1" /> {t("nav.zen")}
          </Link>
          <button
            onClick={logout}
            className="rounded-arcade bg-[var(--color-arcade-navy)] px-4 py-2 text-xs font-black uppercase text-white hover:bg-[var(--color-arcade-navy-hover)]"
          >
            <LogOut className="inline w-4 h-4 mr-1" /> {t("nav.logout")}
          </button>
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-5xl px-6 pb-20">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-3xl sm:text-4xl font-black text-[var(--color-arcade-navy)]">
            {t("dashboard.welcome", { name: username })}
          </h1>
          <p className="mt-1 font-semibold text-slate-600">{t("dashboard.subtitle")}</p>
        </motion.div>

        {/* Quick actions */}
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <Link
            to="/arena"
            className="flex items-center gap-3 rounded-arcade-lg bg-[var(--color-arcade-orange)] p-5 text-white border-b-arcade-xl border-[var(--color-arcade-orange-shadow)] shadow-lg hover:scale-[1.02] transition-transform"
          >
            <Play className="w-8 h-8" />
            <span className="font-black uppercase">{t("dashboard.continue")}</span>
          </Link>
          <Link
            to="/zen"
            className="flex items-center gap-3 rounded-arcade-lg bg-emerald-500 p-5 text-white border-b-arcade-xl border-emerald-700 shadow-lg hover:scale-[1.02] transition-transform"
          >
            <Wind className="w-8 h-8" />
            <div>
              <span className="font-black uppercase">{t("zen.title")}</span>
              {zenStats && (
                <p className="text-xs font-bold text-emerald-100">
                  {zenStats.total_sessions} {t("dashboard.zen_sessions").toLowerCase()}
                </p>
              )}
            </div>
          </Link>
          {!isPro ? (
            <Link
              to="/arena?upgrade=1"
              className="flex items-center gap-3 rounded-arcade-lg bg-[var(--color-arcade-navy)] p-5 text-white border-b-arcade-xl border-[var(--color-arcade-ink)] shadow-lg hover:scale-[1.02] transition-transform"
            >
              <Crown className="w-8 h-8 text-[var(--color-arcade-yellow)]" />
              <div>
                <span className="font-black uppercase">{t("dashboard.upgrade")}</span>
                <p className="text-xs font-bold text-amber-300">{t("dashboard.plan_free")}</p>
              </div>
            </Link>
          ) : (
            <div className="flex items-center gap-3 rounded-arcade-lg bg-gradient-to-r from-amber-400 to-orange-400 p-5 text-[var(--color-arcade-navy)] border-b-arcade-xl border-amber-600 shadow-lg">
              <Crown className="w-8 h-8" />
              <span className="font-black uppercase">{t("dashboard.plan_pro")}</span>
            </div>
          )}
        </div>

        {/* Folders */}
        <section className="mt-10">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-black uppercase text-[var(--color-arcade-navy)] flex items-center gap-2">
              <BookOpen className="w-5 h-5" /> {t("dashboard.my_folders")}
            </h2>
            <div className="flex gap-2">
              <button
                onClick={load}
                className="rounded-arcade-sm bg-white/70 p-2 text-[var(--color-arcade-navy)] hover:bg-white"
                aria-label={t("common.retry")}
              >
                <RefreshCw className="w-4 h-4" />
              </button>
              <Link
                to="/arena"
                className="inline-flex items-center gap-1 rounded-arcade-sm bg-[var(--color-arcade-navy)] px-3 py-2 text-xs font-black uppercase text-white"
              >
                <FolderPlus className="w-4 h-4" /> {t("dashboard.new_folder")}
              </Link>
            </div>
          </div>

          {error && (
            <div className="mt-4 rounded-arcade bg-rose-100 p-4 text-sm font-semibold text-rose-700">
              {t("common.error")}: {error}
              <button onClick={load} className="ml-3 underline">{t("common.retry")}</button>
            </div>
          )}

          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {folders === null ? (
              <>
                <FolderSkeleton /><FolderSkeleton /><FolderSkeleton />
              </>
            ) : folders.length === 0 ? (
              <div className="col-span-full rounded-arcade-lg bg-white/70 p-8 text-center">
                <Folder className="mx-auto w-10 h-10 text-slate-400" />
                <p className="mt-3 font-semibold text-slate-600">{t("dashboard.empty_folders")}</p>
                <Link
                  to="/arena"
                  className="mt-4 inline-flex items-center gap-2 rounded-arcade bg-[var(--color-arcade-orange)] px-5 py-2.5 text-sm font-black uppercase text-white border-b-arcade border-[var(--color-arcade-orange-shadow)]"
                >
                  <FolderPlus className="w-4 h-4" /> {t("dashboard.new_folder")}
                </Link>
              </div>
            ) : (
              folders.map((f) => (
                <Link
                  key={f.id}
                  to="/arena"
                  state={{ folderId: f.id }}
                  className="group rounded-arcade-lg bg-white/85 p-5 border-b-arcade-xl border-slate-200 shadow hover:scale-[1.02] transition-transform"
                >
                  <div className="flex items-center gap-3">
                    <div className="rounded-arcade bg-[var(--color-arcade-yellow)]/20 p-3">
                      <Folder className="w-6 h-6 text-[var(--color-arcade-orange)]" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="truncate font-black text-[var(--color-arcade-navy)]">{f.name}</h3>
                      <p className="text-xs font-semibold text-slate-500">
                        {(f.documents || []).length} docs · {(f.games || []).length} juegos
                      </p>
                    </div>
                  </div>
                </Link>
              ))
            )}
          </div>
        </section>

        {/* Portabilidad de datos — derecho a exportar */}
        <section className="mt-14 rounded-arcade-lg border-2 border-slate-200 bg-white/80 p-6">
          <h2 className="text-sm font-black uppercase tracking-wide text-[var(--color-arcade-navy)]">
            {t("dashboard.your_data", "Tus datos")}
          </h2>
          <p className="mt-1 text-xs font-semibold text-slate-500">
            {t(
              "dashboard.export_desc",
              "Descarga toda la información que Hubzy guarda de ti: perfil, carpetas, documentos y progreso de habilidades.",
            )}
          </p>
          <button
            onClick={async () => {
              try {
                const res = await fetchWithAuth("/api/v1/users/me/export");
                const data = await res.json();
                const blob = new Blob([JSON.stringify(data, null, 2)], {
                  type: "application/json",
                });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `hubzy-mis-datos-${new Date().toISOString().slice(0, 10)}.json`;
                a.click();
                URL.revokeObjectURL(url);
              } catch (err) {
                console.warn("Error exportando datos:", err);
              }
            }}
            className="mt-4 inline-flex items-center gap-2 rounded-arcade bg-slate-700 hover:bg-slate-600 px-4 py-2.5 text-xs font-black uppercase text-white border-b-arcade border-slate-900 transition-all"
          >
            <Download className="w-4 h-4" />
            {t("dashboard.export_data", "Descargar mis datos")}
          </button>
        </section>

        {/* Zona de peligro — derecho de supresión de datos */}
        <section className="mt-6 rounded-arcade-lg border-2 border-rose-200 bg-rose-50/80 p-6">
          <h2 className="text-sm font-black uppercase tracking-wide text-rose-700">
            {t("dashboard.danger_zone", "Zona de peligro")}
          </h2>
          <p className="mt-1 text-xs font-semibold text-rose-600">
            {t(
              "dashboard.delete_account_desc",
              "Eliminar tu cuenta borra permanentemente tu perfil, carpetas, documentos y datos de progreso. Esta acción no se puede deshacer.",
            )}
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              onClick={handleDeleteAccount}
              disabled={deleting}
              className={`inline-flex items-center gap-2 rounded-arcade px-4 py-2.5 text-xs font-black uppercase text-white transition-all ${
                confirmDelete
                  ? "bg-rose-600 hover:bg-rose-500 border-b-arcade border-rose-800"
                  : "bg-slate-600 hover:bg-slate-500 border-b-arcade border-slate-800"
              } disabled:opacity-50`}
            >
              <Trash2 className="w-4 h-4" />
              {deleting
                ? t("common.deleting", "Eliminando…")
                : confirmDelete
                  ? t("dashboard.confirm_delete", "Confirmar: borrar todo")
                  : t("dashboard.delete_account", "Eliminar mi cuenta")}
            </button>
            {confirmDelete && !deleting && (
              <button
                onClick={() => setConfirmDelete(false)}
                className="rounded-arcade bg-white px-4 py-2.5 text-xs font-black uppercase text-slate-600 border-b-arcade border-slate-300 hover:bg-slate-50"
              >
                {t("common.cancel", "Cancelar")}
              </button>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
