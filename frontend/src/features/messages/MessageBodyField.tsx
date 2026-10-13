import TextField from '@mui/material/TextField';
import { MESSAGE_MAX_LENGTH } from '@/utils/messages';

interface MessageBodyFieldProps {
  value: string;
  onChange: (value: string) => void;
  error?: string | null;
  disabled?: boolean;
  autoFocus?: boolean;
}

export default function MessageBodyField({
  value,
  onChange,
  error,
  disabled,
  autoFocus,
}: MessageBodyFieldProps) {
  return (
    <TextField
      label="Message"
      multiline
      minRows={3}
      maxRows={10}
      fullWidth
      value={value}
      onChange={(event) => onChange(event.target.value)}
      error={Boolean(error)}
      helperText={error ?? `${value.length}/${MESSAGE_MAX_LENGTH} characters`}
      disabled={disabled}
      autoFocus={autoFocus}
      slotProps={{ htmlInput: { maxLength: MESSAGE_MAX_LENGTH } }}
    />
  );
}