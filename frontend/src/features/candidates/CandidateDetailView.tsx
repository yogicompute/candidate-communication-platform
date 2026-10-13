'use client';

import { useEffect, useState, type ReactNode } from 'react';
import NextLink from 'next/link';
import SearchOffIcon from '@mui/icons-material/SearchOff';
import Alert, { type AlertColor } from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Link from '@mui/material/Link';
import Paper from '@mui/material/Paper';
import Snackbar from '@mui/material/Snackbar';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import EmptyState from '@/components/EmptyState';
import ErrorState from '@/components/ErrorState';
import LoadingState from '@/components/LoadingState';
import PageHeader from '@/components/PageHeader';
import StatusChip from '@/components/StatusChip';
import MessageHistory from '@/features/messages/MessageHistory';
import SendMessageForm from '@/features/messages/SendMessageForm';
import { ApiError, getErrorMessage } from '@/services/apiError';
import { candidateService } from '@/services/candidateService';
import { messageService } from '@/services/messageService';
import type { Candidate } from '@/types/candidate';
import type { Message } from '@/types/message';
import { formatDateTime, formatPhone } from '@/utils/format';
import { isInFlight } from '@/utils/messages';

const POLL_INTERVAL_MS = 3000;

interface DetailData {
  candidateId: string;
  candidate: Candidate;
  messages: Message[];
}

interface LoadError {
  key: string;
  message: string;
  notFound: boolean;
}

interface Notice {
  severity: AlertColor;
  text: string;
}

interface DetailItemProps {
  label: string;
  children: ReactNode;
}

function DetailItem({ label, children }: DetailItemProps) {
  return (
    <Box sx={{ py: 1.5, '&:not(:last-of-type)': { borderBottom: 1, borderColor: 'divider' } }}>
      <Typography component="dt" variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
        {label}
      </Typography>
      <Typography component="dd" variant="body1" sx={{ m: 0, mt: 0.5, wordBreak: 'break-word' }}>
        {children}
      </Typography>
    </Box>
  );
}

interface CandidateDetailViewProps {
  candidateId: string;
}

export default function CandidateDetailView({ candidateId }: CandidateDetailViewProps) {
  const [refreshToken, setRefreshToken] = useState(0);
  const [data, setData] = useState<DetailData | null>(null);
  const [loadError, setLoadError] = useState<LoadError | null>(null);
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);

  const requestKey = `${candidateId}|${refreshToken}`;
  const current = data?.candidateId === candidateId ? data : null;
  const latestRequestFailed = loadError?.key === requestKey;

  useEffect(() => {
    let active = true;
    Promise.all([candidateService.get(candidateId), messageService.listForCandidate(candidateId)]).then(
      ([candidate, messages]) => {
        if (!active) return;
        setData({ candidateId, candidate, messages });
        setLoadError(null);
      },
      (error: unknown) => {
        if (!active) return;
        setLoadError({
          key: requestKey,
          message: getErrorMessage(error),
          notFound: error instanceof ApiError && error.status === 404,
        });
      },
    );
    return () => {
      active = false;
    };
  }, [candidateId, requestKey]);

  useEffect(() => {
    if (!current) return;
    const now = Date.now();
    if (!current.messages.some((message) => isInFlight(message, now))) return;
    const timer = setTimeout(() => setRefreshToken((token) => token + 1), POLL_INTERVAL_MS);
    return () => clearTimeout(timer);
  }, [current, loadError]);

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

  if (!current) {
    if (!latestRequestFailed) return <LoadingState label="Loading candidate…" />;

    if (loadError?.notFound) {
      return (
        <>
          <PageHeader title="Candidate not found" backHref="/candidates" backLabel="All candidates" />
          <Paper variant="outlined">
            <EmptyState
              icon={<SearchOffIcon />}
              title="We couldn't find this candidate"
              description={`No candidate exists with ID ${candidateId}.`}
              action={
                <Button variant="contained" component={NextLink} href="/candidates">
                  Back to candidates
                </Button>
              }
            />
          </Paper>
        </>
      );
    }

    return (
      <>
        <PageHeader title="Candidate" backHref="/candidates" backLabel="All candidates" />
        <Paper variant="outlined">
          <ErrorState title="Couldn't load this candidate" message={loadError?.message} onRetry={refresh} />
        </Paper>
      </>
    );
  }

  const { candidate, messages } = current;

  return (
    <>
      <PageHeader
        title={candidate.fullName}
        subtitle={`Candidate ID ${candidate.id}`}
        backHref="/candidates"
        backLabel="All candidates"
      />

      {latestRequestFailed && (
        <Alert
          severity="warning"
          sx={{ mb: 2 }}
          action={
            <Button color="inherit" size="small" onClick={refresh}>
              Try again
            </Button>
          }
        >
          Couldn&apos;t refresh this page. Showing the last known statuses.
        </Alert>
      )}

      <Box
        sx={{
          display: 'grid',
          gap: 3,
          gridTemplateColumns: { xs: '1fr', md: '340px 1fr' },
          alignItems: 'start',
        }}
      >
        <Paper variant="outlined" sx={{ px: 3, py: 1 }}>
          <Typography variant="h2" sx={{ pt: 2, pb: 1 }}>
            Contact details
          </Typography>
          <Box component="dl" sx={{ m: 0 }}>
            <DetailItem label="Mobile number">
              <Link href={`tel:${candidate.phone}`} underline="hover">
                {formatPhone(candidate.phone)}
              </Link>
            </DetailItem>
            <DetailItem label="Email">
              <Link href={`mailto:${candidate.email}`} underline="hover">
                {candidate.email}
              </Link>
            </DetailItem>
            <DetailItem label="Added on">{formatDateTime(candidate.createdAt)}</DetailItem>
            <DetailItem label="Last message">
              {candidate.lastMessageAt ? formatDateTime(candidate.lastMessageAt) : 'No messages yet'}
            </DetailItem>
            <DetailItem label="Latest status">
              <StatusChip status={candidate.lastMessageStatus} />
            </DetailItem>
          </Box>
        </Paper>

        <Stack spacing={3} sx={{ minWidth: 0 }}>
          <Paper variant="outlined" sx={{ p: 3 }}>
            <Typography variant="h2" sx={{ mb: 2 }}>
              Send a message
            </Typography>
            <SendMessageForm
              key={candidate.id}
              candidateId={candidate.id}
              candidateName={candidate.fullName}
              onSent={refresh}
            />
          </Paper>

          <Paper variant="outlined" sx={{ p: 3 }}>
            <Stack
              direction="row"
              sx={{ justifyContent: 'space-between', alignItems: 'baseline', mb: 2 }}
            >
              <Typography variant="h2">Communication history</Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                Newest first
              </Typography>
            </Stack>
            <MessageHistory messages={messages} retryingId={retryingId} onRetry={handleRetry} />
          </Paper>
        </Stack>
      </Box>

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