import type { EstatusRecord, PagoRecord, PendienteRecord } from '@/types';
import { parseMontoNumeric } from '@/utils/pagoHelpers';

export interface ReportDataPayload {
  pendientes: PendienteRecord[];
  pagos: PagoRecord[];
  estatus: EstatusRecord[];
  generatedAt?: string;
}

export interface ReportSectionTable {
  title: string;
  headers: string[];
  rows: string[][];
  footerRows?: string[][];
}

export interface BuiltOperationalReport {
  mainTitle: string;
  subTitle: string;
  dateSlug: string;
  sections: ReportSectionTable[];
}

const KNOWN_AIRLINES = [
  'dividivi',
  'latam',
  'avior',
  'wingo',
  'zair',
  'aeroparaguana',
  'avianca',
  'arajet',
  'copaairlines',
  'copa',
  'klm',
  'redair',
  'laser',
];

function extractCodigoParts(record: PendienteRecord): {
  aerolinea: string;
  localizador: string;
  apellidos: string;
} {
  if (
    (record.aerolinea && record.aerolinea !== '-') ||
    (record.localizador && record.localizador !== '-') ||
    (record.apellidos && record.apellidos !== '-')
  ) {
    return {
      aerolinea: record.aerolinea && record.aerolinea !== '-' ? record.aerolinea : '-',
      localizador: record.localizador && record.localizador !== '-' ? record.localizador : '-',
      apellidos: record.apellidos && record.apellidos !== '-' ? record.apellidos : '-',
    };
  }

  const codigo = (record.codigo || '').trim();
  if (!codigo || codigo === '-') {
    return { aerolinea: '-', localizador: '-', apellidos: '-' };
  }

  let partA = codigo;
  let apellidos = '-';
  if (codigo.includes('/')) {
    const slashIdx = codigo.indexOf('/');
    partA = codigo.slice(0, slashIdx).trim();
    apellidos = codigo.slice(slashIdx + 1).trim() || '-';
  }

  let aerolinea = '-';
  let localizador = '-';
  if (partA.includes('|')) {
    const pipeParts = partA.split('|').map((s) => s.trim());
    aerolinea = pipeParts[0] || '-';
    localizador = pipeParts.slice(1).join(' | ') || '-';
  } else {
    const trimmed = partA.trim();
    if (KNOWN_AIRLINES.includes(trimmed.toLowerCase())) {
      aerolinea = trimmed;
    } else {
      localizador = trimmed || '-';
    }
  }

  return { aerolinea, localizador, apellidos };
}

function formatPriceSummary(record: {
  monto?: string;
  abono?: string;
  ganancia?: string;
}): string {
  const parts: string[] = [];
  if (record.monto && record.monto !== '-') {
    parts.push(record.monto);
  }
  if (record.abono && record.abono !== '-') {
    parts.push(`Abono: ${record.abono}`);
  }
  if (record.ganancia && record.ganancia !== '-') {
    parts.push(`Ganancia: ${record.ganancia}`);
  }
  return parts.length > 0 ? parts.join(' | ') : '-';
}

function detectCurrency(rawMonto: string | undefined, rawMoneda?: string): 'USD' | 'Fls' {
  if (rawMoneda === '$' || rawMoneda === 'USD') return 'USD';
  if (rawMonto && (rawMonto.includes('$') || /usd/i.test(rawMonto))) return 'USD';
  return 'Fls';
}

function getTodayDisplayAndSlug(): { display: string; slug: string } {
  const now = new Date();
  const dd = String(now.getDate()).padStart(2, '0');
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const yyyy = String(now.getFullYear());
  return {
    display: `${dd}/${mm}/${yyyy}`,
    slug: `${dd}-${mm}-${yyyy}`,
  };
}

/**
 * Construye todas las secciones del Reporte Operativo de WhatsApp
 * siguiendo exactamente el formato del Excel de Global Travel CW.
 */
