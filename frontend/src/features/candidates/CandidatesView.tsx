'use client';

import { useEffect, useState, type ReactNode } from 'react';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import SearchIcon from '@mui/icons-material/Search';
import SendIcon from '@mui/icons-material/Send';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import InputAdornment from '@mui/material/InputAdornment';
import LinearProgress from '@mui/material/LinearProgress';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Snackbar from '@mui/material/Snackbar';
import Stack from '@mui/material/Stack';
import TablePagination from '@mui/material/TablePagination';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import EmptyState from '@/components/EmptyState';
import ErrorState from '@/components/ErrorState';
import LoadingState from '@/components/LoadingState';
import PageHeader from '@/components/PageHeader';
import AddCandidateDialog from '@/features/candidates/AddCandidateDialog';
import CandidateTable from '@/features/candidates/CandidateTable';
import { getErrorMessage } from '@/services/apiError';
import { candidateService } from '@/services/candidateService';
import type { Paginated } from '@/types/api';
import type { Candidate, CandidateStatusFilter } from '@/types/candidate';
import { MESSAGE_STATUSES, MESSAGE_STATUS_LABELS } from '@/types/message';

const PAGE_SIZE = 10;
const SEARCH_DEBOUNCE_MS = 300;

type StatusFilterValue = CandidateStatusFilter | 'all';

const STATUS_FILTER_OPTIONS: { value: StatusFilterValue; label: string }[] = [
  { value: 'all', label: 'All statuses' },
  { value: 'none', label: 'Never messaged' },
  ...MESSAGE_STATUSES.map((status) => ({ value: status, label: MESSAGE_STATUS_LABELS[status] })),
];

interface LoadResult {
  key: string;
  data?: Paginated<Candidate>;
  error?: string;
}

export default function CandidatesView() {
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilterValue>('all');
  const [page, setPage] = useState(0);
  const [reloadToken, setReloadToken] = useState(0);
  const [result, setResult] = useState<LoadResult | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const requestKey = [search, statusFilter, page, reloadToken].join('|');

  useEffect(() => {
    const next = searchInput.trim();
    if (next === search) return;
    const timer = setTimeout(() => {
      setSearch(next);
      setPage(0);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchInput, search]);

  useEffect(() => {
    let active = true;
    candidateService
      .list({
        search,
        status: statusFilter === 'all' ? undefined : statusFilter,
        page: page + 1,
        pageSize: PAGE_SIZE,
      })
      .then(
        (data) => {
          if (active) setResult({ key: requestKey, data });
        },
        (error: unknown) => {
          if (active) setResult({ key: requestKey, error: getErrorMessage(error) });
        },
      );
    return () => {
      active = false;
    };
  }, [requestKey, search, statusFilter, page]);

  const isLoading = result?.key !== requestKey;
  const data = result?.data;
  const error = isLoading ? null : (result?.error ?? null);
  const hasFilters = search !== '' || statusFilter !== 'all';

  function reload() {
    setReloadToken((token) => token + 1);
  }

  function clearFilters() {
    setSearchInput('');
    setSearch('');
    setStatusFilter('all');
    setPage(0);
  }

  function toggleOne(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function toggleAll(ids: string[], checked: boolean) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const id of ids) {
        if (checked) {
          next.add(id);
        } else {
          next.delete(id);
        }
      }
      return next;
    });
  }

  function handleCreated(candidate: Candidate) {
    setDialogOpen(false);
    setNotice(`${candidate.fullName} was added.`);
    clearFilters();
    reload();
  }

  let content: ReactNode = null;
  if (!data && isLoading) {
    content = <LoadingState label="Loading candidates…" />;
  } else if (error) {
    content = <ErrorState title="Couldn't load candidates" message={error} onRetry={reload} />;
  } else if (data && data.items.length === 0) {
    content = hasFilters ? (
      <EmptyState
        title="No matching candidates"
        description="Try a different name, mobile number or email, or clear the filters."
        action={<Button onClick={clearFilters}>Clear filters</Button>}
      />
    ) : (
      <EmptyState
        title="No candidates yet"
        description="Add your first candidate to start messaging."
        action={
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setDialogOpen(true)}>
            Add candidate
          </Button>
        }
      />
    );
  } else if (data) {
    content = (
      <>
        <CandidateTable
          candidates={data.items}
          selectedIds={selectedIds}
          onToggle={toggleOne}
          onToggleAll={toggleAll}
        />
        <TablePagination
          component="div"
          count={data.total}
          page={page}
          rowsPerPage={PAGE_SIZE}
          rowsPerPageOptions={[]}
          onPageChange={(_, nextPage) => setPage(nextPage)}
        />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Candidate communication"
        actions={
          <>
            <Button variant="outlined" startIcon={<AddIcon />} onClick={() => setDialogOpen(true)}>
              Add candidate
            </Button>
            <Button variant="contained" startIcon={<DeleteIcon />} disabled>
              Delete candidate
            </Button>
            <Button variant="contained" startIcon={<SendIcon />} disabled>
              Send message
            </Button>
            <TextField
              type="search"
              placeholder="Search"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              sx={{ width: { xs: '100%', sm: 260 } }}
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon fontSize="small" />
                    </InputAdornment>
                  ),
                },
                htmlInput: {
                  'aria-label': 'Search candidates by name, mobile number or email',
                  maxLength: 100,
                },
              }}
            />
          </>
        }
      />

      <Paper variant="outlined" sx={{ overflow: 'hidden' }}>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={2}
          sx={{ p: 2, alignItems: { xs: 'stretch', sm: 'center' } }}
        >
          <TextField
            select
            label="Status"
            value={statusFilter}
            onChange={(event) => {
              setStatusFilter(event.target.value as StatusFilterValue);
              setPage(0);
            }}
            sx={{ minWidth: 200 }}
          >
            {STATUS_FILTER_OPTIONS.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </TextField>
          {selectedIds.size > 0 && (
            <Stack direction="row" spacing={1} sx={{ alignItems: 'center', ml: { sm: 'auto' } }}>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                {selectedIds.size} selected
              </Typography>
              <Button size="small" onClick={() => setSelectedIds(new Set())}>
                Clear selection
              </Button>
            </Stack>
          )}
        </Stack>
        {isLoading && data ? <LinearProgress /> : <Box sx={{ height: 4 }} />}
        {content}
      </Paper>

      <AddCandidateDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onCreated={handleCreated}
      />

      <Snackbar
        open={notice !== null}
        autoHideDuration={4000}
        onClose={() => setNotice(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity="success" variant="filled" onClose={() => setNotice(null)}>
          {notice}
        </Alert>
      </Snackbar>
    </>
  );
}