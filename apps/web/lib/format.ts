export const MIN_GUESS_AMOUNT = 1000;

export function parseAmount(raw: string): number | null {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return null;
  return parseInt(digits, 10);
}

export function formatInputDigits(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";
  return new Intl.NumberFormat("nl-NL").format(parseInt(digits, 10));
}
