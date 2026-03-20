import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createTheme, ThemeProvider } from '@mui/material/styles'
import './index.css'
import App from './App.tsx'

const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: { main: '#6366f1' },
    success: { main: '#10b981' },
    error:   { main: '#ef4444' },
    warning: { main: '#f59e0b' },
    background: {
      default: '#0d0d12',
      paper:   '#15151e',
    },
    divider: '#252535',
    text: {
      primary:   '#e8e8f0',
      secondary: '#7c7c96',
    },
  },
  typography: {
    fontFamily: '"Inter", system-ui, sans-serif',
    button: { textTransform: 'none', fontWeight: 600 },
  },
  shape: { borderRadius: 10 },
  components: {
    MuiCssBaseline: { styleOverrides: { body: { background: '#0d0d12' } } },
    MuiPaper: { styleOverrides: { root: { backgroundImage: 'none' } } },
    MuiAppBar: { styleOverrides: { root: { backgroundImage: 'none' } } },
    MuiButton: {
      styleOverrides: {
        root: { borderRadius: 8, fontWeight: 600 },
        contained: {
          boxShadow: 'none',
          '&:hover': { boxShadow: '0 0 16px rgba(99,102,241,0.3)' },
        },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          '& fieldset': { borderColor: '#252535' },
          '&:hover fieldset': { borderColor: '#3a3a50 !important' },
        },
      },
    },
    MuiMenuItem: {
      styleOverrides: {
        root: { fontSize: '0.85rem' },
      },
    },
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider theme={theme}>
      <App />
    </ThemeProvider>
  </StrictMode>,
)
