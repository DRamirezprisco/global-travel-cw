import type {
  PagoStatus,
  PendienteStatus,
  StatusConfig,
} from '@/types';

// ==========================================
// 1. PANEL PENDIENTES
// ==========================================

// Los 7 estatus operativos visibles en la cuadrícula de Pendientes
export const PENDIENTE_STATUS_LIST: PendienteStatus[] = [
  'Pendiente Cotizacion',
  'Cotizacion Enviada',
  'Reserva por 24h',
  'Reserva Emitida',
  'Visas',
  'Consultas',
  'Cambio Tickets',
];

// Todos los estatus seleccionables en el modal de Pendientes (incluyendo Finalizado)
export const ALL_PENDIENTE_STATUS_LIST: PendienteStatus[] = [
  ...PENDIENTE_STATUS_LIST,
  'Finalizado',
];

export const PENDIENTE_STATUS_CONFIGS: Record<PendienteStatus, StatusConfig> = {
  'Pendiente Cotizacion': {
    id: 'Pendiente Cotizacion',
    order: 1,
    label: 'Pendiente Cotizacion',
    shortDescription: 'Solicitudes en espera de cotización para reservas (Rojo #FF0000)',
    badgeClass:
      'bg-status-cotizacion-bg text-status-cotizacion-text border-status-cotizacion-border',
    dotClass: 'bg-status-cotizacion-dot ring-1 ring-status-cotizacion-border',
    cardBorderClass: 'border-l-status-cotizacion-border',
  },
  'Cotizacion Enviada': {
    id: 'Cotizacion Enviada',
    order: 2,
    label: 'Cotizacion Enviada',
    shortDescription: 'Cotización enviada / esperando confirmación (Amarillo #FFC000)',
    badgeClass:
      'bg-status-enviada-bg text-status-enviada-text border-status-enviada-border',
    dotClass: 'bg-status-enviada-dot ring-1 ring-status-enviada-border',
    cardBorderClass: 'border-l-status-enviada-border',
  },
  'Reserva por 24h': {
    id: 'Reserva por 24h',
    order: 3,
    label: 'Reserva por 24h',
    shortDescription: 'Reserva apartado 24hrs (Azul Cielo #00B0F0)',
    badgeClass:
      'bg-status-reserva24-bg text-status-reserva24-text border-status-reserva24-border',
    dotClass: 'bg-status-reserva24-dot ring-1 ring-status-reserva24-border',
    cardBorderClass: 'border-l-status-reserva24-border',
  },
  'Reserva Emitida': {
    id: 'Reserva Emitida',
    order: 4,
    label: 'Reserva Emitida',
    shortDescription: 'Viaje Confirmado / Boleto Emitido (Verde Lima #00FF00)',
    badgeClass:
      'bg-status-emitida-bg text-status-emitida-text border-status-emitida-border',
    dotClass: 'bg-status-emitida-dot ring-1 ring-status-emitida-border',
    cardBorderClass: 'border-l-status-emitida-border',
  },
  Visas: {
    id: 'Visas',
    order: 5,
    label: 'Visas',
    shortDescription: 'Visas en gestión (Magenta / Ciruela #CC3399)',
    badgeClass:
      'bg-status-visas-bg text-status-visas-text border-status-visas-border',
    dotClass: 'bg-status-visas-dot ring-1 ring-status-visas-border',
    cardBorderClass: 'border-l-status-visas-border',
  },
  Consultas: {
    id: 'Consultas',
    order: 6,
    label: 'Consultas',
    shortDescription: 'Consultas y orientaciones generales (Verde Oliva #669900)',
    badgeClass:
      'bg-status-consultas-bg text-status-consultas-text border-status-consultas-border',
    dotClass: 'bg-status-consultas-dot ring-1 ring-status-consultas-border',
    cardBorderClass: 'border-l-status-consultas-border',
  },
  'Cambio Tickets': {
    id: 'Cambio Tickets',
    order: 7,
    label: 'Cambio Tickets',
    shortDescription: 'Cambio de Tickets / Reprogramaciones (Fucsia #FF0066)',
    badgeClass:
      'bg-status-cambio-bg text-status-cambio-text border-status-cambio-border',
    dotClass: 'bg-status-cambio-dot ring-1 ring-status-cambio-border',
    cardBorderClass: 'border-l-status-cambio-border',
  },
  Finalizado: {
    id: 'Finalizado',
    order: 8,
    label: 'Finalizado',
    shortDescription: 'Gestión completada y finalizada',
    badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-300',
    dotClass: 'bg-emerald-600 ring-1 ring-emerald-400',
    cardBorderClass: 'border-l-emerald-600',
  },
};

// Aliases para compatibilidad con código existente
export const CLIENTE_STATUS_LIST = PENDIENTE_STATUS_LIST;
export const ALL_CLIENTE_STATUS_LIST = ALL_PENDIENTE_STATUS_LIST;
export const STATUS_CONFIGS = PENDIENTE_STATUS_CONFIGS;

// ==========================================
// 2. PANEL PAGOS
// ==========================================

// Los 4 estatus de Pagos
export const PAGO_STATUS_LIST: PagoStatus[] = [
  'Pendiente',
  'Abono',
  'Demorados',
  'Pagado',
];

export const PAGO_STATUS_CONFIGS: Record<PagoStatus, StatusConfig> = {
  Pendiente: {
    id: 'Pendiente',
    order: 1,
    label: 'Pendiente',
    shortDescription: 'Pagos pendientes (Unión de Facturas y Ticketes)',
    badgeClass: 'bg-purple-50 text-purple-800 border-purple-300',
    dotClass: 'bg-purple-600 ring-1 ring-purple-400',
    cardBorderClass: 'border-l-purple-600',
  },
  Abono: {
    id: 'Abono',
    order: 2,
    label: 'Abono',
    shortDescription: 'Abonos y pagos parciales registrados',
    badgeClass: 'bg-amber-50 text-amber-800 border-amber-300',
    dotClass: 'bg-amber-500 ring-1 ring-amber-400',
    cardBorderClass: 'border-l-amber-500',
  },
  Demorados: {
    id: 'Demorados',
    order: 3,
    label: 'Demorados',
    shortDescription: 'Cobranza atrasada / pagos demorados',
    badgeClass: 'bg-rose-50 text-rose-800 border-rose-300',
    dotClass: 'bg-rose-500 ring-1 ring-rose-400',
    cardBorderClass: 'border-l-rose-500',
  },
  Pagado: {
    id: 'Pagado',
    order: 4,
    label: 'Pagado',
    shortDescription: 'Cuenta saldada en su totalidad',
    badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-300',
    dotClass: 'bg-emerald-600 ring-1 ring-emerald-400',
    cardBorderClass: 'border-l-emerald-600',
  },
};
