type DateInput = string | Date | null | undefined;

const pad = (value: number) => String(value).padStart(2, '0');

function toDate(value: DateInput): Date | null {
  if (!value) return null;
  const date = typeof value === 'string' ? new Date(value) : value;
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatDate(value: DateInput): string {
  const date = toDate(value);
  if (!date) return 'NA';
  return `${pad(date.getDate())}-${pad(date.getMonth() + 1)}-${date.getFullYear()}`;
}

export function formatTime(value: DateInput): string {
  const date = toDate(value);
  if (!date) return 'NA';
  const hours = date.getHours();
  return `${hours % 12 || 12}:${pad(date.getMinutes())} ${hours >= 12 ? 'PM' : 'AM'}`;
}

export function formatDateTime(value: DateInput): string {
  const date = toDate(value);
  if (!date) return 'NA';
  return `${formatDate(date)} | ${formatTime(date)}`;
}

export function formatPhone(e164: string): string {
  const match = /^\+91(\d{10})$/.exec(e164);
  return match ? `+91 ${match[1]}` : e164;
}