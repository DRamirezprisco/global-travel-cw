import type { PendienteRecord } from '@/types';

export interface ParsedFlightDate {
  day: number;
  month: number; // 1-12
  year: number; // 4-digit year (e.g. 2026)
  formatted: string; // DD/MM/YYYY
  timestamp: number; // Midnight local timestamp for sorting/comparison
  rawToken: string;
}

export interface PendienteHoyEvaluation {
  matches: boolean;
  isReserva24h: boolean;
  /** Todas las fechas detectadas ordenadas de la más cercana a la más lejana */
  parsedDates: ParsedFlightDate[];
  /** La fecha que activó la coincidencia (o la más cercana) */
  matchedDate: ParsedFlightDate | null;
  /** Etiqueta explicativa para mostrar en la tabla (ej. "Vuelo Hoy: 08/11/2026", "Vuelo Mañana: 09/11/2026", "Reserva 24h vence hoy (ayer)") */
  matchLabel: string;
  /** Prioridad de ordenamiento (menor = más urgente / más cercano) */
  sortTimestamp: number;
  /** Segunda clave de ordenamiento para multiruta (la fecha más lejana) */
  secondarySortTimestamp: number;
}

const MONTH_MAP: Record<string, number> = {
  JAN: 1,
  ENE: 1,
  ENERO: 1,
  FEB: 2,
  FEBRERO: 2,
  MAR: 3,
  MARZO: 3,
  APR: 4,
  ABR: 4,
  ABRIL: 4,
  MAY: 5,
  MAYO: 5,
  JUN: 6,
  JUNIO: 6,
  JUL: 7,
  JULIO: 7,
  AUG: 8,
  AGO: 8,
  AGOSTO: 8,
  SEP: 9,
  SET: 9,
  SEPT: 9,
  SEPTIEMBRE: 9,
  OCT: 10,
  OTC: 10,
  OCTUBRE: 10,
  NOV: 11,
  NOVIEMBRE: 11,
  DEC: 12,
  DIC: 12,
  DICIEMBRE: 12,
};

function normalizeTwoDigits(n: number): string {
  return String(n).padStart(2, '0');
}

export function formatDateDDMMYYYY(day: number, month: number, year: number): string {
  return `${normalizeTwoDigits(day)}/${normalizeTwoDigits(month)}/${year}`;
}

export function createMidnightDate(year: number, month: number, day: number): Date {
  return new Date(year, month - 1, day, 0, 0, 0, 0);
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/**
 * Extrae una fecha desde `fecha_gestion` (ej. "23/10/26", "23/10/2026", "23-10-2026 14:30").
 */
export function parseFechaGestionDate(
  rawFecha: string | undefined | null,
  referenceYear = new Date().getFullYear()
): ParsedFlightDate | null {
  if (!rawFecha || rawFecha.trim() === '-' || rawFecha.trim() === '') return null;
  const clean = rawFecha.trim();

  // Formato DD/MM/YYYY o DD/MM/YY o DD-MM-YYYY
  const m = clean.match(/(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?/);
  if (m) {
    const day = Number(m[1]);
    const month = Number(m[2]);
    let year = m[3] ? Number(m[3]) : referenceYear;
    if (year < 100) year += 2000;
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
      const d = createMidnightDate(year, month, day);
      return {
        day,
        month,
        year,
        formatted: formatDateDDMMYYYY(day, month, year),
        timestamp: d.getTime(),
        rawToken: m[0],
      };
    }
  }

  // Formato YYYY-MM-DD
  const iso = clean.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (iso) {
    const year = Number(iso[1]);
    const month = Number(iso[2]);
    const day = Number(iso[3]);
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
      const d = createMidnightDate(year, month, day);
      return {
        day,
        month,
        year,
        formatted: formatDateDDMMYYYY(day, month, year),
        timestamp: d.getTime(),
        rawToken: iso[0],
      };
    }
  }

  return null;
}

/**
 * Extrae TODAS las fechas presentes en el campo `solicitud_vuelo` ("Datos del Vuelo").
 * Soporta formatos:
 * - "22NOV  MARCUR" -> [22/11/2026]
 * - "27DEC CURMAR /   10JAN CURMAR" -> [27/12/2026, 10/01/2027]
 * - "29NOVCURMAR 10DECMARCUR" -> [29/11/2026, 10/12/2026]
 * - "24-25DEC 10-12JAN CUR-MAR-CUR" -> [24/12/2026, 25/12/2026, 10/01/2027, 12/01/2027]
 * - "CUR-BOG 21 OCT | BOG-BAQ 25 OCT | BAQ-CUR 01 NOV" -> [21/10/2026, 25/10/2026, 01/11/2026]
 * - "Nov 30 - Dec 15 CUR -> PMV" -> [30/11/2026, 15/12/2026]
 * - "14/11/26 - 28/11/26" o "05/11" -> [14/11/2026, 28/11/2026]
 *
 * Devuelve las fechas ordenadas de la más cercana a la más lejana con respecto a `referenceDate`.
 */
