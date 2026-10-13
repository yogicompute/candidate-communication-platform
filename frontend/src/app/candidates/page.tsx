import type { Metadata } from 'next';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import SendIcon from '@mui/icons-material/Send';
import Button from '@mui/material/Button';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import EmptyState from '@/components/EmptyState';
import PageHeader from '@/components/PageHeader';
import StatusChip from '@/components/StatusChip';
import { MESSAGE_STATUSES } from '@/types/message';

export const metadata: Metadata = { title: 'Candidates' };

export default function CandidatesPage() {
  return (
    <>
      <PageHeader
        title="Candidate communication"
        actions={
          <>
            <Button variant="outlined" startIcon={<AddIcon />}>
              Add candidate
            </Button>
            <Button variant="contained" startIcon={<DeleteIcon />} disabled>
              Delete candidate
            </Button>
            <Button variant="contained" startIcon={<SendIcon />} disabled>
              Send message
            </Button>
          </>
        }
      />
      <Paper variant="outlined" sx={{ p: 3 }}>
        <Typography variant="h2" sx={{ mb: 2 }}>
          Status chips
        </Typography>
        <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap', alignItems: 'center' }}>
          {MESSAGE_STATUSES.map((status) => (
            <StatusChip key={status} status={status} />
          ))}
          <StatusChip status={null} />
        </Stack>
        <EmptyState
          title="No candidates yet"
          description="The candidate list is built in Phase 2."
        />
      </Paper>
    </>
  );
}