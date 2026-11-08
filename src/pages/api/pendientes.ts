import type { APIRoute } from 'astro';
import { ALL_PENDIENTE_STATUS_LIST } from '@/constants/statuses';
import type { NewPendienteRecord } from '@/types';
import {
  createPendiente,
  deletePendiente,
  getAllEstatus,
  getAllPendientes,
  getDatabase,
  updatePendiente,
} from '@/utils/db';

const JSON_HEADERS = {
  'Content-Type': 'application/json',
  'Cache-Control': 'no-store, no-cache, must-revalidate',
};

async function checkValidStatus(db: D1Database, value: unknown): Promise<boolean> {
  if (typeof value !== 'string' || !value.trim()) return false;
  const trimmed = value.trim();
  if (ALL_PENDIENTE_STATUS_LIST.includes(trimmed as any)) return true;
  const allEstatus = await getAllEstatus(db);
  return allEstatus.some(
    (e) => e.nombre.toLowerCase() === trimmed.toLowerCase() || e.codigo.toLowerCase() === trimmed.toLowerCase()
  );
}

export const GET: APIRoute = async ({ locals }) => {
  try {
    const db = getDatabase(locals);
    const pendientes = await getAllPendientes(db);
    return new Response(JSON.stringify({ ok: true, data: pendientes }), {
      status: 200,
      headers: JSON_HEADERS,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error al consultar D1';
    return new Response(JSON.stringify({ ok: false, error: message }), {
      status: 500,
      headers: JSON_HEADERS,
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
        { status: 400, headers: JSON_HEADERS }
      );
    }

    const isValid = await checkValidStatus(db, body.status);
    if (!isValid || !body.status) {
      return new Response(
        JSON.stringify({ ok: false, error: 'El estatus seleccionado no es válido para Pendientes.' }),
        { status: 400, headers: JSON_HEADERS }
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
      abono: body.abono ?? '-',
      ganancia: body.ganancia ?? '-',
      origen_tabla: body.origen_tabla ?? 'Registro Manual',
    });

    return new Response(JSON.stringify({ ok: true, data: created }), {
      status: 201,
      headers: JSON_HEADERS,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error al crear pendiente en D1';
    return new Response(JSON.stringify({ ok: false, error: message }), {
      status: 500,
      headers: JSON_HEADERS,
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
        { status: 400, headers: JSON_HEADERS }
      );
    }

    if (body.status !== undefined) {
      const isValid = await checkValidStatus(db, body.status);
      if (!isValid) {
        return new Response(
          JSON.stringify({ ok: false, error: 'El estatus proporcionado no es válido para Pendientes.' }),
          { status: 400, headers: JSON_HEADERS }
        );
      }
    }

    const updated = await updatePendiente(db, id, body);

    if (!updated) {
      return new Response(
        JSON.stringify({ ok: false, error: `No se encontró el registro de pendiente con ID ${id}.` }),
        { status: 404, headers: JSON_HEADERS }
      );
    }

    return new Response(JSON.stringify({ ok: true, data: updated }), {
      status: 200,
      headers: JSON_HEADERS,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error al actualizar pendiente en D1';
    return new Response(JSON.stringify({ ok: false, error: message }), {
      status: 500,
      headers: JSON_HEADERS,
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
        { status: 400, headers: JSON_HEADERS }
      );
    }

    const ok = await deletePendiente(db, id);

    if (!ok) {
      return new Response(
        JSON.stringify({ ok: false, error: `No se pudo eliminar el pendiente con ID ${id}.` }),
        { status: 404, headers: JSON_HEADERS }
      );
    }

    return new Response(JSON.stringify({ ok: true, message: 'Pendiente eliminado con éxito.' }), {
      status: 200,
      headers: JSON_HEADERS,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error al eliminar pendiente en D1';
    return new Response(JSON.stringify({ ok: false, error: message }), {
      status: 500,
      headers: JSON_HEADERS,
    });
  }
};
