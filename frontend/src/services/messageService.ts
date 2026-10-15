import { API_MODE } from '@/services/config';
import { httpMessageService } from '@/services/http/httpMessageService';
import { mockMessageService } from '@/services/mock/mockMessageService';
import type {
  BulkSendInput,
  BulkSendResult,
  Message,
  ScheduledMessage,
  ScheduleInput,
  ScheduleResult,
  SendMessageInput,
} from '@/types/message';

export interface MessageService {
  listForCandidate(candidateId: string): Promise<Message[]>;
  send(input: SendMessageInput): Promise<Message>;
  sendBulk(input: BulkSendInput): Promise<BulkSendResult>;
  retry(messageId: string, idempotencyKey: string): Promise<Message>;
  schedule(input: ScheduleInput): Promise<ScheduleResult>;
  listScheduledForCandidate(candidateId: string): Promise<ScheduledMessage[]>;
  cancelScheduled(scheduledId: string): Promise<ScheduledMessage>;
}

export const messageService: MessageService = API_MODE === 'http' ? httpMessageService : mockMessageService;