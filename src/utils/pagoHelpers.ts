/**
 * Utilidades para procesamiento numérico, de fechas y enlaces dinámicos de WhatsApp Business
 * en Pagos, Pendientes y Contactos.
 */

export const WHATSAPP_BUSINESS_NUMBER = '+599 9 661 8899';
export const WHATSAPP_BUSINESS_DIGITS = '59996618899';

/**
 * Extrae y normaliza un número telefónico en formato internacional de solo dígitos para WhatsApp (wa.me).
 * Ignora fechas con formato DD/MM/AA.
 */
export function normalizePhoneForWhatsApp(raw: string | null | undefined): string {
  if (!raw || raw.trim() === '-' || raw.trim() === '') return '';

  // Eliminar posibles fechas tipo DD/MM/YYYY o DD/MM/YY para no confundirlas con teléfonos
  const withoutDates = raw.replace(/\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/g, ' ');

  // Buscar patrón de número telefónico (con o sin código de país +)
  const phoneMatch = withoutDates.match(/(?:\+\d{1,3}[\s\-\.]?)?(?:\(?\d{1,4}\)?[\s\-\.]?){2,6}\d/);
  if (!phoneMatch) return '';

  let digits = phoneMatch[0].replace(/\D/g, '');
  if (digits.startsWith('00')) {
    digits = digits.slice(2);
  }

  if (digits.length < 7 || digits.length > 15) {
    return '';
  }

  // Si es número local de Curazao (7 dígitos, ej. 6618899) -> agregar 5999
  if (digits.length === 7) {
    digits = `5999${digits}`;
  } else if (digits.length === 8 && digits.startsWith('9')) {
    // Ej. 96618899 -> agregar 599
    digits = `599${digits}`;
  }

  return digits;
}

/**
 * Resuelve los dígitos telefónicos de un cliente buscando primero en su teléfono directo,
 * luego en el directorio de contactos y finalmente en el propio texto del contacto.
 */
export function resolveClienteWhatsAppDigits(
  contactoName: string,
  telefonoDirecto?: string | null,
  contactosList?: Array<{ contacto: string; telefono?: string | null }>
): string {
  // 1. Teléfono directo si existe
  const fromDirect = normalizePhoneForWhatsApp(telefonoDirecto);
  if (fromDirect) return fromDirect;

  const cleanName = (contactoName || '').trim().toLowerCase();

  // 2. Buscar en el directorio de contactos
  if (cleanName && contactosList && contactosList.length > 0) {
    const exactMatch = contactosList.find(
      (c) => c.contacto.trim().toLowerCase() === cleanName && c.telefono && c.telefono !== '-'
    );
    if (exactMatch) {
      const fromExact = normalizePhoneForWhatsApp(exactMatch.telefono);
      if (fromExact) return fromExact;
    }

    // Coincidencia parcial (ej. "Mariale Salazar Pax Vzla | 14/10/26" -> "Mariale Salazar Pax Vzla")
    const baseName = cleanName.split('|')[0].split('(')[0].trim();
    if (baseName.length >= 4) {
      const partialMatch = contactosList.find((c) => {
        const cClean = c.contacto.trim().toLowerCase();
        return (
          (cClean === baseName || cClean.startsWith(baseName) || baseName.startsWith(cClean)) &&
          c.telefono &&
          c.telefono !== '-'
        );
      });
      if (partialMatch) {
        const fromPartial = normalizePhoneForWhatsApp(partialMatch.telefono);
        if (fromPartial) return fromPartial;
      }
    }
  }

  // 3. Extraer del propio nombre/identificador del contacto si incluye teléfono
  return normalizePhoneForWhatsApp(contactoName);
}

/**
 * Construye la URL dinámica de WhatsApp (compatible con WhatsApp Web y App Móvil / WhatsApp Business).
 * - Si el cliente tiene número telefónico asociado, abre el chat directo con el cliente (`https://wa.me/<numero_cliente>`).
 * - Si el registro aún no tiene teléfono del cliente, abre WhatsApp Business (`+599 9 661 8899`) con la referencia del cliente lista.
 */
export function buildWhatsAppDynamicLink(
  contactoName: string,
  telefonoDirecto?: string | null,
  contactosList?: Array<{ contacto: string; telefono?: string | null }>,
  extraInfo?: string
): { url: string; hasClientPhone: boolean; targetPhoneDigits: string; label: string } {
  const clientDigits = resolveClienteWhatsAppDigits(contactoName, telefonoDirecto, contactosList);
  const cleanContacto = (contactoName || '').trim() || 'Cliente';

  if (clientDigits) {
    return {
      url: `https://wa.me/${clientDigits}`,
      hasClientPhone: true,
      targetPhoneDigits: clientDigits,
      label: `Abrir chat de WhatsApp con ${cleanContacto} (+${clientDigits})`,
    };
  }

  const refText = extraInfo && extraInfo !== '-' ? `${cleanContacto} - ${extraInfo}` : cleanContacto;
  return {
    url: `https://wa.me/${WHATSAPP_BUSINESS_DIGITS}?text=${encodeURIComponent(refText)}`,
    hasClientPhone: false,
    targetPhoneDigits: WHATSAPP_BUSINESS_DIGITS,
    label: `Abrir WhatsApp Business (${WHATSAPP_BUSINESS_NUMBER}) para ${cleanContacto}`,
  };
}

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
    if (phonePart && normalizePhoneForWhatsApp(phonePart)) {
      telefono = phonePart;
    }
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
