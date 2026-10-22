import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Ban,
  Check,
  Copy,
  KeyRound,
  Pencil,
  RefreshCw,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  UserCheck,
  UserCog,
  UserPlus,
  Users,
  UserX,
  Wand2,
  AlertCircle,
} from 'lucide-react';
import type { User } from '../../types/camp';
import { usersApi, RoleWithCount } from '../../api/services';
import { ApiError, isApiError } from '../../api/errors';
import { DEFAULT_ROLES, ROLE_LABEL, ROLE_TONE, RoleId } from '../../auth/permissions';
import { useAuth } from '../../context/AuthContext';
import { useCamp } from '../../context/CampContext';
import { useToast } from '../common/Toast';
import { useConfirm } from '../common/ConfirmDialog';
import { initials } from '../../utils/campUtils';
import {
  AdminPage,
  AdminPageHeader,
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  FormSection,
  Modal,
  SearchInput,
  SelectInput,
  StatCard,
  Table,
  TextInput,
  Toggle,
} from './ui';
import { PasswordChecklist, PasswordInput, generatePassword, passwordProblem } from '../auth/PasswordPolicy';
import { EMAIL_RE, PHONE_RE, localPhone } from '../../utils/validation';

type Errors = Record<string, string>;

const AVATAR_TONE: Record<string, string> = {
  super_admin: 'from-violet-100 to-violet-200 text-violet-700',
  admin: 'from-sky-100 to-sky-200 text-sky-700',
  tesorero: 'from-emerald-100 to-emerald-200 text-emerald-700',
  coordinador: 'from-amber-100 to-amber-200 text-amber-700',
  control_acceso: 'from-indigo-100 to-indigo-200 text-indigo-700',
  campista: 'from-slate-100 to-slate-200 text-slate-600',
};

const fullName = (u: Pick<User, 'firstName' | 'paternalLastName' | 'maternalLastName'>) =>
  `${u.firstName} ${u.paternalLastName} ${u.maternalLastName || ''}`.trim();

const formatStamp = (s?: string) => {
  if (!s) return 'Nunca';
  const [date, time] = s.split(/[ T]/);
  const [y, m, d] = date.split('-');
  if (!y || !m || !d) return s;
  return `${d}/${m}/${y}${time ? ` ${time.slice(0, 5)}` : ''}`;
};

const RoleBadge: React.FC<{ role: RoleId; label?: string }> = ({ role, label }) => (
  <Badge className={ROLE_TONE[role] || ROLE_TONE.campista}>
    {role === 'super_admin' ? <ShieldAlert className="w-3 h-3" /> : role === 'campista' ? null : <Shield className="w-3 h-3" />}
    {label || ROLE_LABEL[role] || role}
  </Badge>
);

const StatusBadge: React.FC<{ status: User['status'] }> = ({ status }) =>
  status === 'active' ? (
    <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200">
      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Activo
    </Badge>
  ) : (
    <Badge className="bg-red-50 text-red-700 border-red-200">
      <span className="w-1.5 h-1.5 rounded-full bg-red-500" /> Desactivado
    </Badge>
  );

const Avatar: React.FC<{ user: User }> = ({ user }) => (
  <div
    className={`w-11 h-11 text-sm rounded-2xl bg-gradient-to-br ${
      AVATAR_TONE[user.role] || AVATAR_TONE.campista
    } flex items-center justify-center font-black shrink-0 ${user.status === 'disabled' ? 'opacity-50 grayscale' : ''}`}
  >
    {initials(`${user.firstName} ${user.paternalLastName}`)}
  </div>
);

const ServerAlert: React.FC<{ message: string | null }> = ({ message }) =>
  message ? (
    <div role="alert" className="flex items-start gap-2 p-3 rounded-2xl bg-red-50 border border-red-200 text-xs text-red-800 mb-4">
      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" /> {message}
    </div>
  ) : null;

