import type { APIRoute } from 'astro';
import { CLIENTE_STATUS_LIST } from '@/constants/statuses';
import type { ClienteStatus, NewClienteRecord } from '@/types';
import {
  createCliente,
  deleteCliente,
  getAllClientes,
  getDatabase,
  updateCliente,
} from '@/utils/db';

function isValidStatus(value: unknown): value is ClienteStatus {
  return typeof value === 'string' && CLIENTE_STATUS_LIST.includes(value as ClienteStatus);
}

export const GET: APIRoute = async ({ locals }) => {
  try {
    const db = getDatabase(locals);
    const clientes = await getAllClientes(db);
    return new Response(JSON.stringify({ ok: true, data: clientes }), {
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
    const body = (await request.json()) as Partial<NewClienteRecord>;

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

    const created = await createCliente(db, {
      contacto: body.contacto,
      status: body.status,
      codigo: body.codigo ?? '-',
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
    const message = error instanceof Error ? error.message : 'Error al crear cliente en D1';
    return new Response(JSON.stringify({ ok: false, error: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

export const PATCH: APIRoute = async ({ request, locals }) => {
  try {
    const db = getDatabase(locals);
    const body = (await request.json()) as Partial<NewClienteRecord> & { id?: number };
    const id = Number(body.id);

    if (!Number.isInteger(id) || id <= 0) {
      return new Response(
        JSON.stringify({ ok: false, error: 'ID de cliente inválido.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (body.status !== undefined && !isValidStatus(body.status)) {
      return new Response(
        JSON.stringify({ ok: false, error: 'El estatus proporcionado no es válido.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const updated = await updateCliente(db, id, body);
    if (!updated) {
      return new Response(
        JSON.stringify({ ok: false, error: 'Cliente no encontrado en D1.' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(JSON.stringify({ ok: true, data: updated }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error al actualizar cliente en D1';
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
        JSON.stringify({ ok: false, error: 'ID de cliente inválido.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const deleted = await deleteCliente(db, id);
    return new Response(JSON.stringify({ ok: deleted }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error al eliminar cliente en D1';
    return new Response(JSON.stringify({ ok: false, error: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
