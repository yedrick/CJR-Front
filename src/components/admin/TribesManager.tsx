import React, { useMemo, useState } from 'react';
import { AlertCircle, Crown, Edit3, Hash, Loader2, Lock, Palette, PawPrint, Plus, Shield, Shuffle, Trash2, Users } from 'lucide-react';
import { useCamp } from '../../context/CampContext';
import type { CamperRegistration, TribeGroup } from '../../types/camp';
import { animalEmoji, colorName, initials, uid } from '../../utils/campUtils';
import { useConfirm } from '../common/ConfirmDialog';
import { useAuth } from '../../context/AuthContext';
import {
  AdminPage,
  AdminPageHeader,
  Badge,
  Button,
  Card,
  CampFilterSelect,
  EmptyState,
  Field,
  FormSection,
  Modal,
  TextInput,
} from './ui';

const PRESET_COLORS = [
  '#0284C7',
  '#2563EB',
  '#4F46E5',
  '#7C3AED',
  '#DB2777',
  '#DC2626',
  '#EA580C',
  '#D97706',
  '#059669',
  '#0D9488',
  '#0891B2',
  '#1E293B',
];

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

/** Mezcla el color con blanco para obtener un fondo claro de acento. */
const lightTint = (hex: string, amount = 0.92): string => {
  if (!HEX_RE.test(hex)) return '#F0F9FF';
  const n = parseInt(hex.slice(1), 16);
  const mix = (c: number) => Math.round(c + (255 - c) * amount);
  const r = mix((n >> 16) & 255);
  const g = mix((n >> 8) & 255);
  const b = mix(n & 255);
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`.toUpperCase();
};

type TribeForm = Omit<TribeGroup, 'id' | 'accentBg'>;
type FormErrors = Partial<Record<'name' | 'number' | 'colorHex', string>>;

const MAX_AVATARS = 8;

export const TribesManager: React.FC = () => {
  const {
    tribes,
    registrations,
    adminCampFilter,
    getCampById,
    saveTribe,
    deleteTribe,
    setSelectedCamperForBadge,
  } = useCamp();
  const { confirm, notify } = useConfirm();
  const { can } = useAuth();
  const canCreate = can('tribes:create');
  const canUpdate = can('tribes:update');
  const canDelete = can('tribes:delete');
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<TribeForm>({
    number: 1,
    name: '',
    colorHex: PRESET_COLORS[0],
    animalSymbol: '',
    leaderName: '',
    motto: '',
  });
  const [errors, setErrors] = useState<FormErrors>({});

  const filteredCamp = adminCampFilter !== 'ALL' ? getCampById(adminCampFilter) : undefined;
  const sortedTribes = useMemo(() => [...tribes].sort((a, b) => a.number - b.number), [tribes]);

  const scopedRegistrations = useMemo(
    () => (adminCampFilter === 'ALL' ? registrations : registrations.filter((r) => r.campId === adminCampFilter)),
    [registrations, adminCampFilter]
  );

  const membersByTribe = useMemo(() => {
    const map: Record<string, CamperRegistration[]> = {};
    tribes.forEach((t) => (map[t.id] = []));
    scopedRegistrations.forEach((r) => {
      if (map[r.tribeId]) map[r.tribeId].push(r);
    });
    Object.values(map).forEach((list) => list.sort((a, b) => a.fullName.localeCompare(b.fullName, 'es')));
    return map;
  }, [tribes, scopedRegistrations]);

  const counts = sortedTribes.map((t) => membersByTribe[t.id]?.length || 0);
  const maxCount = counts.length ? Math.max(...counts) : 0;
  const minCount = counts.length ? Math.min(...counts) : 0;
  const assigned = counts.reduce((a, b) => a + b, 0);
  const average = tribes.length ? assigned / tribes.length : 0;

  const patch = (updates: Partial<TribeForm>) => setForm((f) => ({ ...f, ...updates }));

  const openCreate = () => {
    const nextNumber = tribes.reduce((max, t) => Math.max(max, t.number), 0) + 1;
    const usedColors = new Set(tribes.map((t) => t.colorHex.toUpperCase()));
    setEditingId(null);
    setForm({
      number: nextNumber,
      name: `Tribu ${nextNumber}: `,
      colorHex: PRESET_COLORS.find((c) => !usedColors.has(c)) || PRESET_COLORS[0],
      animalSymbol: '',
      leaderName: '',
      motto: '',
    });
    setErrors({});
    setFormOpen(true);
  };

  const openEdit = (t: TribeGroup) => {
    setEditingId(t.id);
    setForm({
      number: t.number,
      name: t.name,
      colorHex: t.colorHex,
      animalSymbol: t.animalSymbol,
      leaderName: t.leaderName,
      motto: t.motto,
    });
    setErrors({});
    setFormOpen(true);
  };

  const closeForm = () => {
    if (saving) return;
    setFormOpen(false);
    setEditingId(null);
  };

  const handleSave = async (ev?: React.FormEvent) => {
    ev?.preventDefault();
    if (saving || !(editingId ? canUpdate : canCreate)) return;
    const e: FormErrors = {};
    if (!form.name.trim()) e.name = 'El nombre es obligatorio.';
    if (!Number.isInteger(form.number) || form.number < 1) e.number = 'Debe ser un número entero mayor a 0.';
    else if (tribes.some((t) => t.number === form.number && t.id !== editingId))
      e.number = `Ya existe una tribu con el número ${form.number}.`;
    if (!HEX_RE.test(form.colorHex)) e.colorHex = 'Usa un color hexadecimal válido (ej. #0284C7).';
    setErrors(e);
    if (Object.keys(e).length > 0) return;

    const colorHex = form.colorHex.toUpperCase();
    setSaving(true);
    const saved = await saveTribe({
      id: editingId || uid('t'),
      number: form.number,
      name: form.name.trim(),
      colorHex,
      accentBg: lightTint(colorHex),
      animalSymbol: form.animalSymbol.trim() || 'Emblema',
      leaderName: form.leaderName.trim() || 'Líder por asignar',
      motto: form.motto.trim(),
    }).finally(() => setSaving(false));
    if (!saved) return; // error (403/409/422): el formulario queda abierto
    setFormOpen(false);
    setEditingId(null);
  };

  const handleDelete = async (t: TribeGroup) => {
    const members = registrations.filter((r) => r.tribeId === t.id);
    if (members.length > 0) {
      const byCamp = members.reduce<Record<string, number>>((acc, r) => {
        acc[r.campId] = (acc[r.campId] || 0) + 1;
        return acc;
      }, {});
      await notify({
        tone: 'warning',
        title: `No se puede eliminar «${t.name}»`,
        message: `Esta tribu tiene ${members.length} ${
          members.length === 1 ? 'joven asignado' : 'jóvenes asignados'
        }. Reasígnalos a otra tribu desde Inscritos → Editar antes de eliminarla.`,
        details: [
          ...Object.entries(byCamp).map(
            ([campId, n]) =>
              `${getCampById(campId)?.name || 'Sin campamento'}: ${n} ${n === 1 ? 'integrante' : 'integrantes'}`
          ),
          'Así ningún joven se queda sin tribu ni con una credencial inválida.',
        ],
      });
      return;
    }
    const ok = await confirm({
      tone: 'danger',
      title: `¿Eliminar la tribu «${t.name}»?`,
      message: 'La tribu dejará de estar disponible para las próximas asignaciones automáticas.',
      details: [
        `Tribu N.º ${t.number} · ${t.animalSymbol || 'Sin emblema'} · líder ${t.leaderName || 'por asignar'}`,
        'No tiene integrantes asignados en ningún campamento.',
        `Quedarán ${tribes.length - 1} ${tribes.length - 1 === 1 ? 'tribu' : 'tribus'} para repartir a los nuevos inscritos.`,
        'Esta acción no se puede deshacer.',
      ],
      confirmText: 'Sí, eliminar tribu',
    });
    if (!ok) return;
    setDeletingId(t.id);
    try {
      await deleteTribe(t.id);
    } finally {
      setDeletingId(null);
    }
  };

  const previewColor = HEX_RE.test(form.colorHex) ? form.colorHex : '#0284C7';
  const previewTint = lightTint(previewColor);
  const editingTribe = editingId ? tribes.find((t) => t.id === editingId) : undefined;
  const editingMembers = editingId ? registrations.filter((r) => r.tribeId === editingId).length : 0;
  const colorTaken = tribes.find(
    (t) => t.id !== editingId && t.colorHex.toUpperCase() === form.colorHex.toUpperCase()
  );

  return (
    <AdminPage>
      <AdminPageHeader
        kicker="Tribus"
        title="Tribus del campamento"
        description="Cada joven inscrito se asigna automáticamente a la tribu con menos integrantes dentro de su campamento, para que los grupos queden equilibrados."
        icon={Shield}
        actions={
          <>
            {!canCreate && !canUpdate && !canDelete && (
              <Badge className="bg-slate-100 text-slate-600 border-slate-200">
                <Lock className="w-3 h-3" /> Solo lectura
              </Badge>
            )}
            <CampFilterSelect className="w-full sm:w-72" />
            {canCreate && (
              <Button icon={Plus} onClick={openCreate}>
                Nueva tribu
              </Button>
            )}
          </>
        }
      />

      <Card className="p-4 sm:p-5">
        <div className="flex flex-col lg:flex-row lg:items-center gap-4">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <div className="p-2.5 rounded-2xl bg-sky-50 text-[#0284C7] shrink-0">
              <Shuffle className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-black text-slate-900">Asignación automática y equilibrada</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {filteredCamp
                  ? `Mostrando integrantes de ${filteredCamp.name}. Al inscribirse, cada joven entra a la tribu con menos miembros de este campamento.`
                  : 'Mostrando integrantes de todos los campamentos. El equilibrio se calcula por separado en cada campamento; elige uno para ver su distribución.'}
              </p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 shrink-0">
            {[
              { label: 'Tribus', value: tribes.length },
              { label: 'Asignados', value: assigned },
              { label: 'Promedio', value: average.toFixed(1) },
            ].map((s) => (
              <div key={s.label} className="px-3 py-2 rounded-2xl bg-sky-50 text-center min-w-20">
                <div className="text-lg font-black text-[#0284C7] font-mono tabular-nums">{s.value}</div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
        {filteredCamp && assigned > 0 && (
          <p className="mt-3 text-[11px] text-slate-500">
            Diferencia entre la tribu más grande y la más pequeña:{' '}
            <span className={`font-bold ${maxCount - minCount <= 1 ? 'text-emerald-600' : 'text-amber-600'}`}>
              {maxCount - minCount} {maxCount - minCount === 1 ? 'integrante' : 'integrantes'}
            </span>
            {maxCount - minCount <= 1 ? ' · distribución equilibrada.' : '.'}
          </p>
        )}
      </Card>

      {sortedTribes.length === 0 ? (
        <Card>
          <EmptyState
            icon={Shield}
            title="No hay tribus configuradas"
            description="Crea las tribus para que el sistema pueda asignar a los jóvenes automáticamente."
            action={
              canCreate ? (
                <Button icon={Plus} onClick={openCreate}>
                  Nueva tribu
                </Button>
              ) : undefined
            }
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {sortedTribes.map((tribe) => {
            const members = membersByTribe[tribe.id] || [];
            const pct = maxCount > 0 ? (members.length / maxCount) * 100 : 0;
            return (
              <Card key={tribe.id} className="overflow-hidden flex flex-col hover:shadow-md transition-shadow">
                <div className="p-4 text-white relative" style={{ backgroundColor: tribe.colorHex }}>
                  <div className="flex items-start justify-between gap-2">
                    <span className="w-12 h-12 rounded-2xl bg-white/20 ring-1 ring-white/30 flex items-center justify-center text-2xl font-black font-mono tabular-nums">
                      {tribe.number}
                    </span>
                    <div className="flex gap-1">
                      {canUpdate && (
                        <button
                          type="button"
                          onClick={() => openEdit(tribe)}
                          className="p-1.5 rounded-lg bg-black/15 hover:bg-black/30 transition-colors cursor-pointer"
                          title="Editar tribu"
                          aria-label="Editar tribu"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {canDelete && (
                        <button
                          type="button"
                          onClick={() => handleDelete(tribe)}
                          disabled={!!deletingId}
                          className="p-1.5 rounded-lg bg-black/15 hover:bg-black/30 transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-wait"
                          title="Eliminar tribu"
                          aria-label="Eliminar tribu"
                        >
                          {deletingId === tribe.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="w-3.5 h-3.5" />
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                  <h3 className="text-base font-black font-display mt-3 leading-tight">{tribe.name}</h3>
                  <span className="mt-1.5 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/20 text-[10px] font-bold">
                    <PawPrint className="w-3 h-3" /> {tribe.animalSymbol}
                  </span>
                  {tribe.motto && (
                    <p className="text-[11px] text-white/90 italic mt-2 line-clamp-2">“{tribe.motto}”</p>
                  )}
                </div>

                <div className="p-4 flex-1 flex flex-col gap-3" style={{ backgroundColor: tribe.accentBg || undefined }}>
                  <div className="flex items-center gap-2 text-xs text-slate-700">
                    <Crown className="w-3.5 h-3.5 shrink-0" style={{ color: tribe.colorHex }} />
                    <span className="truncate">
                      <span className="text-slate-500">Líder:</span> <span className="font-bold">{tribe.leaderName}</span>
                    </span>
                  </div>

                  <div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="flex items-center gap-1.5 font-bold text-slate-700">
                        <Users className="w-3.5 h-3.5 text-slate-400" /> Integrantes
                      </span>
                      <span className="font-mono font-black tabular-nums" style={{ color: tribe.colorHex }}>
                        {members.length}
                      </span>
                    </div>
                    <div className="mt-1.5 h-1.5 rounded-full bg-white/80 overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: tribe.colorHex }} />
                    </div>
                  </div>

                  {members.length > 0 ? (
                    <>
                      <div className="flex -space-x-2">
                        {members.slice(0, MAX_AVATARS).map((m) => (
                          <button
                            key={m.id}
                            type="button"
                            onClick={() => setSelectedCamperForBadge(m)}
                            title={`${m.fullName} · ver credencial`}
                            className="w-8 h-8 rounded-full ring-2 ring-white text-white text-[10px] font-black flex items-center justify-center hover:-translate-y-0.5 transition-transform cursor-pointer"
                            style={{ backgroundColor: tribe.colorHex }}
                          >
                            {initials(m.fullName)}
                          </button>
                        ))}
                        {members.length > MAX_AVATARS && (
                          <span className="w-8 h-8 rounded-full ring-2 ring-white bg-slate-200 text-slate-600 text-[10px] font-black flex items-center justify-center">
                            +{members.length - MAX_AVATARS}
                          </span>
                        )}
                      </div>
                      <ul className="space-y-1 max-h-40 overflow-y-auto pr-1">
                        {members.map((m) => (
                          <li key={m.id}>
                            <button
                              type="button"
                              onClick={() => setSelectedCamperForBadge(m)}
                              className="w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl bg-white/80 hover:bg-white border border-white text-left transition-colors cursor-pointer"
                            >
                              <span className="min-w-0">
                                <span className="block text-xs font-bold text-slate-800 truncate">{m.fullName}</span>
                                <span className="block text-[10px] text-slate-400 truncate">
                                  <span className="font-mono">{m.ticketCode}</span>
                                  {adminCampFilter === 'ALL' ? ` · ${getCampById(m.campId)?.name || 'Sin campamento'}` : ` · ${m.regional}`}
                                </span>
                              </span>
                              <span className="text-[10px] font-bold shrink-0" style={{ color: tribe.colorHex }}>
                                Credencial
                              </span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    </>
                  ) : (
                    <p className="text-[11px] text-slate-400 text-center py-3">Lista para recibir asignaciones automáticas.</p>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Modal
        open={formOpen}
        onClose={closeForm}
        size="lg"
        icon={Shield}
        title={editingId ? 'Editar tribu' : 'Nueva tribu'}
        subtitle={
          editingTribe
            ? `Editando · ${editingTribe.name} · ${editingMembers} ${editingMembers === 1 ? 'integrante' : 'integrantes'}`
            : 'El color identifica a la tribu en credenciales, listados y el escáner.'
        }
        footer={
          <>
            <Button variant="ghost" onClick={closeForm} disabled={saving}>
              Cancelar
            </Button>
            <Button
              icon={saving ? Loader2 : editingId ? undefined : Plus}
              onClick={() => handleSave()}
              disabled={saving}
              className={saving ? '[&>svg]:animate-spin' : ''}
            >
              {saving ? 'Guardando…' : editingId ? 'Guardar cambios' : 'Crear tribu'}
            </Button>
          </>
        }
      >
        <form onSubmit={handleSave} className="space-y-4" noValidate>
          {/* Vista previa en vivo */}
          <div className="rounded-2xl overflow-hidden border border-slate-100 shadow-sm">
            <div className="px-4 py-4 text-white relative" style={{ backgroundColor: previewColor }}>
              <span className="absolute top-3 right-3 text-[9px] font-black uppercase tracking-widest bg-black/20 px-2 py-0.5 rounded-full">
                Vista previa
              </span>
              <div className="flex items-center gap-3 pr-20">
                <span className="w-12 h-12 rounded-2xl bg-white/20 ring-1 ring-white/30 flex items-center justify-center text-2xl font-black font-mono tabular-nums shrink-0">
                  {form.number || '?'}
                </span>
                <div className="min-w-0">
                  <p className="text-base font-black font-display leading-tight truncate">
                    {form.name.trim() || 'Nombre de la tribu'}
                  </p>
                  <span className="mt-1 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/20 text-[10px] font-bold">
                    <span aria-hidden="true">{animalEmoji(form.animalSymbol)}</span> {form.animalSymbol.trim() || 'Emblema'}
                  </span>
                </div>
              </div>
              {form.motto.trim() && <p className="text-[11px] text-white/90 italic mt-2 line-clamp-2">“{form.motto.trim()}”</p>}
            </div>
            <div
              className="px-4 py-2.5 text-[11px] text-slate-600 flex flex-wrap items-center justify-between gap-2"
              style={{ backgroundColor: previewTint }}
            >
              <span className="flex items-center gap-1.5 min-w-0">
                <Crown className="w-3.5 h-3.5 shrink-0" style={{ color: previewColor }} />
                <span className="truncate">
                  Líder: <span className="font-bold text-slate-800">{form.leaderName.trim() || 'Por asignar'}</span>
                </span>
              </span>
              <span className="font-mono font-bold">
                {colorName(previewColor)} · {previewColor.toUpperCase()}
              </span>
            </div>
          </div>

          {Object.keys(errors).length > 0 && (
            <div className="flex items-start gap-2 p-3 rounded-2xl bg-red-50 border border-red-200 text-xs text-red-700 font-semibold">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              Revisa los campos marcados antes de guardar.
            </div>
          )}

          <FormSection title="Identidad" description="Número y nombre con los que aparece en la credencial." icon={Hash}>
            <div className="grid grid-cols-[96px_minmax(0,1fr)] sm:grid-cols-[120px_minmax(0,1fr)] gap-3">
              <Field label="Número" required error={errors.number}>
                <TextInput
                  type="number"
                  min={1}
                  value={Number.isNaN(form.number) ? '' : form.number}
                  onChange={(e) => patch({ number: e.target.value === '' ? NaN : Number(e.target.value) })}
                />
              </Field>
              <Field label="Nombre" required error={errors.name}>
                <TextInput
                  value={form.name}
                  placeholder="Ej. Tribu 1: Leones de Judá"
                  onChange={(e) => patch({ name: e.target.value })}
                />
              </Field>
            </div>
          </FormSection>

          <FormSection title="Color" description="Se usa en la credencial, el avatar y el escáner de acceso." icon={Palette}>
            <div className="flex flex-wrap gap-2">
              {PRESET_COLORS.map((c) => {
                const active = form.colorHex.toUpperCase() === c;
                const taken = tribes.some((t) => t.id !== editingId && t.colorHex.toUpperCase() === c);
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => patch({ colorHex: c })}
                    className={`relative w-8 h-8 rounded-full transition-transform cursor-pointer ${
                      active ? 'scale-110 ring-2 ring-offset-2 ring-slate-900' : 'hover:scale-110'
                    }`}
                    style={{ backgroundColor: c }}
                    title={`${colorName(c)} ${c}${taken ? ' · ya en uso' : ''}`}
                    aria-label={`Color ${colorName(c)}${taken ? ' (ya en uso)' : ''}`}
                    aria-pressed={active}
                  >
                    {taken && !active && (
                      <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-white ring-2 ring-slate-300" />
                    )}
                  </button>
                );
              })}
            </div>
            <Field label="Color personalizado" required error={errors.colorHex} hint="Formato hexadecimal, ej. #0284C7.">
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={previewColor}
                  onChange={(e) => patch({ colorHex: e.target.value.toUpperCase() })}
                  className="w-11 h-10 rounded-xl border border-slate-200 cursor-pointer p-0.5 bg-white shrink-0"
                  aria-label="Elegir color personalizado"
                />
                <TextInput
                  value={form.colorHex}
                  onChange={(e) => patch({ colorHex: e.target.value })}
                  className="font-mono uppercase"
                  maxLength={7}
                />
              </div>
            </Field>
            {colorTaken && (
              <Badge className="bg-amber-50 text-amber-700 border-amber-200">
                <AlertCircle className="w-3 h-3" /> {colorTaken.name} ya usa este color
              </Badge>
            )}
          </FormSection>

          <FormSection title="Emblema y liderazgo" description="Datos opcionales que acompañan a la tribu." icon={Crown}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Animal / emblema" hint="Ej. León, Águila, Jaguar.">
                <TextInput
                  value={form.animalSymbol}
                  placeholder="Ej. León"
                  onChange={(e) => patch({ animalSymbol: e.target.value })}
                />
              </Field>
              <Field label="Líder de la tribu">
                <TextInput
                  value={form.leaderName}
                  placeholder="Ej. Pr. Marcos Andrade"
                  onChange={(e) => patch({ leaderName: e.target.value })}
                />
              </Field>
              <Field label="Lema" className="sm:col-span-2">
                <TextInput
                  value={form.motto}
                  placeholder="Ej. Rugido de fe y alabanza"
                  onChange={(e) => patch({ motto: e.target.value })}
                />
              </Field>
            </div>
          </FormSection>
          <button type="submit" className="hidden" aria-hidden="true" />
        </form>
      </Modal>
    </AdminPage>
  );
};
