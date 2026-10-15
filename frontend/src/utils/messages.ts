import type { BulkSendResult, Message, ScheduleResult } from '@/types/message';
import { formatDateTime } from '@/utils/format';
import { placeholderError } from '@/utils/placeholders';

export const MESSAGE_MAX_LENGTH = 1000;
export const MAX_BULK_RECIPIENTS = 100;
export const MAX_ATTEMPTS = 3;

const IN_FLIGHT_WINDOW_MS = 2 * 60 * 1000;

export function validateMessageBody(body: string): string | null {
  const text = body.trim();
  if (!text) return 'Write a message before sending.';
  if (text.length > MESSAGE_MAX_LENGTH) {
    return `Messages can be up to ${MESSAGE_MAX_LENGTH} characters.`;
  }
  return placeholderError(text);
}

export function isInFlight(message: Message, now: number): boolean {
  const awaitingUpdate =
    message.status === 'pending' || message.status === 'sent' || message.status === 'delivered';
  return awaitingUpdate && now - Date.parse(message.updatedAt) < IN_FLIGHT_WINDOW_MS;
}

export function createIdempotencyKey(): string {
  return crypto.randomUUID();
}

const plural = (count: number, noun: string) => `${count} ${noun}${count === 1 ? '' : 's'}`;

export function summarizeBulkResult(result: BulkSendResult): {
  severity: 'success' | 'warning' | 'error';
  text: string;
} {
  const { total, acceptedCount, failedCount } = result;
  if (failedCount === 0) {
    return { severity: 'success', text: `Message sent to ${plural(total, 'candidate')}` };
  }
  if (acceptedCount === 0) {
    return {
      severity: 'error',
      text: `Message could not be sent. All ${plural(total, 'recipient')} failed.`,
    };
  }
  return {
    severity: 'warning',
    text: `Sent to ${acceptedCount} of ${plural(total, 'candidate')}. ${failedCount} failed.`,
  };
}
const MAX_SCHEDULE_AHEAD_MS = 365 * 24 * 60 * 60 * 1000;

/** Mirrors the backend rule: strictly in the future and at most a year ahead. */
export function validateScheduleTime(value: string | Date, now = Date.now()): string | null {
  const time = typeof value === 'string' ? Date.parse(value) : value.getTime();
  if (Number.isNaN(time)) return 'Choose a valid date and time.';
  if (time <= now) return 'Choose a time in the future.';
  if (time > now + MAX_SCHEDULE_AHEAD_MS) return 'You can schedule up to a year ahead.';
  return null;
}

export function summarizeScheduleResult(result: ScheduleResult): {
  severity: 'success' | 'warning';
  text: string;
} {
  const when = formatDateTime(result.scheduledFor);
  if (result.failedCount === 0) {
    return { severity: 'success', text: `Message scheduled for ${plural(result.total, 'candidate')} · ${when}` };
  }
  return {
    severity: 'warning',
    text: `Scheduled for ${result.acceptedCount} of ${plural(result.total, 'candidate')} · ${when}. ${result.failedCount} no longer exist.`,
  };
}
