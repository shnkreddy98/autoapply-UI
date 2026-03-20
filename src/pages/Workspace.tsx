import { useEffect, useRef, useState } from 'react';
import {
  Box, Typography, TextField, Button, Menu, MenuItem,
  CircularProgress, Alert, Select, FormControl,
  IconButton, Tooltip,
} from '@mui/material';
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import SearchIcon from '@mui/icons-material/Search';
import CloseIcon from '@mui/icons-material/Close';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import axios from 'axios';
import { getApiUrl } from '../utils/api';
import { useStore } from '../store';

// ─── constants ────────────────────────────────────────────────────────────────

const VNC_BASE_URL = '/novnc/vnc.html';
const VNC_W   = 580;    // right panel px
const ROW_H   = 44;     // spreadsheet row height
const GRID    = '36px 44px 1.8fr 100px 110px 1.2fr 48px'; // col template

// ─── status helpers ───────────────────────────────────────────────────────────

type Status = 'idle' | 'queued' | 'running' | 'paused' | 'completed' | 'done' | 'failed';

const DOT_COLOR: Record<string, string> = {
  idle:      '#3a3a52',
  queued:    '#6366f1',
  running:   '#f59e0b',
  paused:    '#f59e0b',
  done:      '#10b981',
  completed: '#10b981',
  failed:    '#ef4444',
};

function StatusCell({ status }: { status: Status | undefined }) {
  const s = status ?? 'idle';
  const color = DOT_COLOR[s] ?? DOT_COLOR.idle;
  const isSquare = s === 'failed';
  const isPulse  = s === 'running' || s === 'paused';
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8 }}>
      <Box
        className={isPulse ? 'status-running' : undefined}
        sx={{
          width: 7, height: 7, flexShrink: 0,
          borderRadius: isSquare ? '1.5px' : '50%',
          background: color,
        }}
      />
      <Typography sx={{ fontSize: '0.75rem', color, fontWeight: 500 }}>
        {s}
      </Typography>
    </Box>
  );
}

function truncUrl(url: string) {
  try {
    const u = new URL(url);
    const host = u.hostname.replace('www.', '');
    const path = u.pathname.length > 34 ? u.pathname.slice(0, 34) + '…' : u.pathname;
    return { host, path };
  } catch { return { host: url.slice(0, 30), path: '' }; }
}

function getFavicon(url: string) {
  try { return `https://www.google.com/s2/favicons?sz=16&domain=${new URL(url).origin}`; }
  catch { return ''; }
}

// ─── main component ───────────────────────────────────────────────────────────

