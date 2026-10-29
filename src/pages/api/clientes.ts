import type { APIRoute } from 'astro';
import { ALL_PENDIENTE_STATUS_LIST } from '@/constants/statuses';
import type { NewPendienteRecord, PendienteStatus } from '@/types';
import {
  createPendiente,
  deletePendiente,
  getAllPendientes,
  getDatabase,
  updatePendiente,
} from '@/utils/db';

function isValidStatus(value: unknown): value is PendienteStatus {
  return typeof value === 'string' && ALL_PENDIENTE_STATUS_LIST.includes(value as PendienteStatus);
}

export const GET: APIRoute = async ({ locals }) => {
  try {
    const db = getDatabase(locals);
    const data = await getAllPendientes(db);
    return new Response(JSON.stringify({ ok: true, data }), {
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

    if (!isValidStatus(body.status)) {
      return new Response(
        JSON.stringify({ ok: false, error: 'El estatus seleccionado no es válido.' }),
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
    const message = error instanceof Error ? error.message : 'Error al crear en D1';
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
        JSON.stringify({ ok: false, error: 'ID inválido.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (body.status !== undefined && !isValidStatus(body.status)) {
      return new Response(
        JSON.stringify({ ok: false, error: 'El estatus proporcionado no es válido.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const updated = await updatePendiente(db, id, body);
    if (!updated) {
      return new Response(
        JSON.stringify({ ok: false, error: 'Registro no encontrado en D1.' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(JSON.stringify({ ok: true, data: updated }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error al actualizar en D1';
    return new Response(JSON.stringify({ ok: false, error: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

export const DELETE: APIRoute = async ({ request, locals }) => {
  try {
    const db = getDatabase(locals);
    const url = new URL(request.url);
    const id = Number(url.searchParams.get('id'));

    if (!Number.isInteger(id) || id <= 0) {
      return new Response(
        JSON.stringify({ ok: false, error: 'ID inválido.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const deleted = await deletePendiente(db, id);
    return new Response(JSON.stringify({ ok: deleted }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error al eliminar en D1';
    return new Response(JSON.stringify({ ok: false, error: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
