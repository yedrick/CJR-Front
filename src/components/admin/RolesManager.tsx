import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Eye,
  KeyRound,
  Lock,
  RefreshCw,
  RotateCcw,
  Save,
  ShieldAlert,
  ShieldCheck,
  Undo2,
  Users,
} from 'lucide-react';
import { usersApi, RoleWithCount } from '../../api/services';
import { ApiError } from '../../api/errors';
import { ALL_PERMISSIONS, DEFAULT_ROLES, PERMISSIONS, PERMISSION_GROUPS, Permission, RoleId } from '../../auth/permissions';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../common/Toast';
import { useConfirm } from '../common/ConfirmDialog';
import { AdminPage, AdminPageHeader, Badge, Button, Card, EmptyState } from './ui';

const ROLE_ACCENT: Record<string, { band: string; text: string; dot: string }> = {
  super_admin: { band: 'from-violet-500 to-indigo-600', text: 'text-violet-700', dot: 'bg-violet-500' },
  admin: { band: 'from-sky-500 to-[#0284C7]', text: 'text-sky-700', dot: 'bg-sky-500' },
  tesorero: { band: 'from-emerald-400 to-emerald-600', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  coordinador: { band: 'from-amber-400 to-orange-500', text: 'text-amber-700', dot: 'bg-amber-500' },
  control_acceso: { band: 'from-indigo-400 to-indigo-600', text: 'text-indigo-700', dot: 'bg-indigo-500' },
  campista: { band: 'from-slate-300 to-slate-400', text: 'text-slate-600', dot: 'bg-slate-400' },
};
const accent = (id: string) => ROLE_ACCENT[id] || ROLE_ACCENT.campista;

const GROUPED = PERMISSION_GROUPS.map((g) => ({
  ...g,
  perms: ALL_PERMISSIONS.filter((p) => p.split(':')[0] === g.resource),
})).filter((g) => g.perms.length > 0);

const sameSet = (a: readonly string[], b: readonly string[]) => a.length === b.length && a.every((x) => b.includes(x));

/** Casilla con estado intermedio (para los encabezados de grupo). */
const Check: React.FC<{
  checked: boolean;
  indeterminate?: boolean;
  disabled?: boolean;
  onChange: (v: boolean) => void;
  label: string;
}> = ({ checked, indeterminate = false, disabled, onChange, label }) => (
  <input
    type="checkbox"
    checked={checked}
    ref={(el) => {
      if (el) el.indeterminate = indeterminate;
    }}
    disabled={disabled}
    onChange={(e) => onChange(e.target.checked)}
    aria-label={label}
    className="w-4 h-4 rounded accent-[#0284C7] cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
  />
);

export const RolesManager: React.FC = () => {
  const { can, reloadUser } = useAuth();
  const { toast, toastError } = useToast();
  const { confirm } = useConfirm();
  const canEdit = can('roles:update');

  const [roles, setRoles] = useState<RoleWithCount[]>([]);
  const [drafts, setDrafts] = useState<Partial<Record<RoleId, Permission[]>>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<{ status?: number; message: string } | null>(null);
  const [savingId, setSavingId] = useState<RoleId | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRoles(await usersApi.roles());
    } catch (e) {
      setError({ status: e instanceof ApiError ? e.status : undefined, message: e instanceof Error ? e.message : 'Error al cargar.' });
      if (!(e instanceof ApiError && e.status === 403)) toastError(e, 'No se pudieron cargar los roles');
    } finally {
      setLoading(false);
    }
  }, [toastError]);

  useEffect(() => {
    load();
  }, [load]);

  const isEditable = (id: RoleId) => canEdit && id !== 'super_admin' && id !== 'campista';

  /** Permisos que se muestran (borrador si existe). */
  const permsOf = useCallback(
    (r: RoleWithCount): Permission[] => {
      if (r.id === 'super_admin') return ALL_PERMISSIONS;
      if (r.id === 'campista') return [];
      return drafts[r.id] ?? r.permissions;
    },
    [drafts]
  );

  const isDirty = useCallback((r: RoleWithCount) => !!drafts[r.id] && !sameSet(drafts[r.id]!, r.permissions), [drafts]);
  const dirtyRoles = useMemo(() => roles.filter(isDirty), [roles, isDirty]);

  const setDraft = (r: RoleWithCount, next: Permission[]) => {
    // mantener el orden canónico
    const ordered = ALL_PERMISSIONS.filter((p) => next.includes(p));
    setDrafts((d) => {
      if (sameSet(ordered, r.permissions)) {
        const { [r.id]: _omit, ...rest } = d;
        return rest;
      }
      return { ...d, [r.id]: ordered };
    });
  };

  const toggle = (r: RoleWithCount, perm: Permission, value: boolean) => {
    if (!isEditable(r.id)) return;
    const current = permsOf(r);
    setDraft(r, value ? [...current, perm] : current.filter((p) => p !== perm));
  };

  const toggleGroup = (r: RoleWithCount, perms: Permission[], value: boolean) => {
    if (!isEditable(r.id)) return;
    const current = permsOf(r).filter((p) => !perms.includes(p));
    setDraft(r, value ? [...current, ...perms] : current);
  };

  const discard = (r: RoleWithCount) =>
    setDrafts((d) => {
      const { [r.id]: _omit, ...rest } = d;
      return rest;
    });

  const restoreDefaults = (r: RoleWithCount) => {
    const def = DEFAULT_ROLES.find((x) => x.id === r.id);
    if (!def) return;
    setDraft(r, def.permissions);
    toast({
      type: 'info',
      title: `Valores por defecto de «${r.name}»`,
      message: 'Se cargaron como borrador. Revisa y pulsa «Guardar cambios» para aplicarlos.',
    });
  };

  const save = async (r: RoleWithCount) => {
    const next = drafts[r.id];
    if (!next) return;
    const added = next.filter((p) => !r.permissions.includes(p));
    const removed = r.permissions.filter((p) => !next.includes(p));
    const ok = await confirm({
      title: `¿Guardar los permisos de «${r.name}»?`,
      message: (
        <>
          El cambio afecta a <b>{r.userCount}</b> {r.userCount === 1 ? 'usuario' : 'usuarios'} con este rol desde su próxima acción.
        </>
      ),
      details: [
        ...added.map((p) => (
          <span key={`a-${p}`} className="text-emerald-700">
            <b>+</b> {PERMISSIONS[p]} <span className="font-mono text-[10px] text-slate-400">({p})</span>
          </span>
        )),
        ...removed.map((p) => (
          <span key={`r-${p}`} className="text-red-700">
            <b>−</b> {PERMISSIONS[p]} <span className="font-mono text-[10px] text-slate-400">({p})</span>
          </span>
        )),
      ],
      confirmText: 'Guardar cambios',
      tone: removed.length ? 'warning' : 'info',
    });
    if (!ok) return;
    setSavingId(r.id);
    try {
      const saved = await usersApi.updateRole(r.id, next);
      setRoles((list) => list.map((x) => (x.id === r.id ? { ...x, ...saved, userCount: x.userCount } : x)));
      discard(r);
      toast({
        type: 'success',
        title: 'Permisos actualizados',
        message: `«${r.name}»: ${added.length} agregados, ${removed.length} quitados.`,
      });
      // Por si el rol modificado es el del usuario actual (si cambian sus permisos, CampContext recarga los datos)
      await reloadUser();
    } catch (e) {
      toastError(e);
    } finally {
      setSavingId(null);
    }
  };

  if (!loading && error) {
    return (
      <AdminPage>
        <AdminPageHeader kicker="Administración" title="Roles y permisos" icon={KeyRound} />
        <Card>
          <EmptyState
            icon={error.status === 403 ? ShieldAlert : AlertCircle}
            title={error.status === 403 ? 'No tienes acceso a los roles (403)' : 'No se pudieron cargar los roles'}
            description={error.message}
            action={
              error.status !== 403 && (
                <Button icon={RefreshCw} onClick={load}>
                  Reintentar
                </Button>
              )
            }
          />
        </Card>
      </AdminPage>
    );
  }

  return (
    <AdminPage>
      <AdminPageHeader
        kicker="Administración"
        title="Roles y permisos"
        description="Define qué puede hacer cada rol del equipo. El servidor valida estos permisos en cada solicitud."
        icon={KeyRound}
        actions={
          <Button variant="secondary" icon={RefreshCw} onClick={load} disabled={loading || !!savingId}>
            Actualizar
          </Button>
        }
      />

      {!canEdit && (
        <div className="flex items-start gap-3 p-4 rounded-3xl bg-sky-50 border border-sky-200 text-sm text-sky-900">
          <Eye className="w-5 h-5 shrink-0 mt-0.5 text-[#0284C7]" />
          <div>
            <p className="font-black">Modo de solo lectura</p>
            <p className="text-xs mt-0.5">
              Puedes consultar los permisos de cada rol, pero no modificarlos. Para hacerlo se necesita el permiso «
              {PERMISSIONS['roles:update']}».
            </p>
          </div>
        </div>
      )}

      {/* Tarjetas de roles */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="p-5 space-y-3 animate-pulse">
              <div className="h-4 w-1/2 rounded-full bg-slate-100" />
              <div className="h-3 w-full rounded-full bg-slate-100" />
              <div className="h-3 w-2/3 rounded-full bg-slate-100" />
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {roles.map((r) => {
            const a = accent(r.id);
            const perms = permsOf(r);
            const dirty = isDirty(r);
            const editable = isEditable(r.id);
            const saving = savingId === r.id;
            const def = DEFAULT_ROLES.find((x) => x.id === r.id);
            const isDefault = !!def && sameSet(perms, def.permissions);
            return (
              <Card key={r.id} className={`overflow-hidden flex flex-col ${dirty ? 'ring-2 ring-amber-300' : ''}`}>
                <div className={`h-1.5 bg-gradient-to-r ${a.band}`} />
                <div className="p-5 flex-1 flex flex-col gap-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="text-base font-black text-slate-900 font-display leading-tight">{r.name}</h3>
                      <p className="font-mono text-[10px] text-slate-400 mt-0.5">{r.id}</p>
                    </div>
                    <div className="flex flex-wrap justify-end gap-1 shrink-0">
                      {r.locked && (
                        <Badge className="bg-slate-100 text-slate-600 border-slate-200">
                          <Lock className="w-3 h-3" /> Sistema
                        </Badge>
                      )}
                      {dirty && <Badge className="bg-amber-50 text-amber-700 border-amber-200">Sin guardar</Badge>}
                    </div>
                  </div>
                  <p className="text-xs text-slate-500 leading-relaxed flex-1">{r.description}</p>
                  <div className="flex items-center gap-4 text-xs">
                    <span className="inline-flex items-center gap-1.5 text-slate-600">
                      <Users className="w-3.5 h-3.5 text-slate-400" />
                      <b className="font-mono">{r.userCount}</b> {r.userCount === 1 ? 'usuario' : 'usuarios'}
                    </span>
                    <span className={`inline-flex items-center gap-1.5 ${a.text}`}>
                      <ShieldCheck className="w-3.5 h-3.5" />
                      <b className="font-mono">{perms.length}</b>/{ALL_PERMISSIONS.length} permisos
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden" aria-hidden="true">
                    <div className={`h-full rounded-full bg-gradient-to-r ${a.band}`} style={{ width: `${(perms.length / ALL_PERMISSIONS.length) * 100}%` }} />
                  </div>

                  {r.id === 'super_admin' && (
                    <p className="text-[11px] text-slate-500 italic">Siempre tiene todos los permisos; no se puede modificar.</p>
                  )}
                  {r.id === 'campista' && (
                    <p className="text-[11px] text-slate-500 italic">Solo gestiona sus propias inscripciones; no recibe permisos del panel.</p>
                  )}
                  {editable && (
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={RotateCcw}
                        onClick={() => restoreDefaults(r)}
                        disabled={saving || isDefault}
                        title={isDefault ? 'Ya tiene los valores por defecto' : 'Cargar los permisos por defecto como borrador'}
                      >
                        Restablecer
                      </Button>
                      {dirty && (
                        <>
                          <Button variant="secondary" size="sm" icon={Undo2} onClick={() => discard(r)} disabled={saving}>
                            Descartar
                          </Button>
                          <Button size="sm" icon={Save} onClick={() => save(r)} disabled={saving} className="ml-auto">
                            {saving ? 'Guardando…' : 'Guardar cambios'}
                          </Button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Matriz de permisos */}
      {!loading && roles.length > 0 && (
        <Card className="overflow-hidden">
          <div className="px-4 sm:px-5 py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-black text-slate-900">Matriz de permisos</h3>
              <p className="text-[11px] text-slate-500">
                {canEdit ? 'Marca o desmarca para preparar los cambios; se aplican al pulsar «Guardar cambios».' : 'Vista de consulta.'}
              </p>
            </div>
            <span className="text-[11px] text-slate-400 sm:hidden">Desliza para ver todos los roles →</span>
          </div>
          <div className="overflow-auto max-h-[70vh] overscroll-x-contain">
            <table className="w-full text-xs border-separate border-spacing-0" style={{ minWidth: `${14 + roles.length * 7.5}rem` }}>
              <thead>
                <tr>
                  <th className="sticky top-0 left-0 z-30 bg-slate-50 border-b border-r border-slate-100 px-3 sm:px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-slate-500 w-44 sm:w-72">
                    Permiso
                  </th>
                  {roles.map((r) => (
                    <th
                      key={r.id}
                      className="sticky top-0 z-20 bg-slate-50 border-b border-slate-100 px-2 py-3 text-center align-bottom min-w-[7.5rem]"
                    >
                      <span className="inline-flex flex-col items-center gap-1">
                        <span className={`w-2 h-2 rounded-full ${accent(r.id).dot}`} />
                        <span className="text-[11px] font-black text-slate-800 leading-tight">{r.name}</span>
                        {isDirty(r) ? (
                          <span className="text-[9px] font-black uppercase text-amber-600">Sin guardar</span>
                        ) : !isEditable(r.id) ? (
                          <span className="text-[9px] font-bold uppercase text-slate-400 inline-flex items-center gap-0.5">
                            <Lock className="w-2.5 h-2.5" /> Fijo
                          </span>
                        ) : (
                          <span className="text-[9px] text-transparent select-none">·</span>
                        )}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {GROUPED.map((g) => (
                  <React.Fragment key={g.resource}>
                    <tr>
                      <th
                        scope="rowgroup"
                        className="sticky left-0 z-10 bg-sky-50 border-b border-r border-sky-100 px-3 sm:px-4 py-2 text-left text-[10px] font-black uppercase tracking-widest text-[#0284C7]"
                      >
                        {g.label}
                      </th>
                      {roles.map((r) => {
                        const perms = permsOf(r);
                        const count = g.perms.filter((p) => perms.includes(p)).length;
                        return (
                          <td key={r.id} className="bg-sky-50 border-b border-sky-100 px-2 py-2 text-center">
                            <Check
                              checked={count === g.perms.length}
                              indeterminate={count > 0 && count < g.perms.length}
                              disabled={!isEditable(r.id) || savingId === r.id}
                              onChange={(v) => toggleGroup(r, g.perms, v)}
                              label={`${g.label}: todos los permisos para ${r.name}`}
                            />
                          </td>
                        );
                      })}
                    </tr>
                    {g.perms.map((p) => (
                      <tr key={p} className="group">
                        <th
                          scope="row"
                          className="sticky left-0 z-10 bg-white group-hover:bg-slate-50 border-b border-r border-slate-100 px-3 sm:px-4 py-2.5 text-left font-normal"
                        >
                          <span className="block text-xs text-slate-700 leading-snug">{PERMISSIONS[p]}</span>
                          <span className="block font-mono text-[10px] text-slate-400 truncate">{p}</span>
                        </th>
                        {roles.map((r) => {
                          const checked = permsOf(r).includes(p);
                          const changed = isDirty(r) && checked !== r.permissions.includes(p);
                          return (
                            <td
                              key={r.id}
                              className={`border-b border-slate-100 px-2 py-2.5 text-center group-hover:bg-slate-50 ${
                                changed ? (checked ? 'bg-emerald-50' : 'bg-red-50') : ''
                              }`}
                            >
                              <Check
                                checked={checked}
                                disabled={!isEditable(r.id) || savingId === r.id}
                                onChange={(v) => toggle(r, p, v)}
                                label={`${PERMISSIONS[p]} para ${r.name}`}
                              />
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Barra de cambios pendientes */}
      {dirtyRoles.length > 0 && (
        <div className="sticky bottom-20 lg:bottom-4 z-30 animate-fade-in-up">
          <div className="mx-auto max-w-3xl rounded-3xl bg-slate-900 text-white shadow-2xl px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3">
            <p className="text-xs flex-1 min-w-0">
              <span className="font-black">Cambios sin guardar</span> en {dirtyRoles.map((r) => `«${r.name}»`).join(', ')}.
            </p>
            <div className="flex flex-wrap gap-2">
              {dirtyRoles.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => save(r)}
                  disabled={!!savingId}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#0284C7] hover:bg-sky-500 text-[11px] font-bold cursor-pointer disabled:opacity-50"
                >
                  <Save className="w-3.5 h-3.5" /> Guardar {r.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </AdminPage>
  );
};
