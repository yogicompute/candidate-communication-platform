'use client';

import { useRef } from 'react';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { MESSAGE_MAX_LENGTH } from '@/utils/messages';
import { PLACEHOLDERS, type Placeholder } from '@/utils/placeholders';

interface MessageTextAreaProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
  error?: string | null;
  disabled?: boolean;
  autoFocus?: boolean;
  placeholder?: string;
}

/** Resizable message box (Figma dev note) with buttons that insert a placeholder at the cursor. */
export default function MessageTextArea({
  id,
  value,
  onChange,
  error,
  disabled,
  autoFocus,
  placeholder,
}: MessageTextAreaProps) {
  const inputRef = useRef<HTMLTextAreaElement>(null);

  function insert(name: Placeholder) {
    const input = inputRef.current;
    const token = `{{${name}}}`;
    const start = input?.selectionStart ?? value.length;
    const end = input?.selectionEnd ?? value.length;
    onChange(value.slice(0, start) + token + value.slice(end));
    requestAnimationFrame(() => {
      input?.focus();
      input?.setSelectionRange(start + token.length, start + token.length);
    });
  }

  return (
    <>
      <TextField
        id={id}
        multiline
        rows={6}
        fullWidth
        required
        autoFocus={autoFocus}
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        error={Boolean(error)}
        helperText={error ?? `${value.length}/${MESSAGE_MAX_LENGTH} characters`}
        disabled={disabled}
        slotProps={{ htmlInput: { ref: inputRef, maxLength: MESSAGE_MAX_LENGTH } }}
        sx={{ '& textarea': { resize: 'vertical' } }}
      />
      <Stack direction="row" spacing={1} useFlexGap sx={{ mt: 1, alignItems: 'center', flexWrap: 'wrap' }}>
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          Insert:
        </Typography>
        {PLACEHOLDERS.map((name) => (
          <Chip
            key={name}
            size="small"
            variant="outlined"
            label={`{{${name}}}`}
            onClick={() => insert(name)}
            disabled={disabled}
            aria-label={`Insert ${name.replace('_', ' ')} placeholder`}
          />
        ))}
      </Stack>
    </>
  );
}
