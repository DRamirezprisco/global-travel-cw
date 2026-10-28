import { CLIENTES_SEED } from '@/constants/clientesSeed';
import type { ClienteRecord, ClienteStatus, NewClienteRecord } from '@/types';

/**
 * Obtiene la instancia de Cloudflare D1 Database desde Astro.locals.
 */
export function getDatabase(locals: App.Locals): D1Database {
  const db = locals.runtime?.env?.DB;
  if (!db) {
    throw new Error('Cloudflare D1 binding "DB" no está disponible en el entorno actual.');
  }
  return db;
}

/**
 * Crea la tabla `clientes` en Cloudflare D1 si no existe y carga los 94 registros
 * iniciales del Reporte Semanal cuando la tabla está vacía.
 */
export async function ensureClientesInitialized(db: D1Database): Promise<void> {
  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS clientes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        contacto TEXT NOT NULL,
        status TEXT NOT NULL,
        codigo TEXT NOT NULL DEFAULT '-',
        fecha_gestion TEXT NOT NULL DEFAULT '-',
        solicitud_vuelo TEXT NOT NULL DEFAULT '-',
        observacion TEXT NOT NULL DEFAULT '-',
        checkin TEXT NOT NULL DEFAULT '-',
        monto TEXT NOT NULL DEFAULT '-',
        origen_tabla TEXT NOT NULL DEFAULT '-',
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      )`
    )
    .run();

  const countRow = await db
    .prepare('SELECT COUNT(*) as total FROM clientes')
    .first<{ total: number }>();

  if (!countRow || countRow.total === 0) {
    const insertStmt = db.prepare(
      `INSERT INTO clientes (
        contacto, status, codigo, fecha_gestion, solicitud_vuelo, observacion, checkin, monto, origen_tabla
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );

    const batchStatements = CLIENTES_SEED.map((item) =>
      insertStmt.bind(
        item.contacto,
        item.status,
        item.codigo,
        item.fecha_gestion,
        item.solicitud_vuelo,
        item.observacion,
        item.checkin,
        item.monto,
        item.origen_tabla
      )
    );

    await db.batch(batchStatements);
  }
}

/**
 * Obtiene todos los registros de clientes desde Cloudflare D1.
 */
export async function getAllClientes(db: D1Database): Promise<ClienteRecord[]> {
  await ensureClientesInitialized(db);
  const { results } = await db
    .prepare('SELECT * FROM clientes ORDER BY id ASC')
    .all<ClienteRecord>();
  return results ?? [];
}

/**
 * Inserta un nuevo cliente en Cloudflare D1.
 */
export async function createCliente(
  db: D1Database,
  data: NewClienteRecord
): Promise<ClienteRecord | null> {
  await ensureClientesInitialized(db);
  const result = await db
    .prepare(
      `INSERT INTO clientes (
        contacto, status, codigo, fecha_gestion, solicitud_vuelo, observacion, checkin, monto, origen_tabla, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      RETURNING *`
    )
    .bind(
      data.contacto.trim(),
      data.status,
      data.codigo.trim() || '-',
      data.fecha_gestion.trim() || '-',
      data.solicitud_vuelo.trim() || '-',
      data.observacion.trim() || '-',
      data.checkin.trim() || '-',
      data.monto.trim() || '-',
      data.origen_tabla.trim() || 'Registro Manual'
    )
    .first<ClienteRecord>();

  return result ?? null;
}

/**
 * Actualiza el estatus o los campos de un cliente en Cloudflare D1.
 */
export async function updateCliente(
  db: D1Database,
  id: number,
  fields: Partial<NewClienteRecord> & { status?: ClienteStatus }
): Promise<ClienteRecord | null> {
  await ensureClientesInitialized(db);
  const existing = await db
    .prepare('SELECT * FROM clientes WHERE id = ?')
    .bind(id)
    .first<ClienteRecord>();

  if (!existing) {
    return null;
  }

  const updated = {
    contacto: fields.contacto !== undefined ? fields.contacto.trim() : existing.contacto,
    status: fields.status !== undefined ? fields.status : existing.status,
    codigo: fields.codigo !== undefined ? fields.codigo.trim() || '-' : existing.codigo,
    fecha_gestion:
      fields.fecha_gestion !== undefined
        ? fields.fecha_gestion.trim() || '-'
        : existing.fecha_gestion,
    solicitud_vuelo:
      fields.solicitud_vuelo !== undefined
        ? fields.solicitud_vuelo.trim() || '-'
        : existing.solicitud_vuelo,
    observacion:
      fields.observacion !== undefined
        ? fields.observacion.trim() || '-'
        : existing.observacion,
    checkin: fields.checkin !== undefined ? fields.checkin.trim() || '-' : existing.checkin,
    monto: fields.monto !== undefined ? fields.monto.trim() || '-' : existing.monto,
    origen_tabla:
      fields.origen_tabla !== undefined
        ? fields.origen_tabla.trim() || '-'
        : existing.origen_tabla,
  };

  const result = await db
    .prepare(
      `UPDATE clientes
       SET contacto = ?,
           status = ?,
           codigo = ?,
           fecha_gestion = ?,
           solicitud_vuelo = ?,
           observacion = ?,
           checkin = ?,
           monto = ?,
           origen_tabla = ?,
           updated_at = datetime('now')
       WHERE id = ?
       RETURNING *`
    )
    .bind(
      updated.contacto,
      updated.status,
      updated.codigo,
      updated.fecha_gestion,
      updated.solicitud_vuelo,
      updated.observacion,
      updated.checkin,
      updated.monto,
      updated.origen_tabla,
      id
    )
    .first<ClienteRecord>();

  return result ?? null;
}

/**
 * Elimina un registro de cliente de Cloudflare D1.
 */
export async function deleteCliente(db: D1Database, id: number): Promise<boolean> {
  await ensureClientesInitialized(db);
  const res = await db.prepare('DELETE FROM clientes WHERE id = ?').bind(id).run();
  return Boolean(res.success);
}
