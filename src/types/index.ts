export interface SiteMeta {
  title: string;
  description: string;
  lang: string;
}

export interface NavItem {
  id: string;
  label: string;
  href: string;
}

export interface ReportHeaderInfo {
  agencyName: string;
  location: string;
  emissionDate: string;
  responsible: string;
  subtitle: string;
}

// --- ESTATUS PENDIENTES ---
export type PendienteStatus =
  | 'Pendiente Cotizacion'
  | 'Cotizacion Enviada'
  | 'Reserva por 24h'
  | 'Reserva Emitida'
  | 'Visas'
  | 'Consultas'
  | 'Cambio Tickets'
  | 'Finalizado';

// --- ESTATUS PAGOS ---
export type PagoStatus =
  | 'Pendiente'
  | 'Abono'
  | 'Demorados'
  | 'Pagado';

// Estatus históricos de la semilla inicial
export type LegacyClienteStatus =
  | PendienteStatus
  | PagoStatus
  | 'Pago Pendiente Factura'
  | 'Pago Pendiente Tickete'
  | 'Pagos Demorados'
  | 'Pagos Demorados(lista negra)';

// Alias para compatibilidad
export type ClienteStatus = PendienteStatus;

export interface StatusConfig {
  id: string;
  order: number;
  label: string;
  shortDescription: string;
  badgeClass: string;
  dotClass: string;
  cardBorderClass: string;
}

// --- TABLA ESTATUS (Configuración dinámica de Estatus de Pendientes) ---
export interface EstatusRecord {
  id: number;
  nombre: string;
  codigo: string;
  color: string;
  updated_at?: string;
  total_pendientes?: number;
}

export type NewEstatusRecord = {
  nombre: string;
  codigo: string;
  color: string;
};

// --- REGISTRO PENDIENTES ---
export interface PendienteRecord {
  id: number;
  contacto: string;
  status: PendienteStatus | string;
  status_id?: number | null;
  codigo: string;
  aerolinea?: string;
  localizador?: string;
  apellidos?: string;
  fecha_gestion: string;
  solicitud_vuelo: string;
  observacion: string;
  checkin: string;
  monto: string;
  moneda?: string;
  origen_tabla: string;
  updated_at: string;
  status_color?: string;
}

export type NewPendienteRecord = Omit<PendienteRecord, 'id' | 'updated_at'>;

// Alias para compatibilidad previa
export type ClienteRecord = PendienteRecord;
export type NewClienteRecord = NewPendienteRecord;

// --- REGISTRO CONTACTOS ---
export interface ContactoRecord {
  id: number;
  contacto: string;
  telefono: string;
  email: string;
  nombres: string;
  apellidos: string;
  fecha_nacimiento: string;
  numero_pasaporte: string;
  nacionalidad_pasaporte: string;
  genero: string;
  fecha_emision_pasaporte: string;
  fecha_vencimiento_pasaporte: string;
  created_at?: string;
  updated_at?: string;
}

export type NewContactoRecord = Omit<ContactoRecord, 'id' | 'created_at' | 'updated_at'>;

// --- REGISTRO PAGOS ---
export interface PagoRecord {
  id: number;
  contacto: string;
  status: PagoStatus;
  codigo: string;
  fecha_gestion: string;
  solicitud_vuelo: string;
  observacion: string;
  checkin: string;
  monto: string;
  moneda?: string;
  origen_tabla: string;
  pendiente_id?: number | null;
  updated_at: string;
}

export type NewPagoRecord = Omit<PagoRecord, 'id' | 'updated_at'>;

export interface SeedRecord {
  contacto: string;
  status: LegacyClienteStatus;
  fecha_gestion: string;
  codigo: string;
  solicitud_vuelo: string;
  observacion: string;
  checkin: string;
  monto: string;
  moneda?: string;
  origen_tabla: string;
}