export function buildOperationalReport(data: ReportDataPayload): BuiltOperationalReport {
  const { pendientes = [], pagos = [] } = data;
  const { display: emissionDate, slug: dateSlug } = getTodayDisplayAndSlug();

  const cotizacionesList = pendientes.filter(
    (p) => p.status === 'Pendiente Cotizacion' || p.status === 'Cotizacion Enviada'
  );
  const reservas24hList = pendientes.filter((p) => p.status === 'Reserva por 24h');
  const emitidasList = pendientes.filter((p) => p.status === 'Reserva Emitida');
  const consultasList = pendientes.filter((p) => p.status === 'Consultas');
  const cambiosList = pendientes.filter((p) => p.status === 'Cambio Tickets');
  const visasList = pendientes.filter((p) => p.status === 'Visas');
  const finalizadosList = pendientes.filter((p) => p.status === 'Finalizado');

  const checkinPendienteCount = emitidasList.filter(
    (p) => (p.checkin || '').toLowerCase() !== 'completado'
  ).length;

  const pagosPendientesCount = pagos.filter(
    (p) => p.status === 'Pendiente' || p.status === 'Abono'
  ).length;
  const pagosDemoradosCount = pagos.filter((p) => p.status === 'Demorados').length;

  // Otros estatus personalizados creados en la tabla estatus
  const standardStatuses = new Set([
    'Pendiente Cotizacion',
    'Cotizacion Enviada',
    'Reserva por 24h',
    'Reserva Emitida',
    'Consultas',
    'Cambio Tickets',
    'Visas',
    'Finalizado',
  ]);
  const otrosPendientes = pendientes.filter((p) => !standardStatuses.has(p.status));

  const totalSeguimiento =
    cotizacionesList.length +
    reservas24hList.length +
    pagosPendientesCount +
    emitidasList.length +
    consultasList.length +
    cambiosList.length +
    pagosDemoradosCount +
    visasList.length +
    otrosPendientes.length;

  // 1. TABLA RESUMEN OPERATIVO
  const resumenRows: string[][] = [
    [
      'Cotizaciones Pendientes',
      String(cotizacionesList.length),
      'Solicitudes en espera de cotización y respuesta para reservas',
      'Alta (Acción inmediata)',
      'Enviar itinerarios y tarifas',
    ],
    [
      'Reserva (apartado 24hrs)',
      String(reservas24hList.length),
      'Al día / requieren re-etiquetar, envío factura email o WhatsApp',
      'Alta',
      'Verificar pago y emitir',
    ],
    [
      'Reserva / Pago Pendiente',
      String(pagosPendientesCount),
      'En seguimiento de pago o abono parcial',
      'Alta',
      'Hacer seguimiento de pago',
    ],
    [
      'Viaje Confirmado / Boleto Emitido',
      String(emitidasList.length),
      'Servicio completado / seguimiento de vuelo y novedades',
      'Monitoreo',
      'Seguimiento de vuelo / Check-in',
    ],
    [
      'Consultas',
      String(consultasList.length),
      'Consultas y orientaciones generales',
      'Media',
      'Responder dudas',
    ],
    [
      'Cambio de Tickets',
      String(cambiosList.length),
      'Reprogramaciones y penalidades',
      'Alta operativa',
      'Tramitar con aerolínea',
    ],
    [
      'Pendiente Pagos Viejos / Demorados',
      String(pagosDemoradosCount),
      'Cobranza acumulada / Saldos pendientes vencidos',
      'Cobranzas / Alta',
      'Gestión de cobro acumulado',
    ],
    [
      'Visas',
      String(visasList.length),
      'En gestión de visado',
      'Media',
      'Verificar estatus de tramitación',
    ],
    [
      'Pendiente Check-in',
      String(checkinPendienteCount),
      'Pasajeros con reserva emitida pendientes de check-in',
      'Media',
      'Realizar check-in web',
    ],
    [
      'Finalizados',
      String(finalizadosList.length),
      'Gestiones cerradas / archivadas',
      'Informativo',
      'Sin acción pendiente',
    ],
  ];

  if (otrosPendientes.length > 0) {
    resumenRows.push([
      'Otros Estatus Personalizados',
      String(otrosPendientes.length),
      'Registros en estatus adicionales configurados',
      'Media',
      'Revisar seguimiento',
    ]);
  }

  const sectionResumen: ReportSectionTable = {
    title: 'RESUMEN OPERATIVO POR ETIQUETA / ESTATUS',
    headers: [
      'Lista / Etiqueta',
      'Chats Activos',
      'Estado Operativo',
      'Prioridad Comercial',
      'Acción Sugerida',
    ],
    rows: resumenRows,
    footerRows: [
      [
        'TOTAL CHATS EN SEGUIMIENTO ACTIVO',
        String(totalSeguimiento),
        '',
        '',
        '',
      ],
    ],
  };

  // 2. SOLICITUDES DE COTIZACIÓN PENDIENTES
  const sectionCotizaciones: ReportSectionTable = {
    title: 'SOLICITUDES DE COTIZACIÓN PENDIENTES',
    headers: [
      'Contacto / Cliente',
      'Última Act.',
      'Ruta / Fechas Solicitadas',
      'Estado / Respuesta Pendiente',
      'Precio / Abono / Ganancia',
      'Estatus',
    ],
    rows:
      cotizacionesList.length > 0
        ? cotizacionesList.map((item) => [
            item.contacto || '-',
            item.fecha_gestion || '-',
            item.solicitud_vuelo || '-',
            item.observacion || '-',
            formatPriceSummary(item),
            item.status === 'Cotizacion Enviada' ? 'Esperando Cliente (Enviada)' : 'Pendiente',
          ])
        : [['Sin solicitudes de cotización pendientes', '-', '-', '-', '-', '-']],
  };

  // 3. RESERVAS EN ESPERA DE CONFIRMACIÓN Y PAGO (24 HRS)
  const sectionReservas24h: ReportSectionTable = {
    title: 'RESERVAS EN ESPERA DE CONFIRMACIÓN Y PAGO (24 HRS)',
    headers: [
      'Contacto / Cliente',
      'Fecha Reserva',
      'Aerolínea / Código PNR',
      'Fecha Vuelo / Ruta',
      'Observaciones / Estado',
      'Precio / Abono / Ganancia',
      'Estatus',
    ],
    rows:
      reservas24hList.length > 0
        ? reservas24hList.map((item) => {
            const parts = extractCodigoParts(item);
            const aeroPnr =
              parts.aerolinea !== '-' && parts.localizador !== '-'
                ? `${parts.aerolinea} (${parts.localizador})`
                : parts.aerolinea !== '-'
                  ? parts.aerolinea
                  : parts.localizador !== '-'
                    ? parts.localizador
                    : item.codigo || '-';
            return [
              item.contacto || '-',
              item.fecha_gestion || '-',
              aeroPnr,
              item.solicitud_vuelo || '-',
              item.observacion || '-',
              formatPriceSummary(item),
              'Reserva 24h (Por Emitir)',
            ];
          })
        : [['Sin reservas 24h activas', '-', '-', '-', '-', '-', '-']],
  };

  // 4. VIAJES CONFIRMADOS Y MONITOREO DE CHECK-IN
  const sectionEmitidas: ReportSectionTable = {
    title: 'VIAJES CONFIRMADOS Y MONITOREO DE CHECK-IN',
    headers: [
      'Contacto / Cliente',
      'Aerolínea',
      'Código PNR / Apellido Pasajero',
      'Fecha Vuelo / Ruta',
      'Estatus Check-in',
      'Precio / Abono / Ganancia',
      'Notas Adicionales',
    ],
    rows:
      emitidasList.length > 0
        ? emitidasList.map((item) => {
            const parts = extractCodigoParts(item);
            const pnrApellido =
              parts.localizador !== '-' && parts.apellidos !== '-'
                ? `${parts.localizador} / ${parts.apellidos}`
                : parts.localizador !== '-'
                  ? parts.localizador
                  : parts.apellidos !== '-'
                    ? parts.apellidos
                    : item.codigo || '-';
            return [
              item.contacto || '-',
              parts.aerolinea,
              pnrApellido,
              item.solicitud_vuelo || '-',
              item.checkin && item.checkin !== '-' ? item.checkin : 'Pendiente',
              formatPriceSummary(item),
              item.observacion || '-',
            ];
          })
        : [['Sin viajes confirmados registrados', '-', '-', '-', '-', '-', '-']],
  };

  // 5. CONTROL DE COBRANZAS, CRÉDITOS Y PAGOS PENDIENTES
  let subtotalUsdPendiente = 0;
  let subtotalFlsPendiente = 0;

  for (const p of pagos) {
    if (p.status !== 'Pagado') {
      const montoTotal = parseMontoNumeric(p.monto);
      const abonoVal = parseMontoNumeric(p.abono || '');
      const saldoRestante =
        montoTotal > 0 && abonoVal > 0 && abonoVal < montoTotal
          ? montoTotal - abonoVal
          : montoTotal;
      const curr = detectCurrency(p.monto, p.moneda);
      if (curr === 'USD') {
        subtotalUsdPendiente += saldoRestante;
      } else {
        subtotalFlsPendiente += saldoRestante;
      }
    }
  }

  const sectionPagos: ReportSectionTable = {
    title: 'CONTROL DE COBRANZAS, CRÉDITOS Y PAGOS PENDIENTES',
    headers: [
      'Contacto / Cliente',
      'Fecha Ref.',
      'Cód. Factura / PNR / Concepto',
      'Precio Total',
      'Abono',
      'Ganancia',
      'Moneda',
      'Estado de Pago / Acuerdo',
      'Observaciones / Acción',
    ],
    rows:
      pagos.length > 0
        ? pagos.map((p) => {
            const curr = detectCurrency(p.monto, p.moneda);
            return [
              p.contacto || '-',
              p.fecha_gestion || '-',
              p.solicitud_vuelo && p.solicitud_vuelo !== '-' ? p.solicitud_vuelo : p.codigo || '-',
              p.monto || '-',
              p.abono || '-',
              p.ganancia || '-',
              curr === 'USD' ? '$ (USD)' : 'Fls (ANG/XCG)',
              p.status,
              p.observacion || '-',
            ];
          })
        : [['Sin registros de cobranzas', '-', '-', '-', '-', '-', '-', '-', '-']],
    footerRows: [
      [
        '',
        '',
        'SUBTOTAL USD ($) PENDIENTE POR COBRAR:',
        `${subtotalUsdPendiente.toFixed(2)} $`,
        '',
        '',
        'USD',
        '',
        '',
      ],
      [
        '',
        '',
        'SUBTOTAL FLS PENDIENTE POR COBRAR:',
        `${subtotalFlsPendiente.toFixed(2)} Fls`,
        '',
        '',
        'Fls',
        '',
        '',
      ],
    ],
  };

  // 6. REPROGRAMACIONES, CAMBIOS DE TICKET, VISAS Y CONSULTAS GENERALES
  const cambiosYConsultas = [
    ...cambiosList,
    ...consultasList,
    ...visasList,
    ...otrosPendientes,
  ];

  const sectionCambiosConsultas: ReportSectionTable = {
    title: 'REPROGRAMACIONES, CAMBIOS DE TICKET, VISAS Y CONSULTAS GENERALES',
    headers: [
      'Tipo / Categoría',
      'Contacto / Cliente',
      'Fecha Solic.',
      'Detalle de la Solicitud / PNR',
      'Precio / Abono / Ganancia',
      'Acción Requerida / Estado',
    ],
    rows:
      cambiosYConsultas.length > 0
        ? cambiosYConsultas.map((item) => {
            const detalle =
              item.solicitud_vuelo && item.solicitud_vuelo !== '-'
                ? item.solicitud_vuelo
                : item.codigo && item.codigo !== '-'
                  ? item.codigo
                  : '-';
            return [
              item.status,
              item.contacto || '-',
              item.fecha_gestion || '-',
              detalle,
              formatPriceSummary(item),
              item.observacion || '-',
            ];
          })
        : [['-', 'Sin cambios o consultas pendientes', '-', '-', '-', '-']],
  };

  return {
    mainTitle: 'GLOBAL TRAVEL CW - RESUMEN OPERATIVO DE WHATSAPP',
    subTitle: `Fecha de Emisión: ${emissionDate} | Responsable: Daniela Ramírez`,
    dateSlug,
    sections: [
      sectionResumen,
      sectionCotizaciones,
      sectionReservas24h,
      sectionEmitidas,
      sectionPagos,
      sectionCambiosConsultas,
    ],
  };
}

