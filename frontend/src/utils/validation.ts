import type { FieldErrors } from '@/types/api';
import type { CandidateInput } from '@/types/candidate';

export const NAME_MAX_LENGTH = 100;
export const EMAIL_MAX_LENGTH = 254;

const E164_PATTERN = /^\+[1-9]\d{7,14}$/;
const INDIAN_MOBILE_PATTERN = /^\+91[6-9]\d{9}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function normalizePhone(raw: string): string {
  const compact = raw.replace(/[\s()-]/g, '');
  if (/^\d{10}$/.test(compact)) return `+91${compact}`;
  if (/^0\d{10}$/.test(compact)) return `+91${compact.slice(1)}`;
  if (/^91\d{10}$/.test(compact)) return `+${compact}`;
  return compact;
}

export function normalizeCandidateInput(input: CandidateInput): CandidateInput {
  return {
    fullName: input.fullName.trim().replace(/\s+/g, ' '),
    phone: normalizePhone(input.phone),
    email: input.email.trim().toLowerCase(),
  };
}

export function validateCandidateInput(input: CandidateInput): FieldErrors<CandidateInput> {
  const errors: FieldErrors<CandidateInput> = {};
  const { fullName, phone, email } = input;

  if (!fullName) {
    errors.fullName = "Enter the candidate's full name.";
  } else if (fullName.length < 2) {
    errors.fullName = 'Name must be at least 2 characters.';
  } else if (fullName.length > NAME_MAX_LENGTH) {
    errors.fullName = `Name must be ${NAME_MAX_LENGTH} characters or fewer.`;
  } else if (/\d/.test(fullName)) {
    errors.fullName = 'Name should not contain numbers.';
  }

  const isInvalidIndianNumber = phone.startsWith('+91') && !INDIAN_MOBILE_PATTERN.test(phone);
  if (!phone) {
    errors.phone = 'Enter a mobile number.';
  } else if (!E164_PATTERN.test(phone) || isInvalidIndianNumber) {
    errors.phone = 'Enter a valid mobile number, e.g. 9876543210 or +91 9876543210.';
  }

  if (!email) {
    errors.email = 'Enter an email address.';
  } else if (email.length > EMAIL_MAX_LENGTH || !EMAIL_PATTERN.test(email)) {
    errors.email = 'Enter a valid email address.';
  }

  return errors;
}

export function hasErrors(errors: Partial<Record<string, string>>): boolean {
  return Object.values(errors).some(Boolean);
}