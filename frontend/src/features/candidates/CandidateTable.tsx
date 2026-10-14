'use client';

import type { KeyboardEvent, ReactNode } from 'react';
import Box from '@mui/material/Box';
import Checkbox from '@mui/material/Checkbox';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import StatusChip from '@/components/StatusChip';
import type { CandidateFilters } from '@/features/candidates/candidateFilters';
import {
  DateRangeColumnFilter,
  StatusColumnFilter,
  TextColumnFilter,
} from '@/features/candidates/ColumnFilters';
import type { Candidate } from '@/types/candidate';
import { formatDate, formatPhone } from '@/utils/format';

interface HeaderCellProps {
  label: string;
  filter: ReactNode;
}

function HeaderCell({ label, filter }: HeaderCellProps) {
  return (
    <TableCell>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 1,
          whiteSpace: 'nowrap',
        }}
      >
        {label}
        {filter}
      </Box>
    </TableCell>
  );
}

interface CandidateTableProps {
  candidates: Candidate[];
  selectedIds: ReadonlySet<string>;
  onToggle: (id: string) => void;
  onToggleAll: (ids: string[], checked: boolean) => void;
  onOpen: (candidate: Candidate) => void;
  filters: CandidateFilters;
  onFiltersChange: (changes: Partial<CandidateFilters>) => void;
}

export default function CandidateTable({
  candidates,
  selectedIds,
  onToggle,
  onToggleAll,
  onOpen,
  filters,
  onFiltersChange,
}: CandidateTableProps) {
  const pageIds = candidates.map((candidate) => candidate.id);
  const selectedOnPage = pageIds.filter((id) => selectedIds.has(id)).length;
  const allSelected = pageIds.length > 0 && selectedOnPage === pageIds.length;

  function handleRowKeyDown(event: KeyboardEvent<HTMLTableRowElement>, candidate: Candidate) {
    if (event.target !== event.currentTarget) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onOpen(candidate);
    }
  }

  return (
    <TableContainer>
      <Table size="small" sx={{ minWidth: 860 }} aria-label="Candidates">
        <TableHead>
          <TableRow>
            <TableCell padding="checkbox">
              <Checkbox
                checked={allSelected}
                indeterminate={selectedOnPage > 0 && !allSelected}
                disabled={pageIds.length === 0}
                onChange={(event) => onToggleAll(pageIds, event.target.checked)}
                slotProps={{ input: { 'aria-label': 'Select all candidates on this page' } }}
              />
            </TableCell>
            <HeaderCell
              label="Full name"
              filter={
                <TextColumnFilter
                  label="Full name"
                  value={filters.name}
                  onChange={(name) => onFiltersChange({ name })}
                />
              }
            />
            <HeaderCell
              label="Mobile number"
              filter={
                <TextColumnFilter
                  label="Mobile number"
                  value={filters.phone}
                  onChange={(phone) => onFiltersChange({ phone })}
                  placeholder="e.g. 98765"
                  maxLength={20}
                  inputMode="tel"
                />
              }
            />
            <HeaderCell
              label="Last message"
              filter={
                <DateRangeColumnFilter
                  label="Last message"
                  value={{ from: filters.lastMessageFrom, to: filters.lastMessageTo }}
                  onChange={({ from, to }) => onFiltersChange({ lastMessageFrom: from, lastMessageTo: to })}
                />
              }
            />
            <HeaderCell
              label="Status"
              filter={
                <StatusColumnFilter value={filters.status} onChange={(status) => onFiltersChange({ status })} />
              }
            />
            <HeaderCell
              label="Candidate ID"
              filter={
                <TextColumnFilter
                  label="Candidate ID"
                  value={filters.candidateId}
                  onChange={(candidateId) => onFiltersChange({ candidateId })}
                  maxLength={6}
                />
              }
            />
          </TableRow>
        </TableHead>
        <TableBody>
          {candidates.map((candidate) => {
            const isSelected = selectedIds.has(candidate.id);
            return (
              <TableRow
                key={candidate.id}
                hover
                selected={isSelected}
                tabIndex={0}
                onClick={() => onOpen(candidate)}
                onKeyDown={(event) => handleRowKeyDown(event, candidate)}
                sx={{ cursor: 'pointer' }}
              >
                <TableCell padding="checkbox" onClick={(event) => event.stopPropagation()}>
                  <Checkbox
                    checked={isSelected}
                    onChange={() => onToggle(candidate.id)}
                    slotProps={{ input: { 'aria-label': `Select ${candidate.fullName}` } }}
                  />
                </TableCell>
                <TableCell>{candidate.fullName}</TableCell>
                <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatPhone(candidate.phone)}</TableCell>
                <TableCell sx={{ color: candidate.lastMessageAt ? 'text.primary' : 'text.disabled' }}>
                  {formatDate(candidate.lastMessageAt)}
                </TableCell>
                <TableCell>
                  <StatusChip status={candidate.lastMessageStatus} />
                </TableCell>
                <TableCell>{candidate.id}</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
