'use client';

import { useEffect, useState, type ReactNode } from 'react';
import NextLink from 'next/link';
import ForumOutlinedIcon from '@mui/icons-material/ForumOutlined';
import SearchOffIcon from '@mui/icons-material/SearchOff';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Link from '@mui/material/Link';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import EmptyState from '@/components/EmptyState';
import ErrorState from '@/components/ErrorState';
import LoadingState from '@/components/LoadingState';
import PageHeader from '@/components/PageHeader';
import StatusChip from '@/components/StatusChip';
import { ApiError, getErrorMessage } from '@/services/apiError';
import { candidateService } from '@/services/candidateService';
import type { Candidate } from '@/types/candidate';
import { formatDateTime, formatPhone } from '@/utils/format';

interface LoadResult {
  key: string;
  candidate?: Candidate;
  error?: { message: string; notFound: boolean };
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
  const [reloadToken, setReloadToken] = useState(0);
  const [result, setResult] = useState<LoadResult | null>(null);
  const requestKey = `${candidateId}|${reloadToken}`;

  useEffect(() => {
    let active = true;
    candidateService.get(candidateId).then(
      (candidate) => {
        if (active) setResult({ key: requestKey, candidate });
      },
      (error: unknown) => {
        if (!active) return;
        setResult({
          key: requestKey,
          error: {
            message: getErrorMessage(error),
            notFound: error instanceof ApiError && error.status === 404,
          },
        });
      },
    );
    return () => {
      active = false;
    };
  }, [candidateId, requestKey]);

  if (!result || result.key !== requestKey) {
    return <LoadingState label="Loading candidate…" />;
  }

  if (result.error?.notFound) {
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

  if (result.error || !result.candidate) {
    return (
      <>
        <PageHeader title="Candidate" backHref="/candidates" backLabel="All candidates" />
        <Paper variant="outlined">
          <ErrorState
            title="Couldn't load this candidate"
            message={result.error?.message}
            onRetry={() => setReloadToken((token) => token + 1)}
          />
        </Paper>
      </>
    );
  }

  const { candidate } = result;

  return (
    <>
      <PageHeader
        title={candidate.fullName}
        subtitle={`Candidate ID ${candidate.id}`}
        backHref="/candidates"
        backLabel="All candidates"
      />
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
        <Paper variant="outlined" sx={{ p: 3 }}>
          <Typography variant="h2">Communication history</Typography>
          <EmptyState
            icon={<ForumOutlinedIcon />}
            title="No messages to show"
            description="Sending messages and the message history are added in the next phase."
          />
        </Paper>
      </Box>
    </>
  );
}