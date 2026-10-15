import { ApiError } from '@/services/apiError';
import type { CandidateService } from '@/services/candidateService';
import { getDb, saveDb, simulateNetwork, type CandidateRecord } from '@/services/mock/mockDb';
import { candidateStatusFor, latestMessageFor, syncMessageStatuses } from '@/services/mock/mockMessageService';
import type { FieldErrors } from '@/types/api';
import type {
  Candidate,
  CandidateInput,
  CandidateListParams,
  CandidateStatusFilter,
} from '@/types/candidate';
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
    lastMessageStatus: candidateStatusFor(record.id, latest),
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

function includesText(value: string, filter?: string): boolean {
  const term = filter?.trim().toLowerCase();
  return !term || value.toLowerCase().includes(term);
}

function matchesFilters(candidate: Candidate, params: CandidateListParams): boolean {
  const phoneDigits = (params.phone ?? '').replace(/\D/g, '');
  const lastAt = candidate.lastMessageAt ? Date.parse(candidate.lastMessageAt) : null;
  if (!includesText(candidate.fullName, params.name) || !includesText(candidate.id, params.candidateId)) {
    return false;
  }
  if (phoneDigits && !candidate.phone.includes(phoneDigits)) return false;
  if (params.lastMessageAfter && (lastAt === null || lastAt < Date.parse(params.lastMessageAfter))) {
    return false;
  }
  if (params.lastMessageBefore && (lastAt === null || lastAt >= Date.parse(params.lastMessageBefore))) {
    return false;
  }
  return matchesSearch(candidate, params.search ?? '') && matchesStatus(candidate, params.status);
}

export const mockCandidateService: CandidateService = {
  async list(params) {
    const { page, pageSize } = params;
    await simulateNetwork();
    syncMessageStatuses();
    const matches = getDb()
      .candidates.map(toCandidate)
      .filter((c) => matchesFilters(c, params))
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

  async remove(ids) {
    await simulateNetwork();
    const requested = Array.from(new Set(ids.map((id) => id.toUpperCase())));
    const db = getDb();
    const existing = new Set(db.candidates.map((c) => c.id));
    const deletedIds = requested.filter((id) => existing.has(id));
    db.candidates = db.candidates.filter((c) => !deletedIds.includes(c.id));
    saveDb();
    return { deletedIds, notFoundIds: requested.filter((id) => !existing.has(id)) };
  },
};