export interface SiteMeta {
  title: string;
  description: string;
  lang: string;
}

export interface ReportHeaderInfo {
  agencyName: string;
  location: string;
  emissionDate: string;
  responsible: string;
  subtitle: string;
}

export type ClienteStatus =
  | 'Pendiente Cotizacion'
  | 'Cotizacion Enviada'
  | 'Reserva por 24h'
  | 'Reserva Emitida'
  | 'Pago Pendiente Factura'
  | 'Pago Pendiente Tickete'
  | 'Cambio Tickets'
  | 'Visas'
  | 'Consultas'
  | 'Pagos Demorados(lista negra)';

export interface StatusConfig {
  id: ClienteStatus;
  order: number;
  label: string;
  shortDescription: string;
  badgeClass: string;
  dotClass: string;
  cardBorderClass: string;
}

export interface ClienteRecord {
  id: number;
  contacto: string;
  status: ClienteStatus;
  codigo: string;
  fecha_gestion: string;
  solicitud_vuelo: string;
  observacion: string;
  checkin: string;
  monto: string;
  origen_tabla: string;
  updated_at: string;
}

export type NewClienteRecord = Omit<ClienteRecord, 'id' | 'updated_at'>;
