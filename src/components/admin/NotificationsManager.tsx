import React, { useEffect, useMemo, useState } from 'react';
import {
  BellRing,
  CheckCircle2,
  Clock,
  Globe,
  Link2,
  Megaphone,
  RefreshCw,
  Send,
  ShieldCheck,
  Smartphone,
  Tent,
  Users,
  XCircle,
} from 'lucide-react';
import { AdminPage, AdminPageHeader, Badge, Button, Card, EmptyState, Field, SelectInput, TextArea, TextInput } from './ui';
import { useCamp } from '../../context/CampContext';
import { useToast } from '../common/Toast';
import { useConfirm } from '../common/ConfirmDialog';
import { notificationsApi } from '../../api/services';
import { isApiError } from '../../api/errors';
import { env } from '../../config/env';
import { usePwa } from '../../pwa/registerSW';
import {
  getPushDiagnostics,
  requestPermission,
  showLocalNotification,
  subscribePush,
  vapidConfigured,
  type PushDiagnostics,
} from '../../pwa/notifications';

// =========================================================
// ADMIN · Avisos y notificaciones (requiere notifications:send)
// =========================================================

type Audience = 'campers' | 'staff' | 'all';

const TITLE_MAX = 80;
const BODY_MAX = 400;

const AUDIENCES: { id: Audience; label: string; hint: string; icon: React.ElementType }[] = [
  { id: 'campers', label: 'Inscritos de un campamento', hint: 'Campistas con inscripción', icon: Tent },
  { id: 'staff', label: 'Todo el equipo', hint: 'Usuarios del panel activos', icon: ShieldCheck },
  { id: 'all', label: 'Todos', hint: 'Inscritos + equipo', icon: Globe },
];

const LINKS = [
  { path: '/mis-inscripciones', label: 'Mis inscripciones' },
  { path: '/inscripcion', label: 'Inscripción' },
  { path: '/campamentos', label: 'Campamentos' },
  { path: '/galeria', label: 'Galería' },
];

interface SentItem {
  id: string;
  title: string;
  body: string;
  audience: Audience;
  campName?: string;
  link: string;
  sent: number;
  at: Date;
}

const audienceLabel = (a: Audience) => AUDIENCES.find((x) => x.id === a)?.label || a;
const linkLabel = (path: string) => LINKS.find((l) => l.path === path)?.label || path;

