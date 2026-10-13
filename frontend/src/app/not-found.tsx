import SearchOffIcon from '@mui/icons-material/SearchOff';
import Button from '@mui/material/Button';
import Paper from '@mui/material/Paper';
import EmptyState from '@/components/EmptyState';

export default function NotFound() {
  return (
    <Paper variant="outlined">
      <EmptyState
        icon={<SearchOffIcon />}
        title="Page not found"
        description="The page you are looking for does not exist or has been moved."
        action={
          <Button variant="contained" href="/candidates">
            Go to candidates
          </Button>
        }
      />
    </Paper>
  );
}