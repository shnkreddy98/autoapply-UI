import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Container,
  Paper,
  TextField,
  Button,
  Typography,
  Box,
  Tab,
  Tabs,
  CircularProgress,
  Alert,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';
import axios from 'axios';
import { getApiUrl } from '../utils/api';
import { useStore } from '../store';

function Login() {
  const navigate = useNavigate();
  const setUser = useStore((s) => s.setUser);

  useEffect(() => {
    if (localStorage.getItem('userEmail') && localStorage.getItem('hasOnboarded')) {
      navigate('/workspace', { replace: true });
    }
  }, []);

  const [tab, setTab] = useState<'signin' | 'signup'>('signin');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Sign-in state
  const [siEmail, setSiEmail] = useState('');
  const [siPassword, setSiPassword] = useState('');

  // Sign-up state
  const [suName, setSuName] = useState('');
  const [suEmail, setSuEmail] = useState('');
  const [suPassword, setSuPassword] = useState('');
  const [suConfirm, setSuConfirm] = useState('');
  const [suPhone, setSuPhone] = useState('');
  const [suCountryCode, setSuCountryCode] = useState('+1');
  const [suLocation, setSuLocation] = useState('');

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!siEmail.trim() || !siPassword) { setError('Email and password are required'); return; }
    setLoading(true);
    setError('');
    try {
      const res = await axios.post(getApiUrl('/login'), { email: siEmail.trim(), password: siPassword });
      localStorage.setItem('userEmail', res.data.email);
      if (res.data.has_user_data) localStorage.setItem('hasOnboarded', '1');
      setUser(res.data.email, useStore.getState().resumeId ?? 0);
      navigate(res.data.has_user_data ? '/workspace' : '/onboarding');
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!suName.trim()) { setError('Name is required'); return; }
    if (!suEmail.trim()) { setError('Email is required'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(suEmail)) { setError('Invalid email'); return; }
    if (!suPassword) { setError('Password is required'); return; }
    if (suPassword.length < 6) { setError('Password must be at least 6 characters'); return; }
    if (suPassword !== suConfirm) { setError('Passwords do not match'); return; }
    if (!suPhone.trim()) { setError('Phone is required'); return; }
    if (!suLocation.trim()) { setError('Location is required'); return; }

    setLoading(true);
    setError('');
    try {
      const res = await axios.post(getApiUrl('/signup'), {
        name: suName.trim(),
        email: suEmail.trim(),
        password: suPassword,
        phone: suPhone.trim(),
        country_code: suCountryCode,
        location: suLocation.trim(),
      });
      // Store in localStorage and session for onboarding pre-fill
      localStorage.setItem('userEmail', res.data.email);
      sessionStorage.setItem('userEmail', res.data.email);
      sessionStorage.setItem('userName', suName.trim());
      sessionStorage.setItem('userPhone', suPhone.trim());
      sessionStorage.setItem('userCountryCode', suCountryCode);
      sessionStorage.setItem('userLocation', suLocation.trim());
      setUser(res.data.email, 0);
      navigate('/profile');
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Signup failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container maxWidth="sm">
      <Box sx={{ mt: 8, mb: 4 }}>
        <Paper elevation={3} sx={{ p: 4, borderRadius: 'var(--clay-radius)', background: 'var(--clay-surface)' }}>
          <Typography variant="h4" align="center" gutterBottom fontWeight={700}>
            AutoApply
          </Typography>

          <Tabs
            value={tab}
            onChange={(_, v) => { setTab(v); setError(''); }}
            centered
            sx={{ mb: 3 }}
          >
            <Tab label="Sign In" value="signin" />
            <Tab label="Sign Up" value="signup" />
          </Tabs>

          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

          {tab === 'signin' ? (
            <Box component="form" onSubmit={handleSignIn}>
              <TextField
                fullWidth label="Email" type="email"
                value={siEmail} onChange={(e) => setSiEmail(e.target.value)}
                margin="normal" required disabled={loading}
              />
              <TextField
                fullWidth label="Password" type="password"
                value={siPassword} onChange={(e) => setSiPassword(e.target.value)}
                margin="normal" required disabled={loading}
              />
              <Button
                type="submit" fullWidth variant="contained" size="large"
                disabled={loading} sx={{ mt: 3, borderRadius: 'var(--clay-radius)' }}
              >
                {loading ? <CircularProgress size={24} /> : 'Sign In'}
              </Button>
              <Typography variant="body2" align="center" sx={{ mt: 2, color: 'text.secondary' }}>
                Don't have an account?{' '}
                <Button size="small" onClick={() => { setTab('signup'); setError(''); }}>
                  Sign Up
                </Button>
              </Typography>
            </Box>
          ) : (
            <Box component="form" onSubmit={handleSignUp}>
              <TextField
                fullWidth label="Full Name"
                value={suName} onChange={(e) => setSuName(e.target.value)}
                margin="normal" required disabled={loading}
              />
              <TextField
                fullWidth label="Email" type="email"
                value={suEmail} onChange={(e) => setSuEmail(e.target.value)}
                margin="normal" required disabled={loading}
              />
              <TextField
                fullWidth label="Password" type="password"
                value={suPassword} onChange={(e) => setSuPassword(e.target.value)}
                margin="normal" required disabled={loading}
                helperText="At least 6 characters"
              />
              <TextField
                fullWidth label="Confirm Password" type="password"
                value={suConfirm} onChange={(e) => setSuConfirm(e.target.value)}
                margin="normal" required disabled={loading}
              />
              <Box sx={{ display: 'flex', gap: 2 }}>
                <FormControl sx={{ minWidth: 120 }} margin="normal">
                  <InputLabel>Country</InputLabel>
                  <Select value={suCountryCode} onChange={(e) => setSuCountryCode(e.target.value)} label="Country" disabled={loading}>
                    <MenuItem value="+1">+1 (US/CA)</MenuItem>
                    <MenuItem value="+44">+44 (UK)</MenuItem>
                    <MenuItem value="+91">+91 (India)</MenuItem>
                    <MenuItem value="+86">+86 (China)</MenuItem>
                    <MenuItem value="+49">+49 (Germany)</MenuItem>
                    <MenuItem value="+33">+33 (France)</MenuItem>
                    <MenuItem value="+61">+61 (Australia)</MenuItem>
                    <MenuItem value="+81">+81 (Japan)</MenuItem>
                  </Select>
                </FormControl>
                <TextField
                  fullWidth label="Phone" type="tel"
                  value={suPhone} onChange={(e) => setSuPhone(e.target.value)}
                  margin="normal" required disabled={loading}
                  helperText="Without country code"
                />
              </Box>
              <TextField
                fullWidth label="Location"
                value={suLocation} onChange={(e) => setSuLocation(e.target.value)}
                margin="normal" required disabled={loading}
                helperText="e.g. San Francisco, CA"
              />
              <Button
                type="submit" fullWidth variant="contained" size="large"
                disabled={loading} sx={{ mt: 3, borderRadius: 'var(--clay-radius)' }}
              >
                {loading ? <CircularProgress size={24} /> : 'Create Account'}
              </Button>
              <Typography variant="body2" align="center" sx={{ mt: 2, color: 'text.secondary' }}>
                Already have an account?{' '}
                <Button size="small" onClick={() => { setTab('signin'); setError(''); }}>
                  Sign In
                </Button>
              </Typography>
            </Box>
          )}
        </Paper>
      </Box>
    </Container>
  );
}

export default Login;