export default function Workspace() {
  const jobUrls       = useStore((s) => s.jobUrls);
  const resumeId      = useStore((s) => s.resumeId);
  const allResumeIds  = useStore((s) => s.allResumeIds);
  const tailorJobs    = useStore((s) => s.tailorJobs);
  const applySessions = useStore((s) => s.applySessions);
  const vncSessionId  = useStore((s) => s.vncSessionId);
  const setTailorJob  = useStore((s) => s.setTailorJob);
  const setApplySession = useStore((s) => s.setApplySession);
  const setAllResumeIds = useStore((s) => s.setAllResumeIds);
  const setResumeId   = useStore((s) => s.setResumeId);
  const setJobUrls    = useStore((s) => s.setJobUrls);
  const openVnc       = useStore((s) => s.openVnc);

  const [resumeLoaded, setResumeLoaded] = useState(false);
  const [role,    setRole]    = useState('');
  const [company, setCompany] = useState('');
  const [pages,   setPages]   = useState(5);
  const [searchLoading, setSearchLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error,   setError]   = useState('');
  const [runAnchor, setRunAnchor] = useState<HTMLElement | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // load resumes
  useEffect(() => {
    axios.get(getApiUrl('/list-resumes')).then((res) => {
      if (Array.isArray(res.data) && res.data.length > 0) {
        setAllResumeIds(res.data);
        if (!useStore.getState().resumeId) setResumeId(res.data[res.data.length - 1]);
      }
    }).catch(() => {}).finally(() => setResumeLoaded(true));
  }, []);

  // poll sessions
  useEffect(() => {
    const hasActive = Object.values(applySessions).some(
      (s) => s.status === 'queued' || s.status === 'running' || s.status === 'paused'
    );
    if (hasActive && !pollingRef.current) {
      pollingRef.current = setInterval(async () => {
        try {
          const res = await axios.get(getApiUrl('/sessions'));
          (res.data as any[]).forEach((s) => {
            const entry = Object.entries(applySessions).find(([, v]) => v.sessionId === s.session_id);
            if (entry) setApplySession(entry[0], { sessionId: s.session_id, status: s.status, currentStep: s.current_step });
          });
        } catch { /* ignore */ }
      }, 5000);
    }
    if (!hasActive && pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null; }
    return () => { if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null; } };
  }, [applySessions]);

  const noResume = resumeLoaded && allResumeIds.length === 0;

  const handleSearch = async () => {
    if (!role.trim()) { setError('Role is required'); return; }
    setSearchLoading(true); setError('');
    try {
      const res = await axios.post(getApiUrl('/search-jobs'), { role: role.trim(), company: company.trim() || undefined, pages });
      setJobUrls(res.data as string[]);
    } catch (err: any) { setError(err.response?.data?.detail || 'Search failed'); }
    finally { setSearchLoading(false); }
  };

  const handleApplyNow = async () => {
    setRunAnchor(null);
    if (!resumeId) { setError('No resume — upload one in Profile first.'); return; }
    setActionLoading(true); setError('');
    try {
      const res = await axios.post(getApiUrl('/applytojobs'), { urls: jobUrls, resume_id: resumeId });
      res.data.sessions.forEach((s: any) => setApplySession(s.url, { sessionId: s.session_id, status: s.status }));
    } catch (err: any) { setError(err.response?.data?.detail || 'Failed to start'); }
    finally { setActionLoading(false); }
  };

  const handleTailorFirst = async () => {
    setRunAnchor(null);
    if (!resumeId) { setError('No resume — upload one in Profile first.'); return; }
    setActionLoading(true); setError('');
    jobUrls.forEach((url) => setTailorJob(url, { status: 'running' }));
    try {
      const res = await axios.post(getApiUrl('/tailortojobs'), { urls: jobUrls, resume_id: resumeId });
      const results: boolean[] = res.data;
      jobUrls.forEach((url, i) => setTailorJob(url, { status: results[i] === true ? 'done' : 'failed' }));
    } catch (err: any) {
      jobUrls.forEach((url) => setTailorJob(url, { status: 'failed' }));
      setError(err.response?.data?.detail || 'Tailoring failed');
    } finally { setActionLoading(false); }
  };

  const handlePlayRow = async (url: string) => {
    const session = applySessions[url];
    if (!session?.sessionId) return;
    openVnc(session.sessionId);
    try {
      await axios.get(getApiUrl(`/sessions/${session.sessionId}/vnc-focus`));
    } catch { /* best-effort */ }
  };

  const removeUrl = (url: string) => setJobUrls(jobUrls.filter((u) => u !== url));

  // ─── render ────────────────────────────────────────────────────────────────

  return (
    <Box sx={{ height: 'calc(100vh - 64px)', display: 'flex', overflow: 'hidden', background: 'var(--clay-bg)' }}>

      {/* ── Left: table area ── */}
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>

        {/* Toolbar */}
        <Box sx={{
          display: 'flex', alignItems: 'center', gap: 1, px: 2, py: 1,
          borderBottom: '1px solid var(--clay-border)',
          background: 'var(--clay-surface)',
          flexShrink: 0, flexWrap: 'wrap',
        }}>
          <TextField
            placeholder="Role" value={role} onChange={(e) => setRole(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            size="small" disabled={searchLoading}
            sx={{ width: 160, '& .MuiOutlinedInput-root': { height: 32, fontSize: '0.82rem', background: 'var(--clay-surface-2)' } }}
          />
          <TextField
            placeholder="Company (opt.)" value={company} onChange={(e) => setCompany(e.target.value)}
            size="small" disabled={searchLoading}
            sx={{ width: 140, '& .MuiOutlinedInput-root': { height: 32, fontSize: '0.82rem', background: 'var(--clay-surface-2)' } }}
          />
          <TextField
            placeholder="Pages" type="number" value={pages} onChange={(e) => setPages(Number(e.target.value))}
            size="small" inputProps={{ min: 1, max: 20 }}
            sx={{ width: 72, '& .MuiOutlinedInput-root': { height: 32, fontSize: '0.82rem', background: 'var(--clay-surface-2)' } }}
          />
          <Button
            variant="contained" size="small" onClick={handleSearch}
            disabled={searchLoading || !role.trim()}
            startIcon={searchLoading ? <CircularProgress size={12} color="inherit" /> : <SearchIcon sx={{ fontSize: '14px !important' }} />}
            sx={{ height: 32, fontSize: '0.78rem', px: 1.5 }}
          >
            Search
          </Button>

          {/* divider */}
          <Box sx={{ width: 1, height: 20, background: 'var(--clay-border)', mx: 0.5 }} />

          {/* Apply split button */}
          <Box sx={{ display: 'flex' }}>
            <Button
              variant="contained" size="small" onClick={handleApplyNow}
              disabled={actionLoading || jobUrls.length === 0}
              sx={{ height: 32, fontSize: '0.78rem', px: 1.5, borderRadius: '8px 0 0 8px' }}
            >
              {actionLoading ? <CircularProgress size={12} color="inherit" /> : 'Apply Now'}
            </Button>
            <Button
              variant="contained" size="small"
              onClick={(e) => setRunAnchor(e.currentTarget)}
              disabled={actionLoading || jobUrls.length === 0}
              sx={{ height: 32, minWidth: 26, px: 0, borderRadius: '0 8px 8px 0', borderLeft: '1px solid rgba(0,0,0,0.2)' }}
            >
              <ArrowDropDownIcon sx={{ fontSize: 18 }} />
            </Button>
          </Box>
          <Menu anchorEl={runAnchor} open={!!runAnchor} onClose={() => setRunAnchor(null)}>
            <MenuItem dense onClick={handleApplyNow}>Apply Now</MenuItem>
            <MenuItem dense onClick={handleTailorFirst}>Tailor First</MenuItem>
          </Menu>

          {/* Resume selector */}
          {allResumeIds.length > 0 && (
            <FormControl size="small" sx={{ minWidth: 120 }}>
              <Select
                value={resumeId ?? ''}
                onChange={(e) => setResumeId(Number(e.target.value))}
                displayEmpty
                sx={{ height: 32, fontSize: '0.78rem', background: 'var(--clay-surface-2)' }}
              >
                {allResumeIds.map((id) => (
                  <MenuItem key={id} value={id} sx={{ fontSize: '0.82rem' }}>Resume #{id}</MenuItem>
                ))}
              </Select>
            </FormControl>
          )}

          {/* job count */}
          {jobUrls.length > 0 && (
            <Typography sx={{ fontSize: '0.72rem', color: 'text.secondary', ml: 0.5 }}>
              {jobUrls.length} job{jobUrls.length !== 1 ? 's' : ''}
            </Typography>
          )}
        </Box>

        {error && (
          <Alert severity="error" sx={{ mx: 2, mt: 1, py: 0, fontSize: '0.78rem' }} onClose={() => setError('')}>
            {error}
          </Alert>
        )}
        {noResume && (
          <Alert severity="warning" sx={{ mx: 2, mt: 1, py: 0, fontSize: '0.78rem' }}>
            No resume uploaded. Go to <a href="/profile" style={{ color: 'inherit' }}>Profile</a> first.
          </Alert>
        )}

        {/* Table */}
        <Box sx={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          {/* Table header */}
          <Box sx={{
            display: 'grid', gridTemplateColumns: GRID,
            height: 34, alignItems: 'center',
            px: 0, flexShrink: 0,
            background: 'var(--clay-surface-2)',
            borderBottom: '1px solid var(--clay-border)',
          }}>
            {['', '#', 'Job URL', 'Tailor', 'Apply', 'Current Step', ''].map((col, i) => (
              <Box key={i} sx={{ px: i === 0 ? 1 : i === 1 ? 0.5 : 1.5, overflow: 'hidden' }}>
                <Typography sx={{
                  fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.08em',
                  textTransform: 'uppercase', color: 'text.secondary', whiteSpace: 'nowrap',
                }}>
                  {col}
                </Typography>
              </Box>
            ))}
          </Box>

          {/* Rows */}
          <Box sx={{ flex: 1, overflowY: 'auto' }}>
            {jobUrls.length === 0 ? (
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200 }}>
                <Typography sx={{ color: 'text.secondary', fontSize: '0.85rem' }}>
                  Search for jobs to get started
                </Typography>
              </Box>
            ) : (
              jobUrls.map((url, idx) => {
                const tailor  = tailorJobs[url];
                const session = applySessions[url];
                const isActive = vncSessionId === session?.sessionId;
                const { host, path } = truncUrl(url);
                const favicon = getFavicon(url);

                return (
                  <Box
                    key={url}
                    sx={{
                      display: 'grid', gridTemplateColumns: GRID,
                      height: ROW_H, alignItems: 'center',
                      borderBottom: '1px solid var(--clay-border)',
                      background: isActive ? 'rgba(99,102,241,0.06)' : 'transparent',
                      borderLeft: isActive ? '2px solid #6366f1' : '2px solid transparent',
                      transition: 'background 0.15s',
                      cursor: 'default',
                      '&:hover': { background: isActive ? 'rgba(99,102,241,0.08)' : 'var(--clay-surface-2)' },
                    }}
                  >
                    {/* Empty first col (checkbox placeholder) */}
                    <Box />

                    {/* Row number */}
                    <Box sx={{ px: 0.5 }}>
                      <Typography sx={{ fontSize: '0.72rem', color: '#3a3a52', fontVariantNumeric: 'tabular-nums' }}>
                        {idx + 1}
                      </Typography>
                    </Box>

                    {/* URL */}
                    <Box sx={{ px: 1.5, display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
                      <Box
                        component="img" src={favicon}
                        sx={{ width: 13, height: 13, flexShrink: 0, opacity: 0.65 }}
                        onError={(e: any) => { e.target.style.display = 'none'; }}
                      />
                      <Box sx={{ minWidth: 0 }}>
                        <Typography noWrap title={url} sx={{ fontSize: '0.78rem', fontWeight: 500, color: 'text.primary', lineHeight: 1.2 }}>
                          {host}
                        </Typography>
                        <Typography noWrap sx={{ fontSize: '0.65rem', color: 'text.secondary', lineHeight: 1.2 }}>
                          {path}
                        </Typography>
                      </Box>
                      <IconButton
                        size="small"
                        onClick={() => removeUrl(url)}
                        sx={{ ml: 'auto', p: 0.25, opacity: 0, flexShrink: 0,
                          '.MuiBox-root:hover > .MuiBox-root > &': { opacity: 1 },
                          color: '#4a4a5c', '&:hover': { color: '#ef4444' },
                        }}
                      >
                        <CloseIcon sx={{ fontSize: 11 }} />
                      </IconButton>
                    </Box>

                    {/* Tailor status */}
                    <Box sx={{ px: 1.5 }}>
                      <StatusCell status={tailor?.status as Status} />
                    </Box>

                    {/* Apply status */}
                    <Box sx={{ px: 1.5 }}>
                      <StatusCell status={session?.status as Status} />
                    </Box>

                    {/* Current step */}
                    <Box sx={{ px: 1.5, minWidth: 0 }}>
                      <Typography noWrap sx={{ fontSize: '0.72rem', color: 'text.secondary' }}>
                        {session?.currentStep ?? ''}
                      </Typography>
                    </Box>

                    {/* Play button */}
                    <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                      <Tooltip title="Open in VNC" placement="left">
                        <span>
                          <IconButton
                            size="small"
                            onClick={() => handlePlayRow(url)}
                            disabled={!session?.sessionId}
                            sx={{
                              p: 0.5,
                              color: isActive ? '#6366f1' : 'text.secondary',
                              opacity: session?.sessionId ? 1 : 0.25,
                              '&:hover': { color: '#6366f1', background: 'rgba(99,102,241,0.1)' },
                            }}
                          >
                            <PlayArrowIcon sx={{ fontSize: 16 }} />
                          </IconButton>
                        </span>
                      </Tooltip>
                    </Box>
                  </Box>
                );
              })
            )}
          </Box>
        </Box>
      </Box>

      {/* ── Right: VNC Panel (always visible) ── */}
      <Box sx={{
        width: VNC_W, flexShrink: 0,
        display: 'flex', flexDirection: 'column',
        borderLeft: '1px solid var(--clay-border)',
        background: '#0a0a0f',
      }}>
        {/* VNC header */}
        <Box sx={{
          height: 34, flexShrink: 0,
          display: 'flex', alignItems: 'center', px: 1.5, gap: 1,
          borderBottom: '1px solid var(--clay-border)',
          background: 'var(--clay-surface-2)',
        }}>
          {vncSessionId ? (
            <>
              <Box
                className="status-running"
                sx={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--status-running)', flexShrink: 0 }}
              />
              <Typography sx={{ flex: 1, fontSize: '0.72rem', color: 'text.secondary', fontFamily: 'monospace' }} noWrap>
                {vncSessionId}
              </Typography>
            </>
          ) : (
            <Typography sx={{ fontSize: '0.72rem', color: '#3a3a52', fontFamily: 'monospace' }}>
              no session selected
            </Typography>
          )}
        </Box>

        {/* VNC iframe — always loaded */}
        <Box sx={{ flex: 1, overflow: 'hidden' }}>
          <iframe
            key={vncSessionId ?? 'default'}
            src={VNC_BASE_URL}
            title="VNC"
            style={{ width: '100%', height: '100%', border: 'none', background: '#000', display: 'block' }}
          />
        </Box>
      </Box>

    </Box>
  );
}
