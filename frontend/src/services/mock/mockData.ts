import type { CandidateRecord, MessageRecord } from '@/services/mock/mockDb';
import { failureFor } from '@/services/mock/mockProvider';

export const SEED_CANDIDATES: CandidateRecord[] = [
  { id: 'A1B2C3', fullName: 'Krishna Khandelwal', phone: '+919876543210', email: 'krishna.khandelwal@example.com', createdAt: '2026-10-10T09:00:00+05:30' },
  { id: 'D4E5F6', fullName: 'Urvashi Soni', phone: '+919123456789', email: 'urvashi.soni@example.com', createdAt: '2026-10-09T09:00:00+05:30' },
  { id: 'G7H8I9', fullName: 'Aditya Kumar', phone: '+919988766554', email: 'aditya.kumar@example.com', createdAt: '2026-10-08T09:00:00+05:30' },
  { id: 'J1K2L3', fullName: 'Ajit Srivastava', phone: '+919234567890', email: 'ajit.srivastava@example.com', createdAt: '2026-10-07T09:00:00+05:30' },
  { id: 'M4N5O6', fullName: 'Aniket Sawant', phone: '+919876512345', email: 'aniket.sawant@example.com', createdAt: '2026-10-06T09:00:00+05:30' },
  { id: 'P7Q8R9', fullName: 'Ira Akbar', phone: '+919456789012', email: 'ira.akbar@example.com', createdAt: '2026-10-05T09:00:00+05:30' },
  { id: 'S1T2U3', fullName: 'Amarjeet Kumar', phone: '+919012345678', email: 'amarjeet.kumar@example.com', createdAt: '2026-10-04T09:00:00+05:30' },
  { id: 'V4W5X6', fullName: 'Neha Sharma', phone: '+919811122233', email: 'neha.sharma@example.com', createdAt: '2026-10-03T09:00:00+05:30' },
  { id: 'Y7Z8A9', fullName: 'Rohan Mehta', phone: '+919822233344', email: 'rohan.mehta@example.com', createdAt: '2026-10-02T09:00:00+05:30' },
  { id: 'B1C2D3', fullName: 'Priya Nair', phone: '+919833344455', email: 'priya.nair@example.com', createdAt: '2026-10-01T09:00:00+05:30' },
  { id: 'E4F5G6', fullName: 'Sameer Khan', phone: '+919844455566', email: 'sameer.khan@example.com', createdAt: '2026-09-30T09:00:00+05:30' },
  { id: 'H7J8K9', fullName: 'Kavya Iyer', phone: '+919855566677', email: 'kavya.iyer@example.com', createdAt: '2026-09-29T09:00:00+05:30' },
];

type SeedFields = Pick<MessageRecord, 'id' | 'candidateId' | 'body' | 'status' | 'createdAt'> &
  Partial<MessageRecord>;

function seedMessage(fields: SeedFields): MessageRecord {
  const record: MessageRecord = {
    providerReference: null,
    bulkRequestId: null,
    attemptNumber: 1,
    retryOfId: null,
    retriedById: null,
    failure: null,
    sentAt: null,
    deliveredAt: null,
    readAt: null,
    failedAt: null,
    updatedAt: fields.createdAt,
    ...fields,
  };
  record.updatedAt =
    record.readAt ?? record.deliveredAt ?? record.failedAt ?? record.sentAt ?? record.createdAt;
  return record;
}

const INTERVIEW_INVITE =
  'Hi, thanks for applying for the Frontend Engineer role. Are you available for a 30-minute call this week?';
const DOCUMENT_REMINDER =
  'Hi, a quick reminder to upload your updated resume and ID proof before Friday.';

