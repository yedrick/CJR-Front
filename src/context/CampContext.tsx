import React, { createContext, useContext, useState, useEffect } from 'react';
import { 
  CampCourse, 
  TribeGroup, 
  CamperRegistration, 
  CheckInLog, 
  ViewTab, 
  Championship,
  PastCampEdition,
  GroupCoupon,
  Regional
} from '../types/camp';
import { 
  INITIAL_COURSES, 
  FIXED_12_TRIBES, 
  INITIAL_REGISTRATIONS, 
  INITIAL_CHECKINS,
  INITIAL_CHAMPIONSHIPS,
  PAST_CAMP_EDITIONS,
  VALID_GROUP_COUPONS 
} from '../data/initialData';

interface CampContextType {
  courses: CampCourse[];
  tribes: TribeGroup[];
  registrations: CamperRegistration[];
  checkIns: CheckInLog[];
  championships: Championship[];
  pastEditions: PastCampEdition[];
  coupons: GroupCoupon[];
  activeTab: ViewTab;
  setActiveTab: (tab: ViewTab) => void;
  selectedCamperForBadge: CamperRegistration | null;
  setSelectedCamperForBadge: (camper: CamperRegistration | null) => void;
  selectedEditionForGallery: PastCampEdition | null;
  setSelectedEditionForGallery: (edition: PastCampEdition | null) => void;
  openGalleryWithEdition: (yearOrEdition: number | PastCampEdition) => void;
  addRegistration: (data: Omit<CamperRegistration, 'id' | 'registeredAt' | 'tribeId'>) => Promise<CamperRegistration>;
  collectCashPayment: (registrationId: string, cashierName?: string) => CamperRegistration | null;
  verifyQrPaymentTransaction: (registrationId: string) => Promise<boolean>;
  approveQrVoucherPayment: (registrationId: string, verifierName?: string) => CamperRegistration | null;
  validateGroupCoupon: (code: string, groupSize: number, regional: Regional) => {
    valid: boolean;
    discountedPricePerPerson?: number;
    error?: string;
  };
  addCourse: (course: Omit<CampCourse, 'id' | 'enrolledCount'>) => void;
  updateCourse: (id: string, updates: Partial<CampCourse>) => void;
  deleteCourse: (id: string) => void;
  updateTribe: (id: string, updates: Partial<TribeGroup>) => void;
  recordCheckIn: (registrationId: string, courseId: string, verifiedBy: string) => CheckInLog | null;
  resetToDemoData: () => void;
  getTribeById: (id: string) => TribeGroup | undefined;
  getCourseById: (id: string) => CampCourse | undefined;
  getChampionshipById: (id: string) => Championship | undefined;
}

const STORAGE_KEYS = {
  COURSES: 'campflow_courses_v2',
  TRIBES: 'campflow_tribes_v2',
  REGISTRATIONS: 'campflow_registrations_v2',
  CHECKINS: 'campflow_checkins_v2',
};

const CampContext = createContext<CampContextType | undefined>(undefined);

