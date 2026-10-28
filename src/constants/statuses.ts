import type { ClienteStatus, StatusConfig } from '@/types';

export const CLIENTE_STATUS_LIST: ClienteStatus[] = [
  'Pendiente Cotizacion',
  'Cotizacion Enviada',
  'Reserva por 24h',
  'Reserva Emitida',
  'Pago Pendiente Factura',
  'Pago Pendiente Tickete',
  'Cambio Tickets',
  'Visas',
  'Consultas',
  'Pagos Demorados(lista negra)',
];

export const STATUS_CONFIGS: Record<ClienteStatus, StatusConfig> = {
  'Pendiente Cotizacion': {
    id: 'Pendiente Cotizacion',
    order: 1,
    label: '1. Pendiente Cotizacion',
    shortDescription: 'Solicitudes en espera de cotización para reservas (Rojo #FF0000)',
    badgeClass:
      'bg-status-cotizacion-bg text-status-cotizacion-text border-status-cotizacion-border',
    dotClass: 'bg-status-cotizacion-dot ring-1 ring-status-cotizacion-border',
    cardBorderClass: 'border-l-status-cotizacion-border',
  },
  'Cotizacion Enviada': {
    id: 'Cotizacion Enviada',
    order: 2,
    label: '2. Cotizacion Enviada',
    shortDescription: 'Cotización enviada / esperando confirmación (Amarillo #FFC000)',
    badgeClass:
      'bg-status-enviada-bg text-status-enviada-text border-status-enviada-border',
    dotClass: 'bg-status-enviada-dot ring-1 ring-status-enviada-border',
    cardBorderClass: 'border-l-status-enviada-border',
  },
  'Reserva por 24h': {
    id: 'Reserva por 24h',
    order: 3,
    label: '3. Reserva por 24h',
    shortDescription: 'Reserva apartado 24hrs (Azul Cielo #00B0F0)',
    badgeClass:
      'bg-status-reserva24-bg text-status-reserva24-text border-status-reserva24-border',
    dotClass: 'bg-status-reserva24-dot ring-1 ring-status-reserva24-border',
    cardBorderClass: 'border-l-status-reserva24-border',
  },
  'Reserva Emitida': {
    id: 'Reserva Emitida',
    order: 4,
    label: '4. Reserva Emitida',
    shortDescription: 'Viaje Confirmado / Boleto Emitido (Verde Lima #00FF00)',
    badgeClass:
      'bg-status-emitida-bg text-status-emitida-text border-status-emitida-border',
    dotClass: 'bg-status-emitida-dot ring-1 ring-status-emitida-border',
    cardBorderClass: 'border-l-status-emitida-border',
  },
  'Pago Pendiente Factura': {
    id: 'Pago Pendiente Factura',
    order: 5,
    label: '5. Pago Pendiente Factura',
    shortDescription: 'Reserva / Pago Pendiente Factura (Morado #7030A0)',
    badgeClass:
      'bg-status-factura-bg text-status-factura-text border-status-factura-border',
    dotClass: 'bg-status-factura-dot ring-1 ring-status-factura-border',
    cardBorderClass: 'border-l-status-factura-border',
  },
  'Pago Pendiente Tickete': {
    id: 'Pago Pendiente Tickete',
    order: 6,
    label: '6. Pago Pendiente Tickete',
    shortDescription: 'Boleto emitido / Pago Pendiente Tickete (Azul Acero #2F5496)',
    badgeClass:
      'bg-status-tickete-bg text-status-tickete-text border-status-tickete-border',
    dotClass: 'bg-status-tickete-dot ring-1 ring-status-tickete-border',
    cardBorderClass: 'border-l-status-tickete-border',
  },
  'Cambio Tickets': {
    id: 'Cambio Tickets',
    order: 7,
    label: '7. Cambio Tickets',
    shortDescription: 'Cambio de Tickets / Reprogramaciones (Fucsia #FF0066)',
    badgeClass:
      'bg-status-cambio-bg text-status-cambio-text border-status-cambio-border',
    dotClass: 'bg-status-cambio-dot ring-1 ring-status-cambio-border',
    cardBorderClass: 'border-l-status-cambio-border',
  },
  Visas: {
    id: 'Visas',
    order: 8,
    label: '8. Visas',
    shortDescription: 'Visas en gestión (Magenta / Ciruela #CC3399)',
    badgeClass:
      'bg-status-visas-bg text-status-visas-text border-status-visas-border',
    dotClass: 'bg-status-visas-dot ring-1 ring-status-visas-border',
    cardBorderClass: 'border-l-status-visas-border',
  },
  Consultas: {
    id: 'Consultas',
    order: 9,
    label: '9. Consultas',
    shortDescription: 'Consultas y orientaciones generales (Verde Oliva #669900)',
    badgeClass:
      'bg-status-consultas-bg text-status-consultas-text border-status-consultas-border',
    dotClass: 'bg-status-consultas-dot ring-1 ring-status-consultas-border',
    cardBorderClass: 'border-l-status-consultas-border',
  },
  'Pagos Demorados(lista negra)': {
    id: 'Pagos Demorados(lista negra)',
    order: 10,
    label: '10. Pagos Demorados(lista negra)',
    shortDescription: 'Pendiente Pagos Viejos / Cobranza acumulada (Gris #A5A5A5)',
    badgeClass:
      'bg-status-listanegra-bg text-status-listanegra-text border-status-listanegra-border',
    dotClass: 'bg-status-listanegra-dot ring-1 ring-status-listanegra-border',
    cardBorderClass: 'border-l-status-listanegra-border',
  },
};