export const SEED_MESSAGES: MessageRecord[] = [
  seedMessage({
    id: 'msg_seed_01',
    candidateId: 'A1B2C3',
    body: INTERVIEW_INVITE,
    status: 'failed',
    createdAt: '2026-10-12T10:30:00+05:30',
    failedAt: '2026-10-12T10:30:00+05:30',
    failure: failureFor('provider_unavailable'),
    retriedById: 'msg_seed_02',
  }),
  seedMessage({
    id: 'msg_seed_02',
    candidateId: 'A1B2C3',
    body: INTERVIEW_INVITE,
    status: 'read',
    attemptNumber: 2,
    retryOfId: 'msg_seed_01',
    providerReference: 'SIM-7K2M9Q4XAB01',
    createdAt: '2026-10-12T10:42:00+05:30',
    sentAt: '2026-10-12T10:42:02+05:30',
    deliveredAt: '2026-10-12T10:42:05+05:30',
    readAt: '2026-10-12T11:05:00+05:30',
  }),
  seedMessage({
    id: 'msg_seed_03',
    candidateId: 'D4E5F6',
    body: INTERVIEW_INVITE,
    status: 'failed',
    createdAt: '2026-10-13T11:15:00+05:30',
    failedAt: '2026-10-13T11:15:00+05:30',
    failure: failureFor('invalid_number'),
  }),
  seedMessage({
    id: 'msg_seed_04',
    candidateId: 'G7H8I9',
    body: DOCUMENT_REMINDER,
    status: 'read',
    providerReference: 'SIM-3D8F1H6JKL02',
    createdAt: '2026-10-11T16:45:00+05:30',
    sentAt: '2026-10-11T16:45:02+05:30',
    deliveredAt: '2026-10-11T16:45:06+05:30',
    readAt: '2026-10-11T17:10:00+05:30',
  }),
  seedMessage({
    id: 'msg_seed_05',
    candidateId: 'J1K2L3',
    body: INTERVIEW_INVITE,
    status: 'read',
    providerReference: 'SIM-9P2Q5R8STU03',
    createdAt: '2026-10-12T09:20:00+05:30',
    sentAt: '2026-10-12T09:20:02+05:30',
    deliveredAt: '2026-10-12T09:20:05+05:30',
    readAt: '2026-10-12T09:41:00+05:30',
  }),
  seedMessage({
    id: 'msg_seed_06',
    candidateId: 'M4N5O6',
    body: DOCUMENT_REMINDER,
    status: 'sent',
    providerReference: 'SIM-4V7W1X3YZA04',
    createdAt: '2026-10-13T14:05:00+05:30',
    sentAt: '2026-10-13T14:05:02+05:30',
  }),
  seedMessage({
    id: 'msg_seed_07',
    candidateId: 'V4W5X6',
    body: INTERVIEW_INVITE,
    status: 'pending',
    providerReference: 'SIM-6B9C2D5EFG05',
    createdAt: '2026-10-13T17:30:00+05:30',
  }),
  seedMessage({
    id: 'msg_seed_08',
    candidateId: 'Y7Z8A9',
    body: DOCUMENT_REMINDER,
    status: 'delivered',
    providerReference: 'SIM-8H1J4K7LMN06',
    createdAt: '2026-10-11T12:10:00+05:30',
    sentAt: '2026-10-11T12:10:02+05:30',
    deliveredAt: '2026-10-11T12:10:07+05:30',
  }),
  seedMessage({
    id: 'msg_seed_09',
    candidateId: 'E4F5G6',
    body: INTERVIEW_INVITE,
    status: 'failed',
    createdAt: '2026-10-10T15:00:00+05:30',
    failedAt: '2026-10-10T15:00:00+05:30',
    failure: failureFor('rate_limited'),
  }),
  seedMessage({
    id: 'msg_seed_10',
    candidateId: 'H7J8K9',
    body: DOCUMENT_REMINDER,
    status: 'sent',
    providerReference: 'SIM-2P5Q8R1STU07',
    createdAt: '2026-10-12T18:40:00+05:30',
    sentAt: '2026-10-12T18:40:02+05:30',
  }),
];