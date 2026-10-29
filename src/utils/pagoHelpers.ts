/**
 * Utilidades para procesamiento numérico y de fechas en Pagos y Pendientes.
 */

/**
 * Extrae el valor numérico de un string de monto con formatos variados:
 * Ej: "819 Fls" -> 819, "3.167,61" -> 3167.61, "1.270 Fls" -> 1270, "100$" -> 100
 */
export function parseMontoNumeric(val: string | null | undefined): number {
  if (!val || val.trim() === '-' || val.trim() === '') return 0;
  let cleaned = val.replace(/[^\d.,]/g, '').trim();
  if (!cleaned) return 0;

  if (cleaned.includes('.') && cleaned.includes(',')) {
    // Formato europeo/latino: 3.167,61 -> 3167.61
    cleaned = cleaned.replace(/\./g, '').replace(',', '.');
  } else if (cleaned.includes(',')) {
    if (/,\d{2}$/.test(cleaned)) {
      // Decimal con coma: 350,50 -> 350.50
      cleaned = cleaned.replace(',', '.');
    } else {
      // Separador de miles con coma: 1,200 -> 1200
      cleaned = cleaned.replace(',', '');
    }
  } else if (cleaned.includes('.')) {
    if (/\.\d{3}$/.test(cleaned)) {
      // Separador de miles con punto: 1.270 o 2.000 -> 1270 o 2000
      cleaned = cleaned.replace(/\./g, '');
    }
  }

  const result = parseFloat(cleaned);
  return isNaN(result) ? 0 : result;
}

/**
 * Retorna la fecha y hora actual en formato 'DD/MM/AA HH:mm'
 */
export function getNowFormatted(): string {
  const now = new Date();
  const day = String(now.getDate()).padStart(2, '0');
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const year = String(now.getFullYear()).slice(-2);
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  return `${day}/${month}/${year} ${hours}:${minutes}`;
}

/**
 * Retorna solo la fecha actual en formato 'DD/MM/AA'
 */
export function getTodayDateFormatted(): string {
  const now = new Date();
  const day = String(now.getDate()).padStart(2, '0');
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const year = String(now.getFullYear()).slice(-2);
  return `${day}/${month}/${year}`;
}

/**
 * Verifica si han transcurrido más de 20 días desde la fecha de gestión o creación del pago.
 */
export function isPagoOverdue20Days(fechaGestion: string | null | undefined, updatedAt?: string): boolean {
  let targetDate: Date | null = null;

  if (fechaGestion && fechaGestion.trim() !== '-') {
    const raw = fechaGestion.split(' ')[0].trim();
    const slashParts = raw.split('/');
    if (slashParts.length === 3) {
      const d = parseInt(slashParts[0], 10);
      const m = parseInt(slashParts[1], 10) - 1;
      let y = parseInt(slashParts[2], 10);
      if (y < 100) y += 2000;
      targetDate = new Date(y, m, d);
    } else {
      const parsed = new Date(raw);
      if (!isNaN(parsed.getTime())) targetDate = parsed;
    }
  }

  if (!targetDate || isNaN(targetDate.getTime())) {
    if (updatedAt) {
      const parsed = new Date(updatedAt);
      if (!isNaN(parsed.getTime())) targetDate = parsed;
    }
  }

  if (!targetDate) return false;

  const now = new Date();
  const diffTime = now.getTime() - targetDate.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  return diffDays > 20;
}

/**
 * Parsea un string de contacto extrayendo teléfono, nombres y apellidos si es posible.
 */
export function parseContactoInitial(raw: string) {
  const trimmed = (raw || '').trim();
  let telefono = '-';
  let nombres = '-';
  let apellidos = '-';

  if (!trimmed) {
    return { contacto: '-', telefono, nombres, apellidos };
  }

  // Solo teléfono (dígitos, espacios, +, -, ())
  const isPhoneOnly = /^[\d\s\+\-\(\)\.]+$/.test(trimmed);
  if (isPhoneOnly) {
    return {
      contacto: trimmed,
      telefono: trimmed,
      nombres: '-',
      apellidos: '-',
    };
  }

  // Si tiene pipe '|'
  if (trimmed.includes('|')) {
    const parts = trimmed.split('|').map((s) => s.trim());
    const namePart = parts[0] || '';
    const phonePart = parts.slice(1).join(' ').trim();
    if (phonePart) telefono = phonePart;
    if (namePart) {
      const words = namePart.split(/\s+/);
      if (words.length === 1) {
        nombres = words[0];
      } else if (words.length >= 2) {
        nombres = words.slice(0, Math.ceil(words.length / 2)).join(' ');
        apellidos = words.slice(Math.ceil(words.length / 2)).join(' ');
      }
    }
    return { contacto: trimmed, telefono, nombres, apellidos };
  }

  // Buscar teléfono dentro del string
  const phoneMatch = trimmed.match(/(\+?\d[\d\s\-\.]{6,}\d)/);
  if (phoneMatch) {
    telefono = phoneMatch[1].trim();
    const namePart = trimmed.replace(phoneMatch[0], '').trim();
    if (namePart) {
      const words = namePart.split(/\s+/);
      if (words.length === 1) {
        nombres = words[0];
      } else if (words.length >= 2) {
        nombres = words.slice(0, Math.ceil(words.length / 2)).join(' ');
        apellidos = words.slice(Math.ceil(words.length / 2)).join(' ');
      }
    }
    return { contacto: trimmed, telefono, nombres, apellidos };
  }

  // Nombre solo
  const words = trimmed.split(/\s+/);
  if (words.length === 1) {
    nombres = words[0];
  } else if (words.length >= 2) {
    nombres = words.slice(0, Math.ceil(words.length / 2)).join(' ');
    apellidos = words.slice(Math.ceil(words.length / 2)).join(' ');
  }

  return { contacto: trimmed, telefono, nombres, apellidos };
}
