'use client';

import { Suspense, type ReactNode } from 'react';
import Link from 'next/link';
import ForumOutlinedIcon from '@mui/icons-material/ForumOutlined';
import AppBar from '@mui/material/AppBar';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Container from '@mui/material/Container';
import Toolbar from '@mui/material/Toolbar';
import MainNav from '@/components/layout/MainNav';

interface AppShellProps {
  children: ReactNode;
}

export default function AppShell({ children }: AppShellProps) {
  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <AppBar
        position="sticky"
        color="inherit"
        elevation={0}
        sx={{ borderBottom: 1, borderColor: 'divider' }}
      >
        <Toolbar sx={{ gap: 1 }}>
          <Button
            component={Link}
            href="/candidates"
            startIcon={<ForumOutlinedIcon />}
            sx={{
              mr: 'auto',
              color: 'text.primary',
              fontWeight: 700,
              fontSize: '1rem',
              textTransform: 'none',
              letterSpacing: 0,
              '& .MuiButton-startIcon': { color: 'primary.main' },
            }}
          >
            Candidate Communication
          </Button>
          <Suspense fallback={null}>
            <MainNav />
          </Suspense>
        </Toolbar>
      </AppBar>
      <Container
        component="main"
        maxWidth="xl"
        sx={{ flex: 1, py: { xs: 2, md: 4 }, px: { xs: 2, md: 3 } }}
      >
        {children}
      </Container>
    </Box>
  );
}