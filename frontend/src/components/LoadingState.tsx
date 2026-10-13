import CircularProgress from '@mui/material/CircularProgress';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

interface LoadingStateProps {
  label?: string;
}

export default function LoadingState({ label = 'Loading…' }: LoadingStateProps) {
  return (
    <Stack role="status" aria-live="polite" spacing={2} sx={{ alignItems: 'center', py: 6 }}>
      <CircularProgress size={32} />
      <Typography variant="body2" sx={{ color: 'text.secondary' }}>
        {label}
      </Typography>
    </Stack>
  );
}