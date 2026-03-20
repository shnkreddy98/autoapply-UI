import { useState } from 'react';
import { Box, TextField, Button, Typography, IconButton, CircularProgress, Alert } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import SearchIcon from '@mui/icons-material/Search';
import axios from 'axios';
import { getApiUrl } from '../utils/api';
import { useStore } from '../store';
import ResumeSelector from './ResumeSelector';

export default function SearchPanel() {
  const jobUrls  = useStore((s) => s.jobUrls);
  const setJobUrls = useStore((s) => s.setJobUrls);

  const [role,    setRole]    = useState('');
  const [company, setCompany] = useState('');
  const [pages,   setPages]   = useState(5);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');

  const handleSearch = async () => {
    if (!role.trim()) { setError('Role is required'); return; }
    setLoading(true); setError('');
    try {
      const res = await axios.post(getApiUrl('/search-jobs'), {
        role: role.trim(), company: company.trim() || undefined, pages,
      });
      setJobUrls(res.data as string[]);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Search failed');
    } finally { setLoading(false); }
  };

  const removeUrl = (url: string) => setJobUrls(jobUrls.filter((u) => u !== url));

  const inputSx = {
    '& .MuiOutlinedInput-root': { background: 'var(--clay-surface-2)', borderRadius: '8px', fontSize: '0.85rem' },
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, height: '100%' }}>
      <Typography sx={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'text.secondary' }}>
        Search
      </Typography>

      <TextField
        label="Role" value={role} onChange={(e) => setRole(e.target.value)}
        size="small" fullWidth disabled={loading}
        onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
        sx={inputSx}
      />
      <TextField
        label="Company (optional)" value={company} onChange={(e) => setCompany(e.target.value)}
        size="small" fullWidth disabled={loading} sx={inputSx}
      />
      <TextField
        label="Pages" type="number" value={pages}
        onChange={(e) => setPages(Number(e.target.value))}
        size="small" inputProps={{ min: 1, max: 20 }} disabled={loading} sx={inputSx}
      />

      <Button
        variant="contained" onClick={handleSearch} disabled={loading || !role.trim()}
        startIcon={loading ? <CircularProgress size={14} color="inherit" /> : <SearchIcon sx={{ fontSize: '16px !important' }} />}
        size="small" sx={{ borderRadius: '8px', height: 34, fontSize: '0.82rem' }}
      >
        {loading ? 'Searching…' : 'Search Jobs'}
      </Button>

      {error && <Alert severity="error" sx={{ py: 0, fontSize: '0.78rem' }}>{error}</Alert>}

      {jobUrls.length > 0 && (
        <>
          <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary' }}>
            {jobUrls.length} job{jobUrls.length !== 1 ? 's' : ''} found
          </Typography>
          <Box sx={{ flex: 1, overflowY: 'auto' }}>
            {jobUrls.map((url) => (
              <Box
                key={url}
                sx={{
                  display: 'flex', alignItems: 'center', gap: 0.5,
                  mb: '4px', px: '8px', py: '5px',
                  background: 'var(--clay-surface-2)',
                  border: '1px solid var(--clay-border)',
                  borderRadius: '7px',
                  '&:hover': { borderColor: 'var(--clay-border-2)' },
                }}
              >
                <Typography noWrap title={url} sx={{ flex: 1, fontSize: '0.7rem', color: 'text.secondary' }}>
                  {url.replace(/^https?:\/\/(www\.)?/, '')}
                </Typography>
                <IconButton size="small" onClick={() => removeUrl(url)} sx={{ p: 0.25, color: '#4a4a5c', '&:hover': { color: 'error.main' } }}>
                  <CloseIcon sx={{ fontSize: '0.85rem' }} />
                </IconButton>
              </Box>
            ))}
          </Box>
        </>
      )}

      <Box sx={{ mt: 'auto', pt: 1.5, borderTop: '1px solid var(--clay-border)' }}>
        <ResumeSelector />
      </Box>
    </Box>
  );
}
