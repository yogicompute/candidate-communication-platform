'use client';

import { useEffect, useState, type ReactNode } from 'react';
import AddIcon from '@mui/icons-material/Add';
import CloseIcon from '@mui/icons-material/Close';
import DeleteOutlinedIcon from '@mui/icons-material/DeleteOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import Alert, { type AlertColor } from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import IconButton from '@mui/material/IconButton';
import Paper from '@mui/material/Paper';
import Snackbar from '@mui/material/Snackbar';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import EmptyIllustration from '@/components/EmptyIllustration';
import EmptyState from '@/components/EmptyState';
import ErrorState from '@/components/ErrorState';
import LoadingState from '@/components/LoadingState';
import PageHeader from '@/components/PageHeader';
import TemplateDialog from '@/features/templates/TemplateDialog';
import { getErrorMessage } from '@/services/apiError';
import { templateService } from '@/services/templateService';
import type { MessageTemplate } from '@/types/template';
import { formatDate } from '@/utils/format';

interface LoadResult {
  key: number;
  data?: MessageTemplate[];
  error?: string;
}

interface Notice {
  severity: AlertColor;
  text: string;
}

interface DeleteTemplateDialogProps {
  template: MessageTemplate | null;
  onClose: () => void;
  onDeleted: (template: MessageTemplate) => void;
}

function DeleteTemplateDialog({ template, onClose, onDeleted }: DeleteTemplateDialogProps) {
  const [target] = useState(template);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    if (!target || deleting) return;
    setDeleting(true);
    setError(null);
    try {
      await templateService.remove(target.id);
      onDeleted(target);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setDeleting(false);
    }
  }

  function handleClose() {
    if (!deleting) onClose();
  }

  return (
    <Dialog open={template !== null} onClose={handleClose} fullWidth maxWidth="sm" aria-labelledby="delete-template-title">
      <DialogTitle id="delete-template-title" sx={{ pr: 7 }}>
        Delete Template
      </DialogTitle>
      <IconButton
        onClick={handleClose}
        disabled={deleting}
        aria-label="Close delete template"
        sx={{ position: 'absolute', right: 12, top: 12 }}
      >
        <CloseIcon />
      </IconButton>
      <DialogContent sx={{ pb: 4 }}>
        <Stack spacing={1}>
          {error && <Alert severity="error">{error}</Alert>}
          <Typography variant="body1" sx={{ fontWeight: 500, wordBreak: 'break-word' }}>
            Are you sure you want to delete &ldquo;{target?.name}&rdquo;?
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            Messages already sent with this template are not affected.
          </Typography>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2, borderTop: 1, borderColor: 'divider' }}>
        <Button variant="outlined" onClick={handleClose} disabled={deleting}>
          Cancel
        </Button>
        <Button color="error" variant="contained" onClick={handleDelete} loading={deleting}>
          Delete template
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default function TemplatesView() {
  const [reloadToken, setReloadToken] = useState(0);
  const [result, setResult] = useState<LoadResult | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorSession, setEditorSession] = useState(0);
  const [editing, setEditing] = useState<MessageTemplate | null>(null);
  const [deleting, setDeleting] = useState<MessageTemplate | null>(null);
  const [deleteSession, setDeleteSession] = useState(0);
  const [notice, setNotice] = useState<Notice | null>(null);

  useEffect(() => {
    let active = true;
    templateService.list().then(
      (data) => {
        if (active) setResult({ key: reloadToken, data });
      },
      (error: unknown) => {
        if (active) setResult({ key: reloadToken, error: getErrorMessage(error) });
      },
    );
    return () => {
      active = false;
    };
  }, [reloadToken]);

  const reload = () => setReloadToken((token) => token + 1);
  const isLoading = result?.key !== reloadToken;
  const data = result?.data;
  const error = isLoading ? null : (result?.error ?? null);

  function openEditor(template: MessageTemplate | null) {
    setEditing(template);
    setEditorSession((session) => session + 1);
    setEditorOpen(true);
  }

  function openDelete(template: MessageTemplate) {
    setDeleteSession((session) => session + 1);
    setDeleting(template);
  }

  function handleSaved(template: MessageTemplate) {
    setEditorOpen(false);
    setNotice({
      severity: 'success',
      text: editing ? `${template.name} updated successfully` : `${template.name} created successfully`,
    });
    reload();
  }

  function handleDeleted(template: MessageTemplate) {
    setDeleting(null);
    setNotice({ severity: 'success', text: `${template.name} deleted successfully` });
    reload();
  }

  let content: ReactNode = null;
  if (!data && isLoading) {
    content = <LoadingState label="Loading templates…" />;
  } else if (error && !data) {
    content = <ErrorState title="Couldn't load templates" message={error} onRetry={reload} />;
  } else if (data && data.length === 0) {
    content = (
      <EmptyState
        icon={<EmptyIllustration />}
        title="No templates yet"
        description="Save a message you send often. Add {{first_name}} or {{candidate_name}} and each candidate sees their own name."
      />
    );
  } else if (data) {
    content = (
      <TableContainer>
        <Table aria-label="Message templates" sx={{ tableLayout: 'fixed' }}>
          <TableHead>
            <TableRow>
              <TableCell sx={{ width: '25%' }}>Name</TableCell>
              <TableCell>Message</TableCell>
              <TableCell sx={{ width: 130 }}>Last updated</TableCell>
              <TableCell sx={{ width: 104 }} align="right">
                Actions
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {data.map((template) => (
              <TableRow key={template.id} hover>
                <TableCell sx={{ fontWeight: 500, wordBreak: 'break-word' }}>{template.name}</TableCell>
                <TableCell>
                  <Typography
                    variant="body2"
                    title={template.body}
                    sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                  >
                    {template.body}
                  </Typography>
                </TableCell>
                <TableCell>{formatDate(template.updatedAt)}</TableCell>
                <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                  <Tooltip title="Edit">
                    <IconButton onClick={() => openEditor(template)} aria-label={`Edit ${template.name}`}>
                      <EditOutlinedIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Delete">
                    <IconButton onClick={() => openDelete(template)} aria-label={`Delete ${template.name}`}>
                      <DeleteOutlinedIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    );
  }

  return (
    <>
      <PageHeader
        title="Message templates"
        actions={
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => openEditor(null)}>
            New template
          </Button>
        }
      />

      <Paper variant="outlined" sx={{ overflow: 'hidden' }}>
        {content}
      </Paper>

      <TemplateDialog
        key={`editor-${editorSession}`}
        open={editorOpen}
        template={editing}
        onClose={() => setEditorOpen(false)}
        onSaved={handleSaved}
      />

      <DeleteTemplateDialog
        key={`delete-${deleteSession}`}
        template={deleting}
        onClose={() => setDeleting(null)}
        onDeleted={handleDeleted}
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
