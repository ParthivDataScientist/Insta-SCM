const PLACEHOLDER_VALUES = new Set(['-', '--', 'TBD', 'Unknown']);

const pad = (value: number | string): string => String(value).padStart(2, '0');

const normalizeToDate = (value: unknown): Date | null => {
  if (!value || PLACEHOLDER_VALUES.has(value as string)) {
    return null;
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const [year, month, day] = trimmed.split('-').map(Number);
    return new Date(year, month - 1, day);
  }

  if (/^\d{2}-\d{2}-\d{4}$/.test(trimmed)) {
    const [day, month, year] = trimmed.split('-').map(Number);
    return new Date(year, month - 1, day);
  }

  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

export const formatDateDisplay = (value: unknown): string => {
  if (!value || PLACEHOLDER_VALUES.has(value as string)) return value as string;

  const date = normalizeToDate(value);
  if (!date) {
    return String(value);
  }

  return `${pad(date.getDate())}-${pad(date.getMonth() + 1)}-${date.getFullYear()}`;
};

export const formatDateTimeDisplay = (value: unknown): string => {
  if (!value || PLACEHOLDER_VALUES.has(value as string)) return value as string;

  const date = normalizeToDate(value);
  if (!date) {
    return String(value);
  }

  let hours = date.getHours();
  const minutes = pad(date.getMinutes());
  const suffix = hours >= 12 ? 'PM' : 'AM';
  hours %= 12;
  if (hours === 0) {
    hours = 12;
  }

  return `${formatDateDisplay(date)} ${pad(hours)}:${minutes} ${suffix}`;
};

export const formatDateRangeDisplay = (start: unknown, end: unknown): string => {
  if (!start && !end) return '';

  const startLabel = formatDateDisplay(start) || '-';
  const endLabel = formatDateDisplay(end || start) || '-';
  return `${startLabel} to ${endLabel}`;
};

export const parseDateInput = (displayStr: string | null | undefined): string | null => {
  if (!displayStr) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(displayStr)) return displayStr;

  const parts = displayStr.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (!parts) return null;

  const day = parts[1].padStart(2, '0');
  const month = parts[2].padStart(2, '0');
  const year = parts[3];

  return `${year}-${month}-${day}`;
};

export const isValidDisplayDate = (str: string): boolean => {
  return /^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/.test(str);
};

export const getTodayISO = (): string => {
  return new Date().toISOString().split('T')[0];
};
