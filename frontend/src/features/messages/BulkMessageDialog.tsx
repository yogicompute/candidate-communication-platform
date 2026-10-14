'use client';

import { useRef, useState } from 'react';
import SendIcon from '@mui/icons-material/Send';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import LinearProgress from '@mui/material/LinearProgress';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import StatusChip from '@/components/StatusChip';
import MessageBodyField from '@/features/messages/MessageBodyField';
import { ApiError, getErrorMessage } from '@/services/apiError';
import { messageService } from '@/services/messageService';
import type { BulkRecipientResult, BulkSendResult } from '@/types/message';
import {
  MAX_BULK_RECIPIENTS,
  createIdempotencyKey,
  summarizeBulkResult,
  validateMessageBody,
} from '@/utils/messages';

const PREVIEW_LIMIT = 6;

export interface BulkRecipient {
  id: string;
  fullName: string;
}

type Stage = 'compose' | 'confirm' | 'sending' | 'done';

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

interface BulkMessageDialogProps {
  open: boolean;
  recipients: BulkRecipient[];
  onClose: () => void;
  onBusyChange: (busy: boolean) => void;
  onCompleted: (result: BulkSendResult) => void;
}

export default function BulkMessageDialog({
  open,
  recipients,
  onClose,
  onBusyChange,
  onCompleted,
}: BulkMessageDialogProps) {
  const [recipientList] = useState(recipients);
  const [stage, setStage] = useState<Stage>('compose');
  const [body, setBody] = useState('');
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [result, setResult] = useState<BulkSendResult | null>(null);
  const idempotencyKeyRef = useRef<string | null>(null);
  const sendingRef = useRef(false);

  const count = recipientList.length;
  const countLabel = `${count} candidate${count === 1 ? '' : 's'}`;
  const summary = result ? summarizeBulkResult(result) : null;

  function handleBodyChange(value: string) {
    setBody(value);
    setFieldError(null);
    idempotencyKeyRef.current = null;
  }

  function handleReview() {
    const error = validateMessageBody(body);
    if (error) {
      setFieldError(error);
      return;
    }
    if (count > MAX_BULK_RECIPIENTS) {
      setRequestError(`You can message up to ${MAX_BULK_RECIPIENTS} candidates at once.`);
      return;
    }
    setRequestError(null);
    setStage('confirm');
  }

  async function handleSend() {
    if (sendingRef.current) return;
    sendingRef.current = true;
    idempotencyKeyRef.current ??= createIdempotencyKey();
    setStage('sending');
    setRequestError(null);
    onBusyChange(true);
    try {
      const response = await messageService.sendBulk({
        candidateIds: recipientList.map((recipient) => recipient.id),
        body: body.trim(),
        idempotencyKey: idempotencyKeyRef.current,
      });
      idempotencyKeyRef.current = null;
      setResult(response);
      setStage('done');
      onCompleted(response);
    } catch (error) {
      if (error instanceof ApiError && error.status < 500) idempotencyKeyRef.current = null;
      if (error instanceof ApiError && error.fieldErrors.body) {
        setFieldError(error.fieldErrors.body);
        setStage('compose');
      } else {
        setRequestError(getErrorMessage(error));
        setStage('confirm');
      }
    } finally {
      sendingRef.current = false;
      onBusyChange(false);
    }
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm" aria-labelledby="bulk-message-title">
      <DialogTitle id="bulk-message-title">Message {countLabel}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          {stage === 'compose' && (
            <>
              <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap' }}>
                {recipientList.slice(0, PREVIEW_LIMIT).map((recipient) => (
                  <Chip key={recipient.id} size="small" label={recipient.fullName} />
                ))}
                {count > PREVIEW_LIMIT && (
                  <Chip size="small" variant="outlined" label={`+${count - PREVIEW_LIMIT} more`} />
                )}
              </Stack>
              {requestError && <Alert severity="error">{requestError}</Alert>}
              <MessageBodyField value={body} onChange={handleBodyChange} error={fieldError} autoFocus />
            </>
          )}

          {stage === 'confirm' && (
            <>
              <Alert severity="info">
                Each candidate gets their own copy of this message. If sending fails for one
                candidate, the others are still sent.
              </Alert>
              {requestError && <Alert severity="error">{requestError}</Alert>}
              <Box sx={{ p: 2, bgcolor: 'grey.50', border: 1, borderColor: 'divider', borderRadius: 1 }}>
                <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                  {body.trim()}
                </Typography>
              </Box>
            </>
          )}

          {stage === 'sending' && (
            <Box role="status" aria-live="polite">
              <LinearProgress sx={{ mb: 1.5 }} />
              <Typography variant="body2">Sending to {countLabel}…</Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                You can close this window. Sending continues and a summary appears when it finishes.
              </Typography>
            </Box>
          )}

          {stage === 'done' && result && summary && (
            <>
              <Alert severity={summary.severity}>{summary.text}</Alert>
              <Box
                component="ul"
                sx={{
                  listStyle: 'none',
                  m: 0,
                  p: 0,
                  border: 1,
                  borderColor: 'divider',
                  borderRadius: 1,
                  maxHeight: 320,
                  overflowY: 'auto',
                }}
              >
                {result.results.map((item) => (
                  <RecipientResult key={item.candidateId} item={item} />
                ))}
              </Box>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                Delivery and read updates appear in each candidate&apos;s communication history.
              </Typography>
            </>
          )}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        {stage === 'compose' && (
          <>
            <Button onClick={onClose}>Cancel</Button>
            <Button variant="contained" onClick={handleReview}>
              Review
            </Button>
          </>
        )}
        {stage === 'confirm' && (
          <>
            <Button onClick={() => setStage('compose')}>Back</Button>
            <Button variant="contained" endIcon={<SendIcon />} onClick={handleSend}>
              Send to {countLabel}
            </Button>
          </>
        )}
        {stage === 'sending' && <Button onClick={onClose}>Close</Button>}
        {stage === 'done' && (
          <Button variant="contained" onClick={onClose}>
            Done
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}