import { Box, IconButton, Typography } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { useStore } from '../store';

export default function VncPanel() {
  const vncSessionId = useStore((s) => s.vncSessionId);
  const closeVnc     = useStore((s) => s.closeVnc);

  if (!vncSessionId) return null;

  return (
    <Box
      sx={{
        position: 'fixed', right: 0, top: 64, bottom: 0, width: 480,
        zIndex: 1300, display: 'flex', flexDirection: 'column',
        background: 'var(--clay-surface)',
        borderLeft: '1px solid var(--clay-border)',
        boxShadow: '-8px 0 40px rgba(0,0,0,0.6)',
        animation: 'slideIn 0.25s ease-out',
        '@keyframes slideIn': {
          from: { transform: 'translateX(100%)' },
          to:   { transform: 'translateX(0)' },
        },
      }}
    >
      {/* Header */}
      <Box sx={{
        display: 'flex', alignItems: 'center', px: 2, py: 1.25,
        borderBottom: '1px solid var(--clay-border)',
        background: 'var(--clay-surface-2)',
        flexShrink: 0,
      }}>
        <Box sx={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--status-running)', mr: 1, flexShrink: 0 }} className="status-running" />
        <Typography sx={{ flex: 1, fontSize: '0.8rem', fontWeight: 600, color: 'text.primary', fontFamily: 'monospace' }} noWrap>
          {vncSessionId}
        </Typography>
        <IconButton size="small" onClick={closeVnc} sx={{ color: 'text.secondary', '&:hover': { color: 'error.main' } }}>
          <CloseIcon sx={{ fontSize: 16 }} />
        </IconButton>
      </Box>

      {/* VNC iframe */}
      <Box sx={{ flex: 1, overflow: 'hidden' }}>
        <iframe
          src="http://localhost:8080/vnc.html"
          title="VNC Session"
          style={{ width: '100%', height: '100%', border: 'none', background: '#000' }}
        />
      </Box>
    </Box>
  );
}
