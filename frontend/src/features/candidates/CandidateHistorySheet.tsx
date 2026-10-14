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
import { ApiError, getErrorMessage } from '@/services/apiError';
import { candidateService } from '@/services/candidateService';
import { messageService } from '@/services/messageService';
import type { Candidate } from '@/types/candidate';
import type { Message } from '@/types/message';
import { formatPhone } from '@/utils/format';
import { isInFlight } from '@/utils/messages';

const POLL_INTERVAL_MS = 3000;

interface HistoryData {
  candidate: Candidate;
  messages: Message[];
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
  const [notice, setNotice] = useState<Notice | null>(null);
  const latestRequestFailed = loadError?.key === refreshToken;

  useEffect(() => {
    let active = true;
    Promise.all([candidateService.get(candidateId), messageService.listForCandidate(candidateId)]).then(
      ([candidate, messages]) => {
        if (!active) return;
        setData({ candidate, messages });
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
    const now = Date.now();
    if (!data.messages.some((message) => isInFlight(message, now))) return;
    const timer = setTimeout(() => setRefreshToken((token) => token + 1), POLL_INTERVAL_MS);
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

  const { candidate, messages } = data;

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
      <MessageHistory messages={messages} retryingId={retryingId} onRetry={handleRetry} />

      <Snackbar
        open={notice !== null}
        autoHideDuration={5000}
        onClose={() => setNotice(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity={notice?.severity ?? 'success'} variant="filled" onClose={() => setNotice(null)}>
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
