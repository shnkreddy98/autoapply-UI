import { Box, Typography, IconButton } from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import { useStore, type ApplySession, type TailorJob } from '../store';
import axios from 'axios';
import { getApiUrl } from '../utils/api';

type CellStatus = 'idle' | 'queued' | 'running' | 'paused' | 'completed' | 'done' | 'failed';

interface JobCellProps {
  url: string;
  session?: ApplySession;
  tailorJob?: TailorJob;
}

const STATUS_COLOR: Record<string, string> = {
  running: 'var(--status-running)',
  paused:  'var(--status-running)',
  completed: 'var(--status-success)',
  done:      'var(--status-success)',
  failed:    'var(--status-failed)',
  queued:    'var(--status-queued)',
  idle:      'var(--status-idle)',
};

const STATUS_LABEL: Record<string, string> = {
  running: 'running', paused: 'paused', completed: 'done',
  done: 'done', failed: 'failed', queued: 'queued', idle: 'idle',
};

function truncateUrl(url: string): string {
  try {
    const u = new URL(url);
    const host = u.hostname.replace('www.', '');
    const path = u.pathname.length > 28 ? u.pathname.slice(0, 28) + '…' : u.pathname;
    return host + path;
  } catch {
    return url.length > 48 ? url.slice(0, 48) + '…' : url;
  }
}

function getFavicon(url: string): string {
  try {
    const { origin } = new URL(url);
    return `https://www.google.com/s2/favicons?sz=16&domain=${origin}`;
  } catch { return ''; }
}

export default function JobCell({ url, session, tailorJob }: JobCellProps) {
  const openVnc = useStore((s) => s.openVnc);

  const status: CellStatus = session?.status ?? tailorJob?.status ?? 'idle';
  const color = STATUS_COLOR[status] ?? STATUS_COLOR.idle;
  const label = STATUS_LABEL[status] ?? status;
  const isRunning = status === 'running' || status === 'paused';
  const currentStep = session?.currentStep;

  const handlePlay = async () => {
    if (!session?.sessionId) return;
    try { await axios.get(getApiUrl(`/sessions/${session.sessionId}/vnc-focus`)); } catch { /* best-effort */ }
    openVnc(session.sessionId);
  };

  return (
    <Box
      className={isRunning ? 'status-running' : undefined}
      sx={{
        display: 'flex', alignItems: 'center', gap: 1,
        p: '10px 12px', mb: '6px',
        background: 'var(--clay-surface-2)',
        border: '1px solid var(--clay-border)',
        borderLeft: `3px solid ${color}`,
        borderRadius: '8px',
        transition: 'border-color 0.3s, background 0.2s',
        '&:hover': { background: '#20202e', borderColor: '#2e2e42' },
      }}
    >
      {/* Favicon */}
      <Box
        component="img"
        src={getFavicon(url)}
        sx={{ width: 14, height: 14, flexShrink: 0, opacity: 0.7, borderRadius: '2px' }}
        onError={(e: any) => { e.target.style.display = 'none'; }}
      />

      {/* Text */}
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography noWrap title={url} sx={{ fontSize: '0.78rem', fontWeight: 500, color: 'text.primary', lineHeight: 1.3 }}>
          {truncateUrl(url)}
        </Typography>
        {currentStep && (
          <Typography noWrap sx={{ fontSize: '0.68rem', color: 'text.secondary', lineHeight: 1.3, mt: '1px' }}>
            {currentStep}
          </Typography>
        )}
      </Box>

      {/* Status badge */}
      <Box sx={{
        px: '6px', py: '2px', borderRadius: '99px',
        background: `${color}18`, border: `1px solid ${color}44`,
        flexShrink: 0,
      }}>
        <Typography sx={{ fontSize: '0.62rem', fontWeight: 700, color, letterSpacing: '0.04em' }}>
          {label}
        </Typography>
      </Box>

      {/* Play button */}
      {session?.sessionId && (
        <IconButton
          size="small" onClick={handlePlay} title="Open live view"
          sx={{ p: 0.4, color: 'text.secondary', flexShrink: 0, '&:hover': { color: 'primary.main', background: 'rgba(99,102,241,0.1)' } }}
        >
          <PlayArrowIcon sx={{ fontSize: 16 }} />
        </IconButton>
      )}
    </Box>
  );
}