/** Contraseña temporal con generador y copia rápida. */
const TempPasswordField: React.FC<{ value: string; onChange: (v: string) => void; email: string; error?: string; label?: string }> = ({
  value,
  onChange,
  email,
  error,
  label = 'Contraseña temporal',
}) => {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      /* el portapapeles puede no estar disponible */
    }
  };
  return (
    <div className="space-y-3">
      <Field label={label} required error={error}>
        <PasswordInput autoComplete="new-password" value={value} onChange={(e) => onChange(e.target.value)} invalid={!!error} maxLength={72} />
      </Field>
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" size="sm" icon={Wand2} onClick={() => onChange(generatePassword(12))}>
          Generar segura
        </Button>
        <Button variant="ghost" size="sm" icon={copied ? Check : Copy} onClick={copy} disabled={!value}>
          {copied ? 'Copiada' : 'Copiar'}
        </Button>
      </div>
      <PasswordChecklist password={value} email={email} />
    </div>
  );
};

// =========================================================
// Modal: crear / editar usuario
// =========================================================
interface UserForm {
  firstName: string;
  paternalLastName: string;
  maternalLastName: string;
  email: string;
  phone: string;
  regional: string;
  role: RoleId;
  status: User['status'];
  password: string;
}

const emptyForm: UserForm = {
  firstName: '',
  paternalLastName: '',
  maternalLastName: '',
  email: '',
  phone: '',
  regional: '',
  role: 'control_acceso',
  status: 'active',
  password: '',
};

