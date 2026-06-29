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

function countDigitsBefore(str: string, pos: number): number {
  let count = 0;
  for (let i = 0; i < pos && i < str.length; i++) {
    if (/\d/.test(str[i])) count++;
  }
  return count;
}

function cursorAfterDigits(formatted: string, digitCount: number): number {
  if (digitCount <= 0) return 0;
  let seen = 0;
  for (let i = 0; i < formatted.length; i++) {
    if (/\d/.test(formatted[i])) {
      seen++;
      if (seen === digitCount) return i + 1;
    }
  }
  return formatted.length;
}

export function formatInputWithCursor(
  raw: string,
  cursorPos: number,
): { value: string; cursorPos: number } {
  const digitsBefore = countDigitsBefore(raw, cursorPos);
  const value = formatInputDigits(raw);
  return { value, cursorPos: cursorAfterDigits(value, digitsBefore) };
}
