import type { Metadata } from 'next';
import Paper from '@mui/material/Paper';
import EmptyState from '@/components/EmptyState';
import PageHeader from '@/components/PageHeader';

export const metadata: Metadata = { title: 'Candidate details' };

export default async function CandidateDetailPage({ params }: PageProps<'/candidates/[id]'>) {
  const { id } = await params;

  return (
    <>
      <PageHeader
        title={`Candidate ${id}`}
        subtitle="Details and communication history"
        backHref="/candidates"
        backLabel="All candidates"
      />
      <Paper variant="outlined">
        <EmptyState
          title="No messages yet"
          description="The detail view and message history are built in Phases 2 and 3."
        />
      </Paper>
    </>
  );
}