'use client';

import { useState } from 'react';
import DeleteIcon from '@mui/icons-material/Delete';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import Stack from '@mui/material/Stack';
import { getErrorMessage } from '@/services/apiError';
import { candidateService } from '@/services/candidateService';
import type { DeleteCandidatesResult } from '@/types/candidate';

const PREVIEW_LIMIT = 6;

interface DeleteCandidatesDialogProps {
  open: boolean;
  candidates: { id: string; fullName: string }[];
  onClose: () => void;
  onDeleted: (result: DeleteCandidatesResult) => void;
}

export default function DeleteCandidatesDialog({
  open,
  candidates,
  onClose,
  onDeleted,
}: DeleteCandidatesDialogProps) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const count = candidates.length;
  const countLabel = `${count} candidate${count === 1 ? '' : 's'}`;

  function handleClose() {
    if (deleting) return;
    setError(null);
    onClose();
  }

  async function handleDelete() {
    if (deleting) return;
    setDeleting(true);
    setError(null);
    try {
      onDeleted(await candidateService.remove(candidates.map((candidate) => candidate.id)));
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="xs" aria-labelledby="delete-candidates-title">
      <DialogTitle id="delete-candidates-title">Delete {countLabel}?</DialogTitle>
      <DialogContent>
        <Stack spacing={2}>
          {error && <Alert severity="error">{error}</Alert>}
          <DialogContentText>
            They will be removed from your candidate list and can no longer be messaged. Messages
            already sent are kept for your records.
          </DialogContentText>
          <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap' }}>
            {candidates.slice(0, PREVIEW_LIMIT).map((candidate) => (
              <Chip key={candidate.id} size="small" label={candidate.fullName} />
            ))}
            {count > PREVIEW_LIMIT && (
              <Chip size="small" variant="outlined" label={`+${count - PREVIEW_LIMIT} more`} />
            )}
          </Stack>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={handleClose} disabled={deleting}>
          Cancel
        </Button>
        <Button
          color="error"
          variant="contained"
          startIcon={<DeleteIcon />}
          onClick={handleDelete}
          loading={deleting}
        >
          Delete
        </Button>
      </DialogActions>
    </Dialog>
  );
}