const UserFormModal: React.FC<{
  open: boolean;
  user: User | null; // null = nuevo
  roles: RoleWithCount[];
  onClose: () => void;
  onSaved: (u: User, isNew: boolean) => void;
}> = ({ open, user, roles, onClose, onSaved }) => {
  const { currentUser } = useAuth();
  const { catalogs } = useCamp();
  const { toastError } = useToast();
  const isNew = !user;
  const isSelf = !!user && user.id === currentUser?.id;
  const iAmSuper = currentUser?.role === 'super_admin';

  const initial = useMemo<UserForm>(
    () =>
      user
        ? {
            firstName: user.firstName,
            paternalLastName: user.paternalLastName,
            maternalLastName: user.maternalLastName || '',
            email: user.email,
            phone: localPhone(user.phone),
            regional: user.regional || '',
            role: user.role,
            status: user.status,
            password: '',
          }
        : emptyForm,
    [user]
  );
  const [form, setForm] = useState<UserForm>(initial);
  const [errors, setErrors] = useState<Errors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(user ? initial : { ...initial, password: generatePassword(12) });
      setErrors({});
      setServerError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initial]);

  const regionales = useMemo(
    () => [...catalogs.regionales].sort((a, b) => a.name.localeCompare(b.name, 'es')),
    [catalogs.regionales]
  );

  const set = <K extends keyof UserForm>(k: K, v: UserForm[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    if (errors[k]) setErrors(({ [k]: _o, ...rest }) => rest);
  };

  // Rol: no se puede cambiar el propio; super_admin solo lo asigna otro super_admin
  const roleLocked = isSelf || (!!user && user.role === 'super_admin' && !iAmSuper);
  const roleOptions = roles.filter((r) => r.id !== 'super_admin' || iAmSuper || user?.role === 'super_admin');

  const submit = async () => {
    const e: Errors = {};
    const email = form.email.trim().toLowerCase();
    if (form.firstName.trim().length < 2) e.firstName = 'Nombre obligatorio.';
    if (isNew && form.paternalLastName.trim().length < 2) e.paternalLastName = 'Apellido obligatorio.';
    if (!EMAIL_RE.test(email)) e.email = 'Correo no válido.';
    if (form.phone && !PHONE_RE.test(form.phone)) e.phone = '8 dígitos, empieza con 6 o 7.';
    if (isNew) {
      const p = passwordProblem(form.password, email);
      if (p) e.password = p;
    }
    setErrors(e);
    setServerError(null);
    if (Object.keys(e).length) return;

    const phone = form.phone ? `+591 ${form.phone}` : '';
    setSaving(true);
    try {
      let saved: User;
      if (isNew) {
        saved = await usersApi.create({
          firstName: form.firstName.trim(),
          paternalLastName: form.paternalLastName.trim(),
          maternalLastName: form.maternalLastName.trim(),
          email,
          phone,
          regional: form.regional,
          role: form.role,
          password: form.password,
        });
      } else {
        const changes: Partial<User> = {};
        if (form.firstName.trim() !== initial.firstName) changes.firstName = form.firstName.trim();
        if (form.paternalLastName.trim() !== initial.paternalLastName) changes.paternalLastName = form.paternalLastName.trim();
        if (form.maternalLastName.trim() !== initial.maternalLastName) changes.maternalLastName = form.maternalLastName.trim();
        if (email !== initial.email) changes.email = email;
        if (form.phone !== initial.phone) changes.phone = phone;
        if (form.regional !== initial.regional) changes.regional = form.regional;
        if (!roleLocked && form.role !== initial.role) changes.role = form.role;
        if (!isSelf && form.status !== initial.status) changes.status = form.status;
        if (!Object.keys(changes).length) {
          onClose();
          return;
        }
        saved = await usersApi.update(user!.id, changes);
      }
      onSaved(saved, isNew);
    } catch (err) {
      if (isApiError(err)) {
        if (err.errors) setErrors(err.errors);
        setServerError(err.message);
      }
      toastError(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isNew ? 'Nuevo usuario' : 'Editar usuario'}
      subtitle={isNew ? 'Crea una cuenta para alguien del equipo y asígnale un rol.' : user ? `${fullName(user)} · ${user.email}` : undefined}
      icon={isNew ? UserPlus : UserCog}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button icon={isNew ? UserPlus : Check} onClick={submit} disabled={saving}>
            {saving ? 'Guardando…' : isNew ? 'Crear usuario' : 'Guardar cambios'}
          </Button>
        </>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        noValidate
        className="space-y-4"
      >
        <ServerAlert message={serverError} />
        <FormSection title="Datos personales" icon={UserCog}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Nombres" required error={errors.firstName} className="sm:col-span-2">
              <TextInput value={form.firstName} onChange={(e) => set('firstName', e.target.value)} autoComplete="off" maxLength={60} />
            </Field>
            <Field label="Apellido paterno" required={isNew} error={errors.paternalLastName}>
              <TextInput value={form.paternalLastName} onChange={(e) => set('paternalLastName', e.target.value)} autoComplete="off" maxLength={60} />
            </Field>
            <Field label="Apellido materno" error={errors.maternalLastName}>
              <TextInput value={form.maternalLastName} onChange={(e) => set('maternalLastName', e.target.value)} autoComplete="off" maxLength={60} />
            </Field>
            <Field label="Correo" required error={errors.email}>
              <TextInput type="email" value={form.email} onChange={(e) => set('email', e.target.value)} autoComplete="off" autoCapitalize="none" />
            </Field>
            <Field label="Celular / WhatsApp" error={errors.phone}>
              <div className="flex">
                <span className="inline-flex items-center px-3 rounded-l-xl border border-r-0 border-slate-200 bg-slate-100 text-xs font-bold text-slate-600 shrink-0">
                  +591
                </span>
                <TextInput
                  type="tel"
                  inputMode="numeric"
                  maxLength={8}
                  value={form.phone}
                  onChange={(e) => set('phone', e.target.value.replace(/\D/g, '').slice(0, 8))}
                  className="rounded-l-none font-mono"
                  autoComplete="off"
                />
              </div>
            </Field>
            <Field label="Regional" error={errors.regional} className="sm:col-span-2">
              <SelectInput value={form.regional} onChange={(e) => set('regional', e.target.value)}>
                <option value="">Sin regional</option>
                {form.regional && !regionales.some((r) => r.name === form.regional) && <option value={form.regional}>{form.regional}</option>}
                {regionales.map((r) => (
                  <option key={r.id} value={r.name}>
                    {r.name}
                  </option>
                ))}
              </SelectInput>
            </Field>
          </div>
        </FormSection>

        <FormSection title="Acceso" description="El rol define qué puede ver y hacer en el panel." icon={ShieldCheck}>
          <Field
            label="Rol"
            required
            error={errors.role}
            hint={
              isSelf
                ? 'No puedes cambiar tu propio rol.'
                : roleLocked
                  ? 'Solo un super administrador puede modificar a otro super administrador.'
                  : undefined
            }
          >
            <SelectInput value={form.role} onChange={(e) => set('role', e.target.value as RoleId)} disabled={roleLocked}>
              {roleOptions.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                  {r.isStaff ? ` · ${r.permissions.length} permisos` : ''}
                </option>
              ))}
            </SelectInput>
          </Field>
          {(() => {
            const r = roles.find((x) => x.id === form.role);
            return r ? <p className="text-[11px] text-slate-500 -mt-2">{r.description}</p> : null;
          })()}
          {!isNew && (
            <div className={isSelf ? 'opacity-60 pointer-events-none' : ''}>
              <Toggle
                checked={form.status === 'active'}
                onChange={(v) => set('status', v ? 'active' : 'disabled')}
                label={form.status === 'active' ? 'Cuenta activa' : 'Cuenta desactivada'}
                hint={
                  isSelf
                    ? 'No puedes desactivar tu propia cuenta.'
                    : 'Al desactivarla se cierran sus sesiones y no podrá ingresar.'
                }
              />
            </div>
          )}
          {isNew && <TempPasswordField value={form.password} onChange={(v) => set('password', v)} email={form.email} error={errors.password} />}
          {isNew && (
            <p className="text-[11px] text-slate-500">
              Comparte la contraseña temporal de forma privada; la persona podrá cambiarla desde «Mi perfil».
            </p>
          )}
        </FormSection>
        <button type="submit" hidden />
      </form>
    </Modal>
  );
};

