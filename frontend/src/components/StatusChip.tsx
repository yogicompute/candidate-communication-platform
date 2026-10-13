import type { ReactElement } from 'react';
import CheckIcon from '@mui/icons-material/Check';
import DoneAllIcon from '@mui/icons-material/DoneAll';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import ScheduleIcon from '@mui/icons-material/Schedule';
import Chip from '@mui/material/Chip';
import Typography from '@mui/material/Typography';
import type { MessageStatus } from '@/types/message';

type Tone = 'success' | 'error' | 'info' | 'neutral';

const STATUS_CONFIG: Record<MessageStatus, { label: string; tone: Tone; icon?: ReactElement }> = {
  pending: { label: 'Pending', tone: 'neutral', icon: <ScheduleIcon /> },
  sent: { label: 'Sent', tone: 'info' },
  delivered: { label: 'Delivered', tone: 'info', icon: <CheckIcon /> },
  read: { label: 'Read', tone: 'success', icon: <DoneAllIcon /> },
  failed: { label: 'Failed', tone: 'error', icon: <ErrorOutlineIcon /> },
};

const TONE_STYLES = {
  success: { bgcolor: 'success.light', color: 'success.main' },
  error: { bgcolor: 'error.light', color: 'error.main' },
  info: { bgcolor: 'info.light', color: 'info.main' },
  neutral: { bgcolor: 'grey.100', color: 'text.secondary' },
} as const;

interface StatusChipProps {
  status: MessageStatus | null;
}

export default function StatusChip({ status }: StatusChipProps) {
  if (!status) {
    return (
      <Typography variant="body2" component="span" sx={{ color: 'text.disabled' }}>
        NA
      </Typography>
    );
  }

  const { label, tone, icon } = STATUS_CONFIG[status];

  return (
    <Chip
      size="small"
      label={label}
      icon={icon}
      sx={{ ...TONE_STYLES[tone], '& .MuiChip-icon': { color: 'inherit' } }}
    />
  );
}