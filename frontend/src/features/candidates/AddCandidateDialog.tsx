'use client';

import { useState, type ChangeEvent, type FormEvent } from 'react';
import CloseIcon from '@mui/icons-material/Close';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import { ApiError, getErrorMessage } from '@/services/apiError';
import { candidateService } from '@/services/candidateService';
import type { FieldErrors } from '@/types/api';
import type { Candidate, CandidateInput } from '@/types/candidate';
import {
  EMAIL_MAX_LENGTH,
  NAME_MAX_LENGTH,
  hasErrors,
  normalizeCandidateInput,
  validateCandidateInput,
} from '@/utils/validation';

const EMPTY_FORM: CandidateInput = { fullName: '', phone: '', email: '' };

interface AddCandidateDialogProps {
  open: boolean;
  onClose: () => void;
  onCreated: (candidate: Candidate) => void;
}

export default function AddCandidateDialog({ open, onClose, onCreated }: AddCandidateDialogProps) {
  const [values, setValues] = useState<CandidateInput>(EMPTY_FORM);
  const [errors, setErrors] = useState<FieldErrors<CandidateInput>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function resetForm() {
    setValues(EMPTY_FORM);
    setErrors({});
    setFormError(null);
  }

  function handleClose() {
    if (submitting) return;
    resetForm();
    onClose();
  }

  const handleChange =
    (field: keyof CandidateInput) =>
    (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const { value } = event.target;
      setValues((prev) => ({ ...prev, [field]: value }));
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    };

  const complete = Boolean(values.fullName.trim() && values.phone.trim() && values.email.trim());

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    const input = normalizeCandidateInput(values);
    const validationErrors = validateCandidateInput(input);
    if (hasErrors(validationErrors)) {
      setErrors(validationErrors);
      return;
    }

    setSubmitting(true);
    setFormError(null);
    try {
      const candidate = await candidateService.create(input);
      resetForm();
      onCreated(candidate);
    } catch (error) {
      if (error instanceof ApiError && hasErrors(error.fieldErrors)) {
        setErrors(error.fieldErrors);
      } else {
        setFormError(getErrorMessage(error));
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      fullWidth
      maxWidth="sm"
      aria-labelledby="add-candidate-title"
    >
      <form onSubmit={handleSubmit} noValidate>
        <DialogTitle id="add-candidate-title" sx={{ pr: 7 }}>
          Add Candidate
        </DialogTitle>
        <IconButton
          onClick={handleClose}
          disabled={submitting}
          aria-label="Close add candidate"
          sx={{ position: 'absolute', right: 12, top: 12 }}
        >
          <CloseIcon />
        </IconButton>
        <DialogContent sx={{ pb: 3 }}>
          <Stack spacing={2} sx={{ pt: 1 }}>
            {formError && <Alert severity="error">{formError}</Alert>}
            <TextField
              label="Candidate Name"
              value={values.fullName}
              onChange={handleChange('fullName')}
              error={Boolean(errors.fullName)}
              helperText={errors.fullName}
              required
              autoFocus
              autoComplete="name"
              slotProps={{ htmlInput: { maxLength: NAME_MAX_LENGTH } }}
            />
            <TextField
              label="Mobile Number"
              type="tel"
              value={values.phone}
              onChange={handleChange('phone')}
              error={Boolean(errors.phone)}
              helperText={errors.phone ?? '10-digit mobile number. +91 is added automatically.'}
              required
              autoComplete="tel"
              slotProps={{ htmlInput: { maxLength: 20, inputMode: 'tel' } }}
            />
            <TextField
              label="Email"
              type="email"
              value={values.email}
              onChange={handleChange('email')}
              error={Boolean(errors.email)}
              helperText={errors.email}
              required
              autoComplete="email"
              slotProps={{ htmlInput: { maxLength: EMAIL_MAX_LENGTH } }}
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2, borderTop: 1, borderColor: 'divider' }}>
          <Button variant="outlined" onClick={handleClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" variant="contained" loading={submitting} disabled={!complete}>
            Add candidate
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}