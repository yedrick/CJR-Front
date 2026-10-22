import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type {
  Camp,
  CampCourse,
  TribeGroup,
  CamperRegistration,
  CheckInLog,
  ViewTab,
  Championship,
  ChampionshipEntry,
  PastCampEdition,
  Catalogs,
  CatalogKind,
  PaymentSettings,
} from '../types/camp';
import {
  campsApi,
  catalogsApi,
  championshipEntriesApi,
  championshipsApi,
  checkinsApi,
  ExtraPaymentPayload,
  coursesApi,
  editionsApi,
  paymentsApi,
  registrationsApi,
  tribesApi,
} from '../api/services';
import { errorMessage } from '../api/errors';
import { env } from '../config/env';
import { getCampPhase } from '../utils/campUtils';
import { matchView, pathForTab, routeForTab, RouteParams } from '../auth/access';
import { useAuth } from './AuthContext';
import { useToast } from '../components/common/Toast';

const EMPTY_CATALOGS: Catalogs = { cities: [], subdirectivas: [], regionales: [], serviceAreas: [], campTypes: [] };

interface CampContextType {
  /** carga inicial de datos públicos */
  isLoading: boolean;
  /** error al cargar (p. ej. API caída) */
  dataError: string | null;
  refreshData: () => Promise<void>;
  /** false mientras se cargan los datos del usuario (sus inscripciones, equipos…) */
  privateReady: boolean;

  // Campamentos
  camps: Camp[];
  featuredCamp: Camp | undefined;
  selectedCamp: Camp | undefined;
  selectedCampId: string;
  setSelectedCampId: (id: string) => void;
  getCampById: (id?: string) => Camp | undefined;
  saveCamp: (camp: Camp) => Promise<Camp | null>;
  deleteCamp: (id: string) => Promise<boolean>;
  setFeaturedCamp: (id: string) => Promise<boolean>;

  // Filtro global del panel admin ('ALL' o id de campamento)
  adminCampFilter: string;
  setAdminCampFilter: (id: string) => void;

  // Catálogos
  catalogs: Catalogs;
  saveCatalogItem: <K extends CatalogKind>(
    kind: K,
    item: Catalogs[K][number],
    opts?: { cascadeRename?: boolean }
  ) => Promise<Catalogs[K][number] | null>;
  deleteCatalogItem: (kind: CatalogKind, id: string) => Promise<boolean>;

  courses: CampCourse[];
  tribes: TribeGroup[];
  /** staff: todas las inscripciones; campista: solo las suyas */
  registrations: CamperRegistration[];
  checkIns: CheckInLog[];
  championships: Championship[];
  pastEditions: PastCampEdition[];

  activeTab: ViewTab;
  /** Navega a una pantalla; algunas reciben parámetros (ej. { id } o { code }). */
  setActiveTab: (tab: ViewTab, params?: RouteParams) => void;
  /** Parámetros de la URL actual (ej. /equipo/:code → { code }). */
  routeParams: RouteParams;
  selectedCamperForBadge: CamperRegistration | null;
  setSelectedCamperForBadge: (camper: CamperRegistration | null) => void;
  selectedEditionForGallery: PastCampEdition | null;
  setSelectedEditionForGallery: (edition: PastCampEdition | null) => void;
  openGalleryWithEdition: (yearOrEdition: number | PastCampEdition) => void;

  /** Talleres: solo con pago confirmado y dentro de la ventana de inscripción del taller. */
  enrollCourse: (registrationId: string, courseId: string) => Promise<CamperRegistration | null>;
  dropCourse: (registrationId: string, courseId: string) => Promise<CamperRegistration | null>;

