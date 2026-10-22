import React, { useState } from 'react';
import {
  Banknote,
  BarChart3,
  BookOpen,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Lock,
  Tent,
  Trophy,
  UserCheck,
  Users,
  Wallet,
} from 'lucide-react';
import { useCamp } from '../../context/CampContext';
import { useAuth } from '../../context/AuthContext';
import { ChampionshipEntry, ExtraPayment, PaymentTransaction } from '../../types/camp';
import { formatCourseSchedule, formatDateRange, getCampPhase, PHASE_META, todayISO, formatBs, normalizeText, isPaymentPending } from '../../utils/campUtils';
import { AdminPage, AdminPageHeader, Badge, Button, CampFilterSelect, Card, EmptyState, StatCard, Table } from './ui';

type ReportKey = 'inscritos' | 'pagos' | 'talleres' | 'campeonatos' | 'asistencia' | 'resumen';
type Cell = string | number;

interface Dataset {
  headers: string[];
  rows: Cell[][];
}

const PREVIEW_LIMIT = 25;

const PAY_STATUS_LABEL: Record<PaymentTransaction['status'], string> = {
  completed: 'Pagado',
  pending_cash: 'Pendiente en caja',
  pending_verification: 'Comprobante por verificar',
  rejected: 'Comprobante rechazado',
  refunded: 'Reembolsado',
};

const METHOD_LABEL: Record<PaymentTransaction['paymentMethod'], string> = {
  qr_bank: 'QR bancario',
  transfer: 'Transferencia',
  cash_box: 'Caja (efectivo)',
};

const ENTRY_STATUS_LABEL: Record<ChampionshipEntry['status'], string> = {
  confirmed: 'Confirmada',
  pending_payment: 'Pago pendiente',
  cancelled: 'Anulada',
};

const EXTRA_STATUS_LABEL: Record<ExtraPayment['status'], string> = {
  completed: 'Pagado',
  pending_cash: 'Pendiente en caja',
  pending_verification: 'Comprobante por verificar',
  rejected: 'Comprobante rechazado',
};

const EXTRA_METHOD_LABEL: Record<ExtraPayment['method'], string> = {
  ...METHOD_LABEL,
  free: 'Sin costo',
};

