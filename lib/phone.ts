/**
 * Utilidades para normalizar el contacto de un ciudadano cuando es un
 * teléfono argentino. WhatsApp requiere el formato +54 9 <área><número>
 * (código de país 54 + indicador de móvil 9), sin el 0 de larga distancia
 * ni el 15 de celular que la gente suele dictar.
 */

export function isPhoneLike(contact: string): boolean {
  return /^\+?\d{6,15}$/.test(contact.replace(/[\s-]/g, ""));
}

/**
 * Normaliza un número dictado por el ciudadano (con o sin +54, con o sin 9,
 * con o sin el 0 de larga distancia) al formato canónico +549<resto>.
 *
 * No maneja el "15" de celular intercalado después del código de área en
 * números viejos (ej. "011 15-1234-5678") porque la longitud del código de
 * área varía; para el piloto alcanza con los formatos más comunes.
 */
export function normalizeArgentinePhone(raw: string): string {
  let digits = raw.replace(/\D/g, "");

  if (digits.startsWith("54")) digits = digits.slice(2);
  if (digits.startsWith("9")) digits = digits.slice(1);
  if (digits.startsWith("0")) digits = digits.slice(1);

  return `+549${digits}`;
}

/**
 * Normaliza el contacto solo si parece un teléfono; deja emails u otros
 * valores sin tocar.
 */
export function normalizeContact(contact: string): string {
  const trimmed = contact.trim();
  if (trimmed.includes("@")) return trimmed;
  if (!isPhoneLike(trimmed)) return trimmed;
  return normalizeArgentinePhone(trimmed);
}
