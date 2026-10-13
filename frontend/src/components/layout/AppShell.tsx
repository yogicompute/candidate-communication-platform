'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import ForumOutlinedIcon from '@mui/icons-material/ForumOutlined';
import AppBar from '@mui/material/AppBar';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Container from '@mui/material/Container';
import Toolbar from '@mui/material/Toolbar';

const NAV_ITEMS = [{ label: 'Candidates', href: '/candidates' }] as const;

interface AppShellProps {
  children: ReactNode;
}

export default function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();

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
          <Box component="nav" aria-label="Main navigation" sx={{ display: 'flex', gap: 1 }}>
            {NAV_ITEMS.map((item) => {
              const isActive = pathname.startsWith(item.href);
              return (
                <Button
                  key={item.href}
                  component={Link}
                  href={item.href}
                  color={isActive ? 'primary' : 'inherit'}
                  aria-current={isActive ? 'page' : undefined}
                  sx={{ fontWeight: isActive ? 700 : 500 }}
                >
                  {item.label}
                </Button>
              );
            })}
          </Box>
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