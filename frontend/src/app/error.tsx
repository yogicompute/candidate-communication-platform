'use client';

import { useEffect } from 'react';
import Paper from '@mui/material/Paper';
import ErrorState from '@/components/ErrorState';

interface RouteErrorProps {
  error: Error & { digest?: string };
  retry: () => void;
}

export default function RouteError({ error, retry }: RouteErrorProps) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <Paper variant="outlined">
      <ErrorState onRetry={retry} />
    </Paper>
  );
}