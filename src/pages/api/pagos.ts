import type { APIRoute } from 'astro';
import { PAGO_STATUS_LIST } from '@/constants/statuses';
import type { NewPagoRecord, PagoStatus } from '@/types';
import {
  createPago,
  deletePago,
  getAllPagos,
  getDatabase,
  updatePago,
} from '@/utils/db';

function isValidStatus(value: unknown): value is PagoStatus {
  return typeof value === 'string' && PAGO_STATUS_LIST.includes(value as PagoStatus);
}

export const GET: APIRoute = async ({ locals }) => {
  try {
    const db = getDatabase(locals);
    const pagos = await getAllPagos(db);
    return new Response(JSON.stringify({ ok: true, data: pagos }), {
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
    const body = (await request.json()) as Partial<NewPagoRecord>;

    if (!body.contacto || !body.contacto.trim()) {
      return new Response(
        JSON.stringify({ ok: false, error: 'El nombre o cliente es obligatorio.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!isValidStatus(body.status)) {
      return new Response(
        JSON.stringify({ ok: false, error: 'El estatus seleccionado no es válido para Pagos.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const created = await createPago(db, {
      contacto: body.contacto,
      status: body.status,
      codigo: body.codigo ?? '-',
      fecha_gestion: body.fecha_gestion ?? '-',
      solicitud_vuelo: body.solicitud_vuelo ?? '-',
      observacion: body.observacion ?? '-',
      checkin: body.checkin ?? '-',
      monto: body.monto ?? '-',
      moneda: body.moneda ?? 'Fls',
      origen_tabla: body.origen_tabla ?? 'Registro Manual',
      pendiente_id: body.pendiente_id ?? null,
    });

    return new Response(JSON.stringify({ ok: true, data: created }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error al crear pago en D1';
    return new Response(JSON.stringify({ ok: false, error: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

export const PATCH: APIRoute = async ({ request, locals }) => {
  try {
    const db = getDatabase(locals);
    const body = (await request.json()) as Partial<NewPagoRecord> & { id?: number };
    const id = Number(body.id);

    if (!Number.isInteger(id) || id <= 0) {
      return new Response(
        JSON.stringify({ ok: false, error: 'ID de pago inválido.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (body.status !== undefined && !isValidStatus(body.status)) {
      return new Response(
        JSON.stringify({ ok: false, error: 'El estatus proporcionado no es válido para Pagos.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const updated = await updatePago(db, id, body);
    if (!updated) {
      return new Response(
        JSON.stringify({ ok: false, error: 'Registro de pago no encontrado en D1.' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(JSON.stringify({ ok: true, data: updated }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error al actualizar pago en D1';
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
        JSON.stringify({ ok: false, error: 'ID de pago inválido.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const deleted = await deletePago(db, id);
    return new Response(JSON.stringify({ ok: deleted }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error al eliminar pago en D1';
    return new Response(JSON.stringify({ ok: false, error: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
