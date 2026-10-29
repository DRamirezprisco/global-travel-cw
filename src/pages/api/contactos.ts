import type { APIRoute } from 'astro';
import type { NewContactoRecord } from '@/types';
import {
  createContacto,
  deleteContacto,
  getAllContactos,
  getContactoById,
  getContactoByName,
  getDatabase,
  updateContacto,
} from '@/utils/db';

export const GET: APIRoute = async ({ request, locals }) => {
  try {
    const db = getDatabase(locals);
    const url = new URL(request.url);
    const checkName = url.searchParams.get('check');
    const idParam = url.searchParams.get('id');

    if (idParam) {
      const contact = await getContactoById(db, Number(idParam));
      return new Response(JSON.stringify({ ok: true, data: contact }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (checkName) {
      const contact = await getContactoByName(db, checkName);
      return new Response(JSON.stringify({ ok: true, exists: Boolean(contact), data: contact }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const contactos = await getAllContactos(db);
    return new Response(JSON.stringify({ ok: true, data: contactos }), {
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
    const body = (await request.json()) as Partial<NewContactoRecord>;

    const contactoName = body.contacto?.trim();
    if (!contactoName) {
      return new Response(
        JSON.stringify({ ok: false, error: 'El nombre o identificador del contacto es obligatorio.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const created = await createContacto(db, {
      contacto: contactoName,
      telefono: body.telefono ?? '-',
      email: body.email ?? '-',
      nombres: body.nombres ?? '-',
      apellidos: body.apellidos ?? '-',
      fecha_nacimiento: body.fecha_nacimiento ?? '-',
      numero_pasaporte: body.numero_pasaporte ?? '-',
      nacionalidad_pasaporte: body.nacionalidad_pasaporte ?? '-',
      genero: body.genero ?? '-',
      fecha_emision_pasaporte: body.fecha_emision_pasaporte ?? '-',
      fecha_vencimiento_pasaporte: body.fecha_vencimiento_pasaporte ?? '-',
    });

    return new Response(JSON.stringify({ ok: true, data: created }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error al crear contacto en D1';
    return new Response(JSON.stringify({ ok: false, error: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

export const PATCH: APIRoute = async ({ request, locals }) => {
  try {
    const db = getDatabase(locals);
    const body = (await request.json()) as Partial<NewContactoRecord> & { id?: number };
    const id = Number(body.id);

    if (!Number.isInteger(id) || id <= 0) {
      return new Response(
        JSON.stringify({ ok: false, error: 'ID de contacto inválido.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const updated = await updateContacto(db, id, body);
    if (!updated) {
      return new Response(
        JSON.stringify({ ok: false, error: 'Contacto no encontrado o no actualizado.' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(JSON.stringify({ ok: true, data: updated }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error al actualizar contacto en D1';
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
    const idParam = url.searchParams.get('id');
    const id = Number(idParam);

    if (!Number.isInteger(id) || id <= 0) {
      return new Response(
        JSON.stringify({ ok: false, error: 'ID de contacto inválido para eliminar.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const success = await deleteContacto(db, id);
    if (!success) {
      return new Response(
        JSON.stringify({ ok: false, error: 'No se pudo eliminar el contacto.' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(JSON.stringify({ ok: true, id }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error al eliminar contacto de D1';
    return new Response(JSON.stringify({ ok: false, error: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
