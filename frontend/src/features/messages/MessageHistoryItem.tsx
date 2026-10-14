import ReplayIcon from '@mui/icons-material/Replay';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import StatusChip from '@/components/StatusChip';
import type { Message } from '@/types/message';
import { formatDate, formatDateTime, formatTime } from '@/utils/format';

const TIMESTAMP_FIELDS = [
  ['sentAt', 'Sent'],
  ['deliveredAt', 'Delivered'],
  ['readAt', 'Read'],
  ['failedAt', 'Failed'],
] as const;

function retryNote(message: Message, retriedAttempt: number | null): string {
  if (retriedAttempt) return `Retried as attempt ${retriedAttempt}.`;
  if (!message.failure?.retryable) return "This is a permanent failure, so it can't be retried.";
  return 'The retry limit for this message has been reached.';
}

function timelineEntry(label: string, value: string, createdAt: string): string {
  const sameDay = formatDate(value) === formatDate(createdAt);
  return `${label} ${sameDay ? formatTime(value) : formatDateTime(value)}`;
}

interface MessageHistoryItemProps {
  message: Message;
  retriedAttempt: number | null;
  retrying: boolean;
  retryDisabled: boolean;
  onRetry: () => void;
}

export default function MessageHistoryItem({
  message,
  retriedAttempt,
  retrying,
  retryDisabled,
  onRetry,
}: MessageHistoryItemProps) {
  const { failure } = message;
  const timeline = TIMESTAMP_FIELDS.flatMap(([field, label]) => {
    const value = message[field];
    return value ? [timelineEntry(label, value, message.createdAt)] : [];
  });

  return (
    <Box component="li" sx={{ py: 2 }}>
      <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap', alignItems: 'center', mb: 1 }}>
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          {formatDateTime(message.createdAt)}
        </Typography>
        {message.attemptNumber > 1 && (
          <Chip size="small" variant="outlined" label={`Retry · attempt ${message.attemptNumber}`} />
        )}
        {message.bulkRequestId && <Chip size="small" variant="outlined" label="Bulk message" />}
        <Box sx={{ ml: 'auto' }}>
          <StatusChip status={message.status} />
        </Box>
      </Stack>

      <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
        {message.body}
      </Typography>

      {timeline.length > 0 && (
        <Typography variant="caption" component="p" sx={{ color: 'text.secondary', mt: 1 }}>
          {timeline.join(' · ')}
        </Typography>
      )}
      {message.providerReference && (
        <Typography variant="caption" component="p" sx={{ color: 'text.secondary' }}>
          Provider reference:{' '}
          <Box component="span" sx={{ fontFamily: 'monospace' }}>
            {message.providerReference}
          </Box>
        </Typography>
      )}

      {failure && (
        <Alert
          severity={failure.retryable ? 'warning' : 'error'}
          sx={{ mt: 1.5 }}
          action={
            message.canRetry && (
              <Button
                color="inherit"
                size="small"
                startIcon={<ReplayIcon />}
                onClick={onRetry}
                loading={retrying}
                disabled={retryDisabled && !retrying}
              >
                Retry
              </Button>
            )
          }
        >
          {failure.message}
          {!message.canRetry && (
            <Box component="span" sx={{ display: 'block', mt: 0.5 }}>
              {retryNote(message, retriedAttempt)}
            </Box>
          )}
        </Alert>
      )}
    </Box>
  );
}
