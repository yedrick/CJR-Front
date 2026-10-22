// Cuentas de prueba del servidor simulado. Solo se muestran en el login si VITE_SHOW_DEMO_ACCOUNTS=true.
import type { RoleId } from '../../auth/permissions';

export interface DemoAccount {
  id: string;
  role: RoleId;
  label: string;
  email: string;
  password: string;
  firstName: string;
  paternalLastName: string;
  maternalLastName: string;
  phone: string;
  regional: string;
  birthDate: string;
}

export const DEMO_ACCOUNTS: DemoAccount[] = [
  { id: 'usr-super-01', role: 'super_admin', label: 'Super administrador', email: 'superadmin@cjn.bo', password: 'Super123*', firstName: 'Rebeca', paternalLastName: 'Salazar', maternalLastName: 'Ríos', phone: '+591 76249000', regional: 'COCHABAMBA', birthDate: '1985-06-01' },
  { id: 'usr-admin-01', role: 'admin', label: 'Administrador', email: 'admin@cjn.bo', password: 'Admin123*', firstName: 'Marcos', paternalLastName: 'Andrade', maternalLastName: 'Vargas', phone: '+591 76249100', regional: 'POTOSI', birthDate: '1988-03-12' },
  { id: 'usr-treasurer-01', role: 'tesorero', label: 'Tesorería', email: 'tesoreria@cjn.bo', password: 'Tesoro123*', firstName: 'Elena', paternalLastName: 'Vargas', maternalLastName: 'Paz', phone: '+591 76249200', regional: 'SANTA CRUZ', birthDate: '1990-09-21' },
  { id: 'usr-coord-01', role: 'coordinador', label: 'Coordinador', email: 'coordinador@cjn.bo', password: 'Coordina123*', firstName: 'Raúl', paternalLastName: 'Ortiz', maternalLastName: 'Luna', phone: '+591 76249300', regional: 'ORURO', birthDate: '1992-01-15' },
  { id: 'usr-gate-01', role: 'control_acceso', label: 'Control de acceso', email: 'acceso@cjn.bo', password: 'Acceso123*', firstName: 'Ignacio', paternalLastName: 'Peña', maternalLastName: 'Soria', phone: '+591 76249400', regional: 'EL ALTO', birthDate: '1996-11-30' },
  { id: 'usr-client-01', role: 'campista', label: 'Campista', email: 'sofia.morales@cjn.bo', password: 'Campista123*', firstName: 'Sofía', paternalLastName: 'Morales', maternalLastName: 'Silva', phone: '+591 76249102', regional: 'POTOSI', birthDate: '2008-05-14' },
  { id: 'usr-client-02', role: 'campista', label: 'Campista', email: 'mateo.rivera@cjn.bo', password: 'Campista123*', firstName: 'Mateo', paternalLastName: 'Rivera', maternalLastName: 'Soto', phone: '+591 70688224', regional: 'COCHABAMBA', birthDate: '2007-09-20' },
];
