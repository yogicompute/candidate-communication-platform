'use client';

import { useRef, useState, type FormEvent } from 'react';
import SendIcon from '@mui/icons-material/Send';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import MessageBodyField from '@/features/messages/MessageBodyField';
import { ApiError, getErrorMessage } from '@/services/apiError';
import { messageService } from '@/services/messageService';
import type { Message } from '@/types/message';
import { createIdempotencyKey, validateMessageBody } from '@/utils/messages';

interface Outcome {
  severity: 'success' | 'error';
  text: string;
}

interface SendMessageFormProps {
  candidateId: string;
  candidateName: string;
  onSent: (message: Message) => void;
}

export default function SendMessageForm({ candidateId, candidateName, onSent }: SendMessageFormProps) {
  const [body, setBody] = useState('');
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const idempotencyKeyRef = useRef<string | null>(null);

  function handleBodyChange(value: string) {
    setBody(value);
    setFieldError(null);
    idempotencyKeyRef.current = null;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    const error = validateMessageBody(body);
    if (error) {
      setFieldError(error);
      return;
    }

    idempotencyKeyRef.current ??= createIdempotencyKey();
    setSubmitting(true);
    setOutcome(null);
    try {
      const message = await messageService.send({
        candidateId,
        body: body.trim(),
        idempotencyKey: idempotencyKeyRef.current,
      });
      idempotencyKeyRef.current = null;
      setBody('');
      setOutcome(
        message.status === 'failed'
          ? { severity: 'error', text: `Not sent. ${message.failure?.message ?? ''}`.trim() }
          : { severity: 'success', text: `Message sent to ${candidateName}. Delivery updates appear below.` },
      );
      onSent(message);
    } catch (err) {
      const isTransient = !(err instanceof ApiError) || err.status >= 500;
      if (!isTransient) idempotencyKeyRef.current = null;
      if (err instanceof ApiError && err.fieldErrors.body) {
        setFieldError(err.fieldErrors.body);
      } else {
        setOutcome({ severity: 'error', text: getErrorMessage(err) });
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <Stack spacing={2}>
        {outcome && (
          <Alert severity={outcome.severity} onClose={() => setOutcome(null)}>
            {outcome.text}
          </Alert>
        )}
        <MessageBodyField
          value={body}
          onChange={handleBodyChange}
          error={fieldError}
          disabled={submitting}
        />
        <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Button
            type="submit"
            variant="contained"
            endIcon={<SendIcon />}
            loading={submitting}
            loadingPosition="end"
          >
            Send message
          </Button>
        </Box>
      </Stack>
    </form>
  );
}