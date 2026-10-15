'use client';

import { useState } from 'react';
import CloseIcon from '@mui/icons-material/Close';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { getErrorMessage } from '@/services/apiError';
import { candidateService } from '@/services/candidateService';
import type { DeleteCandidatesResult } from '@/types/candidate';

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
  // Snapshot per opening (the parent remounts with a new key) so the copy doesn't change while the
  // dialog animates closed after the selection is cleared.
  const [targets] = useState(candidates);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const count = targets.length;
  const single = count === 1;

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
      onDeleted(await candidateService.remove(targets.map((candidate) => candidate.id)));
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="sm" aria-labelledby="delete-candidates-title">
      <DialogTitle id="delete-candidates-title" sx={{ pr: 7 }}>
        Delete Candidate
      </DialogTitle>
      <IconButton
        onClick={handleClose}
        disabled={deleting}
        aria-label="Close delete candidate"
        sx={{ position: 'absolute', right: 12, top: 12 }}
      >
        <CloseIcon />
      </IconButton>
      <DialogContent sx={{ pb: 4 }}>
        <Stack spacing={1}>
          {error && <Alert severity="error">{error}</Alert>}
          <Typography variant="body1" sx={{ fontWeight: 500 }}>
            {single
              ? 'Are you sure you want to delete this Candidate?'
              : `Are you sure you want to delete ${count} Candidates?`}
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            This action cannot be undone, and you&apos;ll lose all communication history with{' '}
            {single ? `${targets[0]?.fullName}.` : 'these candidates.'}
          </Typography>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2, borderTop: 1, borderColor: 'divider' }}>
        <Button variant="outlined" onClick={handleClose} disabled={deleting}>
          Cancel
        </Button>
        <Button color="error" variant="contained" onClick={handleDelete} loading={deleting}>
          {single ? 'Delete candidate' : `Delete ${count} candidates`}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
