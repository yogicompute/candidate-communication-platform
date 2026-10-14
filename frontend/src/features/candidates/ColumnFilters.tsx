'use client';

import { useState, type FormEvent, type MouseEvent, type ReactNode } from 'react';
import FilterListIcon from '@mui/icons-material/FilterList';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import MenuItem from '@mui/material/MenuItem';
import Popover from '@mui/material/Popover';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import { STATUS_FILTER_OPTIONS, type StatusFilterValue } from '@/features/candidates/candidateFilters';

interface FilterPopoverProps {
  label: string;
  active: boolean;
  canApply?: boolean;
  onOpen: () => void;
  onApply: () => void;
  onClear: () => void;
  children: ReactNode;
}

function FilterPopover({ label, active, canApply = true, onOpen, onApply, onClear, children }: FilterPopoverProps) {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const actionLabel = `Filter by ${label.toLowerCase()}`;

  function handleOpen(event: MouseEvent<HTMLElement>) {
    onOpen();
    setAnchorEl(event.currentTarget);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canApply) return;
    onApply();
    setAnchorEl(null);
  }

  function handleClear() {
    onClear();
    setAnchorEl(null);
  }

  return (
    <>
      <Tooltip title={actionLabel}>
        <IconButton
          size="small"
          color={active ? 'primary' : 'default'}
          onClick={handleOpen}
          aria-label={actionLabel}
          aria-pressed={active}
        >
          <FilterListIcon fontSize="small" />
        </IconButton>
      </Tooltip>
      <Popover
        open={anchorEl !== null}
        anchorEl={anchorEl}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      >
        <Box component="form" onSubmit={handleSubmit} noValidate sx={{ p: 2, width: 260 }}>
          <Stack spacing={2}>
            {children}
            <Stack direction="row" spacing={1} sx={{ justifyContent: 'flex-end' }}>
              <Button size="small" onClick={handleClear}>
                Clear
              </Button>
              <Button size="small" type="submit" variant="contained" disabled={!canApply}>
                Apply
              </Button>
            </Stack>
          </Stack>
        </Box>
      </Popover>
    </>
  );
}

interface TextColumnFilterProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  maxLength?: number;
  inputMode?: 'text' | 'tel';
}

export function TextColumnFilter({
  label,
  value,
  onChange,
  placeholder,
  maxLength = 100,
  inputMode = 'text',
}: TextColumnFilterProps) {
  const [draft, setDraft] = useState(value);

  return (
    <FilterPopover
      label={label}
      active={value !== ''}
      onOpen={() => setDraft(value)}
      onApply={() => onChange(draft.trim())}
      onClear={() => onChange('')}
    >
      <TextField
        autoFocus
        label={label}
        placeholder={placeholder}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        slotProps={{ htmlInput: { maxLength, inputMode } }}
      />
    </FilterPopover>
  );
}

interface StatusColumnFilterProps {
  value: StatusFilterValue;
  onChange: (value: StatusFilterValue) => void;
}

export function StatusColumnFilter({ value, onChange }: StatusColumnFilterProps) {
  const [draft, setDraft] = useState(value);

  return (
    <FilterPopover
      label="Status"
      active={value !== 'all'}
      onOpen={() => setDraft(value)}
      onApply={() => onChange(draft)}
      onClear={() => onChange('all')}
    >
      <TextField
        select
        label="Status"
        value={draft}
        onChange={(event) => setDraft(event.target.value as StatusFilterValue)}
      >
        {STATUS_FILTER_OPTIONS.map((option) => (
          <MenuItem key={option.value} value={option.value}>
            {option.label}
          </MenuItem>
        ))}
      </TextField>
    </FilterPopover>
  );
}

export interface DateRange {
  from: string;
  to: string;
}

interface DateRangeColumnFilterProps {
  label: string;
  value: DateRange;
  onChange: (value: DateRange) => void;
}

export function DateRangeColumnFilter({ label, value, onChange }: DateRangeColumnFilterProps) {
  const [draft, setDraft] = useState(value);
  const invalid = Boolean(draft.from && draft.to && draft.from > draft.to);

  return (
    <FilterPopover
      label={label}
      active={Boolean(value.from || value.to)}
      canApply={!invalid}
      onOpen={() => setDraft(value)}
      onApply={() => onChange(draft)}
      onClear={() => onChange({ from: '', to: '' })}
    >
      <TextField
        type="date"
        label="From"
        value={draft.from}
        onChange={(event) => setDraft((prev) => ({ ...prev, from: event.target.value }))}
        slotProps={{ inputLabel: { shrink: true } }}
      />
      <TextField
        type="date"
        label="To"
        value={draft.to}
        onChange={(event) => setDraft((prev) => ({ ...prev, to: event.target.value }))}
        error={invalid}
        helperText={invalid ? 'The end date must be on or after the start date.' : undefined}
        slotProps={{ inputLabel: { shrink: true } }}
      />
    </FilterPopover>
  );
}