  /** Campeonatos: staff ve todas las inscripciones; el campista solo las suyas. */
  championshipEntries: ChampionshipEntry[];
  createChampionshipEntry: (data: {
    registrationId: string;
    championshipId: string;
    teamName?: string;
    payment?: ExtraPaymentPayload;
  }) => Promise<ChampionshipEntry | null>;
  cancelChampionshipEntry: (id: string) => Promise<ChampionshipEntry | null>;
  resubmitEntryVoucher: (id: string, voucher: { imageUrl: string; reference: string }) => Promise<ChampionshipEntry | null>;
  removeTeamMember: (entryId: string, registrationId: string) => Promise<ChampionshipEntry | null>;
  joinTeam: (code: string, registrationId?: string) => Promise<ChampionshipEntry | null>;
  approveEntryPayment: (id: string) => Promise<ChampionshipEntry | null>;
  rejectEntryPayment: (id: string, reason: string) => Promise<ChampionshipEntry | null>;
  collectEntryPayment: (id: string) => Promise<ChampionshipEntry | null>;
  updateRegistration: (id: string, updates: Partial<CamperRegistration>) => Promise<CamperRegistration | null>;
  deleteRegistration: (id: string) => Promise<boolean>;
  /** Inscripciones del usuario con sesión. */
  myRegistrations: CamperRegistration[];
  collectCashPayment: (registrationId: string) => Promise<CamperRegistration | null>;
  approveQrVoucherPayment: (registrationId: string) => Promise<CamperRegistration | null>;
  rejectPayment: (registrationId: string, reason: string) => Promise<CamperRegistration | null>;
  resubmitVoucher: (
    registrationId: string,
    voucher: { imageUrl: string; fileName?: string; reference: string }
  ) => Promise<CamperRegistration | null>;

  paymentSettings: PaymentSettings | null;
  savePaymentSettings: (settings: PaymentSettings) => Promise<boolean>;
  validateGroupCoupon: (
    code: string,
    groupSize: number,
    regional: string,
    camp?: Camp
  ) => Promise<{ valid: boolean; discountedPricePerPerson?: number; error?: string }>;

  addCourse: (course: Omit<CampCourse, 'id' | 'enrolledCount'>) => Promise<CampCourse | null>;
  updateCourse: (id: string, updates: Partial<CampCourse>) => Promise<CampCourse | null>;
  deleteCourse: (id: string) => Promise<boolean>;
  getCoursesForCamp: (campId?: string) => CampCourse[];

  saveTribe: (tribe: TribeGroup) => Promise<TribeGroup | null>;
  deleteTribe: (id: string) => Promise<boolean>;

  saveChampionship: (champ: Championship) => Promise<Championship | null>;
  deleteChampionship: (id: string) => Promise<boolean>;
  getChampionshipsForCamp: (campId?: string) => Championship[];

  recordCheckIn: (registrationId: string, courseId: string, campId?: string) => Promise<CheckInLog | null>;
  resetToDemoData: () => Promise<void>;
  getTribeById: (id: string) => TribeGroup | undefined;
  getCourseById: (id: string) => CampCourse | undefined;
  getChampionshipById: (id: string) => Championship | undefined;
}

const CampContext = createContext<CampContextType | undefined>(undefined);

const upsert = <T extends { id: string }>(list: T[], item: T): T[] =>
  list.some((x) => x.id === item.id) ? list.map((x) => (x.id === item.id ? item : x)) : [item, ...list];

