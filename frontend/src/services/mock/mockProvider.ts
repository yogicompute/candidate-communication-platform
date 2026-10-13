import type { StatusEvent } from '@/services/mock/mockDb';
import type { FailureCode, MessageFailure } from '@/types/message';

const PROVIDER_DOWN_KEY = 'ccp:provider-down';

const FAILURES: Record<FailureCode, Omit<MessageFailure, 'code'>> = {
  invalid_number: {
    retryable: false,
    message: "This mobile number can't receive messages. Check the number on the candidate's profile.",
  },
  blocked_recipient: {
    retryable: false,
    message: "The candidate's carrier blocked this message. Try contacting them another way.",
  },
  rate_limited: {
    retryable: true,
    message: 'Too many messages were sent at once. Wait a moment, then retry.',
  },
  provider_unavailable: {
    retryable: true,
    message: 'The messaging service is temporarily unavailable. Try again in a few minutes.',
  },
  delivery_timeout: {
    retryable: true,
    message:
      "The message couldn't be delivered in time. The phone may be off or out of coverage. You can retry.",
  },
};

export type ProviderResult =
  | { accepted: true; reference: string; events: StatusEvent[] }
  | { accepted: false; failure: MessageFailure };

export function failureFor(code: FailureCode): MessageFailure {
  return { code, ...FAILURES[code] };
}

function isProviderDown(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(PROVIDER_DOWN_KEY) === '1';
  } catch {
    return false;
  }
}

function generateReference(): string {
  return `SIM-${crypto.randomUUID().replace(/-/g, '').slice(0, 12).toUpperCase()}`;
}

const reject = (code: FailureCode): ProviderResult => ({ accepted: false, failure: failureFor(code) });

export function submitToProvider(phone: string, attemptNumber: number, submittedAt: number): ProviderResult {
  if (isProviderDown()) return reject('provider_unavailable');

  const lastDigit = phone.slice(-1);
  const isFirstAttempt = attemptNumber === 1;

  if (lastDigit === '9') return reject('invalid_number');
  if (lastDigit === '8' && isFirstAttempt) return reject('provider_unavailable');
  if (lastDigit === '7' && isFirstAttempt) return reject('rate_limited');

  const at = (delayMs: number) => new Date(submittedAt + delayMs).toISOString();
  const sent: StatusEvent = { status: 'sent', at: at(1500) };

  let events: StatusEvent[];
  if (lastDigit === '6') {
    events = [sent, { status: 'failed', at: at(3500), failureCode: 'blocked_recipient' }];
  } else if (lastDigit === '5' && isFirstAttempt) {
    events = [sent, { status: 'failed', at: at(3500), failureCode: 'delivery_timeout' }];
  } else if (lastDigit === '4') {
    events = [sent, { status: 'delivered', at: at(4000) }];
  } else {
    events = [
      sent,
      { status: 'delivered', at: at(4000) },
      { status: 'delivered', at: at(4500) },
      { status: 'sent', at: at(5000) },
      { status: 'read', at: at(8000) },
    ];
  }

  return { accepted: true, reference: generateReference(), events };
}