export function extractFlightDatesFromText(
  rawText: string | undefined | null,
  referenceDate: Date = new Date()
): ParsedFlightDate[] {
  if (!rawText || rawText.trim() === '-' || rawText.trim() === '') return [];

  const text = rawText.toUpperCase();
  const baseYear = referenceDate.getFullYear();
  const refMidnight = createMidnightDate(
    referenceDate.getFullYear(),
    referenceDate.getMonth() + 1,
    referenceDate.getDate()
  );

  const rawExtracted: Array<{
    day: number;
    month: number;
    explicitYear?: number;
    rawToken: string;
    index: number;
  }> = [];

  // 1. Patrón: DD-DDMMM o DDMMM (incluso pegado a código de aeropuerto como 22NOV, 29NOVCURMAR, 14DECCURMAR | 04JANMARCUR, 27DEC, 24-25DEC, 21 OCT)
  const monthNamesPattern =
    '(ENERO|FEBRERO|MARZO|ABRIL|MAYO|JUNIO|JULIO|AGOSTO|SEPTIEMBRE|SEPT|OCTUBRE|NOVIEMBRE|DICIEMBRE|JAN|ENE|FEB|MAR|APR|ABR|MAY|JUN|JUL|AUG|AGO|SEP|SET|OCT|OTC|NOV|DEC|DIC)';
  const regexDayMonth = new RegExp(
    `(?:^|[^0-9])(\\d{1,2})(?:\\s*\\-\\s*(\\d{1,2}))?\\s*${monthNamesPattern}`,
    'g'
  );

  let match: RegExpExecArray | null;
  while ((match = regexDayMonth.exec(text)) !== null) {
    const day1 = Number(match[1]);
    const day2 = match[2] ? Number(match[2]) : null;
    const monthKey = match[3];
    const month = MONTH_MAP[monthKey];

    if (month && day1 >= 1 && day1 <= 31) {
      rawExtracted.push({
        day: day1,
        month,
        rawToken: match[0].trim(),
        index: match.index,
      });
    }
    if (month && day2 && day2 >= 1 && day2 <= 31) {
      rawExtracted.push({
        day: day2,
        month,
        rawToken: match[0].trim(),
        index: match.index + 1,
      });
    }
  }

  // 2. Patrón inverso: MMM DD (ej. "NOV 30", "DEC 15")
  // Nota: excluimos "MAR" suelto aquí a menos que sea "MARZO" para no confundir "CUR-MAR 10" con Marzo 10 si ya fue capturado
  const regexMonthDay =
    /(?:^|[^A-Z0-9])(JAN|ENE|ENERO|FEB|FEBRERO|MARZO|APR|ABR|ABRIL|MAY|MAYO|JUN|JUNIO|JUL|JULIO|AUG|AGO|AGOSTO|SEPTIEMBRE|SEPT|SEP|SET|OCTUBRE|OCT|OTC|NOVIEMBRE|NOV|DICIEMBRE|DEC|DIC)\s+(\d{1,2})(?!\s*(?:JAN|ENE|FEB|MAR|APR|ABR|MAY|JUN|JUL|AUG|AGO|SEP|SET|OCT|OTC|NOV|DEC|DIC|[\/\-]\d))/g;

  while ((match = regexMonthDay.exec(text)) !== null) {
    const monthKey = match[1];
    const day = Number(match[2]);
    const month = MONTH_MAP[monthKey];
    if (month && day >= 1 && day <= 31) {
      rawExtracted.push({
        day,
        month,
        rawToken: match[0].trim(),
        index: match.index,
      });
    }
  }

  // 3. Patrón numérico: DD/MM/YYYY, DD/MM/YY, DD/MM o DD-MM-YYYY (ej. "05/11", "17/12/26", "23/12/2026")
  const regexNumeric = /(?:^|[^\d\/\-])(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?(?!\d)/g;
  while ((match = regexNumeric.exec(text)) !== null) {
    const first = Number(match[1]);
    const second = Number(match[2]);
    const thirdStr = match[3];
    // Evitar confundir YYYY-MM-DD aquí (se procesa abajo)
    if (match[1].length === 4) continue;
    const day = first;
    const month = second;
    let explicitYear: number | undefined;
    if (thirdStr) {
      const y = Number(thirdStr);
      explicitYear = y < 100 ? 2000 + y : y;
    }
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
      rawExtracted.push({
        day,
        month,
        explicitYear,
        rawToken: match[0].trim(),
        index: match.index,
      });
    }
  }

  // 4. Patrón ISO: YYYY-MM-DD (ej. "2026-12-23")
  const regexIso = /(\d{4})-(\d{2})-(\d{2})/g;
  while ((match = regexIso.exec(text)) !== null) {
    const explicitYear = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
      rawExtracted.push({
        day,
        month,
        explicitYear,
        rawToken: match[0].trim(),
        index: match.index,
      });
    }
  }

  if (rawExtracted.length === 0) return [];

  // Ordenar por orden de aparición en el texto para inferir cambio de año en multirutas (ej. 27DEC / 10JAN -> 2026 y 2027)
  rawExtracted.sort((a, b) => a.index - b.index);

  let runningYear = baseYear;
  let prevMonth = -1;

  const resolved: ParsedFlightDate[] = [];
  const seenFormatted = new Set<string>();

  for (const item of rawExtracted) {
    let year = item.explicitYear ?? runningYear;

    if (!item.explicitYear) {
      if (prevMonth !== -1 && item.month < prevMonth) {
        // Ejemplo: 27DEC seguido de 10JAN -> el retorno pasa al año siguiente
        runningYear += 1;
        year = runningYear;
      } else if (prevMonth === -1) {
        // Primera fecha sin año explícito: si la fecha en el año base ya pasó hace más de 6 meses, asumir año siguiente
        const candidate = createMidnightDate(baseYear, item.month, item.day);
        const diffDays = (candidate.getTime() - refMidnight.getTime()) / (1000 * 60 * 60 * 24);
        if (diffDays < -180) {
          runningYear = baseYear + 1;
          year = runningYear;
        }
      }
    } else {
      runningYear = item.explicitYear;
    }

    prevMonth = item.month;
    const formatted = formatDateDDMMYYYY(item.day, item.month, year);
    if (!seenFormatted.has(formatted)) {
      seenFormatted.add(formatted);
      const d = createMidnightDate(year, item.month, item.day);
      resolved.push({
        day: item.day,
        month: item.month,
        year,
        formatted,
        timestamp: d.getTime(),
        rawToken: item.rawToken,
      });
    }
  }

  // Ordenar las fechas del registro de la MÁS CERCANA a la MÁS LEJANA respecto a la fecha de referencia
  const refTime = refMidnight.getTime();
  resolved.sort((a, b) => {
    const distA = Math.abs(a.timestamp - refTime);
    const distB = Math.abs(b.timestamp - refTime);
    if (distA !== distB) return distA - distB;
    return a.timestamp - b.timestamp;
  });

  return resolved;
}

