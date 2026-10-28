import type { ReportHeaderInfo, SiteMeta } from '@/types';

export const SITE_META: SiteMeta = {
  title: 'Global Travel CW | Gestión Unificada de Clientes',
  description:
    'Panel centralizado de control de clientes, cotizaciones, reservas, emisiones y cobranzas de Global Travel CW conectado a Cloudflare D1.',
  lang: 'es',
};

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
