import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  Banknote,
  Building2,
  CheckCircle2,
  Clock,
  CreditCard,
  Eye,
  EyeOff,
  Landmark,
  Loader2,
  Lock,
  MapPin,
  MessageCircle,
  Pencil,
  Plus,
  QrCode,
  RotateCcw,
  Save,
  Smartphone,
  Trash2,
  User as UserIcon,
  Wallet,
} from 'lucide-react';
import { useCamp } from '../../context/CampContext';
import { useAuth } from '../../context/AuthContext';
import { useConfirm } from '../common/ConfirmDialog';
import { BankAccount, PaymentSettings } from '../../types/camp';
import { uid } from '../../utils/campUtils';
import {
  AdminPage,
  AdminPageHeader,
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  FormSection,
  ImageInput,
  Modal,
  SelectInput,
  TextArea,
  TextInput,
  Toggle,
} from './ui';

type MethodKey = 'qr' | 'transfer' | 'cash';

const METHOD_META: Record<MethodKey, { icon: React.ElementType; title: string; tint: string }> = {
  qr: { icon: QrCode, title: 'Pago QR', tint: 'bg-sky-50 text-[#0284C7]' },
  transfer: { icon: Landmark, title: 'Transferencia bancaria', tint: 'bg-indigo-50 text-indigo-600' },
  cash: { icon: Banknote, title: 'Efectivo', tint: 'bg-amber-50 text-amber-600' },
};

const ACCOUNT_TYPES = ['Caja de ahorro', 'Cuenta corriente'];

const emptyAccount = (): BankAccount => ({
  id: uid('acc'),
  bank: '',
  accountNumber: '',
  holder: '',
  holderDocument: '',
  accountType: ACCOUNT_TYPES[0],
  currency: 'Bs',
  isActive: true,
});

