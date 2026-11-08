import { CLIENTES_SEED } from '@/constants/clientesSeed';
import {
  LOCAL_MIGRATION_CONTACTOS,
  LOCAL_MIGRATION_ESTATUS,
  LOCAL_MIGRATION_PAGOS,
  LOCAL_MIGRATION_PENDIENTES,
} from '@/constants/localMigrationData';
import type {
  ContactoRecord,
  EstatusRecord,
  NewContactoRecord,
  NewEstatusRecord,
  NewPagoRecord,
  NewPendienteRecord,
  PagoRecord,
  PagoStatus,
  PendienteRecord,
  PendienteStatus,
} from '@/types';
import {
  getNowFormatted,
  isPagoOverdue20Days,
  parseContactoInitial,
} from '@/utils/pagoHelpers';

export { parseContactoInitial };

/**
 * URL del Worker remoto en Cloudflare conectado directamente a la base de datos D1 de producción.
 * Cuando el proyecto se abre en entorno local (dev), todas las lecturas y escrituras se ejecutan
 * contra el D1 remoto de este Worker para garantizar que nunca se guarde solo en local y todos
 * los dispositivos compartan siempre exactamente la misma información.
 */
export const REMOTE_D1_WORKER_URL = 'https://global-travel-cw.guillermoveraghanain.workers.dev';

function isLocalDevEnvironment(): boolean {
  return Boolean(import.meta.env?.DEV);
}

async function remoteApiFetch<T>(
  path: string,
  options?: RequestInit
): Promise<{ ok: boolean; data?: T; exists?: boolean; error?: string; message?: string }> {
  const res = await fetch(`${REMOTE_D1_WORKER_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      ...(options?.headers || {}),
    },
  });
  return (await res.json()) as {
    ok: boolean;
    data?: T;
    exists?: boolean;
    error?: string;
    message?: string;
  };
}

/**
 * Obtiene la instancia de Cloudflare D1 Database desde Astro.locals.
 */
export function getDatabase(locals: App.Locals): D1Database {
  const db = locals.runtime?.env?.DB;
  if (!db) {
    if (isLocalDevEnvironment()) {
      return {} as D1Database;
    }
    throw new Error('Cloudflare D1 binding "DB" no está disponible en el entorno actual.');
  }
  return db;
}

const PAYMENT_STATUSES = [
  'Pago Pendiente Factura',
  'Pago Pendiente Tickete',
  'Pagos Demorados',
  'Pagos Demorados(lista negra)',
];

export const INITIAL_ESTATUS_SEED: Array<{ nombre: string; codigo: string; color: string }> = [
  { nombre: 'Pendiente Cotizacion', codigo: 'pc', color: '#dd0303' },
  { nombre: 'Cotizacion Enviada', codigo: 'ce', color: '#1e3a8a' },
  { nombre: 'Reserva por 24h', codigo: 'r24', color: '#0298cf' },
  { nombre: 'Reserva Emitida', codigo: 're', color: '#17b080' },
  { nombre: 'Visas', codigo: 'v', color: '#ee17a6' },
  { nombre: 'Consultas', codigo: 'c', color: '#dcac1e' },
  { nombre: 'Cambio Tickets', codigo: 'ct', color: '#ea580c' },
  { nombre: 'Finalizado', codigo: 'f', color: '#6f7680' },
];

let dbInitPromise: Promise<void> | null = null;

/**
 * Asegura la creación, inicialización y migración de las tablas `estatus`, `pendientes`, `pagos` y `contactos` en Cloudflare D1.
 * Utiliza una promesa compartida para evitar condiciones de carrera en llamadas concurrentes (como Promise.all en SSR).
 */
export function ensureDatabaseInitialized(db: D1Database): Promise<void> {
  if (isLocalDevEnvironment()) {
    return Promise.resolve();
  }
  if (!dbInitPromise) {
    dbInitPromise = runDatabaseInitialization(db).catch((err) => {
      dbInitPromise = null; // Permitir reintento en caso de error
      throw err;
    });
  }
  return dbInitPromise;
}

async function applyLocalDataMigrationToD1(db: D1Database): Promise<void> {
  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS _app_migrations (
        key TEXT PRIMARY KEY,
        applied_at TEXT NOT NULL DEFAULT (datetime('now'))
      )`
    )
    .run();

  const migrationKey = 'sync_local_to_d1_2026_11_v1';
  const alreadyApplied = await db
    .prepare('SELECT key FROM _app_migrations WHERE key = ? LIMIT 1')
    .bind(migrationKey)
    .first<{ key: string }>();

  if (alreadyApplied) {
    return;
  }

  // 1. Sincronizar los 8 estatus personalizados desde local
  for (const est of LOCAL_MIGRATION_ESTATUS) {
    await db
      .prepare(
        `INSERT INTO estatus (id, nombre, codigo, color, updated_at)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           nombre = excluded.nombre,
           codigo = excluded.codigo,
           color = excluded.color,
           updated_at = excluded.updated_at`
      )
      .bind(est.id, est.nombre, est.codigo, est.color, est.updated_at || "datetime('now')")
      .run();
  }

  // 2. Sincronizar todos los pendientes desde local
  const upsertPendienteStmt = db.prepare(
    `INSERT INTO pendientes (
      id, contacto, status, status_id, codigo, aerolinea, localizador, apellidos,
      fecha_gestion, solicitud_vuelo, observacion, checkin, monto, origen_tabla, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      contacto = excluded.contacto,
      status = excluded.status,
      status_id = excluded.status_id,
      codigo = excluded.codigo,
      aerolinea = excluded.aerolinea,
      localizador = excluded.localizador,
      apellidos = excluded.apellidos,
      fecha_gestion = excluded.fecha_gestion,
      solicitud_vuelo = excluded.solicitud_vuelo,
      observacion = excluded.observacion,
      checkin = excluded.checkin,
      monto = excluded.monto,
      origen_tabla = excluded.origen_tabla,
      updated_at = excluded.updated_at`
  );

  const pendientesBatch = LOCAL_MIGRATION_PENDIENTES.map((p) =>
    upsertPendienteStmt.bind(
      p.id,
      p.contacto,
      p.status,
      p.status_id ?? null,
      p.codigo || '-',
      p.aerolinea || '-',
      p.localizador || '-',
      p.apellidos || '-',
      p.fecha_gestion || '-',
      p.solicitud_vuelo || '-',
      p.observacion || '-',
      p.checkin || '-',
      p.monto || '-',
      p.origen_tabla || '-',
      p.updated_at || "datetime('now')"
    )
  );
  if (pendientesBatch.length > 0) {
    await db.batch(pendientesBatch);
  }

  // 3. Sincronizar todos los pagos desde local
  const upsertPagoStmt = db.prepare(
    `INSERT INTO pagos (
      id, contacto, status, codigo, fecha_gestion, solicitud_vuelo,
      observacion, checkin, monto, moneda, origen_tabla, pendiente_id, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      contacto = excluded.contacto,
      status = excluded.status,
      codigo = excluded.codigo,
      fecha_gestion = excluded.fecha_gestion,
      solicitud_vuelo = excluded.solicitud_vuelo,
      observacion = excluded.observacion,
      checkin = excluded.checkin,
      monto = excluded.monto,
      moneda = excluded.moneda,
      origen_tabla = excluded.origen_tabla,
      pendiente_id = excluded.pendiente_id,
      updated_at = excluded.updated_at`
  );

  const pagosBatch = LOCAL_MIGRATION_PAGOS.map((pg) =>
    upsertPagoStmt.bind(
      pg.id,
      pg.contacto,
      pg.status,
      pg.codigo || '-',
      pg.fecha_gestion || '-',
      pg.solicitud_vuelo || '-',
      pg.observacion || '-',
      pg.checkin || '-',
      pg.monto || '-',
      pg.moneda || 'Fls',
      pg.origen_tabla || '-',
      pg.pendiente_id ?? null,
      pg.updated_at || "datetime('now')"
    )
  );
  if (pagosBatch.length > 0) {
    await db.batch(pagosBatch);
  }

  // 4. Sincronizar todos los contactos desde local
  const upsertContactoStmt = db.prepare(
    `INSERT INTO contactos (
      contacto, telefono, email, nombres, apellidos,
      fecha_nacimiento, numero_pasaporte, nacionalidad_pasaporte,
      genero, fecha_emision_pasaporte, fecha_vencimiento_pasaporte,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(contacto) DO UPDATE SET
      telefono = excluded.telefono,
      email = excluded.email,
      nombres = excluded.nombres,
      apellidos = excluded.apellidos,
      fecha_nacimiento = excluded.fecha_nacimiento,
      numero_pasaporte = excluded.numero_pasaporte,
      nacionalidad_pasaporte = excluded.nacionalidad_pasaporte,
      genero = excluded.genero,
      fecha_emision_pasaporte = excluded.fecha_emision_pasaporte,
      fecha_vencimiento_pasaporte = excluded.fecha_vencimiento_pasaporte,
      updated_at = excluded.updated_at`
  );

  const contactosBatch = LOCAL_MIGRATION_CONTACTOS.map((c) =>
    upsertContactoStmt.bind(
      c.contacto,
      c.telefono || '-',
      c.email || '-',
      c.nombres || '-',
      c.apellidos || '-',
      c.fecha_nacimiento || '-',
      c.numero_pasaporte || '-',
      c.nacionalidad_pasaporte || '-',
      c.genero || '-',
      c.fecha_emision_pasaporte || '-',
      c.fecha_vencimiento_pasaporte || '-',
      c.created_at || "datetime('now')",
      c.updated_at || "datetime('now')"
    )
  );
  if (contactosBatch.length > 0) {
    await db.batch(contactosBatch);
  }

  await db
    .prepare("INSERT INTO _app_migrations (key, applied_at) VALUES (?, datetime('now'))")
    .bind(migrationKey)
    .run();
}