export const CampProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser, can, isRestoring } = useAuth();
  const { toast, toastError } = useToast();

  const [isLoading, setIsLoading] = useState(true);
  const [privateReady, setPrivateReady] = useState(false);
  const [dataError, setDataError] = useState<string | null>(null);
  const [camps, setCamps] = useState<Camp[]>([]);
  const [catalogs, setCatalogs] = useState<Catalogs>(EMPTY_CATALOGS);
  const [courses, setCourses] = useState<CampCourse[]>([]);
  const [tribes, setTribes] = useState<TribeGroup[]>([]);
  const [championships, setChampionships] = useState<Championship[]>([]);
  const [pastEditions, setPastEditions] = useState<PastCampEdition[]>([]);
  const [paymentSettings, setPaymentSettings] = useState<PaymentSettings | null>(null);
  const [registrations, setRegistrations] = useState<CamperRegistration[]>([]);
  const [checkIns, setCheckIns] = useState<CheckInLog[]>([]);
  const [championshipEntries, setChampionshipEntries] = useState<ChampionshipEntry[]>([]);

  const [selectedCamperForBadge, setSelectedCamperForBadge] = useState<CamperRegistration | null>(null);
  const [selectedEditionForGallery, setSelectedEditionForGallery] = useState<PastCampEdition | null>(null);
  const [adminCampFilter, setAdminCampFilter] = useState<string>('ALL');
  const [selectedCampIdState, setSelectedCampId] = useState<string>('');

  // ── ROUTER (URL ↔ pantalla) ──────────────────────────
  const [route, setRoute] = useState(() => matchView(window.location.pathname));
  const activeTab = route.tab;
  const routeParams = route.params;
  const setActiveTabState = (tab: ViewTab, params: RouteParams = {}) => setRoute({ tab, params });

  useEffect(() => {
    const onPop = () => setRoute(matchView(window.location.pathname));
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  useEffect(() => {
    const route = routeForTab(activeTab);
    document.title = route ? `${route.title} · ${env.appName}` : env.appName;
  }, [activeTab]);

  const setActiveTab = useCallback((tab: ViewTab, params: RouteParams = {}) => {
    const path = pathForTab(tab, params);
    if (window.location.pathname !== path) window.history.pushState({ tab }, '', path);
    setActiveTabState(tab, params);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  // ── CARGA DE DATOS ───────────────────────────────────
  const loadPublic = useCallback(async () => {
    const [c, cat, co, tr, ch, ed, ps] = await Promise.all([
      campsApi.list(),
      catalogsApi.get(),
      coursesApi.list(),
      tribesApi.list(),
      championshipsApi.list(),
      editionsApi.list(),
      paymentsApi.getSettings(),
    ]);
    setCamps(c);
    setCatalogs(cat);
    setCourses(co);
    setTribes(tr);
    setChampionships(ch);
    setPastEditions(ed);
    setPaymentSettings(ps);
  }, []);

  const permsKey = currentUser ? `${currentUser.id}:${currentUser.permissions.join(',')}` : 'guest';

  const loadPrivate = useCallback(async () => {
    if (!currentUser) {
      setPrivateReady(true);
      setRegistrations([]);
      setCheckIns([]);
      setChampionshipEntries([]);
      setSelectedCamperForBadge(null);
      return;
    }
    const seeAll = can(['registrations:read', 'payments:read']);
    const [regs, chk, entries] = await Promise.all([
      seeAll ? registrationsApi.list() : registrationsApi.mine(),
      can('checkins:read') ? checkinsApi.list() : Promise.resolve([] as CheckInLog[]),
      can(['registrations:read', 'payments:read', 'championships:update'])
        ? championshipEntriesApi.list()
        : championshipEntriesApi.mine(),
    ]);
    setRegistrations(regs);
    setCheckIns(chk);
    setChampionshipEntries(entries);
    setPrivateReady(true);
    setSelectedCamperForBadge((prev) => (prev && regs.some((r) => r.id === prev.id) ? prev : null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [permsKey]);

  // al cambiar de usuario, sus datos aún no están listos
  useEffect(() => {
    setPrivateReady(false);
  }, [permsKey]);

  const refreshData = useCallback(async () => {
    setDataError(null);
    try {
      await Promise.all([loadPublic(), loadPrivate()]);
    } catch (e) {
      setDataError(errorMessage(e));
    } finally {
      setIsLoading(false);
    }
  }, [loadPublic, loadPrivate]);

  // Se recarga al iniciar (ya restaurada la sesión, para no cargar dos veces) y cada vez que cambia el usuario o sus permisos
  useEffect(() => {
    if (!isRestoring) refreshData();
  }, [refreshData, isRestoring]);

  // ── DERIVADOS ────────────────────────────────────────
  const featuredCamp = useMemo(
    () => camps.find((c) => c.isFeatured && c.status !== 'borrador') || camps.find((c) => getCampPhase(c) === 'abierto'),
    [camps]
  );
  const selectedCamp = camps.find((c) => c.id === selectedCampIdState) || featuredCamp;
  const selectedCampId = selectedCamp?.id || '';

  const getCampById = (id?: string) => camps.find((c) => c.id === id);
  const getTribeById = (id: string) => tribes.find((t) => t.id === id);
  const getCourseById = (id: string) => courses.find((c) => c.id === id);
  const getChampionshipById = (id: string) => championships.find((ch) => ch.id === id);
  const getCoursesForCamp = (campId?: string) => courses.filter((c) => c.campId === campId);
  const getChampionshipsForCamp = (campId?: string) => championships.filter((ch) => !ch.campId || ch.campId === campId);
  const myRegistrations = useMemo(
    () => (currentUser ? registrations.filter((r) => r.userId === currentUser.id) : []),
    [registrations, currentUser]
  );

  const openGalleryWithEdition = (yearOrEdition: number | PastCampEdition) => {
    const target = typeof yearOrEdition === 'number' ? pastEditions.find((e) => e.year === yearOrEdition) : yearOrEdition;
    if (target) setSelectedEditionForGallery(target);
    setActiveTab('history');
  };

  /** Ejecuta una llamada a la API; ante error muestra el aviso y devuelve null. */
  async function run<T>(fn: () => Promise<T>, success?: string): Promise<T | null> {
    try {
      const result = await fn();
      if (success) toast({ type: 'success', title: success });
      return result;
    } catch (e) {
      toastError(e);
      return null;
    }
  }

  const replaceRegistration = (r: CamperRegistration) => {
    setRegistrations((prev) => upsert(prev, r));
    setSelectedCamperForBadge((prev) => (prev?.id === r.id ? r : prev));
    return r;
  };

  const reloadCourses = () => coursesApi.list().then(setCourses).catch(() => undefined);

  // ── CAMPAMENTOS ──────────────────────────────────────
  const saveCamp = (camp: Camp) => {
    const exists = camps.some((c) => c.id === camp.id);
    return run(async () => {
      const saved = exists ? await campsApi.update(camp.id, camp) : await campsApi.create(camp);
      setCamps((prev) => {
        const next = upsert(prev, saved);
        return saved.isFeatured ? next.map((c) => (c.id === saved.id ? c : { ...c, isFeatured: false })) : next;
      });
      return saved;
    }, exists ? 'Campamento actualizado' : 'Campamento creado');
  };

  const deleteCamp = async (id: string) =>
    !!(await run(async () => {
      await campsApi.remove(id);
      setCamps((prev) => prev.filter((c) => c.id !== id));
      setCourses((prev) => prev.filter((c) => c.campId !== id));
      if (adminCampFilter === id) setAdminCampFilter('ALL');
      return true;
    }, 'Campamento eliminado'));

  const setFeaturedCamp = async (id: string) =>
    !!(await run(async () => {
      setCamps(await campsApi.feature(id));
      setSelectedCampId(id);
      return true;
    }, 'Campamento activo actualizado'));

  // ── CATÁLOGOS ────────────────────────────────────────
  const saveCatalogItem = <K extends CatalogKind>(kind: K, item: Catalogs[K][number], opts?: { cascadeRename?: boolean }) =>
    run(async () => {
      const exists = (catalogs[kind] as { id: string }[]).some((x) => x.id === item.id);
      const { id, ...rest } = item as { id: string };
      const saved = exists
        ? await catalogsApi.update(kind, id, { ...(rest as object), ...(opts || {}) } as never)
        : await catalogsApi.create(kind, rest as never);
      setCatalogs((prev) => ({ ...prev, [kind]: upsert(prev[kind] as { id: string }[], saved as { id: string }) }));
      if (opts?.cascadeRename) loadPrivate().catch(() => undefined);
      return saved as Catalogs[K][number];
    }, 'Catálogo guardado');

  const deleteCatalogItem = async (kind: CatalogKind, id: string) =>
    !!(await run(async () => {
      setCatalogs(await catalogsApi.remove(kind, id));
      return true;
    }, 'Elemento eliminado'));

  // ── TRIBUS ───────────────────────────────────────────
  const saveTribe = (tribe: TribeGroup) => {
    const exists = tribes.some((t) => t.id === tribe.id);
    return run(async () => {
      const { id, ...rest } = tribe;
      const saved = exists ? await tribesApi.update(id, rest) : await tribesApi.create(rest);
      setTribes((prev) => upsert(prev, saved).sort((a, b) => a.number - b.number));
      return saved;
    }, exists ? 'Tribu actualizada' : 'Tribu creada');
  };

  const deleteTribe = async (id: string) =>
    !!(await run(async () => {
      await tribesApi.remove(id);
      setTribes((prev) => prev.filter((t) => t.id !== id));
      return true;
    }, 'Tribu eliminada'));

  // ── CAMPEONATOS ──────────────────────────────────────
  const saveChampionship = (champ: Championship) => {
    const exists = championships.some((c) => c.id === champ.id);
    return run(async () => {
      const { id, ...rest } = champ;
      const saved = exists ? await championshipsApi.update(id, rest) : await championshipsApi.create(rest);
      setChampionships((prev) => upsert(prev, saved));
      return saved;
    }, exists ? 'Campeonato actualizado' : 'Campeonato creado');
  };

  const deleteChampionship = async (id: string) =>
    !!(await run(async () => {
      await championshipsApi.remove(id);
      setChampionships((prev) => prev.filter((c) => c.id !== id));
      setRegistrations((prev) =>
        prev.map((r) => ({ ...r, enrolledChampionshipIds: r.enrolledChampionshipIds.filter((x) => x !== id) }))
      );
      return true;
    }, 'Campeonato eliminado'));

  // ── TALLERES ─────────────────────────────────────────
  const addCourse = (course: Omit<CampCourse, 'id' | 'enrolledCount'>) =>
    run(async () => {
      const saved = await coursesApi.create(course);
      setCourses((prev) => [saved, ...prev]);
      return saved;
    }, 'Taller creado');

  const updateCourse = (id: string, updates: Partial<CampCourse>) =>
    run(async () => {
      const saved = await coursesApi.update(id, updates);
      setCourses((prev) => upsert(prev, saved));
      return saved;
    }, 'Taller actualizado');

  const deleteCourse = async (id: string) =>
    !!(await run(async () => {
      await coursesApi.remove(id);
      setCourses((prev) => prev.filter((c) => c.id !== id));
      setRegistrations((prev) => prev.map((r) => ({ ...r, enrolledCourseIds: r.enrolledCourseIds.filter((x) => x !== id) })));
      return true;
    }, 'Taller eliminado'));

  // ── INSCRIPCIONES ────────────────────────────────────
  const enrollCourse = (registrationId: string, courseId: string) =>
    run(async () => {
      const reg = replaceRegistration(await registrationsApi.enrollCourse(registrationId, courseId));
      reloadCourses();
      return reg;
    }, 'Te inscribiste al taller');

  const dropCourse = (registrationId: string, courseId: string) =>
    run(async () => {
      const reg = replaceRegistration(await registrationsApi.dropCourse(registrationId, courseId));
      reloadCourses();
      return reg;
    }, 'Saliste del taller');

  // ── CAMPEONATOS: INSCRIPCIONES Y EQUIPOS ─────────────
  /** Tras cambiar una inscripción a campeonato se refrescan los contadores y las inscripciones. */
  const afterEntryChange = (entry: ChampionshipEntry) => {
    setChampionshipEntries((prev) => upsert(prev, entry));
    championshipsApi.list().then(setChampionships).catch(() => undefined);
    loadPrivate().catch(() => undefined);
    return entry;
  };

  const createChampionshipEntry = (data: Parameters<CampContextType['createChampionshipEntry']>[0]) =>
    run(async () => afterEntryChange(await championshipEntriesApi.create(data)));
  const cancelChampionshipEntry = (id: string) =>
    run(async () => afterEntryChange(await championshipEntriesApi.cancel(id)), 'Inscripción al campeonato anulada');
  const resubmitEntryVoucher = (id: string, voucher: { imageUrl: string; reference: string }) =>
    run(async () => afterEntryChange(await championshipEntriesApi.resubmitVoucher(id, voucher)), 'Comprobante enviado');
  const removeTeamMember = (entryId: string, registrationId: string) =>
    run(async () => afterEntryChange(await championshipEntriesApi.removeMember(entryId, registrationId)), 'Equipo actualizado');
  const joinTeam = (code: string, registrationId?: string) =>
    run(async () => afterEntryChange(await championshipEntriesApi.join(code, registrationId)), '¡Te uniste al equipo!');
  const approveEntryPayment = (id: string) =>
    run(async () => afterEntryChange(await championshipEntriesApi.approve(id)), 'Pago extra aprobado');
  const rejectEntryPayment = (id: string, reason: string) =>
    run(async () => afterEntryChange(await championshipEntriesApi.reject(id, reason)), 'Comprobante extra rechazado');
  const collectEntryPayment = (id: string) =>
    run(async () => afterEntryChange(await championshipEntriesApi.collect(id)), 'Pago extra cobrado');

  const updateRegistration = (id: string, updates: Partial<CamperRegistration>) =>
    run(async () => {
      const reg = replaceRegistration(await registrationsApi.update(id, updates));
      if (updates.enrolledCourseIds) reloadCourses();
      return reg;
    }, 'Inscripción actualizada');

  const deleteRegistration = async (id: string) =>
    !!(await run(async () => {
      await registrationsApi.remove(id);
      setRegistrations((prev) => prev.filter((r) => r.id !== id));
      setCheckIns((prev) => prev.filter((c) => c.registrationId !== id));
      reloadCourses();
      return true;
    }, 'Inscripción eliminada'));

  // ── PAGOS ────────────────────────────────────────────
  const collectCashPayment = (registrationId: string) =>
    run(async () => replaceRegistration(await paymentsApi.collect(registrationId)), 'Pago registrado en caja');
  const approveQrVoucherPayment = (registrationId: string) =>
    run(async () => replaceRegistration(await paymentsApi.approve(registrationId)), 'Pago aprobado');
  const rejectPayment = (registrationId: string, reason: string) =>
    run(async () => replaceRegistration(await paymentsApi.reject(registrationId, reason)), 'Comprobante rechazado');
  const resubmitVoucher = (registrationId: string, voucher: { imageUrl: string; fileName?: string; reference: string }) =>
    run(async () => replaceRegistration(await registrationsApi.resubmitVoucher(registrationId, voucher)));

  const savePaymentSettings = async (settings: PaymentSettings) =>
    !!(await run(async () => {
      setPaymentSettings(await paymentsApi.updateSettings(settings));
      return true;
    }));

  const validateGroupCoupon = async (code: string, groupSize: number, regional: string, camp?: Camp) => {
    if (!camp) return { valid: false, error: 'Selecciona un campamento.' };
    try {
      const res = await paymentsApi.validateCoupon({ code, groupSize, regional, campId: camp.id });
      return { valid: true, discountedPricePerPerson: res.discountedPricePerPerson };
    } catch (e) {
      return { valid: false, error: errorMessage(e) };
    }
  };

  // ── CONTROL DE ACCESO ────────────────────────────────
  const recordCheckIn = (registrationId: string, courseId: string, campId?: string) =>
    run(async () => {
      const log = await checkinsApi.create({ registrationId, courseId, campId });
      setCheckIns((prev) => [log, ...prev]);
      return log;
    });

  const resetToDemoData = async () => {
    if (import.meta.env.VITE_USE_MOCK_API === 'false' || !env.useMockApi) {
      toast({ type: 'warning', title: 'No disponible', message: 'Solo se puede restablecer la API simulada.' });
      return;
    }
    const { resetDb } = await import('../api/mock/db');
    resetDb();
    window.location.href = '/';
  };

  return (
    <CampContext.Provider
      value={{
        isLoading,
        dataError,
        refreshData,
        privateReady,
        camps,
        featuredCamp,
        selectedCamp,
        selectedCampId,
        setSelectedCampId,
        getCampById,
        saveCamp,
        deleteCamp,
        setFeaturedCamp,
        adminCampFilter,
        setAdminCampFilter,
        catalogs,
        saveCatalogItem,
        deleteCatalogItem,
        courses,
        tribes,
        registrations,
        checkIns,
        championships,
        pastEditions,
        activeTab,
        setActiveTab,
        routeParams,
        selectedCamperForBadge,
        setSelectedCamperForBadge,
        selectedEditionForGallery,
        setSelectedEditionForGallery,
        openGalleryWithEdition,
        enrollCourse,
        dropCourse,
        championshipEntries,
        createChampionshipEntry,
        cancelChampionshipEntry,
        resubmitEntryVoucher,
        removeTeamMember,
        joinTeam,
        approveEntryPayment,
        rejectEntryPayment,
        collectEntryPayment,
        updateRegistration,
        deleteRegistration,
        myRegistrations,
        collectCashPayment,
        approveQrVoucherPayment,
        rejectPayment,
        resubmitVoucher,
        paymentSettings,
        savePaymentSettings,
        validateGroupCoupon,
        addCourse,
        updateCourse,
        deleteCourse,
        getCoursesForCamp,
        saveTribe,
        deleteTribe,
        saveChampionship,
        deleteChampionship,
        getChampionshipsForCamp,
        recordCheckIn,
        resetToDemoData,
        getTribeById,
        getCourseById,
        getChampionshipById,
      }}
    >
      {children}
    </CampContext.Provider>
  );
};

export const useCamp = () => {
  const context = useContext(CampContext);
  if (!context) throw new Error('useCamp must be used within a CampProvider');
  return context;
};
