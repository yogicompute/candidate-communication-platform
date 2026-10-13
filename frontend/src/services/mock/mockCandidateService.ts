import { ApiError } from '@/services/apiError';
import type { CandidateService } from '@/services/candidateService';
import { getDb, saveDb, simulateNetwork } from '@/services/mock/mockDb';
import type { FieldErrors } from '@/types/api';
import type { Candidate, CandidateInput, CandidateStatusFilter } from '@/types/candidate';
import { hasErrors, normalizeCandidateInput, validateCandidateInput } from '@/utils/validation';

const ID_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const ID_LENGTH = 6;

function generateId(candidates: Candidate[]): string {
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
    const matches = getDb()
      .candidates.filter((c) => matchesSearch(c, search) && matchesStatus(c, status))
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
    const start = (page - 1) * pageSize;
    return {
      items: matches.slice(start, start + pageSize).map((c) => ({ ...c })),
      total: matches.length,
      page,
      pageSize,
    };
  },

  async get(id) {
    await simulateNetwork();
    const candidate = getDb().candidates.find((c) => c.id === id.toUpperCase());
    if (!candidate) {
      throw new ApiError('This candidate does not exist or was removed.', 404);
    }
    return { ...candidate };
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

    const candidate: Candidate = {
      id: generateId(db.candidates),
      ...input,
      createdAt: new Date().toISOString(),
      lastMessageAt: null,
      lastMessageStatus: null,
    };
    db.candidates.push(candidate);
    saveDb();
    return { ...candidate };
  },
};