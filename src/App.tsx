import { BrowserRouter as Router, Routes, Route, Navigate, Link, useLocation, useNavigate } from 'react-router-dom';
import { AppBar, Toolbar, Typography, Button, Box, CssBaseline } from '@mui/material';
import { useEffect } from 'react';
import axios from 'axios';
import { getApiUrl } from './utils/api';
import JobList from './pages/JobList';
import JobChat from './pages/JobChat';
import JobDetails from './pages/JobDetails';
import Profile from './pages/Profile';
import Login from './pages/Login';
import Onboarding from './pages/Onboarding';
import Workspace from './pages/Workspace';
import { useStore } from './store';

function AuthGuard() {
  const userEmail = localStorage.getItem('userEmail');
  return userEmail ? <Navigate to="/workspace" replace /> : <Navigate to="/login" replace />;
}

function AppContent() {
  const location = useLocation();
  const navigate = useNavigate();
  const hideNavRoutes = ['/login', '/onboarding'];
  const shouldShowNav = !hideNavRoutes.includes(location.pathname);

  const handleLogout = () => {
    localStorage.removeItem('userEmail');
    localStorage.removeItem('hasOnboarded');
    useStore.setState({ userEmail: null, resumeId: null, allResumeIds: [], jobUrls: [], tailorJobs: {}, applySessions: {} });
    navigate('/login');
  };

  // Auto-logout on 401 from any endpoint except /login itself
  useEffect(() => {
    const id = axios.interceptors.response.use(
      (res) => res,
      (err) => {
        if (err.response?.status === 401 && !err.config?.url?.includes('/login')) {
          handleLogout();
        }
        return Promise.reject(err);
      }
    );
    return () => axios.interceptors.response.eject(id);
  }, []);

  // Validate stored session on every app load — clears stale localStorage after container restart
  useEffect(() => {
    const email = localStorage.getItem('userEmail');
    if (email) {
      axios.get(getApiUrl(`/validate-session?email=${encodeURIComponent(email)}`)).catch(() => {
        // 401 handled by interceptor above → handleLogout fires automatically
      });
    }
  }, []);

  return (
    <Box sx={{ flexGrow: 1, minHeight: '100vh', background: 'var(--clay-bg)' }}>
      {shouldShowNav && (
        <AppBar
          position="sticky"
          elevation={0}
          sx={{
            background: 'rgba(13,13,18,0.85)',
            backdropFilter: 'blur(20px)',
            borderBottom: '1px solid var(--clay-border)',
          }}
        >
          <Toolbar sx={{ gap: 0.5 }}>
            <Typography
              variant="h6"
              component={Link}
              to="/workspace"
              sx={{ flexGrow: 1, fontWeight: 700, color: '#e8e8f0', textDecoration: 'none', letterSpacing: '-0.5px' }}
            >
              Auto<span style={{ color: '#6366f1' }}>Apply</span>
            </Typography>
            {[
              { label: 'Workspace', to: '/workspace' },
              { label: 'Jobs', to: '/jobs' },
              { label: 'Profile', to: '/profile' },
            ].map(({ label, to }) => (
              <Button
                key={to}
                component={Link}
                to={to}
                size="small"
                sx={{
                  color: location.pathname === to ? '#6366f1' : '#7c7c96',
                  fontWeight: 500,
                  fontSize: '0.85rem',
                  px: 1.5,
                  '&:hover': { color: '#e8e8f0', background: 'rgba(255,255,255,0.05)' },
                }}
              >
                {label}
              </Button>
            ))}
            <Button
              size="small"
              onClick={handleLogout}
              sx={{ color: '#4a4a5c', fontSize: '0.8rem', ml: 1, '&:hover': { color: '#ef4444', background: 'transparent' } }}
            >
              Logout
            </Button>
          </Toolbar>
        </AppBar>
      )}

      <Routes>
        <Route path="/" element={<AuthGuard />} />
        <Route path="/login" element={<Login />} />
        <Route path="/onboarding" element={<Onboarding />} />
        <Route path="/workspace" element={<Workspace />} />
        <Route path="/jobs" element={<JobList />} />
        <Route path="/jobs/chat" element={<JobChat />} />
        <Route path="/jobs/:id" element={<JobDetails />} />
        <Route path="/profile" element={<Profile />} />
      </Routes>
    </Box>
  );
}

function App() {
  return (
    <Router>
      <CssBaseline />
      <AppContent />
    </Router>
  );
}

export default App;