// =========================================================
// Modal: restablecer contraseña
// =========================================================
const ResetPasswordModal: React.FC<{ user: User | null; onClose: () => void; onDone: (u: User) => void }> = ({
  user,
  onClose,
  onDone,
}) => {
  const { toastError } = useToast();
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [serverError, setServerError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user) {
      setPassword(generatePassword(12));
      setError(undefined);
      setServerError(null);
    }
  }, [user]);

  const submit = async () => {
    if (!user) return;
    const p = passwordProblem(password, user.email);
    setError(p || undefined);
    if (p) return;
    setSaving(true);
    setServerError(null);
    try {
      const saved = await usersApi.update(user.id, { password });
      onDone(saved);
    } catch (err) {
      if (isApiError(err)) {
        setError(err.errors?.password);
        setServerError(err.message);
      }
      toastError(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={!!user}
      onClose={onClose}
      size="md"
      title="Restablecer contraseña"
      subtitle={user ? `${fullName(user)} · ${user.email}` : undefined}
      icon={KeyRound}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button variant="amber" icon={KeyRound} onClick={submit} disabled={saving}>
            {saving ? 'Guardando…' : 'Restablecer'}
          </Button>
        </>
      }
    >
      <ServerAlert message={serverError} />
      <div className="flex items-start gap-2 p-3 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-900 mb-4">
        <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
        Se cerrarán todas las sesiones abiertas de este usuario. Entrégale la nueva contraseña por un canal privado.
      </div>
      {user && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
          noValidate
        >
          <TempPasswordField value={password} onChange={setPassword} email={user.email} error={error} label="Nueva contraseña" />
          <button type="submit" hidden />
        </form>
      )}
    </Modal>
  );
};

