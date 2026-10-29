import type { APIRoute } from 'astro';
import { ALL_PENDIENTE_STATUS_LIST } from '@/constants/statuses';
import type { NewPendienteRecord } from '@/types';
import {
  createPendiente,
  deletePendiente,
  getAllPendientes,
  getDatabase,
  updatePendiente,
} from '@/utils/db';

async function checkValidStatus(db: D1Database, value: unknown): Promise<boolean> {
  if (typeof value !== 'string' || !value.trim()) return false;
  if (ALL_PENDIENTE_STATUS_LIST.includes(value as any)) return true;
  const match = await db
    .prepare('SELECT id FROM estatus WHERE nombre = ? OR codigo = ? LIMIT 1')
    .bind(value.trim(), value.trim())
    .first();
  return Boolean(match);
}

export const GET: APIRoute = async ({ locals }) => {
  try {
    const db = getDatabase(locals);
    const pendientes = await getAllPendientes(db);
    return new Response(JSON.stringify({ ok: true, data: pendientes }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error al consultar D1';
    return new Response(JSON.stringify({ ok: false, error: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const db = getDatabase(locals);
    const body = (await request.json()) as Partial<NewPendienteRecord>;

    if (!body.contacto || !body.contacto.trim()) {
      return new Response(
        JSON.stringify({ ok: false, error: 'El nombre o contacto del cliente es obligatorio.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const isValid = await checkValidStatus(db, body.status);
    if (!isValid || !body.status) {
      return new Response(
        JSON.stringify({ ok: false, error: 'El estatus seleccionado no es válido para Pendientes.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const created = await createPendiente(db, {
      contacto: body.contacto,
      status: body.status,
      codigo: body.codigo ?? '-',
      aerolinea: body.aerolinea ?? '-',
      localizador: body.localizador ?? '-',
      apellidos: body.apellidos ?? '-',
      fecha_gestion: body.fecha_gestion ?? '-',
      solicitud_vuelo: body.solicitud_vuelo ?? '-',
      observacion: body.observacion ?? '-',
      checkin: body.checkin ?? '-',
      monto: body.monto ?? '-',
      origen_tabla: body.origen_tabla ?? 'Registro Manual',
    });

    return new Response(JSON.stringify({ ok: true, data: created }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error al crear pendiente en D1';
    return new Response(JSON.stringify({ ok: false, error: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

export const PATCH: APIRoute = async ({ request, locals }) => {
  try {
    const db = getDatabase(locals);
    const body = (await request.json()) as Partial<NewPendienteRecord> & { id?: number };
    const id = Number(body.id);

    if (!Number.isInteger(id) || id <= 0) {
      return new Response(
        JSON.stringify({ ok: false, error: 'ID de pendiente inválido.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (body.status !== undefined) {
      const isValid = await checkValidStatus(db, body.status);
      if (!isValid) {
        return new Response(
          JSON.stringify({ ok: false, error: 'El estatus proporcionado no es válido para Pendientes.' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }
    }

    const updated = await updatePendiente(db, id, body);

    if (!updated) {
      return new Response(
        JSON.stringify({ ok: false, error: `No se encontró el registro de pendiente con ID ${id}.` }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(JSON.stringify({ ok: true, data: updated }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error al actualizar pendiente en D1';
    return new Response(JSON.stringify({ ok: false, error: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

export const DELETE: APIRoute = async ({ request, locals, url }) => {
  try {
    const db = getDatabase(locals);
    let id: number | null = null;

    const queryId = url.searchParams.get('id');
    if (queryId) {
      id = Number(queryId);
    } else {
      try {
        const body = (await request.json()) as { id?: number };
        if (body.id) id = Number(body.id);
      } catch {}
    }

    if (!id || !Number.isInteger(id) || id <= 0) {
      return new Response(
        JSON.stringify({ ok: false, error: 'ID de pendiente inválido o ausente.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const ok = await deletePendiente(db, id);

    if (!ok) {
      return new Response(
        JSON.stringify({ ok: false, error: `No se pudo eliminar el pendiente con ID ${id}.` }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(JSON.stringify({ ok: true, message: 'Pendiente eliminado con éxito.' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error al eliminar pendiente en D1';
    return new Response(JSON.stringify({ ok: false, error: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
