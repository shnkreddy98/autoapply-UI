import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Box, Typography, TextField, Button, Menu, MenuItem,
  CircularProgress, Alert, Select, FormControl,
  IconButton, Tooltip, Dialog, DialogTitle, DialogContent, DialogActions,
} from '@mui/material';
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import SearchIcon from '@mui/icons-material/Search';
import CloseIcon from '@mui/icons-material/Close';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
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

function StatusCell({ status, error }: { status: Status | undefined; error?: string }) {
  const s = status ?? 'idle';
  const color = DOT_COLOR[s] ?? DOT_COLOR.idle;
  const isSquare = s === 'failed';
  const isPulse  = s === 'running' || s === 'paused';
  const cell = (
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

  return error
    ? <Tooltip title={error} placement="top"><span>{cell}</span></Tooltip>
    : cell;
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
  const userEmail     = useStore((s) => s.userEmail) ?? localStorage.getItem('userEmail') ?? '';
  const jobUrls       = useStore((s) => s.jobUrls);
  const resumeId      = useStore((s) => s.resumeId);
  const allResumeIds  = useStore((s) => s.allResumeIds);
  const tailorJobs    = useStore((s) => s.tailorJobs);
  const applySessions = useStore((s) => s.applySessions);
  const vncSessionId  = useStore((s) => s.vncSessionId);
  const setTailorJob    = useStore((s) => s.setTailorJob);
  const setApplySession = useStore((s) => s.setApplySession);
  const setAllResumeIds = useStore((s) => s.setAllResumeIds);
  const setResumeId     = useStore((s) => s.setResumeId);
  const setJobUrls      = useStore((s) => s.setJobUrls);
  const setWorkspace    = useStore((s) => s.setWorkspace);
  const openVnc         = useStore((s) => s.openVnc);

  const today = new Date().toISOString().slice(0, 10);

  const [resumeLoaded, setResumeLoaded] = useState(false);
  const [selectedDate, setSelectedDate] = useState(today);
  const [role,    setRole]    = useState('');
  const [company, setCompany] = useState('');
  const [pages,   setPages]   = useState(5);
  const [searchLoading, setSearchLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error,   setError]   = useState('');
  const [runAnchor, setRunAnchor] = useState<HTMLElement | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState('');
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const tailorPollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // load workspace data for a given date from DB
  const loadDateData = useCallback(async (dateStr: string) => {
    const email = useStore.getState().userEmail ?? localStorage.getItem('userEmail') ?? '';
    try {
      const [sessionsRes, jobsRes, fetchedRes] = await Promise.all([
        axios.get(getApiUrl(`/sessions?date=${dateStr}&email=${encodeURIComponent(email)}`)),
        axios.get(getApiUrl(`/jobs?date=${dateStr}&email=${encodeURIComponent(email)}`)),
        axios.get(getApiUrl(`/fetched-urls?date=${dateStr}&email=${encodeURIComponent(email)}`)),
      ]);
      const sessions: any[] = sessionsRes.data;
      const jobs: any[]     = jobsRes.data;

      const urlSet = new Set<string>();
      fetchedRes.data.forEach((f: any) => urlSet.add(f.url));
      sessions.forEach((s) => urlSet.add(s.job_url));
      jobs.forEach((j) => urlSet.add(j.url));

      const jobsMap: Record<string, any> = {};
      jobs.forEach((j: any) => { jobsMap[j.url] = j; });

      const tailorUrls = new Set<string>(
        fetchedRes.data.filter((f: any) => f.action === 'tailor').map((f: any) => f.url)
      );

      const tailorMap: Record<string, import('../store').TailorJob> = {};
      tailorUrls.forEach((url: string) => {
        const job = jobsMap[url];
        if (!job) {
          tailorMap[url] = { status: 'queued' };
        } else if (job.resume_path) {
          tailorMap[url] = { status: 'done', resumePath: job.resume_path };
        } else if (job.role === 'Processing') {
          tailorMap[url] = { status: 'running' };
        } else {
          tailorMap[url] = { status: 'failed', error: job.job_match_summary || 'Tailor failed' };
        }
      });

      // backward compat: mark done for old jobs not in jobs_fetched but with resume_path
      jobs.forEach((j: any) => {
        if (j.resume_path && !tailorUrls.has(j.url)) {
          tailorMap[j.url] = { status: 'done', resumePath: j.resume_path };
        }
      });

      const sessionMap: Record<string, import('../store').ApplySession> = {};
      sessions.forEach((s) => {
        sessionMap[s.job_url] = { sessionId: s.session_id, status: s.status, currentStep: s.current_step, error: s.error_message ?? undefined };
      });

      setWorkspace(Array.from(urlSet), tailorMap, sessionMap);
    } catch { /* ignore */ }
  }, [setWorkspace]);

  // load resumes + today's workspace on mount
  useEffect(() => {
    axios.get(getApiUrl(`/list-resumes?email=${encodeURIComponent(userEmail)}`)).then((res) => {
      if (Array.isArray(res.data) && res.data.length > 0) {
        setAllResumeIds(res.data);
        if (!useStore.getState().resumeId) setResumeId(res.data[res.data.length - 1]);
      }
    }).catch(() => {}).finally(() => setResumeLoaded(true));
    loadDateData(today);
  }, []);

  // reload when date changes (skip initial — already loaded above)
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) { isFirstRender.current = false; return; }
    loadDateData(selectedDate);
  }, [selectedDate]);

  // poll tailor jobs — gently merge, only mark done when resume_path appears in DB
  useEffect(() => {
    const hasActive = Object.values(tailorJobs).some(
      (t) => t.status === 'queued' || t.status === 'running'
    );
    if (hasActive && !tailorPollingRef.current) {
      tailorPollingRef.current = setInterval(async () => {
        const email = useStore.getState().userEmail ?? localStorage.getItem('userEmail') ?? '';
        try {
          const res = await axios.get(getApiUrl(`/jobs?date=${selectedDate}&email=${encodeURIComponent(email)}`));
          (res.data as any[]).forEach((j) => {
            if (j.resume_path) {
              setTailorJob(j.url, { status: 'done', resumePath: j.resume_path });
            }
          });
        } catch { /* ignore */ }
      }, 5000);
    }
    if (!hasActive && tailorPollingRef.current) {
      clearInterval(tailorPollingRef.current);
      tailorPollingRef.current = null;
    }
    return () => { if (tailorPollingRef.current) { clearInterval(tailorPollingRef.current); tailorPollingRef.current = null; } };
  }, [tailorJobs, selectedDate]);

  // poll sessions
  useEffect(() => {
    const hasActive = Object.values(applySessions).some(
      (s) => s.status === 'queued' || s.status === 'running' || s.status === 'paused'
    );
    if (hasActive && !pollingRef.current) {
      pollingRef.current = setInterval(async () => {
        try {
          const email = useStore.getState().userEmail ?? localStorage.getItem('userEmail') ?? '';
          const res = await axios.get(getApiUrl(`/sessions?email=${encodeURIComponent(email)}`));
          (res.data as any[]).forEach((s) => {
            const entry = Object.entries(applySessions).find(([, v]) => v.sessionId === s.session_id);
            if (entry) setApplySession(entry[0], { sessionId: s.session_id, status: s.status, currentStep: s.current_step, error: s.error_message ?? undefined });
          });
        } catch { /* ignore */ }
      }, 5000);
    }
    if (!hasActive && pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null; }
    return () => { if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null; } };
  }, [applySessions]);

  const noResume = resumeLoaded && allResumeIds.length === 0;
  const hasOnboarded = !!localStorage.getItem('hasOnboarded');
  const profileComplete = !noResume && hasOnboarded;
  const profileTip = !profileComplete
    ? `Complete your profile first: ${[noResume && 'upload a resume', !hasOnboarded && 'fill in Application Details'].filter(Boolean).join(' and ')}.`
    : '';

  const handleSearch = async () => {
    if (!role.trim()) { setError('Role is required'); return; }
    setSearchLoading(true); setError('');
    try {
      const res = await axios.post(getApiUrl('/search-jobs'), { role: role.trim(), company: company.trim() || undefined, pages });
      setJobUrls(res.data as string[]);
    } catch (err: any) { setError(err.response?.data?.detail || 'Search failed'); }
    finally { setSearchLoading(false); }
  };

  const handleImport = () => {
    const urls = importText
      .split('\n')
      .map((s) => s.trim())
      .filter((s) => s.startsWith('http'));
    if (urls.length > 0) setJobUrls(urls);
    setImportText('');
    setImportOpen(false);
  };

  const handleApplyNow = async () => {
    setRunAnchor(null);
    if (!resumeId) { setError('No resume — upload one in Profile first.'); return; }
    setActionLoading(true); setError('');
    try {
      const urls = jobUrls.filter((url) => applySessions[url]?.status !== 'completed');
      if (urls.length === 0) { setError('All URLs already applied.'); return; }
      const res = await axios.post(getApiUrl('/applytojobs'), { urls, resume_id: resumeId });
      res.data.sessions.forEach((s: any) => setApplySession(s.url, { sessionId: s.session_id, status: s.status }));
    } catch (err: any) { setError(err.response?.data?.detail || 'Failed to start'); }
    finally { setActionLoading(false); }
  };

  const handleTailorFirst = () => {
    setRunAnchor(null);
    if (!resumeId) { setError('No resume — upload one in Profile first.'); return; }
    setError('');
    const urls = jobUrls.filter((url) => tailorJobs[url]?.status !== 'done');
    if (urls.length === 0) { setError('All URLs already tailored.'); return; }
    urls.forEach((url) => setTailorJob(url, { status: 'queued' }));

    // Fire-and-forget — backend processes async, we poll for updates
    axios.post(getApiUrl('/tailortojobs'), { urls, resume_id: resumeId })
      .then((res) => {
        const results: Array<{ success: boolean; reason: string | null }> = res.data;
        urls.forEach((url, i) =>
          setTailorJob(url, {
            status: results[i]?.success ? 'done' : 'failed',
            error: results[i]?.reason ?? undefined,
          })
        );
        loadDateData(selectedDate);
      })
      .catch(() => {
        // Mark any still-queued/running as failed
        const jobs = useStore.getState().tailorJobs;
        urls.forEach((url) => {
          if (jobs[url]?.status === 'queued' || jobs[url]?.status === 'running') {
            setTailorJob(url, { status: 'failed' });
          }
        });
      });
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

          <Button
            variant="outlined" size="small" onClick={() => setImportOpen(true)}
            sx={{ height: 32, fontSize: '0.78rem', px: 1.5 }}
          >
            Import URLs
          </Button>

          {/* divider */}
          <Box sx={{ width: 1, height: 20, background: 'var(--clay-border)', mx: 0.5 }} />

          {/* Apply split button */}
          <Tooltip title={profileTip} disableHoverListener={profileComplete}>
            <Box sx={{ display: 'flex' }}>
              <Button
                variant="contained" size="small" onClick={handleApplyNow}
                disabled={actionLoading || jobUrls.length === 0 || !profileComplete}
                sx={{ height: 32, fontSize: '0.78rem', px: 1.5, borderRadius: '8px 0 0 8px' }}
              >
                {actionLoading ? <CircularProgress size={12} color="inherit" /> : 'Apply Now'}
              </Button>
              <Button
                variant="contained" size="small"
                onClick={(e) => setRunAnchor(e.currentTarget)}
                disabled={actionLoading || jobUrls.length === 0 || !profileComplete}
                sx={{ height: 32, minWidth: 26, px: 0, borderRadius: '0 8px 8px 0', borderLeft: '1px solid rgba(0,0,0,0.2)' }}
              >
                <ArrowDropDownIcon sx={{ fontSize: 18 }} />
              </Button>
            </Box>
          </Tooltip>
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

          {/* date filter */}
          <Box sx={{ ml: 'auto' }}>
            <input
              type="date"
              value={selectedDate}
              max={today}
              onChange={(e) => e.target.value && setSelectedDate(e.target.value)}
              style={{
                height: 32, padding: '0 8px', fontSize: '0.78rem',
                background: 'var(--clay-surface-2)', color: 'var(--color-text)',
                border: '1px solid var(--clay-border)', borderRadius: 8,
                outline: 'none', colorScheme: 'dark', cursor: 'pointer',
              }}
            />
          </Box>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mx: 2, mt: 1, py: 0, fontSize: '0.78rem' }} onClose={() => setError('')}>
            {error}
          </Alert>
        )}
        {!profileComplete && (
          <Alert severity="warning" sx={{ mx: 2, mt: 1, py: 0, fontSize: '0.78rem' }}>
            {profileTip} <a href="/profile" style={{ color: 'inherit', fontWeight: 600 }}>Go to Profile →</a>
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
                        <Typography
                          noWrap title={url}
                          component="a" href={url} target="_blank" rel="noopener noreferrer"
                          sx={{ fontSize: '0.78rem', fontWeight: 500, color: 'text.primary', lineHeight: 1.2, textDecoration: 'none', '&:hover': { color: '#6366f1', textDecoration: 'underline' } }}
                        >
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
                    <Box sx={{ px: 1.5, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <StatusCell status={tailor?.status as Status} error={tailor?.error} />
                      {tailor?.resumePath && (
                        <Tooltip title="View tailored resume" placement="top">
                          <IconButton
                            size="small"
                            onClick={() => window.open(getApiUrl(`/download-resume?url=${encodeURIComponent(url)}`), '_blank')}
                            sx={{ p: 0.25, color: '#6366f1', '&:hover': { color: '#818cf8' } }}
                          >
                            <DescriptionOutlinedIcon sx={{ fontSize: 13 }} />
                          </IconButton>
                        </Tooltip>
                      )}
                    </Box>

                    {/* Apply status */}
                    <Box sx={{ px: 1.5 }}>
                      <StatusCell status={session?.status as Status} error={session?.error} />
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

      <Dialog open={importOpen} onClose={() => setImportOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle sx={{ fontSize: '0.95rem', pb: 1 }}>Import Job URLs</DialogTitle>
        <DialogContent>
          <TextField
            multiline rows={10} fullWidth autoFocus
            placeholder={"https://example.com/jobs/123\nhttps://example.com/jobs/456"}
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
            sx={{ mt: 1, fontFamily: 'monospace', fontSize: '0.8rem' }}
            inputProps={{ style: { fontFamily: 'monospace', fontSize: '0.8rem' } }}
          />
          <Typography sx={{ mt: 1, fontSize: '0.72rem', color: 'text.secondary' }}>
            One URL per line. Non-http lines are ignored.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button size="small" onClick={() => setImportOpen(false)}>Cancel</Button>
          <Button
            size="small" variant="contained"
            onClick={handleImport}
            disabled={!importText.trim()}
          >
            Import
          </Button>
        </DialogActions>
      </Dialog>

    </Box>
  );
}
