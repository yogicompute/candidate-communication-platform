import {
  CANDIDATE_STATUSES,
  CANDIDATE_STATUS_LABELS,
  type CandidateListParams,
  type CandidateStatusFilter,
} from '@/types/candidate';

export type StatusFilterValue = CandidateStatusFilter | 'all';

export interface CandidateFilters {
  name: string;
  phone: string;
  candidateId: string;
  status: StatusFilterValue;
  lastMessageFrom: string;
  lastMessageTo: string;
}

export interface FilterChip {
  label: string;
  clear: Partial<CandidateFilters>;
}

export const EMPTY_FILTERS: CandidateFilters = {
  name: '',
  phone: '',
  candidateId: '',
  status: 'all',
  lastMessageFrom: '',
  lastMessageTo: '',
};

export const STATUS_FILTER_OPTIONS: { value: StatusFilterValue; label: string }[] = [
  { value: 'all', label: 'All statuses' },
  { value: 'none', label: 'Never messaged' },
  ...CANDIDATE_STATUSES.map((status) => ({ value: status, label: CANDIDATE_STATUS_LABELS[status] })),
];

function startOfLocalDay(date: string, addDays = 0): string {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(year, month - 1, day + addDays).toISOString();
}

const displayDate = (date: string) => date.split('-').reverse().join('-');

export function toListFilters(filters: CandidateFilters): Partial<CandidateListParams> {
  return {
    name: filters.name || undefined,
    phone: filters.phone || undefined,
    candidateId: filters.candidateId || undefined,
    status: filters.status === 'all' ? undefined : filters.status,
    lastMessageAfter: filters.lastMessageFrom ? startOfLocalDay(filters.lastMessageFrom) : undefined,
    lastMessageBefore: filters.lastMessageTo ? startOfLocalDay(filters.lastMessageTo, 1) : undefined,
  };
}

export function activeFilterChips(filters: CandidateFilters): FilterChip[] {
  const chips: FilterChip[] = [];
  if (filters.name) chips.push({ label: `Name: ${filters.name}`, clear: { name: '' } });
  if (filters.phone) chips.push({ label: `Mobile: ${filters.phone}`, clear: { phone: '' } });
  if (filters.lastMessageFrom || filters.lastMessageTo) {
    const from = filters.lastMessageFrom ? displayDate(filters.lastMessageFrom) : 'any';
    const to = filters.lastMessageTo ? displayDate(filters.lastMessageTo) : 'any';
    chips.push({ label: `Last message: ${from} – ${to}`, clear: { lastMessageFrom: '', lastMessageTo: '' } });
  }
  if (filters.status !== 'all') {
    const label = STATUS_FILTER_OPTIONS.find((option) => option.value === filters.status)?.label;
    chips.push({ label: `Status: ${label}`, clear: { status: 'all' } });
  }
  if (filters.candidateId) chips.push({ label: `ID: ${filters.candidateId}`, clear: { candidateId: '' } });
  return chips;
}