// ============================================================================
// GENERADOR DE EXCEL (.xlsx nativo OpenXML ZIP sin dependencias externas)
// ============================================================================

function escapeXml(str: string): string {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, ' ');
}

function colIndexToLetter(colIdx: number): string {
  let n = colIdx + 1;
  let s = '';
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

const CRC32_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    crc = CRC32_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function createStoredZip(files: Array<{ name: string; content: string }>): Uint8Array {
  const encoder = new TextEncoder();
  const entries = files.map((f) => {
    const nameBytes = encoder.encode(f.name);
    const dataBytes = encoder.encode(f.content);
    const crc = crc32(dataBytes);
    return { nameBytes, dataBytes, crc };
  });

  let localSize = 0;
  let centralSize = 0;
  for (const e of entries) {
    localSize += 30 + e.nameBytes.length + e.dataBytes.length;
    centralSize += 46 + e.nameBytes.length;
  }

  const totalSize = localSize + centralSize + 22;
  const out = new Uint8Array(totalSize);
  const view = new DataView(out.buffer);

  let offset = 0;
  const localOffsets: number[] = [];

  for (const e of entries) {
    localOffsets.push(offset);
    view.setUint32(offset, 0x04034b50, true); // Local file header signature
    view.setUint16(offset + 4, 20, true); // Version needed
    view.setUint16(offset + 6, 0x0800, true); // UTF-8 flag
    view.setUint16(offset + 8, 0, true); // Store (no compression)
    view.setUint16(offset + 10, 0, true); // Mod time
    view.setUint16(offset + 12, 0x21, true); // Mod date
    view.setUint32(offset + 14, e.crc, true);
    view.setUint32(offset + 18, e.dataBytes.length, true);
    view.setUint32(offset + 22, e.dataBytes.length, true);
    view.setUint16(offset + 26, e.nameBytes.length, true);
    view.setUint16(offset + 28, 0, true);
    out.set(e.nameBytes, offset + 30);
    offset += 30 + e.nameBytes.length;
    out.set(e.dataBytes, offset);
    offset += e.dataBytes.length;
  }

  const centralStart = offset;
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    view.setUint32(offset, 0x02014b50, true); // Central dir signature
    view.setUint16(offset + 4, 20, true);
    view.setUint16(offset + 6, 20, true);
    view.setUint16(offset + 8, 0x0800, true);
    view.setUint16(offset + 10, 0, true);
    view.setUint16(offset + 12, 0, true);
    view.setUint16(offset + 14, 0x21, true);
    view.setUint32(offset + 16, e.crc, true);
    view.setUint32(offset + 20, e.dataBytes.length, true);
    view.setUint32(offset + 24, e.dataBytes.length, true);
    view.setUint16(offset + 28, e.nameBytes.length, true);
    view.setUint16(offset + 30, 0, true);
    view.setUint16(offset + 32, 0, true);
    view.setUint16(offset + 34, 0, true);
    view.setUint16(offset + 36, 0, true);
    view.setUint32(offset + 38, 0, true);
    view.setUint32(offset + 42, localOffsets[i], true);
    out.set(e.nameBytes, offset + 46);
    offset += 46 + e.nameBytes.length;
  }

  const centralEnd = offset;
  view.setUint32(offset, 0x06054b50, true); // End of central dir signature
  view.setUint16(offset + 4, 0, true);
  view.setUint16(offset + 6, 0, true);
  view.setUint16(offset + 8, entries.length, true);
  view.setUint16(offset + 10, entries.length, true);
  view.setUint32(offset + 12, centralEnd - centralStart, true);
  view.setUint32(offset + 16, centralStart, true);
  view.setUint16(offset + 20, 0, true);

  return out;
}

