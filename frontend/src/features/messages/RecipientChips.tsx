'use client';

import { useEffect, useRef, useState } from 'react';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Typography from '@mui/material/Typography';

const MAX_LINES = 2;
const GAP_PX = 8;
const MORE_WIDTH_PX = 44;

export interface Recipient {
  id: string;
  fullName: string;
}

/** Name chips that wrap onto at most two lines; the rest collapse into a "+ n" suffix (Figma dev note). */
export default function RecipientChips({ recipients }: { recipients: Recipient[] }) {
  const measureRef = useRef<HTMLDivElement>(null);
  const [visibleCount, setVisibleCount] = useState(recipients.length);

  useEffect(() => {
    const container = measureRef.current;
    if (!container) return;
    // A hidden copy of every chip is laid out at the real width; count how many fit in two lines
    // while leaving room for the "+ n" label.
    const observer = new ResizeObserver(() => {
      const chips = Array.from(container.children) as HTMLElement[];
      if (chips.length === 0) return;
      const lineTops = [...new Set(chips.map((chip) => chip.offsetTop))].sort((a, b) => a - b);
      const lastLineTop = lineTops[Math.min(MAX_LINES, lineTops.length) - 1];
      let count = chips.filter((chip) => chip.offsetTop <= lastLineTop).length;
      if (count < chips.length) {
        while (count > 0) {
          const last = chips[count - 1];
          const fitsWithMore =
            last.offsetLeft + last.offsetWidth + GAP_PX + MORE_WIDTH_PX <= container.clientWidth;
          if (last.offsetTop < lastLineTop || fitsWithMore) break;
          count -= 1;
        }
      }
      setVisibleCount(count);
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, [recipients]);

  const hidden = recipients.length - visibleCount;
  const chipSx = { maxWidth: '100%' };

  return (
    <Box sx={{ position: 'relative', overflow: 'hidden' }}>
      <Box
        ref={measureRef}
        aria-hidden
        sx={{
          position: 'absolute',
          inset: '0 0 auto 0',
          display: 'flex',
          flexWrap: 'wrap',
          gap: `${GAP_PX}px`,
          visibility: 'hidden',
          pointerEvents: 'none',
        }}
      >
        {recipients.map((recipient) => (
          <Chip key={recipient.id} size="small" label={recipient.fullName} sx={chipSx} />
        ))}
      </Box>
      <Box
        component="ul"
        sx={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: `${GAP_PX}px`,
          listStyle: 'none',
          m: 0,
          p: 0,
        }}
      >
        {recipients.slice(0, visibleCount).map((recipient) => (
          <Box component="li" key={recipient.id} sx={{ maxWidth: '100%', display: 'flex' }}>
            <Chip size="small" label={recipient.fullName} sx={chipSx} />
          </Box>
        ))}
        {hidden > 0 && (
          <Box component="li">
            <Typography variant="body2" aria-label={`and ${hidden} more`}>
              + {hidden}
            </Typography>
          </Box>
        )}
      </Box>
    </Box>
  );
}