// =========================================================
// PÁGINA
// =========================================================
export const UsersManager: React.FC = () => {
  const { currentUser, can, reloadUser } = useAuth();
  const { toast, toastError } = useToast();
  const { confirm } = useConfirm();

  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<RoleWithCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<'ALL' | 'STAFF' | RoleId>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | User['status']>('ALL');

  const [editing, setEditing] = useState<User | null>(null);
  const [creating, setCreating] = useState(false);
  const [resetting, setResetting] = useState<User | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [list, roleList] = await Promise.all([
        usersApi.list(),
        usersApi.roles().catch(() => DEFAULT_ROLES.map((r) => ({ ...r, userCount: 0 }))),
      ]);
      setUsers(list);
      setRoles(roleList);
      setForbidden(null);
    } catch (e) {
      if (e instanceof ApiError && e.status === 403) setForbidden(e.message);
      else {
        setLoadError(e instanceof Error ? e.message : 'No se pudo cargar la lista.');
        toastError(e, 'No se pudieron cargar los usuarios');
      }
    } finally {
      setLoading(false);
    }
  }, [toastError]);

  useEffect(() => {
    load();
  }, [load]);

  const roleName = (id: RoleId) => roles.find((r) => r.id === id)?.name || ROLE_LABEL[id] || id;
  const iAmSuper = currentUser?.role === 'super_admin';

  const stats = useMemo(
    () => ({
      total: users.length,
      staff: users.filter((u) => u.role !== 'campista').length,
      campers: users.filter((u) => u.role === 'campista').length,
      disabled: users.filter((u) => u.status === 'disabled').length,
    }),
    [users]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const qDigits = q.replace(/\D/g, '');
    return users
      .filter((u) => {
        if (roleFilter === 'STAFF' ? u.role === 'campista' : roleFilter !== 'ALL' && u.role !== roleFilter) return false;
        if (statusFilter !== 'ALL' && u.status !== statusFilter) return false;
        if (!q) return true;
        return (
          fullName(u).toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q) ||
          (qDigits.length >= 3 && (u.phone || '').replace(/\D/g, '').includes(qDigits))
        );
      })
      .sort((a, b) => {
        const order = (r: RoleId) => (r === 'campista' ? 1 : 0);
        return order(a.role) - order(b.role) || fullName(a).localeCompare(fullName(b), 'es');
      });
  }, [users, search, roleFilter, statusFilter]);

  const replaceUser = (u: User) => setUsers((list) => (list.some((x) => x.id === u.id) ? list.map((x) => (x.id === u.id ? u : x)) : [u, ...list]));

  const refreshRoleCounts = () => usersApi.roles().then(setRoles).catch(() => undefined);

  const canUpdate = can('users:update');
  const canDelete = can('users:delete');
  const canCreate = can('users:create');

  /** ¿Puede el usuario actual editar a este? (super_admin solo lo edita otro super_admin) */
  const editable = (u: User) => canUpdate && (u.role !== 'super_admin' || iAmSuper);

  const handleDelete = async (u: User) => {
    const isStaffUser = u.role !== 'campista';
    const ok = await confirm({
      title: `¿Eliminar a ${fullName(u)}?`,
      message: 'Esta acción no se puede deshacer. Si tiene inscripciones, mejor desactívalo para conservar el historial.',
      details: [`Correo: ${u.email}`, `Rol: ${roleName(u.role)}`, 'Se cerrarán todas sus sesiones.'],
      confirmText: 'Eliminar usuario',
      tone: 'danger',
      requireText: isStaffUser ? u.email : undefined,
    });
    if (!ok) return;
    setBusyId(u.id);
    try {
      await usersApi.remove(u.id);
      setUsers((list) => list.filter((x) => x.id !== u.id));
      refreshRoleCounts();
      toast({ type: 'success', title: 'Usuario eliminado', message: `${fullName(u)} ya no tiene acceso.` });
    } catch (e) {
      toastError(e);
    } finally {
      setBusyId(null);
    }
  };

  const toggleStatus = async (u: User) => {
    const disabling = u.status === 'active';
    if (disabling) {
      const ok = await confirm({
        title: `¿Desactivar a ${fullName(u)}?`,
        message: 'No podrá iniciar sesión y se cerrarán sus sesiones abiertas. Podrás reactivarlo cuando quieras.',
        confirmText: 'Desactivar',
        tone: 'warning',
      });
      if (!ok) return;
    }
    setBusyId(u.id);
    try {
      const saved = await usersApi.update(u.id, { status: disabling ? 'disabled' : 'active' });
      replaceUser(saved);
      toast({ type: 'success', title: disabling ? 'Usuario desactivado' : 'Usuario reactivado' });
    } catch (e) {
      toastError(e);
    } finally {
      setBusyId(null);
    }
  };

  const renderActions = (u: User, compact = false) => {
    const self = u.id === currentUser?.id;
    const canEdit = editable(u);
    const busy = busyId === u.id;
    const btn = 'p-2 rounded-xl transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed';
    return (
      <div className={`flex items-center gap-1 ${compact ? '' : 'justify-end'}`}>
        {canUpdate && (
          <button
            type="button"
            className={`${btn} text-slate-500 hover:text-[#0284C7] hover:bg-sky-50`}
            onClick={() => setEditing(u)}
            disabled={!canEdit || busy}
            title={canEdit ? 'Editar' : 'Solo un super administrador puede editarlo'}
            aria-label={`Editar a ${fullName(u)}`}
          >
            <Pencil className="w-4 h-4" />
          </button>
        )}
        {canUpdate && (
          <button
            type="button"
            className={`${btn} ${u.status === 'active' ? 'text-slate-500 hover:text-amber-600 hover:bg-amber-50' : 'text-slate-500 hover:text-emerald-600 hover:bg-emerald-50'}`}
            onClick={() => toggleStatus(u)}
            disabled={!canEdit || self || busy}
            title={self ? 'No puedes desactivar tu propia cuenta' : u.status === 'active' ? 'Desactivar' : 'Reactivar'}
            aria-label={u.status === 'active' ? `Desactivar a ${fullName(u)}` : `Reactivar a ${fullName(u)}`}
          >
            {u.status === 'active' ? <Ban className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
          </button>
        )}
        {canUpdate && (
          <button
            type="button"
            className={`${btn} text-slate-500 hover:text-amber-600 hover:bg-amber-50`}
            onClick={() => setResetting(u)}
            disabled={!canEdit || self || busy}
            title={self ? 'Cambia tu contraseña desde «Mi perfil»' : 'Restablecer contraseña'}
            aria-label={`Restablecer contraseña de ${fullName(u)}`}
          >
            <KeyRound className="w-4 h-4" />
          </button>
        )}
        {canDelete && (
          <button
            type="button"
            className={`${btn} text-slate-500 hover:text-red-600 hover:bg-red-50`}
            onClick={() => handleDelete(u)}
            disabled={self || u.role === 'super_admin' || busy}
            title={self ? 'No puedes eliminar tu propia cuenta' : u.role === 'super_admin' ? 'Un super administrador no se puede eliminar' : 'Eliminar'}
            aria-label={`Eliminar a ${fullName(u)}`}
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>
    );
  };

  if (forbidden) {
    return (
      <AdminPage>
        <AdminPageHeader kicker="Administración" title="Usuarios" icon={Users} />
        <Card>
          <EmptyState
            icon={ShieldAlert}
            title="No tienes acceso a la lista de usuarios (403)"
            description={forbidden}
          />
        </Card>
      </AdminPage>
    );
  }

  return (
    <AdminPage>
      <AdminPageHeader
        kicker="Administración"
        title="Usuarios"
        description="Cuentas del equipo y de los campistas: roles, estado y acceso."
        icon={Users}
        actions={
          <>
            <Button variant="secondary" icon={RefreshCw} onClick={load} disabled={loading}>
              Actualizar
            </Button>
            {canCreate && (
              <Button icon={UserPlus} onClick={() => setCreating(true)}>
                Nuevo usuario
              </Button>
            )}
          </>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard label="Total" value={loading ? '—' : stats.total} icon={Users} tone="sky" />
        <StatCard label="Equipo" value={loading ? '—' : stats.staff} icon={ShieldCheck} tone="violet" hint="Con rol administrativo" />
        <StatCard label="Campistas" value={loading ? '—' : stats.campers} icon={UserCheck} tone="emerald" />
        <StatCard label="Desactivados" value={loading ? '—' : stats.disabled} icon={UserX} tone="rose" />
      </div>

      <Card className="p-3 sm:p-4">
        <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_auto_auto] gap-2">
          <SearchInput value={search} onChange={setSearch} placeholder="Buscar por nombre, correo o celular…" />
          <SelectInput value={roleFilter} onChange={(e) => setRoleFilter(e.target.value as typeof roleFilter)} className="py-2 text-xs sm:w-52">
            <option value="ALL">Todos los roles</option>
            <option value="STAFF">Solo equipo</option>
            {roles.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </SelectInput>
          <SelectInput value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)} className="py-2 text-xs sm:w-40">
            <option value="ALL">Todos los estados</option>
            <option value="active">Activos</option>
            <option value="disabled">Desactivados</option>
          </SelectInput>
        </div>
      </Card>

      {loading ? (
        <Card className="p-4 space-y-3" aria-busy="true">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 animate-pulse">
              <div className="w-11 h-11 rounded-2xl bg-slate-100 shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-3 rounded-full bg-slate-100 w-1/3" />
                <div className="h-2.5 rounded-full bg-slate-100 w-1/2" />
              </div>
              <div className="hidden sm:block h-5 w-20 rounded-full bg-slate-100" />
            </div>
          ))}
        </Card>
      ) : loadError && users.length === 0 ? (
        <Card>
          <EmptyState
            icon={AlertCircle}
            title="No se pudo cargar la lista"
            description={loadError}
            action={
              <Button icon={RefreshCw} onClick={load}>
                Reintentar
              </Button>
            }
          />
        </Card>
      ) : filtered.length === 0 ? (
        <Card>
          <EmptyState
            icon={Users}
            title="No hay usuarios que coincidan"
            description="Prueba con otra búsqueda o quita los filtros."
            action={
              (search || roleFilter !== 'ALL' || statusFilter !== 'ALL') && (
                <Button
                  variant="secondary"
                  onClick={() => {
                    setSearch('');
                    setRoleFilter('ALL');
                    setStatusFilter('ALL');
                  }}
                >
                  Quitar filtros
                </Button>
              )
            }
          />
        </Card>
      ) : (
        <>
          <p className="text-[11px] text-slate-500 -mb-3">
            Mostrando <b>{filtered.length}</b> de {users.length} usuarios
          </p>

          {/* Escritorio: tabla */}
          <div className="hidden lg:block">
            <Table
              head={
                <tr>
                  <th className="px-4 py-3">Usuario</th>
                  <th className="px-4 py-3">Celular</th>
                  <th className="px-4 py-3">Rol</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3">Último acceso</th>
                  <th className="px-4 py-3 text-right">Acciones</th>
                </tr>
              }
            >
              {filtered.map((u) => (
                <tr key={u.id} className={`hover:bg-sky-50/40 ${u.status === 'disabled' ? 'bg-slate-50/60' : ''}`}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <Avatar user={u} />
                      <div className="min-w-0">
                        <p className="font-bold text-slate-900 truncate max-w-[16rem]">
                          {fullName(u)}
                          {u.id === currentUser?.id && <span className="ml-1.5 text-[10px] font-black text-[#0284C7]">(tú)</span>}
                        </p>
                        <p className="text-[11px] text-slate-500 truncate max-w-[16rem]">{u.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 font-mono text-[11px] whitespace-nowrap">{u.phone || '—'}</td>
                  <td className="px-4 py-3">
                    <RoleBadge role={u.role} label={roleName(u.role)} />
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={u.status} />
                  </td>
                  <td className="px-4 py-3 text-[11px] text-slate-500 whitespace-nowrap">{formatStamp(u.lastLoginAt)}</td>
                  <td className="px-4 py-3">
                    {renderActions(u)}
                  </td>
                </tr>
              ))}
            </Table>
          </div>

          {/* Móvil y tablet: tarjetas */}
          <div className="lg:hidden grid grid-cols-1 md:grid-cols-2 gap-3">
            {filtered.map((u) => (
              <Card key={u.id} className={`p-4 ${u.status === 'disabled' ? 'bg-slate-50' : ''}`}>
                <div className="flex items-start gap-3">
                  <Avatar user={u} />
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-sm text-slate-900 break-words">
                      {fullName(u)}
                      {u.id === currentUser?.id && <span className="ml-1.5 text-[10px] font-black text-[#0284C7]">(tú)</span>}
                    </p>
                    <p className="text-[11px] text-slate-500 break-all">{u.email}</p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <RoleBadge role={u.role} label={roleName(u.role)} />
                      <StatusBadge status={u.status} />
                    </div>
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                  <div className="text-[11px] text-slate-500 min-w-0">
                    <p className="font-mono truncate">{u.phone || 'Sin celular'}</p>
                    <p className="truncate">Último acceso: {formatStamp(u.lastLoginAt)}</p>
                  </div>
                  {renderActions(u, true)}
                </div>
              </Card>
            ))}
          </div>
        </>
      )}

      <UserFormModal
        open={creating || !!editing}
        user={editing}
        roles={roles.length ? roles : DEFAULT_ROLES.map((r) => ({ ...r, userCount: 0 }))}
        onClose={() => {
          setCreating(false);
          setEditing(null);
        }}
        onSaved={(u, isNew) => {
          replaceUser(u);
          if (u.id === currentUser?.id) reloadUser();
          setCreating(false);
          setEditing(null);
          refreshRoleCounts();
          toast({
            type: 'success',
            title: isNew ? 'Usuario creado' : 'Usuario actualizado',
            message: isNew ? `${fullName(u)} ya puede ingresar como ${roleName(u.role)}.` : undefined,
          });
        }}
      />

      <ResetPasswordModal
        user={resetting}
        onClose={() => setResetting(null)}
        onDone={(u) => {
          replaceUser(u);
          setResetting(null);
          toast({ type: 'success', title: 'Contraseña restablecida', message: `Se cerraron las sesiones de ${fullName(u)}.` });
        }}
      />
    </AdminPage>
  );
};
