import { ApiError } from '@/services/apiError';
import type { CandidateService } from '@/services/candidateService';
import { getDb, saveDb, simulateNetwork, type CandidateRecord } from '@/services/mock/mockDb';
import { latestMessageFor, syncMessageStatuses } from '@/services/mock/mockMessageService';
import type { FieldErrors } from '@/types/api';
import type { Candidate, CandidateInput, CandidateStatusFilter } from '@/types/candidate';
import { hasErrors, normalizeCandidateInput, validateCandidateInput } from '@/utils/validation';

const ID_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const ID_LENGTH = 6;

function generateId(candidates: CandidateRecord[]): string {
  const taken = new Set(candidates.map((candidate) => candidate.id));
  let id: string;
  do {
    id = Array.from(
      { length: ID_LENGTH },
      () => ID_ALPHABET[Math.floor(Math.random() * ID_ALPHABET.length)],
    ).join('');
  } while (taken.has(id));
  return id;
}

function toCandidate(record: CandidateRecord): Candidate {
  const latest = latestMessageFor(record.id);
  return {
    ...record,
    lastMessageAt: latest?.createdAt ?? null,
    lastMessageStatus: latest?.status ?? null,
  };
}

function matchesSearch(candidate: Candidate, search: string): boolean {
  const term = search.trim().toLowerCase();
  if (!term) return true;
  const digits = term.replace(/\D/g, '');
  return (
    candidate.fullName.toLowerCase().includes(term) ||
    candidate.email.includes(term) ||
    candidate.id.toLowerCase() === term ||
    (digits.length >= 3 && candidate.phone.includes(digits))
  );
}

function matchesStatus(candidate: Candidate, status?: CandidateStatusFilter): boolean {
  if (!status) return true;
  if (status === 'none') return candidate.lastMessageStatus === null;
  return candidate.lastMessageStatus === status;
}

export const mockCandidateService: CandidateService = {
  async list({ search = '', status, page, pageSize }) {
    await simulateNetwork();
    syncMessageStatuses();
    const matches = getDb()
      .candidates.map(toCandidate)
      .filter((c) => matchesSearch(c, search) && matchesStatus(c, status))
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
    const start = (page - 1) * pageSize;
    return {
      items: matches.slice(start, start + pageSize),
      total: matches.length,
      page,
      pageSize,
    };
  },

  async get(id) {
    await simulateNetwork();
    syncMessageStatuses();
    const record = getDb().candidates.find((c) => c.id === id.toUpperCase());
    if (!record) {
      throw new ApiError('This candidate does not exist or was removed.', 404);
    }
    return toCandidate(record);
  },

  async create(rawInput) {
    await simulateNetwork();
    const input = normalizeCandidateInput(rawInput);
    const errors = validateCandidateInput(input);
    if (hasErrors(errors)) {
      throw new ApiError('Please fix the highlighted fields.', 400, errors);
    }

    const db = getDb();
    const duplicates: FieldErrors<CandidateInput> = {};
    if (db.candidates.some((c) => c.phone === input.phone)) {
      duplicates.phone = 'A candidate with this mobile number already exists.';
    }
    if (db.candidates.some((c) => c.email === input.email)) {
      duplicates.email = 'A candidate with this email already exists.';
    }
    if (hasErrors(duplicates)) {
      throw new ApiError('This candidate already exists.', 409, duplicates);
    }

    const record: CandidateRecord = {
      id: generateId(db.candidates),
      ...input,
      createdAt: new Date().toISOString(),
    };
    db.candidates.push(record);
    saveDb();
    return toCandidate(record);
  },
};