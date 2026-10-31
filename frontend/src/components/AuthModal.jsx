import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Mail, 
  Lock, 
  User, 
  Eye, 
  EyeOff, 
  LogIn, 
  UserPlus, 
  ShieldCheck, 
  Heart, 
  AlertCircle,
  GraduationCap,
  Volume2,
  X
} from 'lucide-react';
import capyEscolar from '../assets/mascots/capy_escolar_nino_m.webp';
import { fetchWithAuth } from '../lib/api';
import { useAuthStore } from '../store/authStore';
import { useTranslation } from 'react-i18next';

export default function AuthModal({ isOpen, onClose, onAuthSuccess }) {
  const { t } = useTranslation();
  const [mode, setMode] = useState('login'); // 'login' | 'register' | 'forgot'
  
  // Estados de formulario
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [gender, setGender] = useState('masculino');
  const [age, setAge] = useState('14');
  const [parentalConsent, setParentalConsent] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Estados de UI
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  if (!isOpen) return null;

  const isMaleUser = gender === 'masculino';
  const assignedVoiceLabel = t(isMaleUser ? 'auth.voice_assigned_f' : 'auth.voice_assigned_m');

  const handleToggleMode = (newMode) => {
    setMode(newMode);
    setErrorMsg(null);
    setSuccessMsg(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@') || !cleanEmail.includes('.')) {
      setErrorMsg(t('auth.err_email'));
      return;
    }

    if (mode === 'forgot') {
      setIsLoading(true);
      try {
        const res = await fetchWithAuth('/api/v1/auth/forgot-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: cleanEmail })
        });
        const data = await res.json().catch(() => ({}));
        setSuccessMsg(
          data.detail || t('auth.recover_sent')
        );
      } catch {
        setErrorMsg(t('auth.err_send'));
      } finally {
        setIsLoading(false);
      }
      return;
    }

    if (!password || password.length < 6) {
      setErrorMsg(t('auth.err_pass'));
      return;
    }

    if (mode === 'register') {
      if (!username.trim() || username.trim().length < 2) {
        setErrorMsg(t('auth.err_name'));
        return;
      }
      const numAge = parseInt(age, 10);
      if (isNaN(numAge) || numAge < 5 || numAge > 30) {
        setErrorMsg(t('auth.err_age'));
        return;
      }
      if (numAge <= 10 && !parentalConsent) {
        setErrorMsg(t('auth.err_consent'));
        return;
      }
    }

    setIsLoading(true);

    try {
      const endpoint = mode === 'login' ? '/api/v1/auth/login' : '/api/v1/auth/register';
      const bodyData = mode === 'login' 
        ? { email: cleanEmail, password } 
        : {
            email: cleanEmail,
            password,
            username: username.trim(),
            gender,
            age: parseInt(age, 10),
            avatar: 'capy_fan',
            voice_preference: 'auto',
            parental_consent: parseInt(age, 10) <= 10 ? parentalConsent : undefined
          };

      const res = await fetchWithAuth(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyData)
      });

      const data = await res.json();

      if (res.ok && data.user) {
        setSuccessMsg(t(mode === 'login' ? 'auth.welcome_back' : 'auth.created'));
        
        // Guardar token y usuario (store global + claves legadas)
        useAuthStore.getState().setSession({ user: data.user, token: data.token });
        if (data.token) {
          localStorage.setItem('hubzy_auth_token', data.token);
        }
        localStorage.setItem('hubzy_current_user', JSON.stringify(data.user));

        setTimeout(() => {
          onAuthSuccess(data.user);
        }, 500);
      } else {
        setErrorMsg(data.detail || t('auth.err_generic'));
      }
    } catch (err) {
      console.warn("Error en autenticación API, intentando fallback:", err);
      // Fallback local en caso de desconexión momentánea de red
      const fallbackUser = {
        id: `user_${cleanEmail.replace(/[^a-zA-Z0-9]/g, '_')}`,
        email: cleanEmail,
        username: mode === 'register' ? username.trim() : cleanEmail.split('@')[0],
        gender: mode === 'register' ? gender : 'masculino',
        age: mode === 'register' ? parseInt(age, 10) : 14,
        avatar: 'capy_fan',
        voice_preference: 'auto',
        assigned_voice_gender: (mode === 'register' ? gender : 'masculino') === 'masculino' ? 'female' : 'male',
        created_at: new Date().toISOString()
      };
      localStorage.setItem('hubzy_current_user', JSON.stringify(fallbackUser));
      useAuthStore.getState().setUser(fallbackUser);
      setSuccessMsg(t('auth.local_ok'));
      setTimeout(() => {
        onAuthSuccess(fallbackUser);
      }, 500);
    } finally {
      setIsLoading(false);
    }
  };

  const getAgeCategory = (numAge) => {
    if (numAge <= 7) return t('auth.band_1');
    if (numAge <= 10) return t('auth.band_2');
    if (numAge <= 14) return t('auth.band_3');
    if (numAge <= 18) return t('auth.band_4');
    if (numAge <= 25) return t('auth.band_5');
    return t('auth.band_6');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, scale: 0.92, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.92, y: 20 }}
        className="stage-modal-panel relative w-full max-w-md rounded-arcade-lg bg-[var(--color-arcade-navy)] border-4 border-[var(--color-arcade-navy-dark)] p-6 sm:p-7 text-white shadow-[0_12px_0_var(--color-arcade-ink),0_20px_35px_rgba(0,0,0,0.6)] overflow-y-auto max-h-[94dvh]"
      >
        {/* Glow de fondo */}
        <div className="absolute inset-0 overflow-hidden rounded-arcade-lg pointer-events-none">
          <div className="absolute -top-20 -right-20 w-48 h-48 bg-[var(--color-arcade-orange)]/15 rounded-full blur-3xl" />
          <div className="absolute -bottom-20 -left-20 w-48 h-48 bg-[var(--color-arcade-green)]/15 rounded-full blur-3xl" />
        </div>

        {/* Botón Cerrar (X) */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 z-30 p-2 rounded-arcade bg-[var(--color-arcade-navy-dark)] hover:bg-[var(--color-arcade-navy-hover)] border-2 border-[var(--color-arcade-navy-light)] text-slate-300 hover:text-white shadow-hud active:translate-y-0.5 active:shadow-none transition-all cursor-pointer"
          title={t('auth.close')}
        >
          <X className="w-5 h-5 stroke-[2.5]" />
        </button>

        {/* Header con Capibara y Título */}
        <div className="flex items-center gap-3.5 mb-5 pb-4 border-b-arcade-xs border-[var(--color-arcade-navy-light)]">
          <div className="relative w-14 h-14 rounded-arcade overflow-hidden border-3 border-[var(--color-arcade-yellow)] shadow-btn-yellow shrink-0 bg-[var(--color-arcade-navy-dark)]">
            <img src={capyEscolar} alt="Hubzi Guardián" className="w-full h-full object-cover scale-105" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-sans font-black uppercase text-[var(--color-arcade-yellow)] tracking-wider">
                {t('auth.portal_chip')}
              </span>
              <span className="px-2 py-0.5 rounded-full bg-[var(--color-arcade-navy-dark)] border-2 border-[var(--color-arcade-navy-light)] text-[9px] font-black text-white uppercase tracking-wider">
                HUBZI ARENA
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-white tracking-wide mt-0.5 drop-shadow">
              {t(mode === 'login' ? 'auth.login' : mode === 'register' ? 'auth.register' : 'auth.recover')}
            </h2>
          </div>
        </div>

        {/* Selector de Pestañas (Login / Registro estilo Card Clash) */}
        {mode !== 'forgot' && (
        <div className="grid grid-cols-2 p-1.5 rounded-arcade bg-[var(--color-arcade-navy-dark)] border-3 border-[var(--color-arcade-navy-light)] mb-5">
          <button
            type="button"
            onClick={() => handleToggleMode('login')}
            className={`py-2.5 rounded-arcade-sm text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer ${
              mode === 'login'
                ? 'bg-[var(--color-arcade-orange)] text-white border-b-arcade-sm border-[var(--color-arcade-orange-shadow)] shadow-btn-arcade-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <LogIn className="w-4 h-4" />
            <span>{t('auth.tab_login')}</span>
          </button>
          <button
            type="button"
            onClick={() => handleToggleMode('register')}
            className={`py-2.5 rounded-arcade-sm text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer ${
              mode === 'register'
                ? 'bg-[var(--color-arcade-green)] text-white border-b-arcade-sm border-[var(--color-arcade-green-shadow)] shadow-btn-arcade-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <UserPlus className="w-4 h-4" />
            <span>{t('auth.tab_register')}</span>
          </button>
        </div>
        )}

        {/* Cabecera del modo recuperación */}
        {mode === 'forgot' && (
          <div className="mb-4 p-3 rounded-arcade-sm bg-[var(--color-arcade-navy-dark)] border border-[var(--color-arcade-navy-light)] text-xs text-slate-300 leading-snug">
            {t('auth.forgot_note')}
          </div>
        )}

        {/* Mensajes de Alerta / Éxito */}
        <AnimatePresence>
          {errorMsg && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-4 p-3 rounded-arcade-sm bg-rose-950/80 border border-rose-500/60 text-rose-200 text-xs flex items-center gap-2.5"
            >
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span className="leading-snug">{errorMsg}</span>
            </motion.div>
          )}

          {successMsg && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-4 p-3 rounded-arcade-sm bg-emerald-950/80 border border-emerald-500/60 text-emerald-200 text-xs flex items-center gap-2.5"
            >
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
              <span className="leading-snug">{successMsg}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Formulario */}
        <form onSubmit={handleSubmit} className="space-y-3.5">
          
          {/* Campo Nombre de Usuario (Solo en Registro) */}
          {mode === 'register' && (
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-300 mb-1 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-purple-400" />
                <span>{t('auth.username')}</span>
              </label>
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder={t('auth.username_ph')}
                className="w-full px-3.5 py-2.5 rounded-arcade-sm bg-slate-900/90 border border-slate-700 focus:border-purple-400 focus:outline-none text-white text-xs font-medium placeholder:text-slate-500 transition-colors"
              />
            </div>
          )}

          {/* Campo Correo Electrónico */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-300 mb-1 flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5 text-cyan-400" />
              <span>{t('auth.email')}</span>
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t('auth.email_ph')}
              className="w-full px-3.5 py-2.5 rounded-arcade-sm bg-slate-900/90 border border-slate-700 focus:border-cyan-400 focus:outline-none text-white text-xs font-medium placeholder:text-slate-500 transition-colors"
            />
          </div>

          {/* Campo Contraseña con Toggle de Ojo (oculto en modo forgot) */}
          {mode !== 'forgot' && (
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-300 mb-1 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-amber-400" />
                <span>{t('auth.password')}</span>
              </span>
              {mode === 'register' && (
                <span className="text-[10px] text-slate-400 font-normal">{t('auth.password_ph')}</span>
              )}
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3.5 py-2.5 pr-10 rounded-arcade-sm bg-slate-900/90 border border-slate-700 focus:border-amber-400 focus:outline-none text-white text-xs placeholder:text-slate-500 transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
                title={showPassword ? t('auth.hide_pass') : t('auth.show_pass')}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {mode === 'login' && (
              <button
                type="button"
                onClick={() => handleToggleMode('forgot')}
                className="mt-1.5 text-[10px] font-bold text-slate-400 hover:text-cyan-300 transition-colors cursor-pointer"
              >
                {t('auth.forgot')}
              </button>
            )}
          </div>
          )}

          {/* Opciones de Perfil (Solo en Registro) */}
          {mode === 'register' && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="space-y-3 pt-1 border-t border-slate-800"
            >
              {/* Selector de Género */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                  {t('auth.sex_label')}
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setGender('masculino')}
                    className={`py-2 px-3 rounded-arcade-sm border text-xs font-bold transition-all text-left flex items-center justify-between cursor-pointer ${
                      gender === 'masculino'
                        ? 'bg-sky-950/80 border-sky-400 text-sky-200 shadow-sm'
                        : 'bg-slate-900/60 border-slate-700 text-slate-400 hover:border-slate-600'
                    }`}
                  >
                    <span>{t('auth.male')}</span>
                    <span className="text-[9px] text-pink-400">{t('auth.voice_f')}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setGender('femenino')}
                    className={`py-2 px-3 rounded-arcade-sm border text-xs font-bold transition-all text-left flex items-center justify-between cursor-pointer ${
                      gender === 'femenino'
                        ? 'bg-rose-950/80 border-rose-400 text-rose-200 shadow-sm'
                        : 'bg-slate-900/60 border-slate-700 text-slate-400 hover:border-slate-600'
                    }`}
                  >
                    <span>{t('auth.female')}</span>
                    <span className="text-[9px] text-cyan-400">{t('auth.voice_m')}</span>
                  </button>
                </div>
              </div>

              {/* Selector de Edad (Rango de 5 a 30 años — bandas adaptativas) */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1">
                    <GraduationCap className="w-3.5 h-3.5 text-emerald-400" />
                    <span>{t('auth.age')} <strong className="text-amber-300 font-extrabold">{age} {t('auth.years')}</strong></span>
                  </label>
                  <span className="text-[10px] text-slate-400 font-medium text-right">
                    {getAgeCategory(parseInt(age, 10))}
                  </span>
                </div>
                <input
                  type="range"
                  min="5"
                  max="30"
                  step="1"
                  value={age}
                  onChange={(e) => setAge(e.target.value)}
                  className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
                />
                <div className="flex justify-between text-[9px] text-slate-500 font-bold px-0.5 mt-0.5">
                  <span>5 {t('auth.years')}</span>
                  <span>17 {t('auth.years')}</span>
                  <span>30 {t('auth.years')}</span>
                </div>
              </div>

              {/* Consentimiento parental — obligatorio para menores de 11 */}
              {parseInt(age, 10) <= 10 && (
                <label className="flex items-start gap-2.5 p-3 rounded-arcade-sm bg-amber-500/10 border border-amber-400/40 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={parentalConsent}
                    onChange={(e) => setParentalConsent(e.target.checked)}
                    className="mt-0.5 w-4 h-4 accent-amber-400 cursor-pointer"
                  />
                  <span className="text-[11px] text-amber-200 leading-snug">
{t('auth.consent')}
                  </span>
                </label>
              )}

              {/* Indicador de voz complementaria asignada */}
              <div className="p-2.5 rounded-arcade-sm bg-slate-950/80 border border-slate-800 flex items-center gap-2">
                <Volume2 className="w-4 h-4 text-cyan-400 shrink-0" />
                <span className="text-[11px] text-slate-300 font-medium">
                  {t('auth.voice_assigned_lbl')} <strong className="text-cyan-300">{assignedVoiceLabel}</strong>
                </span>
              </div>
            </motion.div>
          )}

          {/* Botón de Enviar (Estilo Botón Primario Arcade Card Clash) */}
          <div className="pt-2 space-y-2.5">
            <button
              type="submit"
              disabled={isLoading}
              className={`w-full py-3.5 rounded-arcade text-xs sm:text-sm font-black uppercase tracking-wider flex items-center justify-center gap-2 border-3 transition-all cursor-pointer ${
                isLoading 
                  ? 'bg-slate-800 text-slate-500 border-[var(--color-arcade-navy-light)] cursor-not-allowed'
                  : mode === 'login'
                  ? 'bg-[var(--color-arcade-orange)] hover:bg-[var(--color-arcade-orange-bright)] border-[var(--color-arcade-navy-dark)] border-b-arcade-lg border-b-[var(--color-arcade-orange-shadow)] text-white shadow-btn-arcade-lg active:translate-y-1 active:shadow-none'
                  : 'bg-[var(--color-arcade-green)] hover:bg-[#57d847] border-[var(--color-arcade-navy-dark)] border-b-arcade-lg border-b-[var(--color-arcade-green-shadow)] text-white shadow-btn-arcade-lg active:translate-y-1 active:shadow-none'
              }`}
            >
              {isLoading ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>{t('auth.processing')}</span>
                </div>
              ) : mode === 'login' ? (
                <>
                  <LogIn className="w-4 h-4 text-white" />
                  <span>{t('auth.btn_login')}</span>
                </>
              ) : mode === 'forgot' ? (
                <>
                  <Mail className="w-4 h-4 text-white" />
                  <span>{t('auth.btn_recover')}</span>
                </>
              ) : (
                <>
                  <UserPlus className="w-4 h-4 text-white" />
                  <span>{t('auth.btn_register')}</span>
                </>
              )}
            </button>

            {/* Volver al login desde modo forgot */}
            {mode === 'forgot' && (
              <button
                type="button"
                onClick={() => handleToggleMode('login')}
                className="w-full py-2 rounded-arcade-sm text-[11px] font-bold text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                {t('auth.back_login')}
              </button>
            )}
          </div>
        </form>

        {/* Footer / Nota de privacidad de documentos */}
        <div className="mt-4 pt-3 border-t border-slate-800/80 text-center">
          <p className="text-[10px] text-slate-400 flex items-center justify-center gap-1 font-medium">
            <ShieldCheck className="w-3 h-3 text-emerald-400" />
            <span>{t('auth.privacy_note')}</span>
          </p>
        </div>
      </motion.div>
    </div>
  );
}
