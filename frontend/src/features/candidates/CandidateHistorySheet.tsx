'use client';

import { useEffect, useState } from 'react';
import CloseIcon from '@mui/icons-material/Close';
import SearchOffIcon from '@mui/icons-material/SearchOff';
import Alert, { type AlertColor } from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import Drawer from '@mui/material/Drawer';
import IconButton from '@mui/material/IconButton';
import Snackbar from '@mui/material/Snackbar';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import EmptyState from '@/components/EmptyState';
import ErrorState from '@/components/ErrorState';
import LoadingState from '@/components/LoadingState';
import MessageHistory from '@/features/messages/MessageHistory';
import ScheduledMessages from '@/features/messages/ScheduledMessages';
import { ApiError, getErrorMessage } from '@/services/apiError';
import { candidateService } from '@/services/candidateService';
import { messageService } from '@/services/messageService';
import type { Candidate } from '@/types/candidate';
import type { Message, ScheduledMessage } from '@/types/message';
import { formatPhone } from '@/utils/format';
import { isInFlight } from '@/utils/messages';

const POLL_INTERVAL_MS = 3000;
// Longest wait before checking again for a scheduled message that is not due yet.
const MAX_SCHEDULE_WAIT_MS = 60 * 60 * 1000;

/** How long to wait before refreshing, or null when nothing is expected to change. */
function nextRefreshDelay({ messages, scheduled }: HistoryData, now: number): number | null {
  const awaiting =
    messages.some((message) => isInFlight(message, now)) ||
    scheduled.some(
      (item) => item.status === 'sending' || (item.status === 'scheduled' && Date.parse(item.scheduledFor) <= now),
    );
  if (awaiting) return POLL_INTERVAL_MS;
  const upcoming = scheduled
    .filter((item) => item.status === 'scheduled')
    .map((item) => Date.parse(item.scheduledFor) - now);
  if (upcoming.length === 0) return null;
  // Wake up when the next one is due; the scheduler sends it within its next pass.
  return Math.min(Math.max(Math.min(...upcoming), POLL_INTERVAL_MS), MAX_SCHEDULE_WAIT_MS);
}

interface HistoryData {
  candidate: Candidate;
  messages: Message[];
  scheduled: ScheduledMessage[];
}

interface LoadError {
  key: number;
  message: string;
  notFound: boolean;
}

interface Notice {
  severity: AlertColor;
  text: string;
}

interface HistoryContentProps {
  candidateId: string;
}

function HistoryContent({ candidateId }: HistoryContentProps) {
  const [refreshToken, setRefreshToken] = useState(0);
  const [data, setData] = useState<HistoryData | null>(null);
  const [loadError, setLoadError] = useState<LoadError | null>(null);
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const latestRequestFailed = loadError?.key === refreshToken;

  useEffect(() => {
    let active = true;
    Promise.all([
      candidateService.get(candidateId),
      messageService.listForCandidate(candidateId),
      messageService.listScheduledForCandidate(candidateId),
    ]).then(
      ([candidate, messages, scheduled]) => {
        if (!active) return;
        setData({ candidate, messages, scheduled });
        setLoadError(null);
      },
      (error: unknown) => {
        if (!active) return;
        setLoadError({
          key: refreshToken,
          message: getErrorMessage(error),
          notFound: error instanceof ApiError && error.status === 404,
        });
      },
    );
    return () => {
      active = false;
    };
  }, [candidateId, refreshToken]);

  useEffect(() => {
    if (!data) return;
    const delay = nextRefreshDelay(data, Date.now());
    if (delay === null) return;
    const timer = setTimeout(() => setRefreshToken((token) => token + 1), delay);
    return () => clearTimeout(timer);
  }, [data, loadError]);

  function refresh() {
    setRefreshToken((token) => token + 1);
  }

  async function handleRetry(message: Message) {
    if (retryingId) return;
    setRetryingId(message.id);
    try {
      const attempt = await messageService.retry(message.id, `retry-${message.id}`);
      setNotice(
        attempt.status === 'failed'
          ? { severity: 'error', text: `Retry failed. ${attempt.failure?.message ?? ''}`.trim() }
          : { severity: 'success', text: 'Message re-sent. Delivery updates appear in the history.' },
      );
    } catch (error) {
      setNotice({ severity: 'error', text: getErrorMessage(error) });
    } finally {
      setRetryingId(null);
      refresh();
    }
  }

  async function handleCancel(item: ScheduledMessage) {
    if (cancellingId) return;
    setCancellingId(item.id);
    try {
      await messageService.cancelScheduled(item.id);
      setNotice({ severity: 'success', text: 'Scheduled message cancelled' });
    } catch (error) {
      setNotice({ severity: 'error', text: getErrorMessage(error) });
    } finally {
      setCancellingId(null);
      refresh();
    }
  }

  if (!data) {
    if (!latestRequestFailed) return <LoadingState label="Loading communication history…" />;
    if (loadError?.notFound) {
      return (
        <EmptyState
          icon={<SearchOffIcon />}
          title="Candidate not found"
          description="This candidate no longer exists or was deleted."
        />
      );
    }
    return (
      <ErrorState title="Couldn't load the history" message={loadError?.message} onRetry={refresh} />
    );
  }

  const { candidate, messages, scheduled } = data;

  return (
    <>
      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
        Candidate ID: {candidate.id}
      </Typography>
      <Typography variant="h1" component="h3" sx={{ mt: 0.5, mb: 0.5, wordBreak: 'break-word' }}>
        {candidate.fullName}
      </Typography>
      <Typography variant="body2">{formatPhone(candidate.phone)}</Typography>
      <Typography variant="body2" sx={{ wordBreak: 'break-word' }}>
        {candidate.email}
      </Typography>

      {latestRequestFailed && (
        <Alert
          severity="warning"
          sx={{ mt: 2 }}
          action={
            <Button color="inherit" size="small" onClick={refresh}>
              Try again
            </Button>
          }
        >
          Couldn&apos;t refresh. Showing the last known statuses.
        </Alert>
      )}

      <Divider sx={{ mt: 2 }} />
      <ScheduledMessages items={scheduled} cancellingId={cancellingId} onCancel={handleCancel} />
      <MessageHistory
        messages={messages}
        retryingId={retryingId}
        onRetry={handleRetry}
        showEmptyState={scheduled.length === 0}
      />

      <Snackbar
        open={notice !== null}
        autoHideDuration={5000}
        onClose={() => setNotice(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert severity={notice?.severity ?? 'success'} onClose={() => setNotice(null)} sx={{ boxShadow: 3 }}>
          {notice?.text}
        </Alert>
      </Snackbar>
    </>
  );
}

interface CandidateHistorySheetProps {
  candidateId: string | null;
  open: boolean;
  onClose: () => void;
}

export default function CandidateHistorySheet({ candidateId, open, onClose }: CandidateHistorySheetProps) {
  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      slotProps={{ paper: { sx: { width: { xs: '100%', sm: 520 } }, 'aria-labelledby': 'history-sheet-title' } }}
    >
      <Stack
        direction="row"
        sx={{ alignItems: 'center', justifyContent: 'space-between', px: 3, pt: 2, pb: 1 }}
      >
        <Typography id="history-sheet-title" variant="h2">
          Communication history
        </Typography>
        <IconButton onClick={onClose} aria-label="Close communication history">
          <CloseIcon />
        </IconButton>
      </Stack>
      <Box sx={{ flex: 1, overflowY: 'auto', px: 3, pb: 3 }}>
        {candidateId && <HistoryContent key={candidateId} candidateId={candidateId} />}
      </Box>
    </Drawer>
  );
}
