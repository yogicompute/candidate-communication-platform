import EventBusyIcon from '@mui/icons-material/EventBusy';
import ScheduleSendIcon from '@mui/icons-material/ScheduleSend';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import type { ScheduledMessage, ScheduledStatus } from '@/types/message';
import { formatDateTime } from '@/utils/format';

const CHIP: Record<Exclude<ScheduledStatus, 'sent'>, { label: string; sx: object }> = {
  scheduled: { label: 'Scheduled', sx: { bgcolor: 'info.light', color: 'info.main' } },
  sending: { label: 'Sending', sx: { bgcolor: 'grey.100', color: 'text.secondary' } },
  cancelled: { label: 'Cancelled', sx: { bgcolor: 'grey.100', color: 'text.secondary' } },
};

interface ScheduledMessagesProps {
  items: ScheduledMessage[];
  cancellingId: string | null;
  onCancel: (item: ScheduledMessage) => void;
}

/** Upcoming (and cancelled) scheduled messages, soonest first, above the sent history. */
export default function ScheduledMessages({ items, cancellingId, onCancel }: ScheduledMessagesProps) {
  if (items.length === 0) return null;

  return (
    <Box component="section" aria-labelledby="scheduled-heading" sx={{ pt: 2 }}>
      <Typography id="scheduled-heading" variant="subtitle2" sx={{ color: 'text.secondary' }}>
        Scheduled
      </Typography>
      <Stack component="ol" divider={<Divider component="li" aria-hidden />} sx={{ listStyle: 'none', m: 0, p: 0 }}>
        {items.map((item) => {
          const chip = item.status === 'sent' ? null : CHIP[item.status];
          const cancelled = item.status === 'cancelled';
          return (
            <Box component="li" key={item.id} sx={{ py: 2, opacity: cancelled ? 0.7 : 1 }}>
              <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 1 }}>
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  Scheduled for {formatDateTime(item.scheduledFor)}
                </Typography>
                {item.groupId && <Chip size="small" variant="outlined" label="Bulk message" />}
                {chip && (
                  <Chip
                    size="small"
                    label={chip.label}
                    icon={cancelled ? <EventBusyIcon /> : <ScheduleSendIcon />}
                    sx={{ ml: 'auto !important', ...chip.sx, '& .MuiChip-icon': { color: 'inherit' } }}
                  />
                )}
              </Stack>
              <Typography
                variant="body2"
                sx={{
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  textDecoration: cancelled ? 'line-through' : 'none',
                }}
              >
                {item.body}
              </Typography>
              {cancelled && item.cancelledAt && (
                <Typography variant="caption" component="p" sx={{ color: 'text.secondary', mt: 1 }}>
                  Cancelled {formatDateTime(item.cancelledAt)}
                </Typography>
              )}
              {item.canCancel && (
                <Button
                  size="small"
                  color="error"
                  variant="outlined"
                  sx={{ mt: 1.5 }}
                  onClick={() => onCancel(item)}
                  loading={cancellingId === item.id}
                  disabled={cancellingId !== null && cancellingId !== item.id}
                >
                  Cancel scheduled message
                </Button>
              )}
            </Box>
          );
        })}
      </Stack>
      <Divider />
    </Box>
  );
}
