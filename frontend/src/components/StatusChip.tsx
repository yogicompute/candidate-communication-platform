import type { ReactElement } from 'react';
import CheckIcon from '@mui/icons-material/Check';
import DoneAllIcon from '@mui/icons-material/DoneAll';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutlined';
import ScheduleIcon from '@mui/icons-material/Schedule';
import Chip from '@mui/material/Chip';
import Typography from '@mui/material/Typography';
import { MESSAGE_STATUS_LABELS, type MessageStatus } from '@/types/message';

type Tone = 'success' | 'error' | 'info' | 'neutral';

const STATUS_STYLE: Record<MessageStatus, { tone: Tone; icon?: ReactElement }> = {
  pending: { tone: 'neutral', icon: <ScheduleIcon /> },
  sent: { tone: 'info' },
  delivered: { tone: 'info', icon: <CheckIcon /> },
  read: { tone: 'success', icon: <DoneAllIcon /> },
  failed: { tone: 'error', icon: <ErrorOutlineIcon /> },
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

  const { tone, icon } = STATUS_STYLE[status];

  return (
    <Chip
      size="small"
      label={MESSAGE_STATUS_LABELS[status]}
      icon={icon}
      sx={{ ...TONE_STYLES[tone], '& .MuiChip-icon': { color: 'inherit' } }}
    />
  );
}