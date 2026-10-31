import React, { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Lock, Eye, EyeOff, CheckCircle2, AlertCircle } from 'lucide-react';

/**
 * Destino del enlace de recuperación: /reset-password?token=...
 * Canjea el token por una contraseña nueva vía /api/v1/auth/reset-password.
 */
export default function ResetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get('token');

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const [done, setDone] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg(null);
    if (password.length < 8) {
      setErrorMsg('La contraseña debe tener al menos 8 caracteres.');
      return;
    }
    if (password !== confirm) {
      setErrorMsg('Las contraseñas no coinciden.');
      return;
    }
    setIsLoading(true);
    try {
      const res = await fetch('/api/v1/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, new_password: password }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setDone(true);
      } else {
        setErrorMsg(data.detail || 'El enlace es inválido o expiró.');
      }
    } catch {
      setErrorMsg('No se pudo contactar al servidor.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="w-screen h-screen flex items-center justify-center bg-[var(--color-arcade-navy-dark)] text-white">
        <p className="text-slate-300">Este enlace no contiene un token válido.</p>
      </div>
    );
  }

  return (
    <div className="w-screen h-screen flex items-center justify-center bg-[var(--color-arcade-navy-dark)] text-white font-sans">
      <div className="max-w-sm w-full mx-4 p-8 rounded-arcade-lg bg-[var(--color-arcade-navy)] border-4 border-[var(--color-arcade-navy-dark)] shadow-modal-lg">
        {done ? (
          <div className="text-center">
            <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto mb-4" />
            <h1 className="text-xl font-black uppercase tracking-wide mb-2">¡Contraseña actualizada!</h1>
            <p className="text-sm text-slate-300 mb-6">Ya puedes iniciar sesión con tu nueva contraseña.</p>
            <Link
              to="/"
              className="inline-block px-6 py-3 rounded-arcade bg-[var(--color-arcade-orange)] border-b-arcade border-[var(--color-arcade-orange-shadow)] font-black text-xs uppercase tracking-wider hover:bg-[var(--color-arcade-orange-bright)] transition-colors"
            >
              Ir a iniciar sesión
            </Link>
          </div>
        ) : (
          <>
            <h1 className="text-xl font-black uppercase tracking-wide mb-1">Nueva contraseña</h1>
            <p className="text-xs text-slate-400 mb-5">Elige una contraseña segura de al menos 8 caracteres.</p>

            {errorMsg && (
              <div className="mb-4 p-3 rounded-arcade-sm bg-rose-950/80 border border-rose-500/60 text-rose-200 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-3.5">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-300 mb-1">
                  Nueva contraseña
                </label>
                <div className="relative">
                  <input
                    type={show ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-3.5 py-2.5 pr-10 rounded-arcade-sm bg-slate-900/90 border border-slate-700 focus:border-amber-400 focus:outline-none text-white text-xs"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShow(!show)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-200 cursor-pointer"
                  >
                    {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-300 mb-1">
                  Confirmar contraseña
                </label>
                <input
                  type={show ? 'text' : 'password'}
                  required
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-arcade-sm bg-slate-900/90 border border-slate-700 focus:border-amber-400 focus:outline-none text-white text-xs"
                  placeholder="••••••••"
                />
              </div>
              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3.5 rounded-arcade bg-[var(--color-arcade-orange)] hover:bg-[var(--color-arcade-orange-bright)] border-b-arcade border-[var(--color-arcade-orange-shadow)] text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-all disabled:opacity-50"
              >
                <Lock className="w-4 h-4" />
                {isLoading ? 'Guardando…' : 'Guardar nueva contraseña'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
