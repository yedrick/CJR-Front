import { Camp, CampCourse, CampPhase, PaymentTransaction } from '../types/camp';

const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const MONTHS_LONG = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const WEEKDAYS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

const pad = (n: number) => String(n).padStart(2, '0');

export function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function nowStamp(withSeconds = false): string {
  const d = new Date();
  const base = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  return withSeconds ? `${base}:${pad(d.getSeconds())}` : base;
}

/** "YYYY-MM-DDTHH:mm" local (mismo formato que un <input type="datetime-local">). */
export function nowLocalStamp(): string {
  return nowStamp().replace(' ', 'T');
}

export function uid(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

function parseISO(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

export function formatShortDate(iso?: string): string {
  if (!iso) return '';
  const d = parseISO(iso);
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

export function formatLongDate(iso?: string): string {
  if (!iso) return '';
  const d = parseISO(iso);
  return `${WEEKDAYS[d.getDay()]} ${d.getDate()} de ${MONTHS_LONG[d.getMonth()]}`;
}

export function formatDateRange(start: string, end: string): string {
  const s = parseISO(start);
  const e = parseISO(end);
  if (start === end) return `${s.getDate()} ${MONTHS[s.getMonth()]} ${s.getFullYear()}`;
  if (s.getMonth() === e.getMonth() && s.getFullYear() === e.getFullYear()) {
    return `${s.getDate()} – ${e.getDate()} ${MONTHS[e.getMonth()]} ${e.getFullYear()}`;
  }
  return `${s.getDate()} ${MONTHS[s.getMonth()]} – ${e.getDate()} ${MONTHS[e.getMonth()]} ${e.getFullYear()}`;
}

export function monthLabel(iso: string): { month: string; day: string } {
  const d = parseISO(iso);
  return { month: MONTHS[d.getMonth()].toUpperCase(), day: String(d.getDate()) };
}

export function campDurationDays(camp: Pick<Camp, 'startDate' | 'endDate'>): number {
  const ms = parseISO(camp.endDate).getTime() - parseISO(camp.startDate).getTime();
  return Math.max(1, Math.round(ms / 86400000) + 1);
}

/** Lista de días (YYYY-MM-DD) del campamento, para asignar talleres a un día. */
export function campDays(camp?: Pick<Camp, 'startDate' | 'endDate'> | null): string[] {
  if (!camp?.startDate || !camp?.endDate) return [];
  const days: string[] = [];
  const cur = parseISO(camp.startDate);
  const end = parseISO(camp.endDate);
  let guard = 0;
  while (cur <= end && guard < 60) {
    days.push(`${cur.getFullYear()}-${pad(cur.getMonth() + 1)}-${pad(cur.getDate())}`);
    cur.setDate(cur.getDate() + 1);
    guard++;
  }
  return days;
}

export function daysUntil(iso: string): number {
  const ms = parseISO(iso).getTime() - parseISO(todayISO()).getTime();
  return Math.round(ms / 86400000);
}

export function getCampPhase(camp: Camp, today = todayISO()): CampPhase {
  if (camp.status === 'borrador') return 'borrador';
  if (camp.endDate < today) return 'finalizado';
  if (camp.startDate <= today && today <= camp.endDate) return 'en_curso';
  if (camp.status === 'cerrado') return 'cerrado';
  return 'abierto';
}

/** Se puede inscribir si está abierto o en curso (inscripción en sede). */
export function isCampEnrollable(camp?: Camp | null): boolean {
  if (!camp) return false;
  const phase = getCampPhase(camp);
  return phase === 'abierto' || (phase === 'en_curso' && camp.status === 'abierto');
}

export const PHASE_META: Record<CampPhase, { label: string; className: string; dot: string }> = {
  borrador: { label: 'Borrador', className: 'bg-slate-100 text-slate-600 border-slate-200', dot: 'bg-slate-400' },
  proximo: { label: 'Próximamente', className: 'bg-violet-100 text-violet-700 border-violet-200', dot: 'bg-violet-500' },
  abierto: { label: 'Inscripciones abiertas', className: 'bg-emerald-100 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' },
  cerrado: { label: 'Inscripciones cerradas', className: 'bg-amber-100 text-amber-800 border-amber-200', dot: 'bg-amber-500' },
  en_curso: { label: 'En curso ahora', className: 'bg-sky-100 text-sky-700 border-sky-200', dot: 'bg-sky-500' },
  finalizado: { label: 'Finalizado', className: 'bg-slate-100 text-slate-500 border-slate-200', dot: 'bg-slate-400' },
};

export function formatCourseSchedule(course: CampCourse): string {
  const time = course.fullDay ? 'Todo el día' : `${course.startTime} – ${course.endTime}`;
  if (course.scheduleType === 'single_day' && course.date) {
    return `${formatLongDate(course.date)} · ${time}`;
  }
  return `Todos los días · ${time}`;
}

export function formatCourseScheduleShort(course: CampCourse): string {
  const time = course.fullDay ? 'Todo el día' : course.startTime;
  if (course.scheduleType === 'single_day' && course.date) {
    return `${formatShortDate(course.date)} · ${time}`;
  }
  return `Diario · ${time}`;
}

export type CourseWindowState = 'none' | 'soon' | 'open' | 'closed';

/** Estado de la ventana de inscripción de un taller ('none' = sin fechas límite). */
export function courseWindowState(
  c: Pick<CampCourse, 'enrollmentOpensAt' | 'enrollmentClosesAt'>,
  now = nowLocalStamp()
): CourseWindowState {
  if (!c.enrollmentOpensAt && !c.enrollmentClosesAt) return 'none';
  if (c.enrollmentOpensAt && now < c.enrollmentOpensAt) return 'soon';
  if (c.enrollmentClosesAt && now > c.enrollmentClosesAt) return 'closed';
  return 'open';
}

/** Dos talleres chocan si comparten día y se superponen en horario. */
export function coursesOverlap(a: CampCourse, b: CampCourse): boolean {
  if (a.id === b.id) return false;
  const sameDay =
    a.scheduleType === 'all_days' ||
    b.scheduleType === 'all_days' ||
    (a.date && b.date && a.date === b.date);
  if (!sameDay) return false;
  if (a.fullDay || b.fullDay) return true;
  return a.startTime < b.endTime && b.startTime < a.endTime;
}

export function buildTicketCode(camp: Camp | undefined, seq: number): string {
  const year = camp?.startDate?.slice(2, 4) || '26';
  const tag = stripAccents(camp?.name || 'CJN')
    .replace(/[^A-Za-z ]/g, '')
    .split(' ')
    .filter((w) => w.length > 2 && !['del', 'los', 'las', 'para'].includes(w.toLowerCase()))
    .slice(0, 3)
    .map((w) => w[0].toUpperCase())
    .join('');
  return `CJN${year}-${tag || 'CMP'}-${String(seq).padStart(4, '0')}`;
}

/** Quita tildes y diacríticos ("Ñandú" → "Nandu"). */
export const stripAccents = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

/** Texto comparable para búsquedas: sin tildes y en minúsculas. */
export const normalizeText = (s?: string) => stripAccents(s || '').toLowerCase();

export const digitsOf = (s?: string) => (s || '').replace(/\D/g, '');

/** "1 taller" / "3 talleres" */
export const plural = (n: number, singular: string, pluralForm: string) => `${n} ${n === 1 ? singular : pluralForm}`;

export const formatBs = (n?: number) => `${Math.round(n || 0).toLocaleString('es-BO')} Bs`;

export const isPaymentPending = (status: PaymentTransaction['status']) =>
  status === 'pending_cash' || status === 'pending_verification';

export function initials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

/** Lee un archivo de imagen como data URL (para subir imágenes desde el admin). */
export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/** Abre la imagen en una pestaña nueva (las data URL se convierten a blob para que el navegador lo permita). */
export const openImageInNewTab = (url: string) => {
  try {
    if (url.startsWith('data:')) {
      const [meta, data] = url.split(',');
      const mime = meta.match(/data:(.*?)(;|$)/)?.[1] || 'image/png';
      const isB64 = meta.includes(';base64');
      const raw = isB64 ? atob(data) : decodeURIComponent(data);
      const bytes = new Uint8Array(raw.length);
      for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
      const blobUrl = URL.createObjectURL(new Blob([bytes], { type: mime }));
      window.open(blobUrl, '_blank', 'noopener');
      setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
    } else {
      window.open(url, '_blank', 'noopener');
    }
  } catch {
    window.open(url, '_blank', 'noopener');
  }
};

const COLOR_NAMES: { name: string; rgb: [number, number, number] }[] = [
  { name: 'Celeste', rgb: [2, 132, 199] },
  { name: 'Azul', rgb: [37, 99, 235] },
  { name: 'Azul marino', rgb: [30, 64, 175] },
  { name: 'Índigo', rgb: [79, 70, 229] },
  { name: 'Morado', rgb: [124, 58, 237] },
  { name: 'Rosa', rgb: [219, 39, 119] },
  { name: 'Rojo', rgb: [220, 38, 38] },
  { name: 'Naranja', rgb: [234, 88, 12] },
  { name: 'Dorado', rgb: [217, 119, 6] },
  { name: 'Amarillo', rgb: [234, 179, 8] },
  { name: 'Verde', rgb: [5, 150, 105] },
  { name: 'Turquesa', rgb: [13, 148, 136] },
  { name: 'Cian', rgb: [8, 145, 178] },
  { name: 'Marrón', rgb: [146, 64, 14] },
  { name: 'Negro', rgb: [30, 41, 59] },
  { name: 'Gris', rgb: [100, 116, 139] },
];

/** Nombre en español del color más cercano (para mostrar "tu color" en la credencial). */
export function colorName(hex: string): string {
  const m = hex.replace('#', '').match(/^([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
  if (!m) return hex;
  const [r, g, b] = [1, 2, 3].map((i) => parseInt(m[i], 16));
  let best = COLOR_NAMES[0];
  let bestDist = Infinity;
  COLOR_NAMES.forEach((c) => {
    const d = (c.rgb[0] - r) ** 2 + (c.rgb[1] - g) ** 2 + (c.rgb[2] - b) ** 2;
    if (d < bestDist) {
      bestDist = d;
      best = c;
    }
  });
  return best.name;
}

const ANIMAL_EMOJI: Record<string, string> = {
  leon: '🦁',
  aguila: '🦅',
  halcon: '🦅',
  condor: '🦅',
  jaguar: '🐆',
  pantera: '🐆',
  nutria: '🦦',
  buho: '🦉',
  lobo: '🐺',
  oso: '🐻',
  zorro: '🦊',
  ciervo: '🦌',
  tigre: '🐯',
  caballo: '🐴',
  delfin: '🐬',
  paloma: '🕊️',
  cordero: '🐑',
};

export function animalEmoji(animal?: string): string {
  if (!animal) return '⛺';
  const key = normalizeText(animal).trim();
  return ANIMAL_EMOJI[key] || '🔥';
}
