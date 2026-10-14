'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import SearchIcon from '@mui/icons-material/Search';
import SendIcon from '@mui/icons-material/Send';
import Alert, { type AlertColor } from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import InputAdornment from '@mui/material/InputAdornment';
import LinearProgress from '@mui/material/LinearProgress';
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
import CandidateHistorySheet from '@/features/candidates/CandidateHistorySheet';
import CandidateTable from '@/features/candidates/CandidateTable';
import DeleteCandidatesDialog from '@/features/candidates/DeleteCandidatesDialog';
import {
  EMPTY_FILTERS,
  activeFilterChips,
  toListFilters,
  type CandidateFilters,
} from '@/features/candidates/candidateFilters';
import BulkMessageDialog from '@/features/messages/BulkMessageDialog';
import { getErrorMessage } from '@/services/apiError';
import { candidateService } from '@/services/candidateService';
import type { Paginated } from '@/types/api';
import type { Candidate, DeleteCandidatesResult } from '@/types/candidate';
import type { BulkSendResult } from '@/types/message';
import { summarizeBulkResult } from '@/utils/messages';

const PAGE_SIZE = 10;
const SEARCH_DEBOUNCE_MS = 300;

const pluralCandidates = (count: number) => `${count} candidate${count === 1 ? '' : 's'}`;

interface LoadResult {
  key: string;
  data?: Paginated<Candidate>;
  error?: string;
}

interface Notice {
  severity: AlertColor;
  text: string;
}

