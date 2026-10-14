import { API_MODE } from '@/services/config';
import { httpMessageService } from '@/services/http/httpMessageService';
import { mockMessageService } from '@/services/mock/mockMessageService';
import type { BulkSendInput, BulkSendResult, Message, SendMessageInput } from '@/types/message';

export interface MessageService {
  listForCandidate(candidateId: string): Promise<Message[]>;
  send(input: SendMessageInput): Promise<Message>;
  sendBulk(input: BulkSendInput): Promise<BulkSendResult>;
  retry(messageId: string, idempotencyKey: string): Promise<Message>;
}

export const messageService: MessageService = API_MODE === 'http' ? httpMessageService : mockMessageService;