async function runDatabaseInitialization(db: D1Database): Promise<void> {
  try {
    // 1. Tabla Estatus (Exclusiva para Pendientes)
    await db
      .prepare(
        `CREATE TABLE IF NOT EXISTS estatus (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          nombre TEXT NOT NULL,
          codigo TEXT NOT NULL UNIQUE,
          color TEXT NOT NULL,
          updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        )`
      )
      .run();

    // Inicializar estatus semilla si la tabla está vacía
    const countEstatus = await db
      .prepare('SELECT COUNT(*) as total FROM estatus')
      .first<{ total: number }>();

    if (!countEstatus || countEstatus.total === 0) {
      const insertEstatusStmt = db.prepare(
        `INSERT INTO estatus (nombre, codigo, color, updated_at)
         VALUES (?, ?, ?, datetime('now'))`
      );

      const estatusBatch = INITIAL_ESTATUS_SEED.map((item) =>
        insertEstatusStmt.bind(item.nombre, item.codigo, item.color)
      );

      if (estatusBatch.length > 0) {
        await db.batch(estatusBatch);
      }
    }

    // 2. Tabla separada de Pendientes (con status_id relacionado a estatus)
    await db
      .prepare(
        `CREATE TABLE IF NOT EXISTS pendientes (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          contacto TEXT NOT NULL,
          status TEXT NOT NULL,
          status_id INTEGER REFERENCES estatus(id),
          codigo TEXT NOT NULL DEFAULT '-',
          aerolinea TEXT DEFAULT '-',
          localizador TEXT DEFAULT '-',
          apellidos TEXT DEFAULT '-',
          fecha_gestion TEXT NOT NULL DEFAULT '-',
          solicitud_vuelo TEXT NOT NULL DEFAULT '-',
          observacion TEXT NOT NULL DEFAULT '-',
          checkin TEXT NOT NULL DEFAULT '-',
          monto TEXT NOT NULL DEFAULT '-',
          abono TEXT NOT NULL DEFAULT '-',
          ganancia TEXT NOT NULL DEFAULT '-',
          origen_tabla TEXT NOT NULL DEFAULT '-',
          updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        )`
      )
      .run();

    // Asegurar migración de columnas en tablas creadas anteriormente
    try {
      await db.prepare('ALTER TABLE pendientes ADD COLUMN status_id INTEGER REFERENCES estatus(id)').run();
    } catch {}
    try {
      await db.prepare("ALTER TABLE pendientes ADD COLUMN abono TEXT NOT NULL DEFAULT '-'").run();
    } catch {}
    try {
      await db.prepare("ALTER TABLE pendientes ADD COLUMN ganancia TEXT NOT NULL DEFAULT '-'").run();
    } catch {}

    // 3. Tabla separada de Pagos (con pendiente_id relacionado a pendientes)
    await db
      .prepare(
        `CREATE TABLE IF NOT EXISTS pagos (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          contacto TEXT NOT NULL,
          status TEXT NOT NULL,
          codigo TEXT NOT NULL DEFAULT '-',
          fecha_gestion TEXT NOT NULL DEFAULT '-',
          solicitud_vuelo TEXT NOT NULL DEFAULT '-',
          observacion TEXT NOT NULL DEFAULT '-',
          checkin TEXT NOT NULL DEFAULT '-',
          monto TEXT NOT NULL DEFAULT '-',
          moneda TEXT DEFAULT 'Fls',
          origen_tabla TEXT NOT NULL DEFAULT '-',
          pendiente_id INTEGER REFERENCES pendientes(id),
          updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        )`
      )
      .run();

    // Asegurar migración de columnas en pagos si la tabla fue creada previamente
    try {
      await db.prepare('ALTER TABLE pagos ADD COLUMN pendiente_id INTEGER REFERENCES pendientes(id)').run();
    } catch {}

    try {
      await db.prepare("ALTER TABLE pagos ADD COLUMN moneda TEXT DEFAULT 'Fls'").run();
    } catch {}

    // 4. Inicializar tabla `pendientes` si está vacía
    const countPendientes = await db
      .prepare('SELECT COUNT(*) as total FROM pendientes')
      .first<{ total: number }>();

    if (!countPendientes || countPendientes.total === 0) {
      let seededFromClientes = false;
      try {
        const hasClientes = await db
          .prepare('SELECT COUNT(*) as total FROM clientes')
          .first<{ total: number }>();

        if (hasClientes && hasClientes.total > 0) {
          await db
            .prepare(
              `INSERT INTO pendientes (contacto, status, codigo, fecha_gestion, solicitud_vuelo, observacion, checkin, monto, origen_tabla, updated_at)
               SELECT contacto, status, codigo, fecha_gestion, solicitud_vuelo, observacion, checkin, monto, origen_tabla, updated_at
               FROM clientes
               WHERE status NOT IN ('Pago Pendiente Factura', 'Pago Pendiente Tickete', 'Pagos Demorados', 'Pagos Demorados(lista negra)')`
            )
            .run();
          seededFromClientes = true;
        }
      } catch {}

      if (!seededFromClientes) {
        const insertStmt = db.prepare(
          `INSERT INTO pendientes (
            contacto, status, codigo, fecha_gestion, solicitud_vuelo, observacion, checkin, monto, origen_tabla
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
        );

        const pendientesSeed = CLIENTES_SEED.filter(
          (item) => !PAYMENT_STATUSES.includes(item.status)
        );

        const batch = pendientesSeed.map((item) =>
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

        if (batch.length > 0) {
          await db.batch(batch);
        }
      }
    }

    // Vincular status_id en registros de pendientes que aún no lo tengan
    try {
      await db
        .prepare(
          `UPDATE pendientes
           SET status_id = (SELECT id FROM estatus WHERE estatus.nombre = pendientes.status LIMIT 1)
           WHERE status_id IS NULL OR status_id = 0`
        )
        .run();
    } catch {}

    // 5. Inicializar tabla `pagos` si está vacía
    const countPagos = await db
      .prepare('SELECT COUNT(*) as total FROM pagos')
      .first<{ total: number }>();

    if (!countPagos || countPagos.total === 0) {
      let seededFromClientes = false;
      try {
        const hasClientes = await db
          .prepare('SELECT COUNT(*) as total FROM clientes')
          .first<{ total: number }>();

        if (hasClientes && hasClientes.total > 0) {
          await db
            .prepare(
              `INSERT INTO pagos (contacto, status, codigo, fecha_gestion, solicitud_vuelo, observacion, checkin, monto, origen_tabla, updated_at)
               SELECT contacto,
                      CASE
                        WHEN status LIKE '%Demorados%' THEN 'Demorados'
                        ELSE 'Pendiente'
                      END,
                      codigo, fecha_gestion, solicitud_vuelo, observacion, checkin, monto, origen_tabla, updated_at
               FROM clientes
               WHERE status IN ('Pago Pendiente Factura', 'Pago Pendiente Tickete', 'Pagos Demorados', 'Pagos Demorados(lista negra)')`
            )
            .run();
          seededFromClientes = true;
        }
      } catch {}

      if (!seededFromClientes) {
        const insertStmt = db.prepare(
          `INSERT INTO pagos (
            contacto, status, codigo, fecha_gestion, solicitud_vuelo, observacion, checkin, monto, origen_tabla
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
        );

        const pagosSeed = CLIENTES_SEED.filter((item) =>
          PAYMENT_STATUSES.includes(item.status)
        ).map((item) => {
          let status: PagoStatus = 'Pendiente';
          if (item.status.includes('Demorados')) {
            status = 'Demorados';
          }
          return { ...item, status };
        });

        const batch = pagosSeed.map((item) =>
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

        if (batch.length > 0) {
          await db.batch(batch);
        }
      }
    }

    // 6. Asegurar que todo pago existente tenga un pendiente_id relacionado.
    try {
      const unlinkedPagos = await db
        .prepare('SELECT * FROM pagos WHERE pendiente_id IS NULL OR pendiente_id = 0')
        .all<PagoRecord>();

      if (unlinkedPagos.results && unlinkedPagos.results.length > 0) {
        const finalizadoEstatus = await db
          .prepare("SELECT id FROM estatus WHERE nombre = 'Finalizado' OR codigo = 'finalizado' OR codigo = 'f' LIMIT 1")
          .first<{ id: number }>();
        const finalizadoId = finalizadoEstatus ? finalizadoEstatus.id : null;

        for (const p of unlinkedPagos.results) {
          const created = await db
            .prepare(
              `INSERT INTO pendientes (
                contacto, status, status_id, codigo, aerolinea, localizador, apellidos, fecha_gestion, solicitud_vuelo, observacion, checkin, monto, origen_tabla, updated_at
              ) VALUES (?, 'Finalizado', ?, ?, '-', '-', '-', ?, ?, ?, ?, ?, 'Relación Inicial Pagos', datetime('now'))
              RETURNING id`
            )
            .bind(
              p.contacto,
              finalizadoId,
              p.codigo || '-',
              p.fecha_gestion || '-',
              p.solicitud_vuelo || 'Pago Histórico',
              p.observacion || '-',
              p.checkin || '-',
              p.monto || '-'
            )
            .first<{ id: number }>();

          if (created && created.id) {
            await db
              .prepare('UPDATE pagos SET pendiente_id = ? WHERE id = ?')
              .bind(created.id, p.id)
              .run();
          }
        }
      }
    } catch {}

    // 7. Tabla Contactos (Directorio general de contactos y pasaportes)
    await db
      .prepare(
        `CREATE TABLE IF NOT EXISTS contactos (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          contacto TEXT NOT NULL UNIQUE,
          telefono TEXT NOT NULL DEFAULT '-',
          email TEXT NOT NULL DEFAULT '-',
          nombres TEXT NOT NULL DEFAULT '-',
          apellidos TEXT NOT NULL DEFAULT '-',
          fecha_nacimiento TEXT NOT NULL DEFAULT '-',
          numero_pasaporte TEXT NOT NULL DEFAULT '-',
          nacionalidad_pasaporte TEXT NOT NULL DEFAULT '-',
          genero TEXT NOT NULL DEFAULT '-',
          fecha_emision_pasaporte TEXT NOT NULL DEFAULT '-',
          fecha_vencimiento_pasaporte TEXT NOT NULL DEFAULT '-',
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        )`
      )
      .run();

    // Inicializar contactos desde pendientes y pagos si la tabla está vacía
    const countContactos = await db
      .prepare('SELECT COUNT(*) as total FROM contactos')
      .first<{ total: number }>();

    if (!countContactos || countContactos.total === 0) {
      try {
        const distinctRows = await db
          .prepare(
            `SELECT DISTINCT contacto FROM (
               SELECT contacto FROM pendientes WHERE contacto IS NOT NULL AND contacto != ''
               UNION
               SELECT contacto FROM pagos WHERE contacto IS NOT NULL AND contacto != ''
             )`
          )
          .all<{ contacto: string }>();

        if (distinctRows.results && distinctRows.results.length > 0) {
          const insertContactoStmt = db.prepare(
            `INSERT OR IGNORE INTO contactos (
              contacto, telefono, email, nombres, apellidos,
              fecha_nacimiento, numero_pasaporte, nacionalidad_pasaporte,
              genero, fecha_emision_pasaporte, fecha_vencimiento_pasaporte,
              created_at, updated_at
            ) VALUES (?, ?, '-', ?, ?, '-', '-', '-', '-', '-', '-', datetime('now'), datetime('now'))`
          );

          const batch = distinctRows.results.map((r) => {
            const parsed = parseContactoInitial(r.contacto);
            return insertContactoStmt.bind(
              parsed.contacto,
              parsed.telefono,
              parsed.nombres,
              parsed.apellidos
            );
          });

          if (batch.length > 0) {
            await db.batch(batch);
          }
        }
      } catch {}
    }

    // 8. Ejecutar migración única de la data local (Oct 30) hacia D1 remoto
    await applyLocalDataMigrationToD1(db);
  } catch (error) {
    console.error('Error inicializando base de datos D1:', error);
    throw error;
  }
}

export const ensureClientesInitialized = ensureDatabaseInitialized;

// ==========================================
// OPERACIONES CRUD: TABLA ESTATUS (PENDIENTES)
// ==========================================

export async function getAllEstatus(db: D1Database): Promise<EstatusRecord[]> {
  if (isLocalDevEnvironment()) {
    const res = await remoteApiFetch<EstatusRecord[]>('/api/estatus');
    return res.data ?? [];
  }
  await ensureDatabaseInitialized(db);
  const { results } = await db
    .prepare(
      `SELECT e.id, e.nombre, e.codigo, e.color, e.updated_at,
              COUNT(p.id) AS total_pendientes
       FROM estatus e
       LEFT JOIN pendientes p ON p.status_id = e.id OR p.status = e.nombre
       GROUP BY e.id, e.nombre, e.codigo, e.color, e.updated_at
       ORDER BY e.id ASC`
    )
    .all<EstatusRecord>();
  return results ?? [];
}

export async function getEstatusById(db: D1Database, id: number): Promise<EstatusRecord | null> {
  if (isLocalDevEnvironment()) {
    const all = await getAllEstatus(db);
    return all.find((e) => e.id === id) ?? null;
  }
  await ensureDatabaseInitialized(db);
  const result = await db
    .prepare(
      `SELECT e.id, e.nombre, e.codigo, e.color, e.updated_at,
              COUNT(p.id) AS total_pendientes
       FROM estatus e
       LEFT JOIN pendientes p ON p.status_id = e.id OR p.status = e.nombre
       WHERE e.id = ?
       GROUP BY e.id, e.nombre, e.codigo, e.color, e.updated_at`
    )
    .bind(id)
    .first<EstatusRecord>();
  return result ?? null;
}

export async function createEstatus(
  db: D1Database,
  data: NewEstatusRecord
): Promise<EstatusRecord | null> {
  if (isLocalDevEnvironment()) {
    const res = await remoteApiFetch<EstatusRecord>('/api/estatus', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(res.error || 'Error al crear estatus en D1 remoto');
    return res.data ?? null;
  }
  await ensureDatabaseInitialized(db);

  const nombre = data.nombre.trim();
  let codigo = data.codigo.trim().toLowerCase();
  if (!codigo) {
    codigo = nombre
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }
  const color = data.color.trim() || '#1e3a8a';

  const result = await db
    .prepare(
      `INSERT INTO estatus (nombre, codigo, color, updated_at)
       VALUES (?, ?, ?, datetime('now'))
       RETURNING *`
    )
    .bind(nombre, codigo, color)
    .first<EstatusRecord>();

  return result ?? null;
}

export async function updateEstatus(
  db: D1Database,
  id: number,
  fields: Partial<NewEstatusRecord>
): Promise<EstatusRecord | null> {
  if (isLocalDevEnvironment()) {
    const res = await remoteApiFetch<EstatusRecord>('/api/estatus', {
      method: 'PATCH',
      body: JSON.stringify({ id, ...fields }),
    });
    if (!res.ok) throw new Error(res.error || 'Error al actualizar estatus en D1 remoto');
    return res.data ?? null;
  }
  await ensureDatabaseInitialized(db);

  const existing = await getEstatusById(db, id);
  if (!existing) {
    return null;
  }

  const nombre = fields.nombre !== undefined ? fields.nombre.trim() : existing.nombre;
  const codigo = fields.codigo !== undefined ? fields.codigo.trim().toLowerCase() : existing.codigo;
  const color = fields.color !== undefined ? fields.color.trim() : existing.color;

  const result = await db
    .prepare(
      `UPDATE estatus
       SET nombre = ?,
           codigo = ?,
           color = ?,
           updated_at = datetime('now')
       WHERE id = ?
       RETURNING *`
    )
    .bind(nombre, codigo, color, id)
    .first<EstatusRecord>();

  if (result && existing.nombre !== nombre) {
    try {
      await db
        .prepare('UPDATE pendientes SET status = ? WHERE status_id = ? OR status = ?')
        .bind(nombre, id, existing.nombre)
        .run();
    } catch {}
  }

  return result ?? null;
}

export async function deleteEstatus(
  db: D1Database,
  id: number
): Promise<{ success: boolean; error?: string }> {
  if (isLocalDevEnvironment()) {
    const res = await remoteApiFetch<unknown>(`/api/estatus?id=${id}`, {
      method: 'DELETE',
    });
    return { success: Boolean(res.ok), error: res.error };
  }
  await ensureDatabaseInitialized(db);

  const existing = await getEstatusById(db, id);
  if (!existing) {
    return { success: false, error: 'Estatus no encontrado.' };
  }

  const count = await db
    .prepare('SELECT COUNT(*) as total FROM pendientes WHERE status_id = ? OR status = ?')
    .bind(id, existing.nombre)
    .first<{ total: number }>();

  if (count && count.total > 0) {
    return {
      success: false,
      error: `No se puede eliminar el estatus "${existing.nombre}" porque tiene ${count.total} pendiente(s) asociado(s). Reasigna los pendientes antes de eliminarlo.`,
    };
  }

  const res = await db.prepare('DELETE FROM estatus WHERE id = ?').bind(id).run();
  return { success: Boolean(res.success) };
}

// ==========================================
// OPERACIONES CRUD: TABLA PENDIENTES
// ==========================================

export async function getAllPendientes(db: D1Database): Promise<PendienteRecord[]> {
  if (isLocalDevEnvironment()) {
    const res = await remoteApiFetch<PendienteRecord[]>('/api/pendientes');
    return res.data ?? [];
  }
  await ensureDatabaseInitialized(db);
  const { results } = await db
    .prepare(
      `SELECT p.*, e.color AS status_color
       FROM pendientes p
       LEFT JOIN estatus e ON p.status_id = e.id OR p.status = e.nombre
       ORDER BY p.id ASC`
    )
    .all<PendienteRecord>();
  return results ?? [];
}

export async function createPendiente(
  db: D1Database,
  data: NewPendienteRecord
): Promise<PendienteRecord | null> {
  if (isLocalDevEnvironment()) {
    const res = await remoteApiFetch<PendienteRecord>('/api/pendientes', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(res.error || 'Error al crear pendiente en D1 remoto');
    return res.data ?? null;
  }
  await ensureDatabaseInitialized(db);

  let statusId = data.status_id;
  if (!statusId) {
    const st = await db
      .prepare('SELECT id FROM estatus WHERE nombre = ? OR codigo = ? LIMIT 1')
      .bind(data.status, data.status)
      .first<{ id: number }>();
    if (st) statusId = st.id;
  }

  const result = await db
    .prepare(
      `INSERT INTO pendientes (
        contacto, status, status_id, codigo, aerolinea, localizador, apellidos, fecha_gestion, solicitud_vuelo, observacion, checkin, monto, abono, ganancia, origen_tabla, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      RETURNING *`
    )
    .bind(
      data.contacto.trim(),
      data.status,
      statusId ?? null,
      data.codigo.trim() || '-',
      data.aerolinea?.trim() || '-',
      data.localizador?.trim() || '-',
      data.apellidos?.trim() || '-',
      data.fecha_gestion.trim() || '-',
      data.solicitud_vuelo.trim() || '-',
      data.observacion.trim() || '-',
      data.checkin.trim() || '-',
      data.monto.trim() || '-',
      data.abono?.trim() || '-',
      data.ganancia?.trim() || '-',
      data.origen_tabla?.trim() || 'Registro Manual'
    )
    .first<PendienteRecord>();

  // Regla de Negocio: si se crea con estatus 'Reserva Emitida', sincronizar y crear el pago automáticamente
  if (result && result.status === 'Reserva Emitida') {
    try {
      await syncPagoFromPendiente(db, result.id);
    } catch {}
  }

  return result ?? null;
}

export async function updatePendiente(
  db: D1Database,
  id: number,
  fields: Partial<NewPendienteRecord> & { status?: PendienteStatus | string; status_id?: number | null }
): Promise<PendienteRecord | null> {
  if (isLocalDevEnvironment()) {
    const res = await remoteApiFetch<PendienteRecord>('/api/pendientes', {
      method: 'PATCH',
      body: JSON.stringify({ id, ...fields }),
    });
    if (!res.ok) throw new Error(res.error || 'Error al actualizar pendiente en D1 remoto');
    return res.data ?? null;
  }
  await ensureDatabaseInitialized(db);
  const existing = await db
    .prepare('SELECT * FROM pendientes WHERE id = ?')
    .bind(id)
    .first<PendienteRecord>();

  if (!existing) {
    return null;
  }

  let status = fields.status !== undefined ? fields.status : existing.status;
  let statusId = fields.status_id !== undefined ? fields.status_id : existing.status_id;

  if (fields.status !== undefined && fields.status_id === undefined) {
    const st = await db
      .prepare('SELECT id FROM estatus WHERE nombre = ? OR codigo = ? LIMIT 1')
      .bind(fields.status, fields.status)
      .first<{ id: number }>();
    if (st) statusId = st.id;
  } else if (fields.status_id !== undefined && fields.status === undefined) {
    const st = await db
      .prepare('SELECT nombre FROM estatus WHERE id = ? LIMIT 1')
      .bind(fields.status_id)
      .first<{ nombre: string }>();
    if (st) status = st.nombre;
  }

  const updated = {
    contacto: fields.contacto !== undefined ? fields.contacto.trim() : existing.contacto,
    status,
    status_id: statusId ?? null,
    codigo: fields.codigo !== undefined ? fields.codigo.trim() || '-' : existing.codigo,
    aerolinea:
      fields.aerolinea !== undefined ? fields.aerolinea.trim() || '-' : existing.aerolinea ?? '-',
    localizador:
      fields.localizador !== undefined ? fields.localizador.trim() || '-' : existing.localizador ?? '-',
    apellidos:
      fields.apellidos !== undefined ? fields.apellidos.trim() || '-' : existing.apellidos ?? '-',
    fecha_gestion:
      fields.fecha_gestion !== undefined ? fields.fecha_gestion.trim() || '-' : existing.fecha_gestion,
    solicitud_vuelo:
      fields.solicitud_vuelo !== undefined ? fields.solicitud_vuelo.trim() || '-' : existing.solicitud_vuelo,
    observacion:
      fields.observacion !== undefined ? fields.observacion.trim() || '-' : existing.observacion,
    checkin: fields.checkin !== undefined ? fields.checkin.trim() || '-' : existing.checkin,
    monto: fields.monto !== undefined ? fields.monto.trim() || '-' : existing.monto,
    abono: fields.abono !== undefined ? fields.abono.trim() || '-' : existing.abono ?? '-',
    ganancia: fields.ganancia !== undefined ? fields.ganancia.trim() || '-' : existing.ganancia ?? '-',
    origen_tabla:
      fields.origen_tabla !== undefined ? fields.origen_tabla.trim() || '-' : existing.origen_tabla,
  };

  const result = await db
    .prepare(
      `UPDATE pendientes
       SET contacto = ?,
           status = ?,
           status_id = ?,
           codigo = ?,
           aerolinea = ?,
           localizador = ?,
           apellidos = ?,
           fecha_gestion = ?,
           solicitud_vuelo = ?,
           observacion = ?,
           checkin = ?,
           monto = ?,
           abono = ?,
           ganancia = ?,
           origen_tabla = ?,
           updated_at = datetime('now')
       WHERE id = ?
       RETURNING *`
    )
    .bind(
      updated.contacto,
      updated.status,
      updated.status_id,
      updated.codigo,
      updated.aerolinea,
      updated.localizador,
      updated.apellidos,
      updated.fecha_gestion,
      updated.solicitud_vuelo,
      updated.observacion,
      updated.checkin,
      updated.monto,
      updated.abono,
      updated.ganancia,
      updated.origen_tabla,
      id
    )
    .first<PendienteRecord>();

  // Regla de Negocio: si el estatus pasó a 'Reserva Emitida', sincronizar y crear el pago automáticamente
  if (result && result.status === 'Reserva Emitida') {
    try {
      await syncPagoFromPendiente(db, result.id);
    } catch {}
  }

  return result ?? null;
}

export async function deletePendiente(db: D1Database, id: number): Promise<boolean> {
  if (isLocalDevEnvironment()) {
    const res = await remoteApiFetch<unknown>(`/api/pendientes?id=${id}`, {
      method: 'DELETE',
    });
    return Boolean(res.ok);
  }
  await ensureDatabaseInitialized(db);
  const res = await db.prepare('DELETE FROM pendientes WHERE id = ?').bind(id).run();
  return Boolean(res.success);
}

// Aliases para compatibilidad con llamadas existentes
export const getAllClientes = getAllPendientes;
export const createCliente = createPendiente;
export const updateCliente = updatePendiente;
export const deleteCliente = deletePendiente;

// ==========================================
// OPERACIONES CRUD Y REGLAS DE NEGOCIO: PAGOS
// ==========================================

/**
 * Regla: Evalúa si los pagos en estatus 'Pendiente' tienen más de 20 días de antigüedad.
 * De ser así, se pasan automáticamente al estatus 'Demorados'.
 */
export async function checkAndSyncDemorados(db: D1Database): Promise<number> {
  if (isLocalDevEnvironment()) return 0;
  try {
    const { results } = await db
      .prepare("SELECT id, fecha_gestion, updated_at FROM pagos WHERE status = 'Pendiente'")
      .all<{ id: number; fecha_gestion: string; updated_at: string }>();

    if (!results || results.length === 0) return 0;

    let updatedCount = 0;
    for (const p of results) {
      if (isPagoOverdue20Days(p.fecha_gestion, p.updated_at)) {
        await db
          .prepare("UPDATE pagos SET status = 'Demorados', updated_at = datetime('now') WHERE id = ?")
          .bind(p.id)
          .run();
        updatedCount++;
      }
    }

    return updatedCount;
  } catch {
    return 0;
  }
}

/**
 * Regla: Cuando un pendiente pasa a 'Reserva Emitida', crea automáticamente un pago
 * en estatus 'Pendiente' con la fecha/hora actual, el monto definido y el concepto.
 * Verifica si ya existe un pago vinculado a ese pendiente para evitar duplicados.
 */
export async function syncPagoFromPendiente(
  db: D1Database,
  pendienteId: number
): Promise<PagoRecord | null> {
  if (isLocalDevEnvironment()) return null;
  const pendiente = await db
    .prepare('SELECT * FROM pendientes WHERE id = ?')
    .bind(pendienteId)
    .first<PendienteRecord>();

  if (!pendiente || pendiente.status !== 'Reserva Emitida') {
    return null;
  }

  // 1. Verificar si ya existe un pago vinculado a este pendiente por ID
  const existingByPendienteId = await db
    .prepare('SELECT * FROM pagos WHERE pendiente_id = ? LIMIT 1')
    .bind(pendiente.id)
    .first<PagoRecord>();

  if (existingByPendienteId) {
    return existingByPendienteId;
  }

  // 2. Verificar si existe un pago no vinculado con el mismo cliente y concepto
  const existingByMatch = await db
    .prepare(
      'SELECT * FROM pagos WHERE pendiente_id IS NULL AND contacto = ? AND solicitud_vuelo = ? LIMIT 1'
    )
    .bind(pendiente.contacto, pendiente.solicitud_vuelo)
    .first<PagoRecord>();

  if (existingByMatch) {
    await db
      .prepare('UPDATE pagos SET pendiente_id = ? WHERE id = ?')
      .bind(pendiente.id, existingByMatch.id)
      .run();
    return existingByMatch;
  }

  // 3. Crear el nuevo pago directamente (sin llamar a createPago para evitar recursión)
  const fechaActual = getNowFormatted();
  const concepto =
    pendiente.solicitud_vuelo && pendiente.solicitud_vuelo !== '-'
      ? pendiente.solicitud_vuelo
      : 'Boleto / Reserva Emitida';
  const moneda =
    pendiente.monto && (pendiente.monto.includes('$') || pendiente.monto.toLowerCase().includes('usd'))
      ? 'USD'
      : 'Fls';

  const newPago = await db
    .prepare(
      `INSERT INTO pagos (
        contacto, status, codigo, fecha_gestion, solicitud_vuelo, observacion, checkin, monto, moneda, origen_tabla, pendiente_id, updated_at
      ) VALUES (?, 'Pendiente', ?, ?, ?, ?, ?, ?, ?, 'Reserva Emitida', ?, datetime('now'))
      RETURNING *`
    )
    .bind(
      pendiente.contacto.trim(),
      pendiente.codigo || '-',
      fechaActual,
      concepto,
      pendiente.observacion && pendiente.observacion !== '-'
        ? `Generado automáticamente por Reserva Emitida. ${pendiente.observacion}`
        : 'Generado automáticamente por Reserva Emitida',
      pendiente.checkin || '-',
      pendiente.monto && pendiente.monto !== '-' ? pendiente.monto : '-',
      moneda,
      pendiente.id
    )
    .first<PagoRecord>();

  return newPago ?? null;
}

export async function getAllPagos(db: D1Database): Promise<PagoRecord[]> {
  if (isLocalDevEnvironment()) {
    const res = await remoteApiFetch<PagoRecord[]>('/api/pagos');
    return res.data ?? [];
  }
  await ensureDatabaseInitialized(db);
  // Sincroniza pagos pendientes vencidos (+20 días) antes de responder
  await checkAndSyncDemorados(db);

  const { results } = await db
    .prepare('SELECT * FROM pagos ORDER BY id ASC')
    .all<PagoRecord>();
  return results ?? [];
}

export async function createPago(
  db: D1Database,
  data: NewPagoRecord
): Promise<PagoRecord | null> {
  if (isLocalDevEnvironment()) {
    const res = await remoteApiFetch<PagoRecord>('/api/pagos', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(res.error || 'Error al crear pago en D1 remoto');
    return res.data ?? null;
  }
  await ensureDatabaseInitialized(db);
  const moneda = data.moneda?.trim() || (data.monto && (data.monto.includes('$') || data.monto.toLowerCase().includes('usd')) ? 'USD' : 'Fls');
  const result = await db
    .prepare(
      `INSERT INTO pagos (
        contacto, status, codigo, fecha_gestion, solicitud_vuelo, observacion, checkin, monto, moneda, origen_tabla, pendiente_id, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
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
      moneda,
      data.origen_tabla?.trim() || 'Registro Manual',
      data.pendiente_id ?? null
    )
    .first<PagoRecord>();

  return result ?? null;
}

export async function updatePago(
  db: D1Database,
  id: number,
  fields: Partial<NewPagoRecord> & { status?: PagoStatus; pendiente_id?: number | null }
): Promise<PagoRecord | null> {
  if (isLocalDevEnvironment()) {
    const res = await remoteApiFetch<PagoRecord>('/api/pagos', {
      method: 'PATCH',
      body: JSON.stringify({ id, ...fields }),
    });
    if (!res.ok) throw new Error(res.error || 'Error al actualizar pago en D1 remoto');
    return res.data ?? null;
  }
  await ensureDatabaseInitialized(db);
  const existing = await db
    .prepare('SELECT * FROM pagos WHERE id = ?')
    .bind(id)
    .first<PagoRecord>();

  if (!existing) {
    return null;
  }

  const updated = {
    contacto: fields.contacto !== undefined ? fields.contacto.trim() : existing.contacto,
    status: fields.status !== undefined ? fields.status : existing.status,
    codigo: fields.codigo !== undefined ? fields.codigo.trim() || '-' : existing.codigo,
    fecha_gestion:
      fields.fecha_gestion !== undefined ? fields.fecha_gestion.trim() || '-' : existing.fecha_gestion,
    solicitud_vuelo:
      fields.solicitud_vuelo !== undefined ? fields.solicitud_vuelo.trim() || '-' : existing.solicitud_vuelo,
    observacion:
      fields.observacion !== undefined ? fields.observacion.trim() || '-' : existing.observacion,
    checkin: fields.checkin !== undefined ? fields.checkin.trim() || '-' : existing.checkin,
    monto: fields.monto !== undefined ? fields.monto.trim() || '-' : existing.monto,
    moneda: fields.moneda !== undefined ? fields.moneda.trim() || 'Fls' : existing.moneda ?? 'Fls',
    origen_tabla:
      fields.origen_tabla !== undefined ? fields.origen_tabla.trim() || '-' : existing.origen_tabla,
    pendiente_id:
      fields.pendiente_id !== undefined ? fields.pendiente_id : existing.pendiente_id ?? null,
  };

  const result = await db
    .prepare(
      `UPDATE pagos
       SET contacto = ?,
           status = ?,
           codigo = ?,
           fecha_gestion = ?,
           solicitud_vuelo = ?,
           observacion = ?,
           checkin = ?,
           monto = ?,
           moneda = ?,
           origen_tabla = ?,
           pendiente_id = ?,
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
      updated.moneda,
      updated.origen_tabla,
      updated.pendiente_id,
      id
    )
    .first<PagoRecord>();

  return result ?? null;
}

export async function deletePago(db: D1Database, id: number): Promise<boolean> {
  if (isLocalDevEnvironment()) {
    const res = await remoteApiFetch<unknown>(`/api/pagos?id=${id}`, {
      method: 'DELETE',
    });
    return Boolean(res.ok);
  }
  await ensureDatabaseInitialized(db);
  const res = await db.prepare('DELETE FROM pagos WHERE id = ?').bind(id).run();
  return Boolean(res.success);
}

// ==========================================
// OPERACIONES CRUD: TABLA CONTACTOS
// ==========================================

export async function getAllContactos(db: D1Database): Promise<ContactoRecord[]> {
  if (isLocalDevEnvironment()) {
    const res = await remoteApiFetch<ContactoRecord[]>('/api/contactos');
    return res.data ?? [];
  }
  await ensureDatabaseInitialized(db);
  const result = await db
    .prepare('SELECT * FROM contactos ORDER BY contacto COLLATE NOCASE ASC')
    .all<ContactoRecord>();
  return result.results || [];
}

export async function getContactoById(db: D1Database, id: number): Promise<ContactoRecord | null> {
  if (isLocalDevEnvironment()) {
    const res = await remoteApiFetch<ContactoRecord>(`/api/contactos?id=${id}`);
    return res.data ?? null;
  }
  await ensureDatabaseInitialized(db);
  const result = await db
    .prepare('SELECT * FROM contactos WHERE id = ?')
    .bind(id)
    .first<ContactoRecord>();
  return result ?? null;
}

export async function getContactoByName(
  db: D1Database,
  contacto: string
): Promise<ContactoRecord | null> {
  if (isLocalDevEnvironment()) {
    const res = await remoteApiFetch<ContactoRecord>(
      `/api/contactos?check=${encodeURIComponent(contacto.trim())}`
    );
    return res.data ?? null;
  }
  await ensureDatabaseInitialized(db);
  const result = await db
    .prepare('SELECT * FROM contactos WHERE LOWER(contacto) = LOWER(?) LIMIT 1')
    .bind(contacto.trim())
    .first<ContactoRecord>();
  return result ?? null;
}

export async function createContacto(
  db: D1Database,
  data: NewContactoRecord
): Promise<ContactoRecord | null> {
  if (isLocalDevEnvironment()) {
    const res = await remoteApiFetch<ContactoRecord>('/api/contactos', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(res.error || 'Error al crear contacto en D1 remoto');
    return res.data ?? null;
  }
  await ensureDatabaseInitialized(db);
  const contactoName = data.contacto ? data.contacto.trim() : '';
  if (!contactoName) return null;

  const existing = await getContactoByName(db, contactoName);
  if (existing) {
    return existing;
  }

  const result = await db
    .prepare(
      `INSERT INTO contactos (
        contacto, telefono, email, nombres, apellidos,
        fecha_nacimiento, numero_pasaporte, nacionalidad_pasaporte,
        genero, fecha_emision_pasaporte, fecha_vencimiento_pasaporte,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
      RETURNING *`
    )
    .bind(
      contactoName,
      data.telefono?.trim() || '-',
      data.email?.trim() || '-',
      data.nombres?.trim() || '-',
      data.apellidos?.trim() || '-',
      data.fecha_nacimiento?.trim() || '-',
      data.numero_pasaporte?.trim() || '-',
      data.nacionalidad_pasaporte?.trim() || '-',
      data.genero?.trim() || '-',
      data.fecha_emision_pasaporte?.trim() || '-',
      data.fecha_vencimiento_pasaporte?.trim() || '-'
    )
    .first<ContactoRecord>();

  return result ?? null;
}

export async function updateContacto(
  db: D1Database,
  id: number,
  fields: Partial<NewContactoRecord>
): Promise<ContactoRecord | null> {
  if (isLocalDevEnvironment()) {
    const res = await remoteApiFetch<ContactoRecord>('/api/contactos', {
      method: 'PATCH',
      body: JSON.stringify({ id, ...fields }),
    });
    if (!res.ok) throw new Error(res.error || 'Error al actualizar contacto en D1 remoto');
    return res.data ?? null;
  }
  await ensureDatabaseInitialized(db);
  const existing = await getContactoById(db, id);
  if (!existing) return null;

  const updated = {
    contacto: fields.contacto !== undefined ? fields.contacto.trim() : existing.contacto,
    telefono: fields.telefono !== undefined ? fields.telefono.trim() || '-' : existing.telefono,
    email: fields.email !== undefined ? fields.email.trim() || '-' : existing.email,
    nombres: fields.nombres !== undefined ? fields.nombres.trim() || '-' : existing.nombres,
    apellidos: fields.apellidos !== undefined ? fields.apellidos.trim() || '-' : existing.apellidos,
    fecha_nacimiento:
      fields.fecha_nacimiento !== undefined
        ? fields.fecha_nacimiento.trim() || '-'
        : existing.fecha_nacimiento,
    numero_pasaporte:
      fields.numero_pasaporte !== undefined
        ? fields.numero_pasaporte.trim() || '-'
        : existing.numero_pasaporte,
    nacionalidad_pasaporte:
      fields.nacionalidad_pasaporte !== undefined
        ? fields.nacionalidad_pasaporte.trim() || '-'
        : existing.nacionalidad_pasaporte,
    genero: fields.genero !== undefined ? fields.genero.trim() || '-' : existing.genero,
    fecha_emision_pasaporte:
      fields.fecha_emision_pasaporte !== undefined
        ? fields.fecha_emision_pasaporte.trim() || '-'
        : existing.fecha_emision_pasaporte,
    fecha_vencimiento_pasaporte:
      fields.fecha_vencimiento_pasaporte !== undefined
        ? fields.fecha_vencimiento_pasaporte.trim() || '-'
        : existing.fecha_vencimiento_pasaporte,
  };

  const result = await db
    .prepare(
      `UPDATE contactos
       SET contacto = ?,
           telefono = ?,
           email = ?,
           nombres = ?,
           apellidos = ?,
           fecha_nacimiento = ?,
           numero_pasaporte = ?,
           nacionalidad_pasaporte = ?,
           genero = ?,
           fecha_emision_pasaporte = ?,
           fecha_vencimiento_pasaporte = ?,
           updated_at = datetime('now')
       WHERE id = ?
       RETURNING *`
    )
    .bind(
      updated.contacto,
      updated.telefono,
      updated.email,
      updated.nombres,
      updated.apellidos,
      updated.fecha_nacimiento,
      updated.numero_pasaporte,
      updated.nacionalidad_pasaporte,
      updated.genero,
      updated.fecha_emision_pasaporte,
      updated.fecha_vencimiento_pasaporte,
      id
    )
    .first<ContactoRecord>();

  return result ?? null;
}

export async function deleteContacto(db: D1Database, id: number): Promise<boolean> {
  if (isLocalDevEnvironment()) {
    const res = await remoteApiFetch<unknown>(`/api/contactos?id=${id}`, {
      method: 'DELETE',
    });
    return Boolean(res.ok);
  }
  await ensureDatabaseInitialized(db);
  const result = await db.prepare('DELETE FROM contactos WHERE id = ?').bind(id).run();
  return Boolean(result.success);
}
