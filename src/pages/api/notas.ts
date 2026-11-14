import type { APIRoute } from 'astro';
import type { NewNotaRecord } from '@/types';
import { createNota, deleteNota, getAllNotas, getDatabase, updateNota } from '@/utils/db';

const JSON_HEADERS = {
  'Content-Type': 'application/json',
  'Cache-Control': 'no-store, no-cache, must-revalidate',
};

export const GET: APIRoute = async ({ locals }) => {
  try {
    const db = getDatabase(locals);
    const notas = await getAllNotas(db);
    return new Response(JSON.stringify({ ok: true, data: notas }), {
      status: 200,
      headers: JSON_HEADERS,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error al consultar notas en D1';
    return new Response(JSON.stringify({ ok: false, error: message }), {
      status: 500,
      headers: JSON_HEADERS,
    });
  }
};

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const db = getDatabase(locals);
    const body = (await request.json()) as Partial<NewNotaRecord>;
    const texto = (body.texto || '').trim();

    if (!texto) {
      return new Response(
        JSON.stringify({ ok: false, error: 'El texto de la nota es obligatorio.' }),
        { status: 400, headers: JSON_HEADERS }
      );
    }

    const created = await createNota(db, {
      texto,
      completada: Boolean(body.completada),
    });

    return new Response(JSON.stringify({ ok: true, data: created }), {
      status: 201,
      headers: JSON_HEADERS,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error al crear nota en D1';
    return new Response(JSON.stringify({ ok: false, error: message }), {
      status: 500,
      headers: JSON_HEADERS,
    });
  }
};

export const PATCH: APIRoute = async ({ request, locals }) => {
  try {
    const db = getDatabase(locals);
    const body = (await request.json()) as Partial<NewNotaRecord> & { id?: number };
    const id = Number(body.id);

    if (!Number.isInteger(id) || id <= 0) {
      return new Response(
        JSON.stringify({ ok: false, error: 'ID de nota inválido.' }),
        { status: 400, headers: JSON_HEADERS }
      );
    }

    const updates: Partial<NewNotaRecord> = {};
    if (body.texto !== undefined) {
      const clean = body.texto.trim();
      if (!clean) {
        return new Response(
          JSON.stringify({ ok: false, error: 'El texto de la nota no puede estar vacío.' }),
          { status: 400, headers: JSON_HEADERS }
        );
      }
      updates.texto = clean;
    }
    if (body.completada !== undefined) {
      updates.completada = Boolean(body.completada);
    }

    const updated = await updateNota(db, id, updates);
    if (!updated) {
      return new Response(
        JSON.stringify({ ok: false, error: 'Nota no encontrada.' }),
        { status: 404, headers: JSON_HEADERS }
      );
    }

    return new Response(JSON.stringify({ ok: true, data: updated }), {
      status: 200,
      headers: JSON_HEADERS,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error al actualizar nota en D1';
    return new Response(JSON.stringify({ ok: false, error: message }), {
      status: 500,
      headers: JSON_HEADERS,
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
        JSON.stringify({ ok: false, error: 'ID de nota inválido.' }),
        { status: 400, headers: JSON_HEADERS }
      );
    }

    const deleted = await deleteNota(db, id);
    if (!deleted) {
      return new Response(
        JSON.stringify({ ok: false, error: 'No se pudo eliminar la nota.' }),
        { status: 404, headers: JSON_HEADERS }
      );
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: JSON_HEADERS,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error al eliminar nota en D1';
    return new Response(JSON.stringify({ ok: false, error: message }), {
      status: 500,
      headers: JSON_HEADERS,
    });
  }
};
