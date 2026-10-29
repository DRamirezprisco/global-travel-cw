import type { APIRoute } from 'astro';
import type { NewEstatusRecord } from '@/types';
import {
  createEstatus,
  deleteEstatus,
  getAllEstatus,
  getDatabase,
  getEstatusById,
  updateEstatus,
} from '@/utils/db';

export const GET: APIRoute = async ({ locals }) => {
  try {
    const db = getDatabase(locals);
    const estatusList = await getAllEstatus(db);
    return new Response(JSON.stringify({ ok: true, data: estatusList }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error al consultar estatus en D1';
    return new Response(JSON.stringify({ ok: false, error: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const db = getDatabase(locals);
    const body = (await request.json()) as Partial<NewEstatusRecord>;

    const nombre = body.nombre?.trim();
    if (!nombre) {
      return new Response(
        JSON.stringify({ ok: false, error: 'El nombre del estatus es obligatorio.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    let codigo = body.codigo?.trim().toLowerCase();
    if (!codigo) {
      codigo = nombre
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
    }

    const color = body.color?.trim() || '#1e3a8a';

    // Verificar si el código ya existe
    const existing = await db
      .prepare('SELECT id FROM estatus WHERE codigo = ? LIMIT 1')
      .bind(codigo)
      .first<{ id: number }>();

    if (existing) {
      return new Response(
        JSON.stringify({ ok: false, error: `Ya existe un estatus con el código "${codigo}".` }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const created = await createEstatus(db, {
      nombre,
      codigo,
      color,
    });

    return new Response(JSON.stringify({ ok: true, data: created }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error al crear estatus en D1';
    return new Response(JSON.stringify({ ok: false, error: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

export const PATCH: APIRoute = async ({ request, locals }) => {
  try {
    const db = getDatabase(locals);
    const body = (await request.json()) as Partial<NewEstatusRecord> & { id?: number };
    const id = Number(body.id);

    if (!Number.isInteger(id) || id <= 0) {
      return new Response(
        JSON.stringify({ ok: false, error: 'ID de estatus inválido.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const existing = await getEstatusById(db, id);
    if (!existing) {
      return new Response(
        JSON.stringify({ ok: false, error: 'Estatus no encontrado.' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Si se actualiza el código, verificar unicidad
    if (body.codigo && body.codigo.trim().toLowerCase() !== existing.codigo) {
      const slug = body.codigo.trim().toLowerCase();
      const codeCheck = await db
        .prepare('SELECT id FROM estatus WHERE codigo = ? AND id != ? LIMIT 1')
        .bind(slug, id)
        .first<{ id: number }>();

      if (codeCheck) {
        return new Response(
          JSON.stringify({ ok: false, error: `Ya existe otro estatus con el código "${slug}".` }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }
    }

    const updated = await updateEstatus(db, id, body);

    return new Response(JSON.stringify({ ok: true, data: updated }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error al actualizar estatus en D1';
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
        JSON.stringify({ ok: false, error: 'ID de estatus inválido o ausente.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const result = await deleteEstatus(db, id);

    if (!result.success) {
      return new Response(
        JSON.stringify({ ok: false, error: result.error || 'No se pudo eliminar el estatus.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(JSON.stringify({ ok: true, message: 'Estatus eliminado con éxito.' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error al eliminar estatus en D1';
    return new Response(JSON.stringify({ ok: false, error: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
