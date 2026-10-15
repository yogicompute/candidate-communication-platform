'use client';

import { useEffect, useRef, useState } from 'react';
import CloseIcon from '@mui/icons-material/Close';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Drawer from '@mui/material/Drawer';
import IconButton from '@mui/material/IconButton';
import FormControlLabel from '@mui/material/FormControlLabel';
import MenuItem from '@mui/material/MenuItem';
import Radio from '@mui/material/Radio';
import RadioGroup from '@mui/material/RadioGroup';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import StatusChip from '@/components/StatusChip';
import MessageTextArea from '@/features/messages/MessageTextArea';
import RecipientChips, { type Recipient } from '@/features/messages/RecipientChips';
import { ApiError, getErrorMessage } from '@/services/apiError';
import { messageService } from '@/services/messageService';
import { templateService } from '@/services/templateService';
import type { BulkRecipientResult, BulkSendResult, ScheduleResult } from '@/types/message';
import type { MessageTemplate } from '@/types/template';
import {
  MAX_BULK_RECIPIENTS,
  createIdempotencyKey,
  summarizeBulkResult,
  validateMessageBody,
  validateScheduleTime,
} from '@/utils/messages';
import { hasPlaceholders, renderPlaceholders } from '@/utils/placeholders';

function RecipientResult({ item }: { item: BulkRecipientResult }) {
  const name = item.candidateName ?? `Unknown candidate (${item.candidateId})`;
  const detail = item.accepted
    ? `Provider reference ${item.message?.providerReference ?? 'not available'}`
    : [item.error, item.message?.canRetry ? 'You can retry from their communication history.' : null]
        .filter(Boolean)
        .join(' ');

  return (
    <Box
      component="li"
      sx={{
        display: 'flex',
        gap: 2,
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        px: 2,
        py: 1.5,
        '&:not(:last-of-type)': { borderBottom: 1, borderColor: 'divider' },
      }}
    >
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="body2" sx={{ fontWeight: 500 }}>
          {name}
        </Typography>
        <Typography
          variant="caption"
          component="p"
          sx={{ color: item.accepted ? 'text.secondary' : 'error.main', wordBreak: 'break-word' }}
        >
          {detail}
        </Typography>
      </Box>
      <StatusChip status={item.message?.status ?? 'failed'} />
    </Box>
  );
}

type SendMode = 'now' | 'schedule';

const pad = (value: number) => String(value).padStart(2, '0');

