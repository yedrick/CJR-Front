import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { CJRRegional } from '../../types/camp';
import { CJR_REGIONALES } from '../../data/initialData';
import { CJNLogo } from '../common/CJNLogo';
import { 
  X, 
  LogIn, 
  UserPlus, 
  KeyRound, 
  Mail, 
  Lock, 
  User, 
  Phone, 
  MapPin, 
  Calendar, 
  Shield, 
  CheckCircle2, 
  AlertCircle,
  ArrowRight,
  Sparkles
} from 'lucide-react';

export const AuthModal: React.FC = () => {
  const {
    isAuthModalOpen,
    setIsAuthModalOpen,
    authModalMode,
    setAuthModalMode,
    login,
    registerUser,
    requestPasswordReset,
  } = useAuth();

  // Login form states
  const [loginIdentifier, setLoginIdentifier] = useState('sofia.morales@cjn.bo');
  const [loginPassword, setLoginPassword] = useState('123456');
  const [loginError, setLoginError] = useState<string | null>(null);

  // Register form states
  const [regFirstName, setRegFirstName] = useState('');
  const [regPaternal, setRegPaternal] = useState('');
  const [regMaternal, setRegMaternal] = useState('');
  const [regBirthDate, setRegBirthDate] = useState('2006-05-14');
  const [regAge, setRegAge] = useState(19);
  const [regRegional, setRegRegional] = useState<CJRRegional>('POTOSI');
  const [regPhone, setRegPhone] = useState('+591 76249102');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('123456');
  const [regError, setRegError] = useState<string | null>(null);

  // Password Recovery states
  const [recoveryIdentifier, setRecoveryIdentifier] = useState('');
  const [recoveryMessage, setRecoveryMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  if (!isAuthModalOpen) return null;

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    const result = login(loginIdentifier, loginPassword);
    if (!result.success) {
      setLoginError(result.message || 'Error al iniciar sesión');
    }
  };

  const handleRegisterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setRegError(null);

    if (!regFirstName.trim() || !regPaternal.trim() || !regEmail.trim() || !regPhone.trim()) {
      setRegError('Por favor completa todos los campos obligatorios.');
      return;
    }

    const result = registerUser({
      firstName: regFirstName,
      paternalLastName: regPaternal,
      maternalLastName: regMaternal,
      birthDate: regBirthDate,
      age: regAge,
      phone: regPhone,
      email: regEmail,
      city: regRegional,
      password: regPassword,
    });

    if (!result.success) {
      setRegError(result.message || 'Error en el registro');
    }
  };

  const handleRecoverySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setRecoveryMessage(null);
    const result = requestPasswordReset(recoveryIdentifier);
    setRecoveryMessage({
      type: result.success ? 'success' : 'error',
      text: result.message,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto animate-fade-in">
      <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-sky-100 overflow-hidden my-8">
        
        {/* Modal Top Ribbon */}
        <div className="flex items-center justify-between px-6 py-4 bg-sky-50/70 border-b border-sky-100">
          <div className="flex items-center gap-2">
            <CJNLogo size="sm" showSubtitle={false} />
            <span className="text-xs font-black text-[#0284C7] uppercase tracking-wider pl-2 border-l border-sky-200">
              {authModalMode === 'login' && 'Acceso al Sistema CJN'}
              {authModalMode === 'register' && 'Registro de Joven / Delegado'}
              {authModalMode === 'recovery' && 'Recuperación de Contraseña'}
            </span>
          </div>
          <button
            onClick={() => setIsAuthModalOpen(false)}
            className="p-1.5 rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-200 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mode Selector Tabs (Login / Register) */}
        {authModalMode !== 'recovery' && (
          <div className="grid grid-cols-2 p-1.5 bg-slate-100/70 border-b border-slate-200 text-xs font-bold">
            <button
              type="button"
              onClick={() => {
                setAuthModalMode('login');
                setLoginError(null);
              }}
              className={`py-2 rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer ${
                authModalMode === 'login'
                  ? 'bg-white text-[#0284C7] shadow-xs font-black'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Iniciar Sesión</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setAuthModalMode('register');
                setRegError(null);
              }}
              className={`py-2 rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer ${
                authModalMode === 'register'
                  ? 'bg-white text-[#0284C7] shadow-xs font-black'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Crear Cuenta</span>
            </button>
          </div>
        )}

        <div className="p-6">
          
          {/* TAB 1: LOGIN */}
          {authModalMode === 'login' && (
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              {loginError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                  <span>{loginError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Correo Electrónico o Celular (WhatsApp)
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    placeholder="joven@cjn.bo o +591 76249102"
                    value={loginIdentifier}
                    onChange={(e) => setLoginIdentifier(e.target.value)}
                    className="w-full pl-10 pr-3 py-2.5 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:ring-2 focus:ring-[#0284C7]"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Contraseña
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setAuthModalMode('recovery');
                      setRecoveryMessage(null);
                    }}
                    className="text-xs font-bold text-[#0284C7] hover:underline"
                  >
                    ¿Olvidaste tu contraseña?
                  </button>
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    required
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    className="w-full pl-10 pr-3 py-2.5 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:ring-2 focus:ring-[#0284C7]"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-3 bg-[#0284C7] hover:bg-[#0369A1] text-white font-extrabold text-xs sm:text-sm rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>Acceder a la Plataforma</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <div className="p-3 rounded-2xl bg-sky-50 border border-sky-200 text-[11px] text-slate-600 space-y-1">
                <span className="font-bold text-[#0284C7] block">Cuentas Demo Rápidas:</span>
                <div>• Cliente: <code className="font-mono font-bold">sofia.morales@cjn.bo</code> (Clave: cualquier valor)</div>
                <div>• Administrador: <code className="font-mono font-bold">admin@cjn.bo</code> (Clave: cualquier valor)</div>
              </div>
            </form>
          )}

          {/* TAB 2: REGISTER */}
          {authModalMode === 'register' && (
            <form onSubmit={handleRegisterSubmit} className="space-y-3.5 max-h-[75vh] overflow-y-auto pr-1">
              {regError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                  <span>{regError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Nombres *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Sofía Valentina"
                  value={regFirstName}
                  onChange={(e) => setRegFirstName(e.target.value)}
                  className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:ring-2 focus:ring-[#0284C7]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Apellido Paterno *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. Morales"
                    value={regPaternal}
                    onChange={(e) => setRegPaternal(e.target.value)}
                    className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Apellido Materno
                  </label>
                  <input
                    type="text"
                    placeholder="Ej. Silva"
                    value={regMaternal}
                    onChange={(e) => setRegMaternal(e.target.value)}
                    className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl text-slate-900"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Fecha de Nacimiento *
                  </label>
                  <input
                    type="date"
                    required
                    value={regBirthDate}
                    onChange={(e) => {
                      setRegBirthDate(e.target.value);
                      const calculated = new Date().getFullYear() - new Date(e.target.value).getFullYear();
                      setRegAge(calculated > 0 ? calculated : 18);
                    }}
                    className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Edad (Calculada)
                  </label>
                  <input
                    type="number"
                    value={regAge}
                    onChange={(e) => setRegAge(Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-100 border border-slate-200 rounded-xl font-mono text-slate-700 font-bold"
                  />
                </div>
              </div>

              {/* Selector de las 31 REGIONALES */}
              <div className="p-3 bg-sky-50 border border-sky-200 rounded-2xl space-y-1.5">
                <div className="flex items-center gap-1.5 text-xs font-bold text-[#0284C7] uppercase">
                  <MapPin className="w-3.5 h-3.5 text-[#0284C7]" />
                  <span>Comité Juvenil Regional (31 Regionales) *</span>
                </div>
                <select
                  value={regRegional}
                  onChange={(e) => setRegRegional(e.target.value as CJRRegional)}
                  className="w-full px-3 py-2 text-xs bg-white border border-sky-300 rounded-xl text-slate-900 font-bold"
                >
                  {CJR_REGIONALES.map((reg, idx) => (
                    <option key={reg} value={reg}>
                      {idx + 1}. {reg}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Celular (WhatsApp) *
                  </label>
                  <input
                    type="tel"
                    required
                    placeholder="+591 76249102"
                    value={regPhone}
                    onChange={(e) => setRegPhone(e.target.value)}
                    className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Correo Electrónico *
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="nombre@cjn.bo"
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl text-slate-900"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Contraseña *
                </label>
                <input
                  type="password"
                  required
                  placeholder="Mínimo 6 caracteres"
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                  className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl text-slate-900"
                />
              </div>

              <button
                type="submit"
                className="w-full py-3 bg-[#0284C7] hover:bg-[#0369A1] text-white font-extrabold text-xs sm:text-sm rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>Crear Cuenta en CJN</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          )}

          {/* TAB 3: RECOVERY */}
          {authModalMode === 'recovery' && (
            <form onSubmit={handleRecoverySubmit} className="space-y-4">
              <p className="text-xs text-slate-600 leading-relaxed">
                Ingresa tu correo electrónico registrado o número de WhatsApp. El sistema enviará un código temporal de recuperación para restablecer tu contraseña.
              </p>

              {recoveryMessage && (
                <div className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                  recoveryMessage.type === 'success'
                    ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
                    : 'bg-red-50 border border-red-200 text-red-700'
                }`}>
                  {recoveryMessage.type === 'success' ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                  )}
                  <span>{recoveryMessage.text}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Correo Electrónico o Celular
                </label>
                <input
                  type="text"
                  required
                  placeholder="ejemplo@cjn.bo o +591 76249102"
                  value={recoveryIdentifier}
                  onChange={(e) => setRecoveryIdentifier(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl text-slate-900"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setAuthModalMode('login')}
                  className="w-1/2 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl"
                >
                  Volver al Login
                </button>
                <button
                  type="submit"
                  className="w-1/2 py-2.5 bg-[#0284C7] hover:bg-[#0369A1] text-white font-extrabold text-xs rounded-xl shadow-md"
                >
                  Enviar Código
                </button>
              </div>
            </form>
          )}

        </div>

      </div>
    </div>
  );
};
