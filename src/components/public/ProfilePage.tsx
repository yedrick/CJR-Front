import React, { useMemo, useState } from 'react';
import {
  CalendarDays,
  CheckCircle2,
  Church,
  Clock,
  KeyRound,
  ListChecks,
  LogOut,
  Mail,
  QrCode,
  Save,
  ShieldCheck,
  Ticket,
  Undo2,
  UserCog,
  UserRound,
  Bell,
  Receipt,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useCamp } from '../../context/CampContext';
import { useToast } from '../common/Toast';
import { useConfirm } from '../common/ConfirmDialog';
import { PERMISSIONS, PERMISSION_GROUPS, ROLE_LABEL, ROLE_TONE, Permission } from '../../auth/permissions';
import { initials } from '../../utils/campUtils';
import { Badge, Button, Card, Field, FormSection, SelectInput, TextInput } from '../admin/ui';
import { PasswordChecklist, PasswordInput, passwordProblem } from '../auth/PasswordPolicy';
import { PHONE_RE, localPhone } from '../../utils/validation';

type Errors = Record<string, string>;

const MONTHS_LONG = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
/** "2026-03-14 09:30" → "14 de marzo de 2026, 09:30" */
function formatStamp(stamp?: string, withTime = true): string {
  if (!stamp) return '—';
  const [date, time] = stamp.split(/[ T]/);
  const [y, m, d] = date.split('-').map(Number);
  if (!y || !m || !d) return stamp;
  const base = `${d} de ${MONTHS_LONG[m - 1]} de ${y}`;
  return withTime && time ? `${base}, ${time.slice(0, 5)}` : base;
}