/**
 * Estilos OpenXML para el archivo .xlsx:
 * 0 = Default
 * 1 = Main Title (Fondo Azul Marino #1E3A8A, Texto Blanco Bold 14pt)
 * 2 = Subtitle (Fondo Gris Azulado #EFF6FF, Texto Azul Marino Bold 10pt)
 * 3 = Section Banner (Fondo Rojo Global Travel #DC2626, Texto Blanco Bold 11pt)
 * 4 = Table Header (Fondo Azul Marino #1E3A8A, Texto Blanco Bold 10pt con bordes)
 * 5 = Data Cell (Fondo Blanco, Texto Negro 10pt con bordes y wrapText)
 * 6 = Footer / Subtotal Cell (Fondo Amarillo Suave #FEF3C7, Texto Bold 10pt con bordes)
 */
function buildXlsxBytes(report: BuiltOperationalReport): Uint8Array {
  let rowIndex = 1;
  const rowsXml: string[] = [];
  const mergeCells: string[] = [];
  const maxCols = 9;

  function addFullBannerRow(text: string, styleIdx: number, height: number, spanCols = maxCols) {
    const cells: string[] = [];
    for (let c = 0; c < spanCols; c++) {
      const ref = `${colIndexToLetter(c)}${rowIndex}`;
      if (c === 0) {
        cells.push(
          `<c r="${ref}" s="${styleIdx}" t="inlineStr"><is><t>${escapeXml(text)}</t></is></c>`
        );
      } else {
        cells.push(`<c r="${ref}" s="${styleIdx}"/>`);
      }
    }
    rowsXml.push(`<row r="${rowIndex}" ht="${height}" customHeight="1">${cells.join('')}</row>`);
    mergeCells.push(`<mergeCell ref="A${rowIndex}:${colIndexToLetter(spanCols - 1)}${rowIndex}"/>`);
    rowIndex++;
  }

  function addBlankRow() {
    rowsXml.push(`<row r="${rowIndex}" ht="12"/>`);
    rowIndex++;
  }

  function addCellsRow(values: string[], styleIdx: number, height = 22) {
    const cells = values.map((val, cIdx) => {
      const ref = `${colIndexToLetter(cIdx)}${rowIndex}`;
      const numVal = Number(val);
      if (val !== '' && !Number.isNaN(numVal) && /^\d+(\.\d+)?$/.test(val.trim())) {
        return `<c r="${ref}" s="${styleIdx}"><v>${numVal}</v></c>`;
      }
      return `<c r="${ref}" s="${styleIdx}" t="inlineStr"><is><t>${escapeXml(val)}</t></is></c>`;
    });
    rowsXml.push(`<row r="${rowIndex}" ht="${height}" customHeight="1">${cells.join('')}</row>`);
    rowIndex++;
  }

  // Cabecera Principal
  addFullBannerRow(report.mainTitle, 1, 28, maxCols);
  addFullBannerRow(report.subTitle, 2, 22, maxCols);
  addBlankRow();

  // Cada sección del reporte
  for (const section of report.sections) {
    const colCount = section.headers.length;
    addFullBannerRow(section.title, 3, 24, colCount);
    addCellsRow(section.headers, 4, 24);

    for (const r of section.rows) {
      addCellsRow(r, 5, 22);
    }

    if (section.footerRows) {
      for (const fRow of section.footerRows) {
        addCellsRow(fRow, 6, 22);
      }
    }

    addBlankRow();
  }

  const colsXml = [
    '<col min="1" max="1" width="34" customWidth="1"/>',
    '<col min="2" max="2" width="18" customWidth="1"/>',
    '<col min="3" max="3" width="36" customWidth="1"/>',
    '<col min="4" max="4" width="38" customWidth="1"/>',
    '<col min="5" max="5" width="30" customWidth="1"/>',
    '<col min="6" max="6" width="26" customWidth="1"/>',
    '<col min="7" max="7" width="24" customWidth="1"/>',
    '<col min="8" max="8" width="24" customWidth="1"/>',
    '<col min="9" max="9" width="36" customWidth="1"/>',
  ].join('');

  const sheetXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <cols>${colsXml}</cols>
  <sheetData>${rowsXml.join('')}</sheetData>
  <mergeCells count="${mergeCells.length}">${mergeCells.join('')}</mergeCells>
</worksheet>`;

  const stylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="5">
    <font><sz val="10"/><color rgb="FF0F172A"/><name val="Calibri"/></font>
    <font><b/><sz val="14"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>
    <font><b/><sz val="10"/><color rgb="FF1E3A8A"/><name val="Calibri"/></font>
    <font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>
    <font><b/><sz val="10"/><color rgb="FF0F172A"/><name val="Calibri"/></font>
  </fonts>
  <fills count="7">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF1E3A8A"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFEFF6FF"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFDC2626"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFFFFFFF"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFFEF3C7"/></patternFill></fill>
  </fills>
  <borders count="2">
    <border><left/><right/><top/><bottom/><diagonal/></border>
    <border>
      <left style="thin"><color rgb="FFCBD5E1"/></left>
      <right style="thin"><color rgb="FFCBD5E1"/></right>
      <top style="thin"><color rgb="FFCBD5E1"/></top>
      <bottom style="thin"><color rgb="FFCBD5E1"/></bottom>
      <diagonal/>
    </border>
  </borders>
  <cellStyleXfs count="1">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0"/>
  </cellStyleXfs>
  <cellXfs count="7">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
    <xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyAlignment="1">
      <alignment vertical="center" horizontal="left"/>
    </xf>
    <xf numFmtId="0" fontId="2" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyAlignment="1">
      <alignment vertical="center" horizontal="left"/>
    </xf>
    <xf numFmtId="0" fontId="3" fillId="4" borderId="1" xfId="0" applyFont="1" applyFill="1" applyAlignment="1">
      <alignment vertical="center" horizontal="left"/>
    </xf>
    <xf numFmtId="0" fontId="3" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1">
      <alignment vertical="center" horizontal="left" wrapText="1"/>
    </xf>
    <xf numFmtId="0" fontId="0" fillId="5" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1">
      <alignment vertical="center" horizontal="left" wrapText="1"/>
    </xf>
    <xf numFmtId="0" fontId="4" fillId="6" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1">
      <alignment vertical="center" horizontal="left" wrapText="1"/>
    </xf>
  </cellXfs>
</styleSheet>`;

  const workbookXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="Resumen Operativo" sheetId="1" r:id="rId1"/>
  </sheets>
</workbook>`;

  const workbookRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;

  const rootRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;

  const contentTypesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>`;

  return createStoredZip([
    { name: '[Content_Types].xml', content: contentTypesXml },
    { name: '_rels/.rels', content: rootRelsXml },
    { name: 'xl/workbook.xml', content: workbookXml },
    { name: 'xl/_rels/workbook.xml.rels', content: workbookRelsXml },
    { name: 'xl/styles.xml', content: stylesXml },
    { name: 'xl/worksheets/sheet1.xml', content: sheetXml },
  ]);
}

