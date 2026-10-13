import ReplayIcon from '@mui/icons-material/Replay';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import StatusChip from '@/components/StatusChip';
import type { Message } from '@/types/message';
import { formatDateTime } from '@/utils/format';

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
  const timeline = TIMESTAMP_FIELDS.filter(([field]) => message[field]).map(
    ([field, label]) => `${label} ${formatDateTime(message[field])}`,
  );

  return (
    <Box component="li" sx={{ border: 1, borderColor: 'divider', borderRadius: 1, p: 2 }}>
      <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap', alignItems: 'center', mb: 1 }}>
        <StatusChip status={message.status} />
        {message.attemptNumber > 1 && (
          <Chip size="small" variant="outlined" label={`Retry · attempt ${message.attemptNumber}`} />
        )}
        {message.bulkRequestId && <Chip size="small" variant="outlined" label="Bulk message" />}
        <Typography variant="caption" sx={{ color: 'text.secondary', ml: 'auto' }}>
          {formatDateTime(message.createdAt)}
        </Typography>
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