export const ProfilePage: React.FC = () => {
  const { currentUser, isStaff, updateProfile, changePassword, logout } = useAuth();
  const { catalogs, setActiveTab } = useCamp();
  const { toast } = useToast();
  const { confirm } = useConfirm();

  const regionales = useMemo(
    () => [...catalogs.regionales].sort((a, b) => a.name.localeCompare(b.name, 'es')),
    [catalogs.regionales]
  );

  const initialProfile = useMemo(
    () => ({
      firstName: currentUser?.firstName || '',
      paternalLastName: currentUser?.paternalLastName || '',
      maternalLastName: currentUser?.maternalLastName || '',
      phone: localPhone(currentUser?.phone),
      churchCongregation: currentUser?.churchCongregation || '',
      regional: currentUser?.regional || '',
    }),
    [currentUser]
  );
  const [profile, setProfile] = useState(initialProfile);
  const [profileErrors, setProfileErrors] = useState<Errors>({});
  const [savingProfile, setSavingProfile] = useState(false);
  // Si el usuario cambia desde fuera (p. ej. reloadUser), se sincroniza el formulario
  const [syncedWith, setSyncedWith] = useState(initialProfile);
  if (syncedWith !== initialProfile) {
    setSyncedWith(initialProfile);
    setProfile(initialProfile);
  }

  const [pwd, setPwd] = useState({ current: '', next: '', confirm: '' });
  const [pwdErrors, setPwdErrors] = useState<Errors>({});
  const [savingPwd, setSavingPwd] = useState(false);
  const [pwdNotice, setPwdNotice] = useState<string | null>(null);

  if (!currentUser) return null;

  const fullName = `${currentUser.firstName} ${currentUser.paternalLastName} ${currentUser.maternalLastName || ''}`.trim();
  const roleLabel = ROLE_LABEL[currentUser.role] || currentUser.role;
  const dirty = (Object.keys(profile) as (keyof typeof profile)[]).some((k) => profile[k] !== initialProfile[k]);

  const setField = (key: keyof typeof profile, value: string) => {
    setProfile((p) => ({ ...p, [key]: value }));
    if (profileErrors[key]) setProfileErrors(({ [key]: _o, ...rest }) => rest);
  };

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Errors = {};
    if (profile.firstName.trim().length < 2) errs.firstName = 'Ingresa tus nombres.';
    if (profile.paternalLastName.trim().length < 2) errs.paternalLastName = 'Ingresa tu apellido paterno.';
    if (!PHONE_RE.test(profile.phone)) errs.phone = 'Debe tener 8 dígitos y empezar con 6 o 7.';
    if (!profile.regional) errs.regional = 'Selecciona tu regional.';
    setProfileErrors(errs);
    if (Object.keys(errs).length) return;

    // Solo se envían los campos que cambiaron
    const changes: Record<string, string> = {};
    (Object.keys(profile) as (keyof typeof profile)[]).forEach((k) => {
      if (profile[k] !== initialProfile[k]) changes[k] = k === 'phone' ? `+591 ${profile.phone}` : profile[k].trim();
    });
    if (!Object.keys(changes).length) return;

    setSavingProfile(true);
    const res = await updateProfile(changes);
    setSavingProfile(false);
    if (res.success) {
      toast({ type: 'success', title: 'Perfil actualizado', message: 'Tus datos se guardaron correctamente.' });
    } else {
      if (res.errors) setProfileErrors(res.errors);
      toast({
        type: res.status === 409 || res.status === 422 ? 'warning' : 'error',
        title: res.status === 409 ? 'Dato ya registrado' : 'No se pudo guardar',
        message: res.message,
      });
    }
  };

  const savePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwdNotice(null);
    const errs: Errors = {};
    if (!pwd.current) errs.currentPassword = 'Ingresa tu contraseña actual.';
    const problem = passwordProblem(pwd.next, currentUser.email);
    if (problem) errs.newPassword = problem;
    else if (pwd.next === pwd.current) errs.newPassword = 'Debe ser distinta de la actual.';
    if (!pwd.confirm) errs.confirm = 'Repite la nueva contraseña.';
    else if (pwd.confirm !== pwd.next) errs.confirm = 'Las contraseñas no coinciden.';
    setPwdErrors(errs);
    if (Object.keys(errs).length) return;

    setSavingPwd(true);
    const res = await changePassword(pwd.current, pwd.next);
    setSavingPwd(false);
    if (res.success) {
      setPwd({ current: '', next: '', confirm: '' });
      setPwdErrors({});
      const msg = res.message || 'Contraseña actualizada. Se cerraron tus otras sesiones.';
      setPwdNotice(msg);
      toast({ type: 'success', title: 'Contraseña actualizada', message: msg });
    } else {
      if (res.errors) setPwdErrors(res.errors);
      if (res.errors?.currentPassword) setPwd((p) => ({ ...p, current: '' }));
      toast({ type: res.status === 422 ? 'warning' : 'error', title: 'No se pudo cambiar la contraseña', message: res.message });
    }
  };

  const handleLogout = async () => {
    const ok = await confirm({
      title: '¿Cerrar sesión?',
      message: 'Tendrás que volver a ingresar con tu correo y contraseña.',
      confirmText: 'Cerrar sesión',
      tone: 'warning',
    });
    if (!ok) return;
    await logout();
    setActiveTab('catalog');
  };

  const permsByGroup = PERMISSION_GROUPS.map((g) => ({
    ...g,
    perms: (Object.keys(PERMISSIONS) as Permission[]).filter((p) => p.split(':')[0] === g.resource && currentUser.permissions.includes(p)),
  })).filter((g) => g.perms.length > 0);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6 animate-fade-in">
      {/* Encabezado */}
      <Card className="overflow-hidden">
        <div className="h-24 sm:h-28 bg-gradient-to-r from-[#0284C7] via-sky-500 to-indigo-600 relative">
          <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_20%_20%,white_0,transparent_40%),radial-gradient(circle_at_80%_60%,white_0,transparent_35%)]" />
        </div>
        <div className="px-5 sm:px-8 pb-6 -mt-10 sm:-mt-12 flex flex-col sm:flex-row sm:items-end gap-4">
          <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-3xl bg-white p-1.5 shadow-lg shrink-0">
            <div className="w-full h-full rounded-[1.1rem] bg-gradient-to-br from-sky-100 to-sky-200 text-[#0284C7] flex items-center justify-center text-2xl sm:text-3xl font-black font-display">
              {initials(`${currentUser.firstName} ${currentUser.paternalLastName}`)}
            </div>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-black text-[#0284C7] uppercase tracking-widest">Mi perfil y seguridad</p>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 font-display tracking-tight break-words">{fullName}</h1>
            <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-slate-500">
              <span className="inline-flex items-center gap-1 min-w-0 break-all">
                <Mail className="w-3.5 h-3.5 shrink-0" /> {currentUser.email}
              </span>
              <Badge className={ROLE_TONE[currentUser.role] || ROLE_TONE.campista}>
                <ShieldCheck className="w-3 h-3" /> {roleLabel}
              </Badge>
              {currentUser.status === 'disabled' && <Badge className="bg-red-50 text-red-700 border-red-200">Desactivada</Badge>}
            </div>
          </div>
          <div className="grid grid-cols-2 sm:flex sm:flex-col gap-2 sm:gap-1 text-[11px] text-slate-500 sm:text-right shrink-0">
            <span className="inline-flex items-center sm:justify-end gap-1.5">
              <CalendarDays className="w-3.5 h-3.5 shrink-0" />
              <span>
                Miembro desde <b className="text-slate-700">{formatStamp(currentUser.createdAt, false)}</b>
              </span>
            </span>
            <span className="inline-flex items-center sm:justify-end gap-1.5">
              <Clock className="w-3.5 h-3.5 shrink-0" />
              <span>
                Último acceso <b className="text-slate-700">{formatStamp(currentUser.lastLoginAt)}</b>
              </span>
            </span>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        <div className="lg:col-span-2 space-y-6 min-w-0">
          {/* Datos personales */}
          <form onSubmit={saveProfile} noValidate>
            <FormSection title="Datos personales" description="Mantén tus datos al día para tus inscripciones." icon={UserRound}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Nombres" required error={profileErrors.firstName} className="sm:col-span-2">
                  <TextInput
                    autoComplete="given-name"
                    value={profile.firstName}
                    onChange={(e) => setField('firstName', e.target.value)}
                    maxLength={60}
                    aria-invalid={!!profileErrors.firstName || undefined}
                  />
                </Field>
                <Field label="Apellido paterno" required error={profileErrors.paternalLastName}>
                  <TextInput
                    autoComplete="family-name"
                    value={profile.paternalLastName}
                    onChange={(e) => setField('paternalLastName', e.target.value)}
                    maxLength={60}
                    aria-invalid={!!profileErrors.paternalLastName || undefined}
                  />
                </Field>
                <Field label="Apellido materno" error={profileErrors.maternalLastName}>
                  <TextInput
                    autoComplete="additional-name"
                    value={profile.maternalLastName}
                    onChange={(e) => setField('maternalLastName', e.target.value)}
                    maxLength={60}
                  />
                </Field>
                <Field label="WhatsApp" required error={profileErrors.phone}>
                  <div className="flex">
                    <span className="inline-flex items-center px-3 rounded-l-xl border border-r-0 border-slate-200 bg-slate-100 text-xs font-bold text-slate-600 shrink-0">
                      +591
                    </span>
                    <TextInput
                      type="tel"
                      inputMode="numeric"
                      autoComplete="tel-national"
                      maxLength={8}
                      value={profile.phone}
                      onChange={(e) => setField('phone', e.target.value.replace(/\D/g, '').slice(0, 8))}
                      className="rounded-l-none font-mono tracking-wider"
                      aria-invalid={!!profileErrors.phone || undefined}
                    />
                  </div>
                </Field>
                <Field label="Regional" required error={profileErrors.regional}>
                  <SelectInput value={profile.regional} onChange={(e) => setField('regional', e.target.value)}>
                    <option value="">Selecciona…</option>
                    {profile.regional && !regionales.some((r) => r.name === profile.regional) && (
                      <option value={profile.regional}>{profile.regional}</option>
                    )}
                    {regionales.map((r) => (
                      <option key={r.id} value={r.name}>
                        {r.name}
                      </option>
                    ))}
                  </SelectInput>
                </Field>
                <Field label="Iglesia / congregación" error={profileErrors.churchCongregation} className="sm:col-span-2">
                  <div className="relative">
                    <Church className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <TextInput
                      value={profile.churchCongregation}
                      onChange={(e) => setField('churchCongregation', e.target.value)}
                      maxLength={80}
                      placeholder="Ej. Iglesia Central de Potosí"
                      className="pl-9"
                    />
                  </div>
                </Field>
                <div className="sm:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded-2xl bg-slate-50 border border-slate-100 text-xs">
                  <div className="min-w-0">
                    <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Correo (no editable)</span>
                    <span className="block font-semibold text-slate-700 break-all">{currentUser.email}</span>
                  </div>
                  <div>
                    <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Fecha de nacimiento</span>
                    <span className="block font-semibold text-slate-700">
                      {currentUser.birthDate ? formatStamp(currentUser.birthDate, false) : '—'}
                      {currentUser.age ? ` · ${currentUser.age} años` : ''}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-1">
                <Button variant="ghost" icon={Undo2} disabled={!dirty || savingProfile} onClick={() => { setProfile(initialProfile); setProfileErrors({}); }}>
                  Descartar cambios
                </Button>
                <Button type="submit" icon={Save} disabled={!dirty || savingProfile}>
                  {savingProfile ? 'Guardando…' : 'Guardar datos'}
                </Button>
              </div>
            </FormSection>
          </form>

          {/* Cambiar contraseña */}
          <form onSubmit={savePassword} noValidate>
            <FormSection
              title="Cambiar contraseña"
              description="Al cambiarla se cerrarán tus sesiones abiertas en otros dispositivos."
              icon={KeyRound}
            >
              {/* campo oculto para que el gestor de contraseñas asocie la cuenta */}
              <input type="text" autoComplete="username" value={currentUser.email} readOnly hidden />
              {pwdNotice && (
                <div className="flex items-start gap-2 p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800" role="status">
                  <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" /> {pwdNotice}
                </div>
              )}
              <Field label="Contraseña actual" required error={pwdErrors.currentPassword}>
                <PasswordInput
                  autoComplete="current-password"
                  value={pwd.current}
                  onChange={(e) => {
                    setPwd((p) => ({ ...p, current: e.target.value }));
                    if (pwdErrors.currentPassword) setPwdErrors(({ currentPassword: _c, ...rest }) => rest);
                  }}
                  invalid={!!pwdErrors.currentPassword}
                />
              </Field>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Nueva contraseña" required error={pwdErrors.newPassword}>
                  <PasswordInput
                    autoComplete="new-password"
                    value={pwd.next}
                    onChange={(e) => setPwd((p) => ({ ...p, next: e.target.value }))}
                    invalid={!!pwdErrors.newPassword}
                    maxLength={72}
                  />
                </Field>
                <Field label="Confirmar nueva contraseña" required error={pwdErrors.confirm}>
                  <PasswordInput
                    autoComplete="new-password"
                    value={pwd.confirm}
                    onChange={(e) => setPwd((p) => ({ ...p, confirm: e.target.value }))}
                    invalid={!!pwdErrors.confirm}
                    maxLength={72}
                  />
                </Field>
              </div>
              <PasswordChecklist password={pwd.next} email={currentUser.email} confirm={pwd.confirm} showConfirm />
              <div className="flex justify-end">
                <Button type="submit" icon={KeyRound} disabled={savingPwd || !pwd.current || !pwd.next}>
                  {savingPwd ? 'Actualizando…' : 'Actualizar contraseña'}
                </Button>
              </div>
            </FormSection>
          </form>
        </div>

        <div className="space-y-6 min-w-0">
          {/* Mis permisos */}
          <FormSection
            title="Mis permisos"
            description={
              isStaff
                ? `Tu rol «${roleLabel}» te da ${currentUser.permissions.length} permisos en el panel.`
                : 'Lo que puedes hacer con tu cuenta de campista.'
            }
            icon={ListChecks}
          >
            {isStaff ? (
              <div className="space-y-3 max-h-[28rem] overflow-y-auto pr-1 -mr-1">
                {permsByGroup.map((g) => (
                  <div key={g.resource}>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{g.label}</p>
                    <ul className="mt-1 space-y-1">
                      {g.perms.map((p) => (
                        <li key={p} className="flex items-start gap-2 text-xs text-slate-700">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                          <span>{PERMISSIONS[p]}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            ) : (
              <ul className="space-y-2.5">
                {[
                  { icon: Ticket, text: 'Inscribirte a los campamentos abiertos y elegir tus talleres.' },
                  { icon: QrCode, text: 'Ver tus inscripciones y tu credencial QR de ingreso.' },
                  { icon: Receipt, text: 'Subir o reenviar tu comprobante de pago si fue observado.' },
                  { icon: Bell, text: 'Recibir avisos de la directiva sobre tu campamento.' },
                  { icon: UserCog, text: 'Actualizar tus datos personales y tu contraseña.' },
                ].map(({ icon: Icon, text }) => (
                  <li key={text} className="flex items-start gap-2.5 text-xs text-slate-700">
                    <span className="w-7 h-7 rounded-xl bg-sky-50 text-[#0284C7] flex items-center justify-center shrink-0">
                      <Icon className="w-3.5 h-3.5" />
                    </span>
                    <span className="pt-1.5">{text}</span>
                  </li>
                ))}
                <li className="pt-1">
                  <Button variant="secondary" icon={Ticket} onClick={() => setActiveTab('my-registrations')} className="w-full">
                    Ver mis inscripciones
                  </Button>
                </li>
              </ul>
            )}
          </FormSection>

          {/* Sesión */}
          <Card className="p-5 space-y-3">
            <div className="flex items-start gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-red-50 text-red-600 flex items-center justify-center shrink-0">
                <LogOut className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-sm font-black text-slate-900">Sesión</h4>
                <p className="text-[11px] text-slate-500 mt-0.5">Cierra tu sesión en este dispositivo.</p>
              </div>
            </div>
            <Button variant="danger" icon={LogOut} onClick={handleLogout} className="w-full">
              Cerrar sesión
            </Button>
          </Card>
        </div>
      </div>
    </div>
  );
};
