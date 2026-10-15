'use client';

import { useState, type FormEvent } from 'react';
import CloseIcon from '@mui/icons-material/Close';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import MessageTextArea from '@/features/messages/MessageTextArea';
import { ApiError, getErrorMessage } from '@/services/apiError';
import { templateService } from '@/services/templateService';
import type { FieldErrors } from '@/types/api';
import type { MessageTemplate, TemplateInput } from '@/types/template';
import { TEMPLATE_NAME_MAX_LENGTH, validateTemplateInput } from '@/utils/templates';

interface TemplateDialogProps {
  open: boolean;
  /** The template being edited, or null to create one. */
  template: MessageTemplate | null;
  onClose: () => void;
  onSaved: (template: MessageTemplate) => void;
}

export default function TemplateDialog({ open, template, onClose, onSaved }: TemplateDialogProps) {
  const [values, setValues] = useState<TemplateInput>({
    name: template?.name ?? '',
    body: template?.body ?? '',
  });
  const [errors, setErrors] = useState<FieldErrors<TemplateInput>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const editing = template !== null;
  const complete = Boolean(values.name.trim() && values.body.trim());

  function handleClose() {
    if (!saving) onClose();
  }

  function update(field: keyof TemplateInput, value: string) {
    setValues((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: undefined }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    const input = { name: values.name.trim(), body: values.body.trim() };
    const validation = validateTemplateInput(input);
    if (validation.name || validation.body) {
      setErrors(validation);
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      onSaved(template ? await templateService.update(template.id, input) : await templateService.create(input));
    } catch (error) {
      if (error instanceof ApiError && (error.fieldErrors.name || error.fieldErrors.body)) {
        setErrors(error.fieldErrors);
      } else {
        setFormError(getErrorMessage(error));
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="sm" aria-labelledby="template-dialog-title">
      <form onSubmit={handleSubmit} noValidate>
        <DialogTitle id="template-dialog-title" sx={{ pr: 7 }}>
          {editing ? 'Edit Template' : 'New Template'}
        </DialogTitle>
        <IconButton
          onClick={handleClose}
          disabled={saving}
          aria-label="Close template"
          sx={{ position: 'absolute', right: 12, top: 12 }}
        >
          <CloseIcon />
        </IconButton>
        <DialogContent sx={{ pb: 3 }}>
          <Stack spacing={2} sx={{ pt: 1 }}>
            {formError && <Alert severity="error">{formError}</Alert>}
            <TextField
              label="Template Name"
              value={values.name}
              onChange={(event) => update('name', event.target.value)}
              error={Boolean(errors.name)}
              helperText={errors.name}
              required
              autoFocus
              slotProps={{ htmlInput: { maxLength: TEMPLATE_NAME_MAX_LENGTH } }}
            />
            <Box>
              <Typography component="label" htmlFor="template-body" variant="body2" sx={{ fontWeight: 500 }}>
                Message *
              </Typography>
              <Typography variant="caption" component="p" sx={{ color: 'text.secondary', mb: 1 }}>
                {'{{candidate_name}}'} and {'{{first_name}}'} are replaced with each candidate&apos;s name
                when the message is sent.
              </Typography>
              <MessageTextArea
                id="template-body"
                value={values.body}
                onChange={(value) => update('body', value)}
                error={errors.body}
                disabled={saving}
                placeholder="Hi {{first_name}}, …"
              />
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2, borderTop: 1, borderColor: 'divider' }}>
          <Button variant="outlined" onClick={handleClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" variant="contained" loading={saving} disabled={!complete}>
            {editing ? 'Save changes' : 'Create template'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