// ============================================================================
// GENERADOR DE PDF (.pdf nativo A4 Horizontal con tablas vectoriales)
// ============================================================================

function toWinAnsiSafePdfString(input: string): string {
  // Reemplazar emojis o caracteres fuera de WinAnsi por equivalentes limpios
  const cleaned = String(input ?? '')
    .replace(/→/g, '->')
    .replace(/[•·]/g, '-')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[–—]/g, '-');

  let out = '';
  for (let i = 0; i < cleaned.length; i++) {
    const code = cleaned.charCodeAt(i);
    if (code === 0x28 || code === 0x29 || code === 0x5c) {
      out += '\\' + cleaned[i];
    } else if (code >= 32 && code <= 126) {
      out += cleaned[i];
    } else if (code >= 160 && code <= 255) {
      out += '\\' + code.toString(8).padStart(3, '0');
    } else {
      out += '';
    }
  }
  return out;
}

function wrapTextToWidth(text: string, maxChars: number): string[] {
  const clean = String(text ?? '-').replace(/\r?\n/g, ' ').trim() || '-';
  if (clean.length <= maxChars) return [clean];
  const words = clean.split(/\s+/);
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    if (!current) {
      current = word.length > maxChars ? word.slice(0, maxChars) : word;
    } else if (current.length + 1 + word.length <= maxChars) {
      current += ' ' + word;
    } else {
      lines.push(current);
      current = word.length > maxChars ? word.slice(0, maxChars) : word;
    }
  }
  if (current) lines.push(current);
  return lines.slice(0, 4); // Máximo 4 líneas por celda para mantener legibilidad
}

