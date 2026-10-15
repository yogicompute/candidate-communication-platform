'use client';

import { createTheme } from '@mui/material/styles';

const theme = createTheme({
  cssVariables: true,
  palette: {
    mode: 'light',
    primary: { main: '#1976D2' },
    success: { main: '#2E7D32', light: '#E8F5E9' },
    error: { main: '#D32F2F', light: '#FDECEA' },
    info: { main: '#0277BD', light: '#E1F1FB' },
    background: { default: '#F4F5F7', paper: '#FFFFFF' },
    text: { primary: '#1F2329', secondary: '#5F6670' },
    divider: '#E3E5E8',
  },
  shape: { borderRadius: 6 },
  typography: {
    fontFamily: 'var(--font-roboto), "Helvetica Neue", Arial, sans-serif',
    h1: { fontSize: '1.625rem', fontWeight: 700, lineHeight: 1.3 },
    h2: { fontSize: '1.25rem', fontWeight: 500, lineHeight: 1.4 },
    button: { fontWeight: 500, letterSpacing: '0.04em' },
  },
  components: {
    // Figma dims and blurs the page behind dialogs and sheets; popover backdrops stay invisible.
    MuiBackdrop: {
      styleOverrides: {
        root: {
          variants: [
            { props: { invisible: false }, style: { backdropFilter: 'blur(2px)' } },
          ],
        },
      },
    },
    MuiButton: {
      defaultProps: { disableElevation: true },
    },
    MuiTextField: {
      defaultProps: { size: 'small' },
    },
    MuiTableCell: {
      styleOverrides: {
        head: { fontWeight: 500, backgroundColor: '#F9FAFB' },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: { fontWeight: 500 },
      },
    },
  },
});

export default theme;