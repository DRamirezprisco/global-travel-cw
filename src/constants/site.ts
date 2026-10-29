import type { NavItem, ReportHeaderInfo, SiteMeta } from '@/types';

export const SITE_META: SiteMeta = {
  title: 'Global Travel CW | Gestión Operativa',
  description:
    'Panel centralizado de control de pendientes, reservas, emisiones y cobranzas de Global Travel CW conectado a Cloudflare D1.',
  lang: 'es',
};

export const NAV_ITEMS: readonly NavItem[] = [
  { id: 'pendientes', label: 'Pendientes', href: '/' },
  { id: 'pagos', label: 'Pagos', href: '/pagos' },
  { id: 'contactos', label: 'Contactos', href: '/contactos' },
  { id: 'estatus', label: 'Estatus', href: '/estatus' },
] as const;

export const REPORT_HEADER_INFO: ReportHeaderInfo = {
  agencyName: 'GLOBAL TRAVEL CW',
  location: 'Willemstad, Curaçao',
  emissionDate: 'Viernes, 23 de Octubre de 2026',
  responsible: 'Daniela Ramírez',
  subtitle: 'Matriz Unificada de Clientes y Operaciones (Cloudflare D1)',
};

export const GRID_COLUMNS = {
  contacto: 'Cliente',
  status: 'Estatus',
  fecha_gestion: 'Fecha',
  solicitud_vuelo: 'Datos del Vuelo',
  observacion: 'Observación',
  monto: 'Precio',
} as const;

export const PAGOS_GRID_COLUMNS = {
  contacto: 'Cliente',
  status: 'Estatus',
  fecha_gestion: 'Fecha',
  solicitud_vuelo: 'Concepto / Servicio',
  observacion: 'Observación / Detalle',
  monto: 'Monto / Deuda',
} as const;

export const CONTACTOS_GRID_COLUMNS = {
  contacto: 'Cliente / Contacto',
  telefono: 'Teléfono',
  email: 'Email',
  nombre_completo: 'Nombres y Apellidos',
  genero: 'Género',
  pasaporte: 'Pasaporte',
  vencimiento: 'Vencimiento',
} as const;
