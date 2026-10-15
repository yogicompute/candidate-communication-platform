import { apiRequest } from '@/services/http/apiClient';
import type {
  BulkSendDto,
  BulkSendResultDto,
  MessageDto,
  MessageListDto,
  ScheduledMessageDto,
  ScheduledMessageListDto,
  ScheduleDto,
  ScheduleResultDto,
  SendMessageDto,
} from '@/services/http/apiTypes';
import { endpoints } from '@/services/http/endpoints';
import { toBulkSendResult, toMessage, toScheduledMessage, toScheduleResult } from '@/services/http/mappers';
import type { MessageService } from '@/services/messageService';

export const httpMessageService: MessageService = {
  async listForCandidate(candidateId) {
    const dto = await apiRequest<MessageListDto>(endpoints.candidateMessages(candidateId));
    return dto.results.map(toMessage);
  },

  async send({ candidateId, body, idempotencyKey }) {
    const payload: SendMessageDto = { candidate_id: candidateId, body };
    const dto = await apiRequest<MessageDto>(endpoints.messages(), {
      method: 'POST',
      body: payload,
      idempotencyKey,
    });
    return toMessage(dto);
  },

  async sendBulk({ candidateIds, body, idempotencyKey }) {
    const payload: BulkSendDto = { candidate_ids: candidateIds, body };
    const dto = await apiRequest<BulkSendResultDto>(endpoints.bulkMessages(), {
      method: 'POST',
      body: payload,
      idempotencyKey,
    });
    return toBulkSendResult(dto);
  },

  async retry(messageId, idempotencyKey) {
    const dto = await apiRequest<MessageDto>(endpoints.retryMessage(messageId), {
      method: 'POST',
      idempotencyKey,
    });
    return toMessage(dto);
  },

  async schedule({ candidateIds, body, scheduledFor, idempotencyKey }) {
    const payload: ScheduleDto = { candidate_ids: candidateIds, body, scheduled_for: scheduledFor };
    const dto = await apiRequest<ScheduleResultDto>(endpoints.scheduleMessages(), {
      method: 'POST',
      body: payload,
      idempotencyKey,
    });
    return toScheduleResult(dto);
  },

  async listScheduledForCandidate(candidateId) {
    const dto = await apiRequest<ScheduledMessageListDto>(endpoints.candidateScheduled(candidateId));
    return dto.results.map(toScheduledMessage);
  },

  async cancelScheduled(scheduledId) {
    const dto = await apiRequest<ScheduledMessageDto>(endpoints.cancelScheduled(scheduledId), { method: 'POST' });
    return toScheduledMessage(dto);
  },
};