export const CampProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [courses, setCourses] = useState<CampCourse[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.COURSES);
      return saved ? JSON.parse(saved) : INITIAL_COURSES;
    } catch {
      return INITIAL_COURSES;
    }
  });

  const [tribes, setTribes] = useState<TribeGroup[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.TRIBES);
      return saved ? JSON.parse(saved) : FIXED_12_TRIBES;
    } catch {
      return FIXED_12_TRIBES;
    }
  });

  const [registrations, setRegistrations] = useState<CamperRegistration[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.REGISTRATIONS);
      return saved ? JSON.parse(saved) : INITIAL_REGISTRATIONS;
    } catch {
      return INITIAL_REGISTRATIONS;
    }
  });

  const [checkIns, setCheckIns] = useState<CheckInLog[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.CHECKINS);
      return saved ? JSON.parse(saved) : INITIAL_CHECKINS;
    } catch {
      return INITIAL_CHECKINS;
    }
  });

  const [championships] = useState<Championship[]>(INITIAL_CHAMPIONSHIPS);
  const [pastEditions] = useState<PastCampEdition[]>(PAST_CAMP_EDITIONS);
  const [coupons] = useState<GroupCoupon[]>(VALID_GROUP_COUPONS);

  const [activeTab, setActiveTab] = useState<ViewTab>('catalog');
  const [selectedCamperForBadge, setSelectedCamperForBadge] = useState<CamperRegistration | null>(null);
  const [selectedEditionForGallery, setSelectedEditionForGallery] = useState<PastCampEdition | null>(null);

  const openGalleryWithEdition = (yearOrEdition: number | PastCampEdition) => {
    let targetEdition: PastCampEdition | undefined;
    if (typeof yearOrEdition === 'number') {
      targetEdition = pastEditions.find((e) => e.year === yearOrEdition);
    } else {
      targetEdition = yearOrEdition;
    }

    if (targetEdition) {
      setSelectedEditionForGallery(targetEdition);
    }
    setActiveTab('history');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Sync to local storage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.COURSES, JSON.stringify(courses));
    } catch (e) {
      console.error(e);
    }
  }, [courses]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.TRIBES, JSON.stringify(tribes));
    } catch (e) {
      console.error(e);
    }
  }, [tribes]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.REGISTRATIONS, JSON.stringify(registrations));
    } catch (e) {
      console.error(e);
    }
  }, [registrations]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.CHECKINS, JSON.stringify(checkIns));
    } catch (e) {
      console.error(e);
    }
  }, [checkIns]);

  const getTribeById = (id: string) => tribes.find((t) => t.id === id);
  const getCourseById = (id: string) => courses.find((c) => c.id === id);
  const getChampionshipById = (id: string) => championships.find((ch) => ch.id === id);

  // Automatic 12-Tribe round-robin assignment (assigns tribe with fewest members)
  const assignAutomaticTribe = (): string => {
    const counts: Record<string, number> = {};
    tribes.forEach((t) => {
      counts[t.id] = 0;
    });

    registrations.forEach((r) => {
      if (counts[r.tribeId] !== undefined) {
        counts[r.tribeId]++;
      }
    });

    // Find the tribe with the minimum count
    let minTribeId = tribes[0].id;
    let minCount = Infinity;

    tribes.forEach((t) => {
      if (counts[t.id] < minCount) {
        minCount = counts[t.id];
        minTribeId = t.id;
      }
    });

    return minTribeId;
  };

  const validateGroupCoupon = (
    code: string,
    groupSize: number,
    regional: Regional
  ): { valid: boolean; discountedPricePerPerson?: number; error?: string } => {
    const cleanCode = code.trim().toUpperCase();
    const coupon = coupons.find((c) => c.code.toUpperCase() === cleanCode && c.isActive);

    if (!coupon) {
      return {
        valid: false,
        error: 'El código de cupón ingresado no existe o no se encuentra activo.',
      };
    }

    // Check regional
    if (!coupon.allowedRegionals.includes(regional)) {
      return {
        valid: false,
        error: `Este cupón está habilitado únicamente para la ${coupon.allowedRegionals.join(', ')}. Tu regional actual es ${regional}.`,
      };
    }

    // Strict 35-person group rule
    if (groupSize < coupon.requiredGroupSize) {
      return {
        valid: false,
        error: `Regla de grupo: El cupón "${coupon.code}" exige un grupo exacto de ${coupon.requiredGroupSize} personas. Tu grupo actual tiene ${groupSize}. Se cobrará la tarifa regular de 450 Bs.`,
      };
    }

    if (groupSize > coupon.requiredGroupSize) {
      return {
        valid: false,
        error: `Límite excedido: El cupón "${coupon.code}" es válido únicamente para un grupo exacto de ${coupon.requiredGroupSize} personas. Con ${groupSize} personas el cupón ha dejado de funcionar.`,
      };
    }

    return {
      valid: true,
      discountedPricePerPerson: coupon.discountedPricePerPerson,
    };
  };

  const addRegistration = async (
    data: Omit<CamperRegistration, 'id' | 'registeredAt' | 'tribeId'>
  ): Promise<CamperRegistration> => {
    const newId = `CMP-2026-${Math.floor(1000 + Math.random() * 9000)}`;
    const now = new Date();
    const formattedDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    // Auto-assign to one of the 12 fixed tribes
    const assignedTribeId = assignAutomaticTribe();

    const newRegistration: CamperRegistration = {
      ...data,
      id: newId,
      tribeId: assignedTribeId,
      registeredAt: formattedDate,
    };

    // Increment enrolledCount on courses
    setCourses((prevCourses) =>
      prevCourses.map((c) => {
        if (data.enrolledCourseIds.includes(c.id)) {
          return { ...c, enrolledCount: Math.min(c.maxCapacity, c.enrolledCount + 1) };
        }
        return c;
      })
    );

    setRegistrations((prev) => [newRegistration, ...prev]);
    return newRegistration;
  };

  // Cashier verification: Admin collects cash in person at camp registration desk
  // REGLE: "Si paga allá en caja presencial no hay descuento ni nada (tarifa estándar completa)"
  const collectCashPayment = (registrationId: string, cashierName = 'Administrador de Caja'): CamperRegistration | null => {
    const now = new Date();
    const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const cashReceiptFolio = `REC-CAJA-${Math.floor(100000 + Math.random() * 900000)}`;

    let updatedCamper: CamperRegistration | null = null;

    setRegistrations((prev) =>
      prev.map((r) => {
        if (r.id === registrationId) {
          // Si paga allá en caja no hay descuento alguno (tarifa base completa de 450 Bs)
          const standardBaseFee = 450;
          const finalCashAmount = standardBaseFee + (r.payment.coursesFees || 0);

          const resultCamper: CamperRegistration = {
            ...r,
            status: 'active',
            championshipsStatus: r.enrolledChampionshipIds && r.enrolledChampionshipIds.length > 0 ? 'confirmed' : undefined,
            payment: {
              ...r.payment,
              baseCampFee: standardBaseFee,
              discountAmount: 0,
              couponCodeApplied: undefined,
              totalAmount: finalCashAmount,
              status: 'completed',
              paymentMethod: 'cash_box',
              remainingBalance: 0,
              cashierCollectedBy: cashierName,
              cashierCollectedAt: dateStr,
              transactionFolio: cashReceiptFolio,
            },
          };
          updatedCamper = resultCamper;
          return resultCamper;
        }
        return r;
      })
    );

    return updatedCamper;
  };

  // Tesorería aprueba comprobante de pago QR subido o webhook bancario confirmado
  const approveQrVoucherPayment = (registrationId: string, verifierName = 'Pasarela Bancaria Webhook'): CamperRegistration | null => {
    const now = new Date();
    const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    let updatedCamper: CamperRegistration | null = null;

    setRegistrations((prev) =>
      prev.map((r) => {
        if (r.id === registrationId) {
          const resultCamper: CamperRegistration = {
            ...r,
            status: 'active',
            championshipsStatus: r.enrolledChampionshipIds && r.enrolledChampionshipIds.length > 0 ? 'confirmed' : undefined,
            payment: {
              ...r.payment,
              status: 'completed',
              verifiedAt: dateStr,
              verifiedBy: verifierName,
              transactionFolio: r.payment.transactionFolio || `QR-WEBHOOK-${Math.floor(100000 + Math.random() * 900000)}`,
            },
          };
          updatedCamper = resultCamper;
          return resultCamper;
        }
        return r;
      })
    );

    return updatedCamper;
  };

  // Simulate "Verificar Pago" button on QR checkout
  const verifyQrPaymentTransaction = async (registrationId: string): Promise<boolean> => {
    // Artificial 1 second roundtrip
    await new Promise((resolve) => setTimeout(resolve, 900));

    setRegistrations((prev) =>
      prev.map((r) => {
        if (r.id === registrationId) {
          return {
            ...r,
            status: 'active',
            payment: {
              ...r.payment,
              status: 'completed',
              transactionFolio: `QR-CONFIRM-${Math.floor(100000 + Math.random() * 900000)}`,
            },
          };
        }
        return r;
      })
    );

    return true;
  };

  const addCourse = (courseData: Omit<CampCourse, 'id' | 'enrolledCount'>) => {
    const newId = `c-${Date.now().toString().slice(-4)}`;
    const newCourse: CampCourse = {
      ...courseData,
      id: newId,
      enrolledCount: 0,
    };
    setCourses((prev) => [newCourse, ...prev]);
  };

  const updateCourse = (id: string, updates: Partial<CampCourse>) => {
    setCourses((prev) => prev.map((c) => (c.id === id ? { ...c, ...updates } : c)));
  };

  const deleteCourse = (id: string) => {
    setCourses((prev) => prev.filter((c) => c.id !== id));
  };

  const updateTribe = (id: string, updates: Partial<TribeGroup>) => {
    setTribes((prev) => prev.map((t) => (t.id === id ? { ...t, ...updates } : t)));
  };

  const recordCheckIn = (
    registrationId: string,
    courseId: string,
    verifiedBy: string
  ): CheckInLog | null => {
    const camper = registrations.find((r) => r.id === registrationId);
    if (!camper) return null;

    let courseTitle = 'Acceso General Campamento';
    let type: CheckInLog['type'] = 'GATE_ENTRY';

    if (courseId !== 'CAMP_GATE') {
      const course = courses.find((c) => c.id === courseId);
      if (course) {
        courseTitle = course.title;
        type = 'COURSE_ATTENDANCE';
      }
    }

    const now = new Date();
    const timestamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;

    const newLog: CheckInLog = {
      id: `chk-${Date.now()}`,
      registrationId,
      camperName: camper.fullName,
      courseId,
      courseTitle,
      timestamp,
      type,
      verifiedBy,
    };

    setCheckIns((prev) => [newLog, ...prev]);
    return newLog;
  };

  const resetToDemoData = () => {
    setCourses(INITIAL_COURSES);
    setTribes(FIXED_12_TRIBES);
    setRegistrations(INITIAL_REGISTRATIONS);
    setCheckIns(INITIAL_CHECKINS);
    localStorage.removeItem(STORAGE_KEYS.COURSES);
    localStorage.removeItem(STORAGE_KEYS.TRIBES);
    localStorage.removeItem(STORAGE_KEYS.REGISTRATIONS);
    localStorage.removeItem(STORAGE_KEYS.CHECKINS);
  };

  return (
    <CampContext.Provider
      value={{
        courses,
        tribes,
        registrations,
        checkIns,
        championships,
        pastEditions,
        coupons,
        activeTab,
        setActiveTab,
        selectedCamperForBadge,
        setSelectedCamperForBadge,
        selectedEditionForGallery,
        setSelectedEditionForGallery,
        openGalleryWithEdition,
        addRegistration,
        collectCashPayment,
        verifyQrPaymentTransaction,
        approveQrVoucherPayment,
        validateGroupCoupon,
        addCourse,
        updateCourse,
        deleteCourse,
        updateTribe,
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
  if (!context) {
    throw new Error('useCamp must be used within a CampProvider');
  }
  return context;
};