function buildPdfBytes(report: BuiltOperationalReport): Uint8Array {
  // A4 Landscape: 842 x 595 pt
  const pageWidth = 842;
  const pageHeight = 595;
  const marginX = 28;
  const usableWidth = pageWidth - marginX * 2; // 786 pt
  const topY = pageHeight - 32;
  const bottomLimitY = 38;

  const pageStreams: string[][] = [];
  let currentStream: string[] = [];
  let cursorY = topY;

  function startNewPage(isFirstPage = false) {
    if (currentStream.length > 0) {
      pageStreams.push(currentStream);
    }
    currentStream = [];
    cursorY = topY;

    if (isFirstPage) {
      // Banner principal Azul Marino (#1E3A8A -> 0.118, 0.227, 0.541)
      currentStream.push('0.118 0.227 0.541 rg');
      currentStream.push(`${marginX} ${cursorY - 26} ${usableWidth} 26 re f`);
      currentStream.push('1 1 1 rg');
      currentStream.push(
        `BT /F2 12 Tf ${marginX + 10} ${cursorY - 17} Td (${toWinAnsiSafePdfString(report.mainTitle)}) Tj ET`
      );
      cursorY -= 26;

      // Subtítulo (#EFF6FF -> 0.937, 0.965, 1.0)
      currentStream.push('0.937 0.965 1 rg');
      currentStream.push(`${marginX} ${cursorY - 18} ${usableWidth} 18 re f`);
      currentStream.push('0.118 0.227 0.541 rg');
      currentStream.push(
        `BT /F2 8.5 Tf ${marginX + 10} ${cursorY - 12} Td (${toWinAnsiSafePdfString(report.subTitle)}) Tj ET`
      );
      cursorY -= 28;
    } else {
      // Encabezado compacto en páginas siguientes
      currentStream.push('0.118 0.227 0.541 rg');
      currentStream.push(
        `BT /F2 8 Tf ${marginX} ${cursorY - 8} Td (${toWinAnsiSafePdfString(report.mainTitle + ' | ' + report.subTitle)}) Tj ET`
      );
      cursorY -= 18;
    }
  }

  startNewPage(true);

  function computeColWidths(colCount: number): number[] {
    if (colCount === 5) {
      return [0.22, 0.1, 0.3, 0.18, 0.2].map((w) => w * usableWidth);
    }
    if (colCount === 6) {
      return [0.2, 0.11, 0.23, 0.22, 0.14, 0.1].map((w) => w * usableWidth);
    }
    if (colCount === 7) {
      return [0.18, 0.1, 0.18, 0.16, 0.14, 0.13, 0.11].map((w) => w * usableWidth);
    }
    if (colCount === 9) {
      return [0.16, 0.08, 0.16, 0.09, 0.09, 0.09, 0.08, 0.11, 0.14].map(
        (w) => w * usableWidth
      );
    }
    const eq = usableWidth / colCount;
    return Array.from({ length: colCount }, () => eq);
  }

  function drawSectionHeader(title: string, headers: string[], colWidths: number[]) {
    // Banner rojo de sección (#DC2626 -> 0.863, 0.149, 0.149)
    currentStream.push('0.863 0.149 0.149 rg');
    currentStream.push(`${marginX} ${cursorY - 18} ${usableWidth} 18 re f`);
    currentStream.push('1 1 1 rg');
    currentStream.push(
      `BT /F2 9.5 Tf ${marginX + 8} ${cursorY - 13} Td (${toWinAnsiSafePdfString(title)}) Tj ET`
    );
    cursorY -= 18;

    // Cabecera de columnas (#1E3A8A)
    const headerHeight = 18;
    currentStream.push('0.118 0.227 0.541 rg');
    currentStream.push(`${marginX} ${cursorY - headerHeight} ${usableWidth} 18 re f`);
    currentStream.push('1 1 1 rg');

    let x = marginX;
    for (let c = 0; c < headers.length; c++) {
      const w = colWidths[c];
      const maxChars = Math.max(8, Math.floor((w - 8) / 4.2));
      const label = (headers[c] || '').slice(0, maxChars);
      currentStream.push(
        `BT /F2 7.5 Tf ${x + 4} ${cursorY - 12} Td (${toWinAnsiSafePdfString(label)}) Tj ET`
      );
      x += w;
    }
    cursorY -= headerHeight;
  }

  for (const section of report.sections) {
    const colWidths = computeColWidths(section.headers.length);

    if (cursorY - 56 < bottomLimitY) {
      startNewPage(false);
    }

    drawSectionHeader(section.title, section.headers, colWidths);

    const allRows = [
      ...section.rows.map((r) => ({ cells: r, isFooter: false })),
      ...(section.footerRows || []).map((r) => ({ cells: r, isFooter: true })),
    ];

    for (let rIdx = 0; rIdx < allRows.length; rIdx++) {
      const { cells, isFooter } = allRows[rIdx];
      const wrappedCols = cells.map((cellText, cIdx) => {
        const w = colWidths[cIdx] || 80;
        const maxChars = Math.max(8, Math.floor((w - 8) / 4.0));
        return wrapTextToWidth(cellText, maxChars);
      });

      const maxLines = Math.max(1, ...wrappedCols.map((lines) => lines.length));
      const rowHeight = maxLines * 10 + 6;

      if (cursorY - rowHeight < bottomLimitY) {
        startNewPage(false);
        drawSectionHeader(`${section.title} (Cont.)`, section.headers, colWidths);
      }

      // Color de fondo de la fila
      if (isFooter) {
        currentStream.push('0.996 0.953 0.780 rg'); // #FEF3C7
      } else if (rIdx % 2 === 1) {
        currentStream.push('0.961 0.969 0.980 rg'); // #F5F7FA
      } else {
        currentStream.push('1 1 1 rg');
      }
      currentStream.push(`${marginX} ${cursorY - rowHeight} ${usableWidth} ${rowHeight} re f`);

      // Bordes de celda
      currentStream.push('0.80 0.84 0.88 RG 0.4 w');
      let x = marginX;
      for (let c = 0; c < colWidths.length; c++) {
        const w = colWidths[c];
        currentStream.push(`${x} ${cursorY - rowHeight} ${w} ${rowHeight} re S`);
        x += w;
      }

      // Texto de cada celda
      currentStream.push('0.06 0.09 0.16 rg');
      x = marginX;
      const fontName = isFooter ? '/F2' : '/F1';
      for (let c = 0; c < colWidths.length; c++) {
        const w = colWidths[c];
        const lines = wrappedCols[c] || ['-'];
        for (let l = 0; l < lines.length; l++) {
          const textY = cursorY - 10 - l * 10;
          currentStream.push(
            `BT ${fontName} 7.2 Tf ${x + 4} ${textY} Td (${toWinAnsiSafePdfString(lines[l])}) Tj ET`
          );
        }
        x += w;
      }

      cursorY -= rowHeight;
    }

    cursorY -= 14;
  }

  if (currentStream.length > 0) {
    pageStreams.push(currentStream);
  }

  // Numeración de páginas en el pie de cada página
  const totalPages = pageStreams.length;
  for (let p = 0; p < totalPages; p++) {
    pageStreams[p].push('0.4 0.45 0.52 rg');
    pageStreams[p].push(
      `BT /F1 7.5 Tf ${pageWidth - 130} 18 Td (${toWinAnsiSafePdfString(`Página ${p + 1} de ${totalPages} - Global Travel CW`)}) Tj ET`
    );
  }

  // Ensamblar objetos PDF 1.4
  const objects: string[] = [];
  // Obj 1: Catalog
  objects.push('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');
  // Obj 2: Pages (se rellenará después)
  objects.push('');
  // Obj 3: Font Helvetica (WinAnsiEncoding para tildes y ñ)
  objects.push(
    '3 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>\nendobj\n'
  );
  // Obj 4: Font Helvetica-Bold
  objects.push(
    '4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>\nendobj\n'
  );

  const pageObjNums: number[] = [];
  for (let p = 0; p < totalPages; p++) {
    const streamContent = pageStreams[p].join('\n');
    const contentObjNum = objects.length + 1;
    const pageObjNum = objects.length + 2;

    objects.push(
      `${contentObjNum} 0 obj\n<< /Length ${streamContent.length} >>\nstream\n${streamContent}\nendstream\nendobj\n`
    );
    objects.push(
      `${pageObjNum} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentObjNum} 0 R >>\nendobj\n`
    );
    pageObjNums.push(pageObjNum);
  }

  objects[1] = `2 0 obj\n<< /Type /Pages /Kids [${pageObjNums.map((n) => `${n} 0 R`).join(' ')}] /Count ${totalPages} >>\nendobj\n`;

  let pdfText = '%PDF-1.4\n';
  const offsets: number[] = [0];
  for (const obj of objects) {
    offsets.push(pdfText.length);
    pdfText += obj;
  }

  const xrefOffset = pdfText.length;
  pdfText += `xref\n0 ${objects.length + 1}\n`;
  pdfText += '0000000000 65535 f \n';
  for (let i = 1; i < offsets.length; i++) {
    pdfText += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }
  pdfText += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  // Codificar en bytes Latin1/WinAnsi
  const bytes = new Uint8Array(pdfText.length);
  for (let i = 0; i < pdfText.length; i++) {
    bytes[i] = pdfText.charCodeAt(i) & 0xff;
  }
  return bytes;
}

