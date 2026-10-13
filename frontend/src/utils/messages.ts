import type { BulkSendResult, Message } from '@/types/message';

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
  return null;
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
    return { severity: 'success', text: `Message sent to ${plural(total, 'candidate')}.` };
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