/** Interruptor compacto para filas de listas (el Toggle del kit ocupa todo el ancho). */
const MiniSwitch: React.FC<{ checked: boolean; onChange: (v: boolean) => void; label: string }> = ({
  checked,
  onChange,
  label,
}) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    aria-label={label}
    title={label}
    onClick={() => onChange(!checked)}
    className={`relative w-10 h-6 rounded-full transition-colors shrink-0 cursor-pointer ${checked ? 'bg-[#0284C7]' : 'bg-slate-300'}`}
  >
    <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all ${checked ? 'left-5' : 'left-1'}`} />
  </button>
);

export const PaymentSettingsManager: React.FC = () => {
  const { paymentSettings, isLoading, dataError, refreshData } = useCamp();
  if (!paymentSettings) {
    return (
      <AdminPage>
        <AdminPageHeader
          kicker="Finanzas"
          title="Métodos de pago"
          description="Define cómo pagan los jóvenes su inscripción: QR, transferencia a las cuentas oficiales o efectivo en caja."
          icon={CreditCard}
        />
        {!isLoading && dataError ? (
          <Card>
            <EmptyState
              icon={AlertTriangle}
              title="No se pudo cargar la configuración"
              description={dataError}
              action={
                <Button icon={RotateCcw} onClick={() => refreshData()}>
                  Reintentar
                </Button>
              }
            />
          </Card>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 animate-pulse" aria-busy="true">
            <div className="lg:col-span-2 space-y-5">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-48 rounded-3xl bg-slate-100" />
              ))}
            </div>
            <div className="h-72 rounded-3xl bg-slate-100" />
          </div>
        )}
      </AdminPage>
    );
  }
  return <PaymentSettingsEditor paymentSettings={paymentSettings} />;
};

const PaymentSettingsEditor: React.FC<{ paymentSettings: PaymentSettings }> = ({ paymentSettings }) => {
  const { savePaymentSettings } = useCamp();
  const { confirm, notify } = useConfirm();
  const { can } = useAuth();
  const readOnly = !can('payment_settings:update');
  const [saving, setSaving] = useState(false);

  const [draft, setDraft] = useState<PaymentSettings>(paymentSettings);
  // Si la configuración del servidor cambia (guardado o recarga), el borrador se sincroniza
  useEffect(() => {
    setDraft(paymentSettings);
  }, [paymentSettings]);
  const [editing, setEditing] = useState<BankAccount | null>(null);
  const [isNewAccount, setIsNewAccount] = useState(false);
  const [accountErrors, setAccountErrors] = useState<Record<string, string>>({});

  const dirty = JSON.stringify(draft) !== JSON.stringify(paymentSettings);
  const activeAccounts = draft.transfer.accounts.filter((a) => a.isActive);
  const enabledCount = (['qr', 'transfer', 'cash'] as MethodKey[]).filter((k) => draft[k].enabled).length;

  // ── Actualizadores del borrador ─────────────────────
  const patch = <K extends MethodKey>(key: K, values: Partial<PaymentSettings[K]>) =>
    setDraft((prev) => ({ ...prev, [key]: { ...prev[key], ...values } }));

  const setEnabled = (key: MethodKey, enabled: boolean) => {
    if (!enabled && enabledCount <= 1 && draft[key].enabled) {
      notify({
        title: 'Debe quedar al menos un método',
        message: 'Los jóvenes necesitan al menos una forma de pagar su inscripción. Habilita otro método antes de desactivar este.',
        tone: 'warning',
      });
      return;
    }
    patch(key, { enabled });
  };

  const setAccounts = (updater: (list: BankAccount[]) => BankAccount[]) =>
    setDraft((prev) => ({ ...prev, transfer: { ...prev.transfer, accounts: updater(prev.transfer.accounts) } }));

  // ── Cuentas bancarias ───────────────────────────────
  const openNewAccount = () => {
    setEditing(emptyAccount());
    setIsNewAccount(true);
    setAccountErrors({});
  };

  const openEditAccount = (acc: BankAccount) => {
    setEditing({ ...acc });
    setIsNewAccount(false);
    setAccountErrors({});
  };

  const saveAccount = () => {
    if (!editing) return;
    const errors: Record<string, string> = {};
    if (!editing.bank.trim()) errors.bank = 'Indica el banco.';
    if (!editing.accountNumber.trim()) errors.accountNumber = 'Indica el número de cuenta.';
    if (!editing.holder.trim()) errors.holder = 'Indica el titular de la cuenta.';
    setAccountErrors(errors);
    if (Object.keys(errors).length > 0) return;
    const clean: BankAccount = {
      ...editing,
      bank: editing.bank.trim(),
      accountNumber: editing.accountNumber.trim(),
      holder: editing.holder.trim(),
      holderDocument: editing.holderDocument?.trim() || undefined,
    };
    setAccounts((list) =>
      list.some((a) => a.id === clean.id) ? list.map((a) => (a.id === clean.id ? clean : a)) : [...list, clean]
    );
    setEditing(null);
  };

  const deleteAccount = async (acc: BankAccount) => {
    const ok = await confirm({
      title: '¿Eliminar esta cuenta bancaria?',
      message: 'Los jóvenes dejarán de verla como opción para transferir. El cambio se aplica al guardar.',
      details: [
        <>
          <b>{acc.bank}</b> · <span className="font-mono">{acc.accountNumber}</span>
        </>,
        <>Titular: {acc.holder}</>,
      ],
      tone: 'danger',
      confirmText: 'Sí, eliminar',
    });
    if (ok) setAccounts((list) => list.filter((a) => a.id !== acc.id));
  };

  // ── Guardar / descartar ─────────────────────────────
  const handleSave = async () => {
    if (enabledCount === 0) {
      await notify({
        title: 'Debe quedar al menos un método',
        message: 'Habilita QR, transferencia o efectivo para que los jóvenes puedan pagar.',
        tone: 'warning',
      });
      return;
    }
    if (draft.transfer.enabled && activeAccounts.length === 0) {
      await notify({
        title: 'Falta una cuenta activa',
        message: 'La transferencia está habilitada pero no hay ninguna cuenta bancaria activa. Agrega o activa una cuenta, o deshabilita la transferencia.',
        tone: 'warning',
      });
      return;
    }
    if (draft.qr.enabled && !draft.qr.bankName.trim()) {
      await notify({
        title: 'Falta el banco del QR',
        message: 'Indica el banco o la pasarela que emite el QR de pago.',
        tone: 'warning',
      });
      return;
    }
    if (draft.transfer.verificationHours < 1) {
      await notify({
        title: 'Plazo de verificación inválido',
        message: 'El plazo de verificación debe ser de al menos 1 hora.',
        tone: 'warning',
      });
      return;
    }
    if (readOnly || saving) return;
    setSaving(true);
    let ok = false;
    try {
      ok = await savePaymentSettings(draft);
    } finally {
      setSaving(false);
    }
    // ante un error (403, 413 imagen QR pesada, 422…) el aviso ya se mostró y el borrador se conserva
    if (!ok) return;
    await notify({
      title: 'Métodos de pago actualizados',
      message: 'Los cambios ya se muestran en el formulario de inscripción.',
      tone: 'success',
    });
  };

  const handleDiscard = async () => {
    const ok = await confirm({
      title: '¿Descartar los cambios?',
      message: 'Se volverá a la última configuración guardada.',
      tone: 'warning',
      confirmText: 'Sí, descartar',
    });
    if (ok) setDraft(paymentSettings);
  };

  // ── Piezas de UI ────────────────────────────────────
  const renderMethodCard = (key: MethodKey, children: React.ReactNode) => {
    const meta = METHOD_META[key];
    const Icon = meta.icon;
    const m = draft[key];
    return (
      <Card className={`overflow-hidden transition-all ${m.enabled ? '' : 'bg-slate-50/60'}`}>
        <div className="p-4 sm:p-5 flex items-start gap-3 border-b border-slate-100">
          <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${meta.tint}`}>
            <Icon className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base font-black text-slate-900 font-display">{meta.title}</h3>
              {m.enabled ? (
                <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200">
                  <Eye className="w-3 h-3" /> Visible
                </Badge>
              ) : (
                <Badge className="bg-slate-100 text-slate-500 border-slate-200">
                  <EyeOff className="w-3 h-3" /> Oculto
                </Badge>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-0.5 truncate">{m.description || 'Sin descripción'}</p>
          </div>
          <MiniSwitch checked={m.enabled} onChange={(v) => setEnabled(key, v)} label={`Habilitar ${meta.title}`} />
        </div>
        <div className={`p-4 sm:p-5 space-y-4 ${m.enabled ? '' : 'opacity-60'}`}>
          {!m.enabled && (
            <div className="flex items-center gap-2 text-[11px] text-slate-500 bg-white border border-slate-200 rounded-xl px-3 py-2">
              <EyeOff className="w-3.5 h-3.5 shrink-0" /> Este método está deshabilitado: los jóvenes no lo verán al inscribirse.
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Nombre visible" required>
              <TextInput value={m.label} onChange={(e) => patch(key, { label: e.target.value })} maxLength={40} />
            </Field>
            <Field label="Descripción corta">
              <TextInput
                value={m.description}
                onChange={(e) => patch(key, { description: e.target.value })}
                maxLength={60}
              />
            </Field>
          </div>
          {children}
          <Field label="Instrucciones para el joven" hint="Se muestran al elegir este método en la inscripción.">
            <TextArea value={m.instructions} onChange={(e) => patch(key, { instructions: e.target.value })} />
          </Field>
        </div>
      </Card>
    );
  };

  const previewItems = (['qr', 'transfer', 'cash'] as MethodKey[]).filter((k) => draft[k].enabled);

  return (
    <AdminPage>
      <AdminPageHeader
        kicker="Finanzas"
        title="Métodos de pago"
        description="Define cómo pagan los jóvenes su inscripción: QR, transferencia a las cuentas oficiales o efectivo en caja."
        icon={CreditCard}
        actions={
          readOnly ? (
            <Badge className="bg-slate-100 text-slate-600 border-slate-200 !text-[11px] !px-3 !py-1">
              <Lock className="w-3.5 h-3.5" /> Solo lectura
            </Badge>
          ) : dirty ? (
            <Badge className="bg-amber-50 text-amber-700 border-amber-200 !text-[11px] !px-3 !py-1">
              <AlertTriangle className="w-3.5 h-3.5" /> Cambios sin guardar
            </Badge>
          ) : (
            <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 !text-[11px] !px-3 !py-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> Todo guardado
            </Badge>
          )
        }
      />

      {readOnly && (
        <div className="flex items-start gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600">
          <Lock className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
          Puedes ver la configuración, pero no tienes permiso para modificar los métodos de pago (requiere «Configurar métodos de pago»).
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 lg:gap-6 items-start">
        {/* ── Configuración ─────────────────────────── */}
        <fieldset disabled={readOnly || saving} className="lg:col-span-2 space-y-5 min-w-0 border-0 p-0 m-0">
          {renderMethodCard(
            'qr',
            <>
              <Field label="Banco / pasarela" required>
                <TextInput
                  value={draft.qr.bankName}
                  onChange={(e) => patch('qr', { bankName: e.target.value })}
                  placeholder="Ej.: Banco Nacional de Bolivia · QR Simple"
                />
              </Field>
              <Field label="QR fijo de la cuenta (opcional)" hint="Si no subes una imagen, se genera un QR dinámico con el monto exacto.">
                <ImageInput aspect="square" value={draft.qr.qrImageUrl || ''} onChange={(v) => patch('qr', { qrImageUrl: v })} />
              </Field>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => patch('qr', { autoConfirm: true })}
                  className={`text-left p-3 rounded-xl border-2 transition-colors cursor-pointer ${
                    draft.qr.autoConfirm ? 'border-sky-400 bg-sky-50' : 'border-slate-200 bg-white hover:border-sky-200'
                  }`}
                >
                  <span className="flex items-center gap-1.5 text-xs font-black text-slate-800">
                    <Smartphone className="w-4 h-4 text-[#0284C7]" /> Confirmación automática por pasarela
                  </span>
                  <span className="block text-[10px] text-slate-500 mt-1">
                    El banco avisa el pago y la credencial se habilita al instante.
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => patch('qr', { autoConfirm: false })}
                  className={`text-left p-3 rounded-xl border-2 transition-colors cursor-pointer ${
                    !draft.qr.autoConfirm ? 'border-sky-400 bg-sky-50' : 'border-slate-200 bg-white hover:border-sky-200'
                  }`}
                >
                  <span className="flex items-center gap-1.5 text-xs font-black text-slate-800">
                    <UserIcon className="w-4 h-4 text-[#0284C7]" /> Tesorería verifica el comprobante
                  </span>
                  <span className="block text-[10px] text-slate-500 mt-1">
                    El joven sube su comprobante y aparece en «Pagos y caja» para aprobarlo.
                  </span>
                </button>
              </div>
            </>
          )}

          {renderMethodCard(
            'transfer',
            <>
              <div className="space-y-2.5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">Cuentas bancarias</div>
                    <div className="text-[10px] text-slate-400">
                      {activeAccounts.length} activa{activeAccounts.length === 1 ? '' : 's'} de {draft.transfer.accounts.length}
                    </div>
                  </div>
                  <Button size="sm" icon={Plus} onClick={openNewAccount}>
                    Agregar cuenta
                  </Button>
                </div>

                {draft.transfer.enabled && activeAccounts.length === 0 && (
                  <div className="flex gap-2 text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-xl p-2.5">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    La transferencia necesita al menos una cuenta activa para poder guardarse.
                  </div>
                )}

                {draft.transfer.accounts.length === 0 ? (
                  <div className="rounded-2xl border-2 border-dashed border-slate-200">
                    <EmptyState
                      icon={Building2}
                      title="Sin cuentas registradas"
                      description="Agrega la cuenta oficial donde los jóvenes deben transferir."
                    />
                  </div>
                ) : (
                  <ul className="space-y-2">
                    {draft.transfer.accounts.map((acc) => (
                      <li
                        key={acc.id}
                        className={`rounded-2xl border p-3 sm:p-3.5 flex flex-col sm:flex-row sm:items-center gap-3 transition-colors ${
                          acc.isActive ? 'border-slate-200 bg-white' : 'border-slate-200 bg-slate-50 opacity-70'
                        }`}
                      >
                        <div className="flex items-start gap-3 flex-1 min-w-0">
                          <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                            <Landmark className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="text-sm font-black text-slate-900 truncate">{acc.bank}</span>
                              <Badge className="bg-slate-100 text-slate-600 border-slate-200">{acc.currency}</Badge>
                              {!acc.isActive && (
                                <Badge className="bg-slate-100 text-slate-500 border-slate-200">Inactiva</Badge>
                              )}
                            </div>
                            <div className="text-xs font-mono font-bold text-slate-700 break-all">{acc.accountNumber}</div>
                            <div className="text-[11px] text-slate-500 truncate">
                              {acc.accountType} · {acc.holder}
                              {acc.holderDocument ? ` · ${acc.holderDocument}` : ''}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center justify-end gap-1.5 shrink-0 border-t sm:border-t-0 border-slate-100 pt-2 sm:pt-0">
                          <span className="text-[10px] font-bold text-slate-500 mr-1 sm:hidden">Activa</span>
                          <MiniSwitch
                            checked={acc.isActive}
                            onChange={(v) => setAccounts((list) => list.map((a) => (a.id === acc.id ? { ...a, isActive: v } : a)))}
                            label={acc.isActive ? 'Desactivar cuenta' : 'Activar cuenta'}
                          />
                          <Button size="sm" variant="ghost" icon={Pencil} onClick={() => openEditAccount(acc)} aria-label="Editar cuenta">
                            <span className="hidden md:inline">Editar</span>
                          </Button>
                          <Button size="sm" variant="ghost" icon={Trash2} onClick={() => deleteAccount(acc)} aria-label="Eliminar cuenta" className="!text-red-600 hover:!bg-red-50">
                            <span className="hidden md:inline">Eliminar</span>
                          </Button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <Toggle
                  checked={draft.transfer.requireVoucher}
                  onChange={(v) => patch('transfer', { requireVoucher: v })}
                  label="Exigir foto del comprobante"
                  hint="El joven debe subir la imagen"
                />
                <Toggle
                  checked={draft.transfer.requireReference}
                  onChange={(v) => patch('transfer', { requireReference: v })}
                  label="Exigir número de referencia"
                  hint="Para cruzar con el extracto"
                />
              </div>
              <Field label="Plazo de verificación (horas)" hint="Tiempo máximo que tesorería tarda en revisar un comprobante.">
                <div className="relative sm:max-w-[14rem]">
                  <Clock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <TextInput
                    type="number"
                    min={1}
                    max={240}
                    value={draft.transfer.verificationHours}
                    onChange={(e) => patch('transfer', { verificationHours: Math.max(0, Number(e.target.value) || 0) })}
                    className="pl-9"
                  />
                </div>
              </Field>
            </>
          )}

          {renderMethodCard(
            'cash',
            <>
              <Toggle
                checked={draft.cash.allowAdvance}
                onChange={(v) => patch('cash', { allowAdvance: v })}
                label="Permitir pago con adelanto"
                hint="El joven paga un adelanto y el saldo en caja"
              />
              <p className="text-[11px] text-slate-500 -mt-2 flex gap-1.5">
                <Wallet className="w-3.5 h-3.5 shrink-0 mt-px" />
                El porcentaje de adelanto se configura en cada campamento (Campamentos → editar → tarifas).
              </p>
              <Field label="Lugares de pago">
                <div className="relative">
                  <MapPin className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <TextInput
                    value={draft.cash.places}
                    onChange={(e) => patch('cash', { places: e.target.value })}
                    placeholder="Ej.: Oficina de tu sub-directiva o caja del campamento"
                    className="pl-9"
                  />
                </div>
              </Field>
            </>
          )}

          <Card className="p-4 sm:p-5">
            <FormSection
              title="Contacto de tesorería"
              description="Número de WhatsApp para dudas de pago. Se muestra en la inscripción y en «Mis entradas»."
              icon={MessageCircle}
              className="!p-0 !border-0"
            >
              <Field label="WhatsApp de contacto">
                <TextInput
                  type="tel"
                  value={draft.whatsappContact}
                  onChange={(e) => setDraft((prev) => ({ ...prev, whatsappContact: e.target.value }))}
                  placeholder="+591 7xxxxxxx"
                  className="sm:max-w-xs"
                />
              </Field>
            </FormSection>
          </Card>
        </fieldset>

        {/* ── Vista previa ──────────────────────────── */}
        <div className="lg:sticky lg:top-28 space-y-3 min-w-0">
          <Card className="overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-100 bg-gradient-to-r from-sky-50 to-white flex items-center gap-2">
              <Eye className="w-4 h-4 text-[#0284C7]" />
              <span className="text-[11px] font-black uppercase tracking-widest text-[#0284C7]">Vista previa</span>
              <span className="ml-auto text-[10px] text-slate-400">Así lo ve el joven</span>
            </div>
            <div className="p-4 sm:p-5 space-y-3">
              <div className="text-sm font-black text-slate-900">¿Cómo quieres pagar?</div>
              {previewItems.length === 0 ? (
                <p className="text-xs text-slate-500">No hay métodos habilitados.</p>
              ) : (
                previewItems.map((k, i) => {
                  const meta = METHOD_META[k];
                  const Icon = meta.icon;
                  const m = draft[k];
                  const extra =
                    k === 'qr'
                      ? draft.qr.bankName
                      : k === 'transfer'
                      ? `${activeAccounts.length} cuenta${activeAccounts.length === 1 ? '' : 's'} disponible${activeAccounts.length === 1 ? '' : 's'}`
                      : draft.cash.allowAdvance
                      ? 'Con adelanto'
                      : 'Pago total en caja';
                  return (
                    <div
                      key={k}
                      className={`flex items-center gap-3 p-3 rounded-2xl border-2 ${
                        i === 0 ? 'border-[#0284C7] bg-sky-50/60' : 'border-slate-200 bg-white'
                      }`}
                    >
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${meta.tint}`}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-black text-slate-900 truncate">{m.label || meta.title}</div>
                        <div className="text-[11px] text-slate-500 truncate">{m.description}</div>
                        {extra && <div className="text-[10px] text-slate-400 truncate">{extra}</div>}
                      </div>
                      <span
                        className={`w-4 h-4 rounded-full border-2 shrink-0 ${
                          i === 0 ? 'border-[#0284C7] bg-[#0284C7] ring-2 ring-white ring-inset' : 'border-slate-300'
                        }`}
                      />
                    </div>
                  );
                })
              )}
              {previewItems[0] && draft[previewItems[0]].instructions && (
                <p className="text-[11px] text-slate-600 bg-slate-50 border border-slate-100 rounded-xl p-3 leading-relaxed">
                  {draft[previewItems[0]].instructions}
                </p>
              )}
              {draft.whatsappContact && (
                <div className="flex items-center gap-1.5 text-[11px] text-emerald-700 font-bold">
                  <MessageCircle className="w-3.5 h-3.5" /> ¿Dudas? Escríbenos al {draft.whatsappContact}
                </div>
              )}
            </div>
          </Card>
          <p className="text-[10px] text-slate-400 px-2">
            Los métodos deshabilitados no se muestran. La vista previa refleja los cambios aún no guardados.
          </p>
        </div>
      </div>

      {/* ── Barra de guardado ─────────────────────────── */}
      {dirty && !readOnly && (
        <div className="sticky bottom-20 lg:bottom-4 z-30 animate-fade-in">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between rounded-2xl bg-slate-900 text-white shadow-2xl px-4 py-3 sm:pl-5">
            <div className="flex items-center gap-2 text-sm font-bold">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
              Tienes cambios sin guardar
            </div>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                icon={RotateCcw}
                onClick={handleDiscard}
                disabled={saving}
                className="flex-1 sm:flex-none !text-slate-300 hover:!bg-white/10 hover:!text-white"
              >
                Descartar
              </Button>
              <Button
                icon={saving ? Loader2 : Save}
                onClick={handleSave}
                disabled={saving}
                className={`flex-1 sm:flex-none ${saving ? '[&>svg]:animate-spin' : ''}`}
              >
                {saving ? 'Guardando…' : 'Guardar cambios'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal de cuenta bancaria ──────────────────── */}
      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={isNewAccount ? 'Nueva cuenta bancaria' : 'Editar cuenta bancaria'}
        subtitle="Los jóvenes verán estos datos para transferir."
        icon={Landmark}
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditing(null)}>
              Cancelar
            </Button>
            <Button icon={CheckCircle2} onClick={saveAccount}>
              {isNewAccount ? 'Agregar cuenta' : 'Aplicar cambios'}
            </Button>
          </>
        }
      >
        {editing && (
          <div className="space-y-4">
            <FormSection title="Datos de la cuenta" icon={Building2}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Banco" required error={accountErrors.bank} className="sm:col-span-2">
                  <TextInput
                    autoFocus
                    value={editing.bank}
                    onChange={(e) => setEditing({ ...editing, bank: e.target.value })}
                    placeholder="Ej.: Banco Unión"
                  />
                </Field>
                <Field label="Número de cuenta" required error={accountErrors.accountNumber}>
                  <TextInput
                    value={editing.accountNumber}
                    onChange={(e) => setEditing({ ...editing, accountNumber: e.target.value })}
                    placeholder="1-000-55512-3"
                    className="font-mono"
                  />
                </Field>
                <Field label="Tipo de cuenta">
                  <SelectInput
                    value={editing.accountType}
                    onChange={(e) => setEditing({ ...editing, accountType: e.target.value })}
                  >
                    {Array.from(new Set([...ACCOUNT_TYPES, editing.accountType])).map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </SelectInput>
                </Field>
                <Field label="Moneda">
                  <SelectInput
                    value={editing.currency}
                    onChange={(e) => setEditing({ ...editing, currency: e.target.value as BankAccount['currency'] })}
                  >
                    <option value="Bs">Bolivianos (Bs)</option>
                    <option value="USD">Dólares (USD)</option>
                  </SelectInput>
                </Field>
              </div>
            </FormSection>
            <FormSection title="Titular" icon={UserIcon}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Nombre del titular" required error={accountErrors.holder} className="sm:col-span-2">
                  <TextInput
                    value={editing.holder}
                    onChange={(e) => setEditing({ ...editing, holder: e.target.value })}
                    placeholder="Comité Juvenil Regional UCE Bolivia"
                  />
                </Field>
                <Field label="CI / NIT del titular">
                  <TextInput
                    value={editing.holderDocument || ''}
                    onChange={(e) => setEditing({ ...editing, holderDocument: e.target.value })}
                    placeholder="NIT 1029384756"
                  />
                </Field>
              </div>
              <Toggle
                checked={editing.isActive}
                onChange={(v) => setEditing({ ...editing, isActive: v })}
                label="Cuenta activa"
                hint="Solo las cuentas activas se muestran a los jóvenes"
              />
            </FormSection>
          </div>
        )}
      </Modal>
    </AdminPage>
  );
};