export default function CandidatesView() {
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<CandidateFilters>(EMPTY_FILTERS);
  const [page, setPage] = useState(0);
  const [reloadToken, setReloadToken] = useState(0);
  const [result, setResult] = useState<LoadResult | null>(null);
  const [selected, setSelected] = useState<Map<string, Candidate>>(() => new Map());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [historyId, setHistoryId] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkSession, setBulkSession] = useState(0);
  const [bulkBusy, setBulkBusy] = useState(false);
  const bulkOpenRef = useRef(false);
  const [notice, setNotice] = useState<Notice | null>(null);

  const requestKey = [search, JSON.stringify(filters), page, reloadToken].join('|');

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
      .list({ search, ...toListFilters(filters), page: page + 1, pageSize: PAGE_SIZE })
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
  }, [requestKey, search, filters, page]);

  const isLoading = result?.key !== requestKey;
  const data = result?.data;
  const error = isLoading ? null : (result?.error ?? null);
  const filterChips = activeFilterChips(filters);
  const hasFilters = search !== '' || filterChips.length > 0;
  const selectedIds = new Set(selected.keys());
  const selectedList = Array.from(selected.values(), (c) => ({ id: c.id, fullName: c.fullName }));

  function reload() {
    setReloadToken((token) => token + 1);
  }

  function updateFilters(changes: Partial<CandidateFilters>) {
    setFilters((prev) => ({ ...prev, ...changes }));
    setPage(0);
  }

  function clearFilters() {
    setSearchInput('');
    setSearch('');
    setFilters(EMPTY_FILTERS);
    setPage(0);
  }

  function openHistory(candidate: Candidate) {
    setHistoryId(candidate.id);
    setHistoryOpen(true);
  }

  function closeHistory() {
    setHistoryOpen(false);
    reload();
  }

  function handleDeleted({ deletedIds, notFoundIds }: DeleteCandidatesResult) {
    setDeleteOpen(false);
    setSelected((prev) => {
      const next = new Map(prev);
      for (const id of [...deletedIds, ...notFoundIds]) next.delete(id);
      return next;
    });
    const alreadyRemoved = notFoundIds.length
      ? ` ${pluralCandidates(notFoundIds.length)} had already been removed.`
      : '';
    setNotice({ severity: 'success', text: `Deleted ${pluralCandidates(deletedIds.length)}.${alreadyRemoved}` });
    setPage(0);
    reload();
  }

  function toggleOne(id: string) {
    const candidate = data?.items.find((item) => item.id === id);
    if (!candidate) return;
    setSelected((prev) => {
      const next = new Map(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.set(id, candidate);
      }
      return next;
    });
  }

  function toggleAll(ids: string[], checked: boolean) {
    const pageItems = data?.items.filter((item) => ids.includes(item.id)) ?? [];
    setSelected((prev) => {
      const next = new Map(prev);
      for (const candidate of pageItems) {
        if (checked) {
          next.set(candidate.id, candidate);
        } else {
          next.delete(candidate.id);
        }
      }
      return next;
    });
  }

  function handleCreated(candidate: Candidate) {
    setDialogOpen(false);
    setNotice({ severity: 'success', text: `${candidate.fullName} was added.` });
    clearFilters();
    reload();
  }

  function setBulkDialogOpen(open: boolean) {
    bulkOpenRef.current = open;
    setBulkOpen(open);
  }

  function openBulkDialog() {
    if (!bulkBusy) setBulkSession((session) => session + 1);
    setBulkDialogOpen(true);
  }

  function handleBulkCompleted(bulkResult: BulkSendResult) {
    setSelected(new Map());
    reload();
    if (!bulkOpenRef.current) setNotice(summarizeBulkResult(bulkResult));
  }

  let content: ReactNode = null;
  if (!data && isLoading) {
    content = <LoadingState label="Loading candidates…" />;
  } else if (error) {
    content = <ErrorState title="Couldn't load candidates" message={error} onRetry={reload} />;
  } else if (data && data.items.length === 0 && !hasFilters) {
    content = (
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
          onOpen={openHistory}
          filters={filters}
          onFiltersChange={updateFilters}
        />
        {data.items.length === 0 ? (
          <EmptyState
            title="No matching candidates"
            description="Try different filters or search terms, or clear them to see everyone."
            action={<Button onClick={clearFilters}>Clear filters</Button>}
          />
        ) : (
          <TablePagination
            component="div"
            count={data.total}
            page={page}
            rowsPerPage={PAGE_SIZE}
            rowsPerPageOptions={[]}
            onPageChange={(_, nextPage) => setPage(nextPage)}
          />
        )}
      </>
    );
  }

  const sendLabel = bulkBusy
    ? 'Sending…'
    : `Send message${selected.size > 0 ? ` (${selected.size})` : ''}`;

  return (
    <>
      <PageHeader
        title="Candidate communication"
        actions={
          <>
            <Button variant="outlined" startIcon={<AddIcon />} onClick={() => setDialogOpen(true)}>
              Add candidate
            </Button>
            <Button
              variant="contained"
              color="error"
              startIcon={<DeleteIcon />}
              disabled={selected.size === 0}
              onClick={() => setDeleteOpen(true)}
            >
              {`Delete candidate${selected.size > 0 ? ` (${selected.size})` : ''}`}
            </Button>
            <Button
              variant="contained"
              startIcon={<SendIcon />}
              disabled={selected.size === 0 && !bulkBusy}
              onClick={openBulkDialog}
            >
              {sendLabel}
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
        {(filterChips.length > 0 || selected.size > 0) && (
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={1}
            useFlexGap
            sx={{ px: 2, pt: 2, pb: 1, alignItems: { xs: 'stretch', sm: 'center' } }}
          >
            {filterChips.length > 0 && (
              <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap', alignItems: 'center' }}>
                {filterChips.map((chip) => (
                  <Chip
                    key={chip.label}
                    size="small"
                    label={chip.label}
                    onDelete={() => updateFilters(chip.clear)}
                  />
                ))}
                <Button size="small" onClick={() => updateFilters(EMPTY_FILTERS)}>
                  Clear filters
                </Button>
              </Stack>
            )}
            {selected.size > 0 && (
              <Stack direction="row" spacing={1} sx={{ alignItems: 'center', ml: { sm: 'auto' } }}>
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  {selected.size} selected
                </Typography>
                <Button size="small" onClick={() => setSelected(new Map())}>
                  Clear selection
                </Button>
              </Stack>
            )}
          </Stack>
        )}
        {isLoading && data ? <LinearProgress /> : <Box sx={{ height: 4 }} />}
        {content}
      </Paper>

      <AddCandidateDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onCreated={handleCreated}
      />

      <CandidateHistorySheet candidateId={historyId} open={historyOpen} onClose={closeHistory} />

      <DeleteCandidatesDialog
        open={deleteOpen}
        candidates={selectedList}
        onClose={() => setDeleteOpen(false)}
        onDeleted={handleDeleted}
      />

      <BulkMessageDialog
        key={bulkSession}
        open={bulkOpen}
        recipients={selectedList}
        onClose={() => setBulkDialogOpen(false)}
        onBusyChange={setBulkBusy}
        onCompleted={handleBulkCompleted}
      />

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