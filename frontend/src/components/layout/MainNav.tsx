'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';

const NAV_ITEMS = [{ label: 'Candidates', href: '/candidates' }] as const;

export default function MainNav() {
  const pathname = usePathname();

  return (
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
  );
}
