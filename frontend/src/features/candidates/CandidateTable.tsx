'use client';

import NextLink from 'next/link';
import Checkbox from '@mui/material/Checkbox';
import Link from '@mui/material/Link';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import StatusChip from '@/components/StatusChip';
import type { Candidate } from '@/types/candidate';
import { formatDate, formatPhone } from '@/utils/format';

interface CandidateTableProps {
  candidates: Candidate[];
  selectedIds: ReadonlySet<string>;
  onToggle: (id: string) => void;
  onToggleAll: (ids: string[], checked: boolean) => void;
}

export default function CandidateTable({
  candidates,
  selectedIds,
  onToggle,
  onToggleAll,
}: CandidateTableProps) {
  const pageIds = candidates.map((candidate) => candidate.id);
  const selectedOnPage = pageIds.filter((id) => selectedIds.has(id)).length;
  const allSelected = pageIds.length > 0 && selectedOnPage === pageIds.length;

  return (
    <TableContainer>
      <Table size="small" sx={{ minWidth: 720 }} aria-label="Candidates">
        <TableHead>
          <TableRow>
            <TableCell padding="checkbox">
              <Checkbox
                checked={allSelected}
                indeterminate={selectedOnPage > 0 && !allSelected}
                onChange={(event) => onToggleAll(pageIds, event.target.checked)}
                slotProps={{ input: { 'aria-label': 'Select all candidates on this page' } }}
              />
            </TableCell>
            <TableCell>Full name</TableCell>
            <TableCell>Mobile number</TableCell>
            <TableCell>Last message</TableCell>
            <TableCell>Status</TableCell>
            <TableCell>Candidate ID</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {candidates.map((candidate) => {
            const isSelected = selectedIds.has(candidate.id);
            return (
              <TableRow key={candidate.id} hover selected={isSelected}>
                <TableCell padding="checkbox">
                  <Checkbox
                    checked={isSelected}
                    onChange={() => onToggle(candidate.id)}
                    slotProps={{ input: { 'aria-label': `Select ${candidate.fullName}` } }}
                  />
                </TableCell>
                <TableCell>
                  <Link component={NextLink} href={`/candidates/${candidate.id}`} underline="hover">
                    {candidate.fullName}
                  </Link>
                </TableCell>
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