export const NotificationsManager: React.FC = () => {
  const { camps, adminCampFilter, registrations } = useCamp();
  const { toast, toastError } = useToast();
  const { confirm } = useConfirm();

  const sortedCamps = useMemo(() => [...camps].sort((a, b) => a.startDate.localeCompare(b.startDate)), [camps]);
  const defaultCampId = useMemo(() => {
    if (adminCampFilter && adminCampFilter !== 'ALL' && camps.some((c) => c.id === adminCampFilter)) return adminCampFilter;
    return camps.find((c) => c.isFeatured)?.id || '';
  }, [adminCampFilter, camps]);

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [audience, setAudience] = useState<Audience>('campers');
  const [campId, setCampId] = useState<string | null>(null); // null = aún sin elegir → usa el predeterminado
  const [link, setLink] = useState(LINKS[0].path);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [sending, setSending] = useState(false);
  const [history, setHistory] = useState<SentItem[]>([]);

  const selectedCampId = campId ?? defaultCampId;
  const selectedCamp = camps.find((c) => c.id === selectedCampId);
  const needsCamp = audience !== 'staff';

  // destinatarios estimados (personas únicas con inscripción en el campamento)
  const estimatedCampers = useMemo(() => {
    if (!registrations.length) return null;
    const list = selectedCampId ? registrations.filter((r) => r.campId === selectedCampId) : registrations;
    return new Set(list.map((r) => r.userId)).size;
  }, [registrations, selectedCampId]);

  const validate = () => {
    const e: Record<string, string> = {};
    if (title.trim().length < 3) e.title = 'Escribe un título (mínimo 3 caracteres).';
    if (body.trim().length < 5) e.body = 'Escribe el mensaje (mínimo 5 caracteres).';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const resetForm = () => {
    setTitle('');
    setBody('');
    setErrors({});
  };

  const send = async () => {
    if (!validate()) return;
    const campName = needsCamp ? selectedCamp?.name || 'Todos los campamentos' : undefined;
    const recipientsText =
      audience === 'staff'
        ? 'Todo el equipo del panel (usuarios activos)'
        : estimatedCampers === null
          ? `Inscritos de: ${campName}`
          : `${estimatedCampers} ${estimatedCampers === 1 ? 'persona inscrita' : 'personas inscritas'} en ${campName}${
              audience === 'all' ? ' + todo el equipo' : ''
            }`;

    const ok = await confirm({
      title: '¿Enviar este aviso?',
      message: 'Llegará a la campana de notificaciones de cada destinatario y, si lo activaron, como notificación en su celular.',
      details: [
        <span key="t">
          <strong>Título:</strong> {title.trim()}
        </span>,
        <span key="a">
          <strong>Destinatarios:</strong> {recipientsText}
        </span>,
        <span key="l">
          <strong>Al tocarlo abre:</strong> {linkLabel(link)}
        </span>,
      ],
      confirmText: 'Enviar aviso',
      cancelText: 'Revisar',
      tone: 'info',
    });
    if (!ok) return;

    setSending(true);
    try {
      const res = await notificationsApi.broadcast({
        title: title.trim(),
        body: body.trim(),
        audience,
        campId: needsCamp && selectedCampId ? selectedCampId : undefined,
        link,
      });
      toast({ type: 'success', title: `Aviso enviado a ${res.sent} ${res.sent === 1 ? 'persona' : 'personas'}` });
      setHistory((h) => [
        { id: `${Date.now()}`, title: title.trim(), body: body.trim(), audience, campName, link, sent: res.sent, at: new Date() },
        ...h,
      ]);
      resetForm();
    } catch (e) {
      if (isApiError(e) && e.status === 422 && e.errors) setErrors(e.errors);
      toastError(e, 'No se pudo enviar el aviso');
    } finally {
      setSending(false);
    }
  };

  const now = new Date();
  const previewTime = now.toLocaleTimeString('es-BO', { hour: 'numeric', minute: '2-digit', hour12: false });
  const previewDate = now.toLocaleDateString('es-BO', { weekday: 'long', day: 'numeric', month: 'long' });
  const previewTitle = title.trim() || 'Título del aviso';
  const previewBody = body.trim() || 'Aquí aparecerá el mensaje que recibirán los campistas en su celular.';

  return (
    <AdminPage>
      <AdminPageHeader
        kicker="Comunicación"
        title="Avisos y notificaciones"
        icon={Megaphone}
        description="Envía avisos a los inscritos o al equipo. Llegan a la campana de la app y, en los dispositivos que lo activaron, como notificación push."
      />

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_360px] gap-6 items-start">
        {/* ── Formulario ── */}
        <Card className="p-5 sm:p-6 space-y-5">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-sky-50 text-[#0284C7] flex items-center justify-center">
              <Send className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-900 font-display">Nuevo aviso</h3>
              <p className="text-[11px] text-slate-500">Sé breve: el título se lee en la pantalla de bloqueo.</p>
            </div>
          </div>

          <Field label="Título" required error={errors.title} hint={`${title.length}/${TITLE_MAX}`}>
            <TextInput
              value={title}
              maxLength={TITLE_MAX}
              placeholder="Ej. Recordatorio de salida"
              onChange={(e) => setTitle(e.target.value)}
            />
          </Field>

          <div className="space-y-1">
            <Field label="Mensaje" required error={errors.body}>
              <TextArea
                rows={4}
                value={body}
                maxLength={BODY_MAX}
                placeholder="Ej. Mañana salimos a las 7:00 desde la puerta del templo central. No olvides tu credencial."
                onChange={(e) => setBody(e.target.value)}
              />
            </Field>
            <p className={`text-right text-[10px] font-bold ${body.length >= BODY_MAX - 20 ? 'text-amber-600' : 'text-slate-400'}`}>
              {body.length}/{BODY_MAX}
            </p>
          </div>

          <div className="space-y-1.5">
            <span className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider">
              Audiencia<span className="text-[#0284C7] ml-0.5">*</span>
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {AUDIENCES.map(({ id, label, hint, icon: Icon }) => {
                const active = audience === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setAudience(id)}
                    aria-pressed={active}
                    className={`flex sm:flex-col items-center sm:items-start gap-2.5 sm:gap-1.5 p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                      active ? 'border-sky-400 bg-sky-50 ring-2 ring-sky-100' : 'border-slate-200 bg-slate-50 hover:border-sky-200'
                    }`}
                  >
                    <span
                      className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                        active ? 'bg-[#0284C7] text-white' : 'bg-white text-slate-500'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-xs font-black text-slate-800 leading-tight">{label}</span>
                      <span className="block text-[10px] text-slate-500">{hint}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {needsCamp && (
              <Field
                label="Campamento"
                hint={
                  estimatedCampers === null
                    ? undefined
                    : `${estimatedCampers} ${estimatedCampers === 1 ? 'persona inscrita' : 'personas inscritas'}`
                }
              >
                <SelectInput value={selectedCampId} onChange={(e) => setCampId(e.target.value)}>
                  <option value="">Todos los campamentos</option>
                  {sortedCamps.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.isFeatured ? '★ ' : ''}
                      {c.name}
                    </option>
                  ))}
                </SelectInput>
              </Field>
            )}
            <Field label="Enlace destino" hint="Pantalla que se abre al tocar el aviso">
              <SelectInput value={link} onChange={(e) => setLink(e.target.value)}>
                {LINKS.map((l) => (
                  <option key={l.path} value={l.path}>
                    {l.label} ({l.path})
                  </option>
                ))}
              </SelectInput>
            </Field>
          </div>

          <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2 pt-4 border-t border-slate-100">
            <Button variant="ghost" onClick={resetForm} disabled={sending || (!title && !body)}>
              Limpiar
            </Button>
            <Button icon={sending ? RefreshCw : Send} onClick={send} disabled={sending} className={sending ? '[&>svg]:animate-spin' : ''}>
              {sending ? 'Enviando…' : 'Enviar aviso'}
            </Button>
          </div>
        </Card>

        {/* ── Vista previa + estado ── */}
        <div className="space-y-6 lg:sticky lg:top-24">
          <Card className="p-5">
            <p className="text-[11px] font-black text-slate-500 uppercase tracking-widest mb-3">Vista previa</p>
            <div className="mx-auto max-w-[300px] rounded-[2.25rem] bg-slate-900 p-2.5 shadow-xl">
              <div className="rounded-[1.75rem] bg-gradient-to-br from-sky-400 via-sky-600 to-indigo-700 px-3 pt-3 pb-10 min-h-[260px]">
                <div className="flex justify-between text-[10px] font-bold text-white/90 px-2">
                  <span>{previewTime}</span>
                  <span className="w-16 h-4 rounded-full bg-slate-900 -mt-0.5" />
                  <span>100%</span>
                </div>
                <p className="text-center text-white text-4xl font-light mt-4 tracking-tight">{previewTime}</p>
                <p className="text-center text-white/80 text-[10px] font-semibold">{previewDate}</p>
                <div className="mt-5 rounded-2xl bg-white/85 backdrop-blur p-2.5 shadow-lg">
                  <div className="flex items-center gap-1.5">
                    <img src="/icons/icon-192.png" alt="" className="w-4 h-4 rounded-[5px]" />
                    <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wide flex-1">{env.appName}</span>
                    <span className="text-[9px] text-slate-400">ahora</span>
                  </div>
                  <p className="text-[12px] font-black text-slate-900 mt-1 leading-snug break-words">{previewTitle}</p>
                  <p className="text-[11px] text-slate-700 leading-snug line-clamp-4 break-words">{previewBody}</p>
                </div>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-1.5 justify-center">
              <Badge className="bg-sky-50 text-sky-700 border-sky-100">
                <Users className="w-3 h-3" /> {audienceLabel(audience)}
              </Badge>
              {needsCamp && (
                <Badge className="bg-amber-50 text-amber-700 border-amber-100">
                  <Tent className="w-3 h-3" /> {selectedCamp?.name || 'Todos los campamentos'}
                </Badge>
              )}
              <Badge className="bg-slate-50 text-slate-600 border-slate-200">
                <Link2 className="w-3 h-3" /> {linkLabel(link)}
              </Badge>
            </div>
          </Card>

          <PushStatusCard draft={{ title: previewTitle, body: previewBody, link }} />
        </div>
      </div>

      {/* ── Historial de la sesión ── */}
      <Card className="overflow-hidden">
        <div className="px-5 sm:px-6 py-4 border-b border-slate-100 flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-black text-slate-900 font-display">Enviados en esta sesión</h3>
            <p className="text-[11px] text-slate-500">Se borra al cerrar o recargar la página.</p>
          </div>
          {history.length > 0 && <Badge className="bg-sky-50 text-sky-700 border-sky-100">{history.length}</Badge>}
        </div>
        {history.length === 0 ? (
          <EmptyState icon={Megaphone} title="Aún no enviaste avisos" description="Los avisos que envíes aparecerán aquí con la cantidad de destinatarios." />
        ) : (
          <ul className="divide-y divide-slate-100">
            {history.map((h) => (
              <li key={h.id} className="px-5 sm:px-6 py-4 flex gap-3">
                <div className="w-9 h-9 rounded-xl bg-sky-100 text-sky-600 flex items-center justify-center shrink-0">
                  <Megaphone className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <p className="text-sm font-black text-slate-900 break-words">{h.title}</p>
                    <Badge className="bg-emerald-50 text-emerald-700 border-emerald-100">
                      <CheckCircle2 className="w-3 h-3" /> {h.sent} {h.sent === 1 ? 'persona' : 'personas'}
                    </Badge>
                  </div>
                  <p className="text-xs text-slate-600 mt-0.5 break-words">{h.body}</p>
                  <p className="text-[10px] text-slate-400 font-semibold mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                    <span className="inline-flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {h.at.toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <span>· {audienceLabel(h.audience)}</span>
                    {h.campName && <span>· {h.campName}</span>}
                    <span>· abre {linkLabel(h.link)}</span>
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </AdminPage>
  );
};

// ─────────────────────────────────────────────────────────
// Estado de push / PWA en este dispositivo
// ─────────────────────────────────────────────────────────
const PERMISSION_LABEL: Record<PushDiagnostics['permission'], string> = {
  granted: 'Concedido',
  denied: 'Bloqueado',
  default: 'Sin decidir',
  unsupported: 'No soportado',
};

const StatusRow: React.FC<{ label: string; ok: boolean | null; value: string }> = ({ label, ok, value }) => (
  <li className="flex items-center justify-between gap-3 py-2">
    <span className="text-xs text-slate-600">{label}</span>
    <span
      className={`inline-flex items-center gap-1 text-[11px] font-bold ${
        ok === null ? 'text-slate-500' : ok ? 'text-emerald-600' : 'text-amber-600'
      }`}
    >
      {ok === null ? null : ok ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
      {value}
    </span>
  </li>
);

const PushStatusCard: React.FC<{ draft: { title: string; body: string; link: string } }> = ({ draft }) => {
  const pwa = usePwa();
  const { toast } = useToast();
  const [diag, setDiag] = useState<PushDiagnostics | null>(null);
  const [busy, setBusy] = useState(false);

  const load = () => {
    getPushDiagnostics()
      .then(setDiag)
      .catch(() => undefined);
  };
  useEffect(load, [pwa.swActive, pwa.swVersion]);

  const activate = async () => {
    setBusy(true);
    try {
      const p = await requestPermission();
      if (p === 'granted' && vapidConfigured()) {
        const res = await subscribePush();
        toast(res.ok ? { type: 'success', title: 'Push activado en este dispositivo' } : { type: 'warning', title: 'Push no disponible', message: res.message });
      } else if (p === 'granted') {
        toast({ type: 'success', title: 'Permiso concedido', message: 'Sin clave VAPID solo habrá notificaciones con la app abierta.' });
      } else if (p === 'denied') {
        toast({ type: 'warning', title: 'Permiso bloqueado', message: 'Actívalo desde los ajustes del navegador.' });
      }
    } finally {
      setBusy(false);
      load();
    }
  };

  const test = async () => {
    const shown = await showLocalNotification({ id: `test-${Date.now()}`, title: draft.title, body: draft.body, link: draft.link });
    if (!shown) toast({ type: 'warning', title: 'No se pudo mostrar la prueba', message: 'Concede el permiso de notificaciones primero.' });
  };

  return (
    <Card className="p-5">
      <div className="flex items-center gap-2.5 mb-2">
        <div className="w-9 h-9 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center">
          <Smartphone className="w-4 h-4" />
        </div>
        <div>
          <h3 className="text-sm font-black text-slate-900 font-display">Push y app instalable</h3>
          <p className="text-[11px] text-slate-500">Estado en este dispositivo</p>
        </div>
      </div>
      {diag ? (
        <ul className="divide-y divide-slate-100">
          <StatusRow label="Permiso de notificaciones" ok={diag.permission === 'granted'} value={PERMISSION_LABEL[diag.permission]} />
          <StatusRow
            label="Service worker"
            ok={diag.swActive}
            value={diag.swActive ? `Activo${diag.swVersion ? ` · v${diag.swVersion.slice(0, 7)}` : ''}` : diag.pwaEnabled ? 'Inactivo' : 'Solo en build'}
          />
          <StatusRow label="Clave VAPID (push)" ok={diag.vapidConfigured} value={diag.vapidConfigured ? 'Configurada' : 'Sin configurar'} />
          <StatusRow
            label="Suscripción push"
            ok={diag.pushSupported ? diag.subscribed : null}
            value={!diag.pushSupported ? 'No soportado' : diag.subscribed ? 'Registrada' : 'No registrada'}
          />
          <StatusRow label="Modo app instalada" ok={null} value={diag.isStandalone ? 'Sí' : 'No (navegador)'} />
        </ul>
      ) : (
        <div className="h-32 rounded-2xl bg-slate-50 animate-pulse" />
      )}
      {diag && !diag.vapidConfigured && (
        <p className="mt-3 text-[10px] text-slate-500 leading-relaxed bg-slate-50 rounded-xl p-2.5">
          Sin <code className="font-mono text-[10px]">VITE_VAPID_PUBLIC_KEY</code> los avisos llegan a la campana y como notificación
          local mientras la app esté abierta. Para push con la app cerrada, configura la clave en el .env y el envío en el backend.
        </p>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        {diag?.permission !== 'granted' && diag?.permission !== 'unsupported' && (
          <Button size="sm" icon={BellRing} onClick={activate} disabled={busy || diag?.permission === 'denied'}>
            Activar en este dispositivo
          </Button>
        )}
        {diag?.permission === 'granted' && diag.vapidConfigured && !diag.subscribed && (
          <Button size="sm" icon={BellRing} onClick={activate} disabled={busy}>
            Suscribir a push
          </Button>
        )}
        <Button size="sm" variant="secondary" icon={Send} onClick={test} disabled={diag?.permission !== 'granted'}>
          Probar con el borrador
        </Button>
      </div>
    </Card>
  );
};