const csvCell = (value: Cell) => {
  const s = String(value ?? '');
  return /[",;\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

const slugify = (s: string) =>
  normalizeText(s)
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');

function downloadCsv(filename: string, data: Dataset) {
  const content = [data.headers, ...data.rows].map((row) => row.map(csvCell).join(',')).join('\r\n');
  const blob = new Blob(['﻿' + content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const ReportsExporter: React.FC = () => {
  const {
    camps,
    registrations,
    courses,
    checkIns,
    championshipEntries,
    adminCampFilter,
    getCampById,
    getTribeById,
    getCourseById,
    getChampionshipById,
  } = useCamp();
  const { can } = useAuth();
  const [active, setActive] = useState<ReportKey>('inscritos');

  const filterCamp = adminCampFilter === 'ALL' ? undefined : getCampById(adminCampFilter);
  const inScope = (campId: string) => adminCampFilter === 'ALL' || campId === adminCampFilter;

  const scopedRegs = registrations.filter((r) => inScope(r.campId));
  const scopedCourses = courses.filter((c) => inScope(c.campId));
  const scopedCheckIns = checkIns.filter((c) => inScope(c.campId));
  const scopedEntries = championshipEntries.filter((e) => inScope(e.campId));

  const paid = scopedRegs.filter((r) => r.payment.status === 'completed');
  const pending = scopedRegs.filter(
    (r) => isPaymentPending(r.payment.status)
  );
  const income = paid.reduce((acc, r) => acc + r.payment.totalAmount, 0);

  const datasets: Record<ReportKey, Dataset> = (() => {
    const campName = (id: string) => getCampById(id)?.name || '';

    const inscritos: Dataset = {
      headers: [
        'Código credencial',
        'Nombre completo',
        'CI',
        'Edad',
        'Celular',
        'Email',
        'Ciudad',
        'Sub-directiva',
        'Regional',
        'Tribu',
        'Talleres',
        'Campamento',
        'Estado de pago',
        'Método de pago',
        'Total (Bs)',
      ],
      rows: scopedRegs.map((r) => [
        r.ticketCode,
        r.fullName,
        [r.documentId, r.idExpedition].filter(Boolean).join(' '),
        r.age,
        r.phone,
        r.email,
        r.city || '',
        r.subdirectivaNumber || '',
        r.regional,
        getTribeById(r.tribeId)?.name || '',
        r.enrolledCourseIds.map((id) => getCourseById(id)?.title || id).join(' | '),
        campName(r.campId),
        PAY_STATUS_LABEL[r.payment.status],
        METHOD_LABEL[r.payment.paymentMethod],
        r.payment.totalAmount,
      ]),
    };

    const pagos: Dataset = {
      headers: [
        'Folio',
        'Código credencial',
        'Joven',
        'Campamento',
        'Tarifa (Bs)',
        'Campeonatos (Bs)',
        'Descuento (Bs)',
        'Cupón',
        'Total (Bs)',
        'Adelanto (Bs)',
        'Método',
        'Estado',
        'Referencia',
        'Fecha',
        'Cobrado / verificado por',
      ],
      rows: scopedRegs.map((r) => {
        const p = r.payment;
        return [
          p.transactionFolio || '',
          r.ticketCode,
          r.fullName,
          campName(r.campId),
          p.baseCampFee,
          p.championshipsFees || 0,
          p.discountAmount || 0,
          p.couponCodeApplied || '',
          p.totalAmount,
          p.advanceAmount || 0,
          METHOD_LABEL[p.paymentMethod],
          PAY_STATUS_LABEL[p.status],
          p.voucherReferenceNumber || '',
          p.cashierCollectedAt || p.verifiedAt || p.date,
          p.cashierCollectedBy || p.verifiedBy || '',
        ];
      }),
    };

    const talleres: Dataset = {
      headers: ['Campamento', 'Taller', 'Categoría', 'Horario', 'Lugar', 'Instructor', 'Inscritos', 'Cupo', 'Ocupación'],
      rows: scopedCourses.map((c) => [
        campName(c.campId),
        c.title,
        c.category,
        formatCourseSchedule(c),
        c.location,
        c.instructor,
        c.enrolledCount,
        c.maxCapacity,
        `${c.maxCapacity > 0 ? Math.round((c.enrolledCount / c.maxCapacity) * 100) : 0}%`,
      ]),
    };

    /** Una fila por joven en cada inscripción (individual o integrante de un equipo). */
    const campeonatos: Dataset = {
      headers: [
        'Campamento',
        'Campeonato',
        'Modalidad',
        'Equipo',
        'Rol',
        'Joven',
        'CI',
        'Regional',
        'Estado',
        'Pago extra',
        'Monto (Bs)',
        'Método',
        'Código de invitación',
      ],
      rows: [...scopedEntries]
        .sort((a, b) => {
          const ca = campName(a.campId).localeCompare(campName(b.campId), 'es');
          if (ca) return ca;
          const cha = (getChampionshipById(a.championshipId)?.name || '').localeCompare(
            getChampionshipById(b.championshipId)?.name || '',
            'es'
          );
          return cha || (a.teamName || '').localeCompare(b.teamName || '', 'es');
        })
        .flatMap((e) => {
          const ch = getChampionshipById(e.championshipId);
          const members = [...e.members].sort((a, b) => (a.role === 'captain' ? -1 : b.role === 'captain' ? 1 : 0));
          return members.map((m) => {
            const reg = registrations.find((r) => r.id === m.registrationId);
            // el monto va solo en la fila de quien pagó (capitán o participante individual)
            const payer = m.registrationId === e.captainRegistrationId;
            return [
              campName(e.campId),
              ch?.name || 'Campeonato eliminado',
              e.type === 'team' ? 'Por equipos' : 'Individual',
              e.teamName || '',
              e.type === 'team' ? (m.role === 'captain' ? 'Capitán' : 'Integrante') : 'Participante',
              m.fullName,
              reg ? [reg.documentId, reg.idExpedition].filter(Boolean).join(' ') : '',
              reg?.regional || '',
              ENTRY_STATUS_LABEL[e.status],
              e.payment.method === 'free' || e.payment.amount <= 0 ? 'Sin costo' : EXTRA_STATUS_LABEL[e.payment.status],
              payer ? e.payment.amount || 0 : '',
              payer ? EXTRA_METHOD_LABEL[e.payment.method] : '',
              e.inviteCode || '',
            ] as Cell[];
          });
        }),
    };

    const asistencia: Dataset = {
      headers: ['Fecha', 'Hora', 'Campamento', 'ID inscripción', 'Código credencial', 'Joven', 'Punto de control', 'Tipo', 'Verificado por'],
      rows: [...scopedCheckIns]
        .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
        .map((c) => {
          const [date, time] = c.timestamp.split(' ');
          return [
            date,
            time || '',
            campName(c.campId),
            c.registrationId,
            registrations.find((r) => r.id === c.registrationId)?.ticketCode || '',
            c.camperName,
            c.courseTitle,
            c.type === 'GATE_ENTRY' ? 'Puerta general' : c.type === 'COURSE_ATTENDANCE' ? 'Taller' : 'Campeonato',
            c.verifiedBy,
          ];
        }),
    };

    const resumen: Dataset = {
      headers: ['Campamento', 'Fechas', 'Estado', 'Precio (Bs)', 'Cupo', 'Inscritos', 'Pagados', 'Pendientes', 'Ingresos (Bs)'],
      rows: [...camps]
        .sort((a, b) => a.startDate.localeCompare(b.startDate))
        .map((camp) => {
          const regs = registrations.filter((r) => r.campId === camp.id && r.status !== 'cancelled');
          const paidRegs = regs.filter((r) => r.payment.status === 'completed');
          const pendingRegs = regs.filter(
            (r) => isPaymentPending(r.payment.status)
          );
          return [
            camp.name,
            formatDateRange(camp.startDate, camp.endDate),
            PHASE_META[getCampPhase(camp)].label,
            camp.price,
            camp.capacity,
            regs.length,
            paidRegs.length,
            pendingRegs.length,
            paidRegs.reduce((acc, r) => acc + r.payment.totalAmount, 0),
          ];
        }),
    };

    return { inscritos, pagos, talleres, campeonatos, asistencia, resumen };
  })();

  const reports: { key: ReportKey; title: string; description: string; icon: React.ElementType; scoped: boolean }[] = [
    { key: 'inscritos', title: 'Inscritos', description: 'Datos personales, tribu, talleres y pago', icon: Users, scoped: true },
    { key: 'pagos', title: 'Pagos', description: 'Folios, métodos, montos y responsables', icon: Banknote, scoped: true },
    { key: 'talleres', title: 'Talleres', description: 'Horario, instructor y ocupación', icon: BookOpen, scoped: true },
    { key: 'campeonatos', title: 'Campeonatos y equipos', description: 'Equipos, integrantes y pagos extra', icon: Trophy, scoped: true },
    { key: 'asistencia', title: 'Asistencia', description: 'Check-ins en puerta y talleres', icon: UserCheck, scoped: true },
    { key: 'resumen', title: 'Resumen por campamento', description: 'Todos los campamentos del año', icon: BarChart3, scoped: false },
  ];

  const current = reports.find((r) => r.key === active)!;
  const canExport = can('reports:export');
  const data = datasets[active];

  const handleExport = (key: ReportKey) => {
    if (!canExport) return;
    const report = reports.find((r) => r.key === key)!;
    const scopeTag = report.scoped && filterCamp ? slugify(filterCamp.name) : 'todos';
    downloadCsv(`cjn_${key}_${scopeTag}_${todayISO()}.csv`, datasets[key]);
  };

  return (
    <AdminPage>
      <AdminPageHeader
        kicker="Reportes"
        title="Exportar información"
        description="Descarga reportes en CSV listos para abrir en Excel. Los reportes respetan el campamento seleccionado."
        icon={FileSpreadsheet}
        actions={
          <>
            {!canExport && (
              <Badge className="bg-slate-100 text-slate-600 border-slate-200">
                <Lock className="w-3 h-3" /> Solo lectura
              </Badge>
            )}
            <CampFilterSelect className="w-full sm:w-72" />
          </>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard label="Inscritos" value={scopedRegs.length} hint={filterCamp?.name || 'Todos los campamentos'} icon={Users} />
        <StatCard label="Pagados" value={paid.length} hint="Pagos confirmados" icon={CheckCircle2} tone="emerald" />
        <StatCard label="Pendientes" value={pending.length} hint="Caja o comprobante" icon={Wallet} tone="amber" />
        <StatCard
          label="Ingresos"
          value={<span className="text-2xl sm:text-3xl">{formatBs(income)}</span>}
          hint="Solo pagos cobrados"
          icon={Banknote}
          tone="violet"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
        {reports.map((r) => {
          const Icon = r.icon;
          const selected = r.key === active;
          return (
            <Card
              key={r.key}
              className={`p-4 flex flex-col gap-3 transition-all ${selected ? 'border-sky-300 ring-2 ring-sky-100' : ''}`}
            >
              <button type="button" onClick={() => setActive(r.key)} className="text-left flex items-start gap-3 cursor-pointer">
                <div className={`p-2 rounded-xl shrink-0 ${selected ? 'bg-[#0284C7] text-white' : 'bg-sky-50 text-[#0284C7]'}`}>
                  <Icon className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-black text-slate-900">{r.title}</div>
                  <div className="text-[10px] text-slate-500 leading-snug">{r.description}</div>
                  <div className="text-lg font-black font-mono tabular-nums text-slate-900 mt-1">
                    {datasets[r.key].rows.length}
                    <span className="text-[10px] font-bold text-slate-400 ml-1">filas</span>
                  </div>
                </div>
              </button>
              {canExport && (
                <Button
                  size="sm"
                  variant={selected ? 'primary' : 'secondary'}
                  icon={Download}
                  disabled={datasets[r.key].rows.length === 0}
                  onClick={() => handleExport(r.key)}
                >
                  Descargar CSV
                </Button>
              )}
            </Card>
          );
        })}
      </div>

      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-black text-slate-900 font-display">Vista previa · {current.title}</h3>
            <p className="text-[11px] text-slate-500 flex items-center gap-1">
              <Tent className="w-3 h-3" />
              {current.scoped ? filterCamp?.name || 'Todos los campamentos' : 'Todos los campamentos'} ·{' '}
              {data.rows.length} filas
              {data.rows.length > PREVIEW_LIMIT ? ` (se muestran las primeras ${PREVIEW_LIMIT})` : ''}
            </p>
          </div>
          {canExport && (
            <Button icon={Download} disabled={data.rows.length === 0} onClick={() => handleExport(active)}>
              Exportar {current.title.toLowerCase()}
            </Button>
          )}
        </div>

        {data.rows.length === 0 ? (
          <Card>
            <EmptyState icon={FileSpreadsheet} title="Sin datos para este reporte" description="Cambia el campamento seleccionado." />
          </Card>
        ) : (
          <Table
            head={
              <tr>
                {data.headers.map((h) => (
                  <th key={h} className="px-3 py-3 whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            }
          >
            {data.rows.slice(0, PREVIEW_LIMIT).map((row, i) => (
              <tr key={i} className="hover:bg-sky-50/40">
                {row.map((cell, j) => (
                  <td
                    key={j}
                    className={`px-3 py-2.5 whitespace-nowrap max-w-[16rem] truncate ${
                      typeof cell === 'number' ? 'font-mono text-right tabular-nums' : ''
                    } ${j === 0 || j === 1 ? 'font-bold text-slate-900' : ''}`}
                    title={String(cell)}
                  >
                    {cell === '' ? <span className="text-slate-300">—</span> : cell}
                  </td>
                ))}
              </tr>
            ))}
          </Table>
        )}
      </div>
    </AdminPage>
  );
};