function triggerBlobDownload(bytes: Uint8Array, filename: string, mimeType: string) {
  const blob = new Blob([bytes as unknown as BlobPart], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 4000);
}

async function fetchLiveReportData(): Promise<BuiltOperationalReport> {
  const response = await fetch('/api/reporte', {
    method: 'GET',
    headers: { Accept: 'application/json' },
    cache: 'no-store',
  });
  if (!response.ok) {
    throw new Error('No se pudo obtener la información actualizada desde Cloudflare D1');
  }
  const json = (await response.json()) as { ok?: boolean; data?: ReportDataPayload };
  if (!json.ok || !json.data) {
    throw new Error('Respuesta inválida al generar el reporte');
  }
  return buildOperationalReport(json.data);
}

export async function downloadOperationalReportExcel(): Promise<void> {
  const report = await fetchLiveReportData();
  const xlsxBytes = buildXlsxBytes(report);
  triggerBlobDownload(
    xlsxBytes,
    `Reporte_Operativo_Global_Travel_CW_${report.dateSlug}.xlsx`,
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  );
}

export async function downloadOperationalReportPdf(): Promise<void> {
  const report = await fetchLiveReportData();
  const pdfBytes = buildPdfBytes(report);
  triggerBlobDownload(
    pdfBytes,
    `Reporte_Operativo_Global_Travel_CW_${report.dateSlug}.pdf`,
    'application/pdf'
  );
}
