import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import EmptyState from '@/components/EmptyState';

interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
}

export default function ErrorState({
  title = 'Something went wrong',
  message = 'Please try again. If the problem continues, refresh the page.',
  onRetry,
}: ErrorStateProps) {
  return (
    <Box role="alert">
      <EmptyState
        icon={<ErrorOutlineIcon color="error" />}
        title={title}
        description={message}
        action={
          onRetry && (
            <Button variant="outlined" onClick={onRetry}>
              Try again
            </Button>
          )
        }
      />
    </Box>
  );
}