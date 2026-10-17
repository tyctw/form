// Keep the text-prefix rule in sync with GAS_Backend.js (standalone Apps Script).
// Quote whitespace/control prefixes too: importers may discard them before parsing formulas.
const UNSAFE_TEXT_PREFIX = /^[\s\u0000-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2060-\u206f=+\-@＝＋－＠]/u;

export function toSpreadsheetCell(value: unknown): string | number | boolean {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'boolean') return value;
  const text = value == null ? '' : String(value);
  return UNSAFE_TEXT_PREFIX.test(text) ? "'" + text : text;
}

export function toCsvCell(value: unknown): string {
  return `"${String(toSpreadsheetCell(value)).replace(/"/g, '""')}"`;
}