/** Value for <input type="datetime-local"> in the browser's time zone. */
function toLocalInputValue(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function nextFullHour(): string {
  const date = new Date();
  date.setHours(date.getHours() + 1, 0, 0, 0);
  return toLocalInputValue(date);
}

interface SendMessageSheetProps {
  open: boolean;
  recipients: Recipient[];
  onClose: () => void;
  onBusyChange: (busy: boolean) => void;
  onCompleted: (result: BulkSendResult) => void;
  onScheduled: (result: ScheduleResult) => void;
}

export default function SendMessageSheet({
  open,
  recipients,
  onClose,
  onBusyChange,
  onCompleted,
  onScheduled,
}: SendMessageSheetProps) {
  const [recipientList] = useState(recipients);
  const [body, setBody] = useState('');
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<BulkSendResult | null>(null);
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [templateId, setTemplateId] = useState('');
  const [mode, setMode] = useState<SendMode>('now');
  const [scheduledFor, setScheduledFor] = useState(nextFullHour);
  const [timeError, setTimeError] = useState<string | null>(null);
  const idempotencyKeyRef = useRef<string | null>(null);
  const sendingRef = useRef(false);

  const count = recipientList.length;
  const summary = result ? summarizeBulkResult(result) : null;
  const previewRecipient = recipientList[0];

  useEffect(() => {
    let active = true;
    templateService.list().then(
      (list) => {
        if (active) setTemplates(list);
      },
      () => {
        // The picker is optional; without templates the recruiter just types the message.
      },
    );
    return () => {
      active = false;
    };
  }, []);

  function handleTemplateChange(id: string) {
    setTemplateId(id);
    const template = templates.find((item) => item.id === id);
    if (template) handleBodyChange(template.body);
  }

  function handleBodyChange(value: string) {
    setBody(value);
    setFieldError(null);
    idempotencyKeyRef.current = null;
  }

  // A different mode or time is a different request, so it needs a new idempotency key.
  function handleModeChange(value: SendMode) {
    setMode(value);
    setTimeError(null);
    idempotencyKeyRef.current = null;
  }

  function handleTimeChange(value: string) {
    setScheduledFor(value);
    setTimeError(null);
    idempotencyKeyRef.current = null;
  }

  async function handleSend() {
    if (sendingRef.current) return;
    const error = validateMessageBody(body);
    if (error) {
      setFieldError(error);
      return;
    }
    if (count > MAX_BULK_RECIPIENTS) {
      setRequestError(`You can message up to ${MAX_BULK_RECIPIENTS} candidates at once.`);
      return;
    }
    // datetime-local has no zone; new Date() reads it as the browser's local time.
    const sendAt = mode === 'schedule' ? new Date(scheduledFor) : null;
    if (sendAt) {
      const scheduleError = validateScheduleTime(sendAt);
      if (scheduleError) {
        setTimeError(scheduleError);
        return;
      }
    }
    sendingRef.current = true;
    idempotencyKeyRef.current ??= createIdempotencyKey();
    setSending(true);
    setRequestError(null);
    onBusyChange(true);
    try {
      const request = {
        candidateIds: recipientList.map((recipient) => recipient.id),
        body: body.trim(),
        idempotencyKey: idempotencyKeyRef.current,
      };
      if (sendAt) {
        const scheduled = await messageService.schedule({ ...request, scheduledFor: sendAt.toISOString() });
        idempotencyKeyRef.current = null;
        onScheduled(scheduled);
      } else {
        const response = await messageService.sendBulk(request);
        idempotencyKeyRef.current = null;
        setResult(response);
        onCompleted(response);
      }
    } catch (err) {
      if (err instanceof ApiError && err.status < 500) idempotencyKeyRef.current = null;
      if (err instanceof ApiError && (err.fieldErrors.body || err.fieldErrors.scheduledFor)) {
        setFieldError(err.fieldErrors.body ?? null);
        setTimeError(err.fieldErrors.scheduledFor ?? null);
      } else {
        setRequestError(getErrorMessage(err));
      }
    } finally {
      sendingRef.current = false;
      setSending(false);
      onBusyChange(false);
    }
  }

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      slotProps={{ paper: { sx: { width: { xs: '100%', sm: 520 } }, 'aria-labelledby': 'send-message-title' } }}
    >
      <Stack
        direction="row"
        sx={{ alignItems: 'center', justifyContent: 'space-between', px: 3, pt: 2, pb: 1 }}
      >
        <Typography id="send-message-title" variant="h2">
          Send Message
        </Typography>
        <IconButton onClick={onClose} aria-label="Close send message">
          <CloseIcon />
        </IconButton>
      </Stack>

      <Stack spacing={3} sx={{ flex: 1, overflowY: 'auto', px: 3, pt: 1, pb: 3 }}>
        <Stack spacing={1}>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            {count} Recipient{count === 1 ? '' : 's'}
          </Typography>
          <RecipientChips recipients={recipientList} />
        </Stack>

        {result && summary ? (
          <Stack spacing={2}>
            <Alert severity={summary.severity}>{summary.text}</Alert>
            <Box
              component="ul"
              sx={{ listStyle: 'none', m: 0, p: 0, border: 1, borderColor: 'divider', borderRadius: 1 }}
            >
              {result.results.map((item) => (
                <RecipientResult key={item.candidateId} item={item} />
              ))}
            </Box>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              Delivery and read updates appear in each candidate&apos;s communication history.
            </Typography>
          </Stack>
        ) : (
          <Box>
            {requestError && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {requestError}
              </Alert>
            )}
            {templates.length > 0 && (
              <TextField
                select
                label="Template"
                fullWidth
                value={templateId}
                onChange={(event) => handleTemplateChange(event.target.value)}
                disabled={sending}
                helperText="Fills the message below. You can still edit it."
                sx={{ mb: 2 }}
              >
                {templates.map((template) => (
                  <MenuItem key={template.id} value={template.id}>
                    {template.name}
                  </MenuItem>
                ))}
              </TextField>
            )}
            <Typography component="label" htmlFor="send-message-body" variant="body2" sx={{ fontWeight: 500 }}>
              Message *
            </Typography>
            <Typography variant="caption" component="p" sx={{ color: 'text.secondary', mb: 1 }}>
              Type or paste the message you want to send.
            </Typography>
            <MessageTextArea
              id="send-message-body"
              value={body}
              onChange={handleBodyChange}
              error={fieldError}
              disabled={sending}
              autoFocus
              placeholder="Type or paste here..."
            />
            {previewRecipient && hasPlaceholders(body) && (
              <Box sx={{ mt: 2, p: 2, bgcolor: 'grey.50', border: 1, borderColor: 'divider', borderRadius: 1 }}>
                <Typography variant="caption" component="p" sx={{ color: 'text.secondary', mb: 0.5 }}>
                  Preview for {previewRecipient.fullName}
                  {count > 1 ? ' · each recipient sees their own name' : ''}
                </Typography>
                <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                  {renderPlaceholders(body.trim(), previewRecipient.fullName)}
                </Typography>
              </Box>
            )}
            <RadioGroup
              row
              aria-label="When to send"
              value={mode}
              onChange={(event) => handleModeChange(event.target.value as SendMode)}
              sx={{ mt: 2 }}
            >
              <FormControlLabel value="now" control={<Radio size="small" />} label="Send now" disabled={sending} />
              <FormControlLabel value="schedule" control={<Radio size="small" />} label="Schedule" disabled={sending} />
            </RadioGroup>
            {mode === 'schedule' && (
              <TextField
                type="datetime-local"
                label="Send at"
                value={scheduledFor}
                onChange={(event) => handleTimeChange(event.target.value)}
                error={Boolean(timeError)}
                helperText={timeError ?? 'Your local time. You can cancel it from the communication history.'}
                disabled={sending}
                fullWidth
                sx={{ mt: 1 }}
                slotProps={{ inputLabel: { shrink: true }, htmlInput: { min: toLocalInputValue(new Date()) } }}
              />
            )}
            {sending && mode === 'now' && (
              <Typography variant="caption" component="p" role="status" sx={{ color: 'text.secondary', mt: 1 }}>
                Sending… You can close this panel; sending continues and you&apos;ll see a summary when it
                finishes.
              </Typography>
            )}
          </Box>
        )}
      </Stack>

      <Stack
        direction="row"
        spacing={1}
        sx={{ justifyContent: 'flex-end', px: 3, py: 2, borderTop: 1, borderColor: 'divider' }}
      >
        {result ? (
          <Button variant="contained" onClick={onClose}>
            Done
          </Button>
        ) : (
          <>
            <Button variant="outlined" onClick={onClose}>
              {sending ? 'Close' : 'Cancel'}
            </Button>
            <Button variant="contained" onClick={handleSend} loading={sending} disabled={!body.trim()}>
              {mode === 'schedule' ? 'Schedule message' : 'Send message'}
            </Button>
          </>
        )}
      </Stack>
    </Drawer>
  );
}