/**
 * Evalúa si un registro de `pendientes` pertenece a "Pendientes Hoy":
 *
 * 1. Si `status === 'Reserva por 24h'`:
 *    - Se filtra por `fecha_gestion` (día en que se va a vencer: fecha de HOY o de AYER).
 * 2. Para los demás estatus:
 *    - Se extraen todas las fechas de `solicitud_vuelo` ("Datos del Vuelo"), ordenadas primero la más cercana y luego la más lejana.
 *    - Coincide si cualquiera de las fechas (ida, vuelta o multiruta) es de la FECHA ACTUAL (Hoy) o UN DÍA DESPUÉS (Mañana / +1 día).
 */
export function evaluatePendienteForHoy(
  record: PendienteRecord,
  referenceDate: Date = new Date()
): PendienteHoyEvaluation {
  // No incluir registros ya finalizados
  if ((record.status || '').toLowerCase() === 'finalizado') {
    return {
      matches: false,
      isReserva24h: false,
      parsedDates: [],
      matchedDate: null,
      matchLabel: '-',
      sortTimestamp: Number.MAX_SAFE_INTEGER,
      secondarySortTimestamp: Number.MAX_SAFE_INTEGER,
    };
  }

  const todayMidnight = createMidnightDate(
    referenceDate.getFullYear(),
    referenceDate.getMonth() + 1,
    referenceDate.getDate()
  );
  const tomorrowMidnight = createMidnightDate(
    referenceDate.getFullYear(),
    referenceDate.getMonth() + 1,
    referenceDate.getDate() + 1
  );
  const yesterdayMidnight = createMidnightDate(
    referenceDate.getFullYear(),
    referenceDate.getMonth() + 1,
    referenceDate.getDate() - 1
  );

  const isReserva24h = record.status === 'Reserva por 24h';

  // Caso 1: Reserva por 24h -> Filtrar por `fecha_gestion` (Hoy o Ayer = día en que vence)
  if (isReserva24h) {
    const gestionDate = parseFechaGestionDate(
      record.fecha_gestion,
      todayMidnight.getFullYear()
    );
    const flightDates = extractFlightDatesFromText(record.solicitud_vuelo, todayMidnight);

    if (gestionDate) {
      const gObj = createMidnightDate(gestionDate.year, gestionDate.month, gestionDate.day);
      const isYesterday = isSameDay(gObj, yesterdayMidnight);
      const isToday = isSameDay(gObj, todayMidnight);

      if (isYesterday || isToday) {
        return {
          matches: true,
          isReserva24h: true,
          parsedDates: [gestionDate, ...flightDates],
          matchedDate: gestionDate,
          matchLabel: isYesterday
            ? `⚠️ Vence Hoy (Gestión ayer ${gestionDate.formatted})`
            : `⏱️ Reserva 24h Hoy (${gestionDate.formatted})`,
          // Las reservas de ayer vencen hoy -> máxima prioridad
          sortTimestamp: gObj.getTime(),
          secondarySortTimestamp: flightDates[0]?.timestamp ?? gObj.getTime(),
        };
      }
    }

    return {
      matches: false,
      isReserva24h: true,
      parsedDates: gestionDate ? [gestionDate, ...flightDates] : flightDates,
      matchedDate: null,
      matchLabel: gestionDate ? `Gestión: ${gestionDate.formatted}` : '-',
      sortTimestamp: Number.MAX_SAFE_INTEGER,
      secondarySortTimestamp: Number.MAX_SAFE_INTEGER,
    };
  }

  // Caso 2: Demás pendientes -> Filtrar por todas las fechas en `solicitud_vuelo` (Hoy o Mañana +1 día)
  const flightDates = extractFlightDatesFromText(record.solicitud_vuelo, todayMidnight);
  if (flightDates.length === 0) {
    return {
      matches: false,
      isReserva24h: false,
      parsedDates: [],
      matchedDate: null,
      matchLabel: '-',
      sortTimestamp: Number.MAX_SAFE_INTEGER,
      secondarySortTimestamp: Number.MAX_SAFE_INTEGER,
    };
  }

  let matchedToday: ParsedFlightDate | null = null;
  let matchedTomorrow: ParsedFlightDate | null = null;

  for (const fd of flightDates) {
    // Comparar por día y mes + año (o día/mes cuando coincide con hoy/mañana)
    const dObj = createMidnightDate(fd.year, fd.month, fd.day);
    if (isSameDay(dObj, todayMidnight)) {
      if (!matchedToday) matchedToday = fd;
    } else if (isSameDay(dObj, tomorrowMidnight)) {
      if (!matchedTomorrow) matchedTomorrow = fd;
    }
  }

  const matched = matchedToday || matchedTomorrow;
  if (!matched) {
    return {
      matches: false,
      isReserva24h: false,
      parsedDates: flightDates,
      matchedDate: null,
      matchLabel: flightDates.map((d) => d.formatted).join(' → '),
      sortTimestamp: flightDates[0].timestamp,
      secondarySortTimestamp: flightDates[1]?.timestamp ?? flightDates[0].timestamp,
    };
  }

  // Ordenar las fechas del registro de modo que la fecha más cercana vaya primero y luego la más lejana
  const chronologicalDates = [...flightDates].sort((a, b) => a.timestamp - b.timestamp);
  const allDatesLabel =
    chronologicalDates.length > 1
      ? ` (${chronologicalDates.map((d) => d.formatted).join(' → ')})`
      : '';

  const matchLabel = matchedToday
    ? `🔴 Vuelo Hoy: ${matchedToday.formatted}${allDatesLabel}`
    : `🟠 Vuelo Mañana: ${matchedTomorrow!.formatted}${allDatesLabel}`;

  return {
    matches: true,
    isReserva24h: false,
    parsedDates: flightDates,
    matchedDate: matched,
    matchLabel,
    sortTimestamp: matched.timestamp,
    secondarySortTimestamp:
      flightDates.length > 1 ? flightDates[flightDates.length - 1].timestamp : matched.timestamp,
  };
}
