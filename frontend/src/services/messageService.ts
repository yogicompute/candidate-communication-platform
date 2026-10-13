import { mockMessageService } from '@/services/mock/mockMessageService';
import type { BulkSendInput, BulkSendResult, Message, SendMessageInput } from '@/types/message';

export interface MessageService {
  listForCandidate(candidateId: string): Promise<Message[]>;
  send(input: SendMessageInput): Promise<Message>;
  sendBulk(input: BulkSendInput): Promise<BulkSendResult>;
  retry(messageId: string, idempotencyKey: string): Promise<Message>;
}

export const messageService: MessageService = mockMessageService;