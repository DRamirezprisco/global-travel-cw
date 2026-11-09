import type { APIRoute } from 'astro';
import {
  getAllEstatus,
  getAllPagos,
  getAllPendientes,
  getDatabase,
} from '@/utils/db';

const JSON_HEADERS = {
  'Content-Type': 'application/json',
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
};

export const GET: APIRoute = async ({ locals }) => {
  try {
    const db = getDatabase(locals);
    const [pendientes, pagos, estatus] = await Promise.all([
      getAllPendientes(db),
      getAllPagos(db),
      getAllEstatus(db),
    ]);

    return new Response(
      JSON.stringify({
        ok: true,
        data: {
          pendientes,
          pagos,
          estatus,
          generatedAt: new Date().toISOString(),
        },
      }),
      {
        status: 200,
        headers: JSON_HEADERS,
      }
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Error al obtener datos para el reporte desde D1';
    return new Response(JSON.stringify({ ok: false, error: message }), {
      status: 500,
      headers: JSON_HEADERS,
    });
  }
};
