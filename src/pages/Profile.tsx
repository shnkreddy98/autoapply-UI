import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Typography, Button, TextField, Select, MenuItem,
  FormControl, InputLabel, Switch, FormControlLabel, Checkbox,
  CircularProgress, Alert, Snackbar, LinearProgress, Tooltip,
  Divider,
} from '@mui/material';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import PersonOutlineIcon from '@mui/icons-material/PersonOutline';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import axios from 'axios';
import type { ProfileData, UserOnboarding, EmploymentType, YesNoNA } from '../types';
import { formatLocalDate } from '../utils/dateUtils';
import { getApiUrl } from '../utils/api';

type Section = 'resume' | 'application';

const EMPTY_FORM: UserOnboarding = {
  full_name: '', street_address: '', city: '', state: '', zip_code: '',
  phone_number: '', email_address: '', date_of_birth: '',
  age_18_or_older: true, work_eligible_us: true, visa_sponsorship: false,
  available_start_date: '', employment_type: 'Full-time' as EmploymentType,
  willing_relocate: false, willing_travel: false, travel_percentage: '',
  desired_salary: '', gender: undefined, race_ethnicity: undefined,
  veteran_status: undefined, disability_status: undefined,
  current_employee: false, ever_terminated: false, termination_explanation: '',
  security_clearance: 'No' as YesNoNA,
  cert_accuracy: false, cert_dismissal: false, cert_background_check: false,
  cert_drug_testing: false, cert_at_will: false, cert_job_description: false,
  cert_privacy_notice: false, cert_data_processing: false,
  electronic_signature: '', signature_date: new Date().toISOString().slice(0, 10),
};

const SidebarItem = ({ icon, label, active, done, onClick }: {
  icon: React.ReactNode; label: string; active: boolean; done: boolean; onClick: () => void;
}) => (
  <Box
    onClick={onClick}
    sx={{
      display: 'flex', alignItems: 'center', gap: 1.5, px: 2, py: 1.2,
      cursor: 'pointer', borderRadius: 1, mx: 1,
      background: active ? 'rgba(99,102,241,0.12)' : 'transparent',
      borderLeft: active ? '2px solid #6366f1' : '2px solid transparent',
      '&:hover': { background: active ? 'rgba(99,102,241,0.15)' : 'var(--clay-surface-2)' },
    }}
  >
    <Box sx={{ color: active ? '#6366f1' : 'text.secondary', display: 'flex' }}>{icon}</Box>
    <Typography sx={{ flex: 1, fontSize: '0.83rem', fontWeight: active ? 600 : 400, color: active ? '#e8e8f0' : '#7c7c96' }}>
      {label}
    </Typography>
    {done
      ? <CheckCircleIcon sx={{ fontSize: 14, color: '#10b981' }} />
      : <RadioButtonUncheckedIcon sx={{ fontSize: 14, color: '#3a3a52' }} />}
  </Box>
);

const FieldRow = ({ children }: { children: React.ReactNode }) => (
  <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 2, mb: 2 }}>
    {children}
  </Box>
);

export default function Profile() {
  const [section, setSection] = useState<Section>('resume');

  // Resume state
  const [resumes, setResumes] = useState<number[]>([]);
  const [resumeId, setResumeId] = useState<string>('');
  const [resumeData, setResumeData] = useState<ProfileData | null>(null);
  const [uploading, setUploading] = useState(false);
  const [loadingResume, setLoadingResume] = useState(false);

  // Application state
  const [form, setForm] = useState<UserOnboarding>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [loadingForm, setLoadingForm] = useState(false);
  const [hasUserData, setHasUserData] = useState(false);

  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false, message: '', severity: 'success',
  });
  const [calcYoe, setCalcYoe] = useState<number | null>(null);

  const userEmail = localStorage.getItem('userEmail') ?? '';

  // Completion
  const hasResume = resumes.length > 0;
  const completion = (hasResume ? 50 : 0) + (hasUserData ? 50 : 0);

  const showSnack = (message: string, severity: 'success' | 'error') =>
    setSnackbar({ open: true, message, severity });

  // Load resumes
  const loadResumes = useCallback(async () => {
    try {
      const res = await axios.get(getApiUrl('/list-resumes'));
      if (Array.isArray(res.data)) {
        setResumes(res.data);
        if (res.data.length > 0 && !resumeId) setResumeId(String(res.data[0]));
      }
    } catch { /* ignore */ }
  }, [resumeId]);

  // Load resume detail
  const loadResumeDetail = useCallback(async (id: string) => {
    if (!id) return;
    setLoadingResume(true);
    try {
      const res = await axios.get<ProfileData>(getApiUrl(`/get-details?resume_id=${id}`));
      setResumeData(res.data);
    } catch { setResumeData(null); }
    finally { setLoadingResume(false); }
  }, []);

  // Load user application data
  const loadUserData = useCallback(async () => {
    if (!userEmail) return;
    setLoadingForm(true);
    try {
      const res = await axios.get(getApiUrl(`/user-form?email=${encodeURIComponent(userEmail)}`));
      const d = res.data;
      setForm({
        ...EMPTY_FORM, ...d,
        // backend uses email, frontend uses email_address
        email_address: d.email ?? d.email_address ?? userEmail,
      });
      if (d.years_of_experience) setCalcYoe(d.years_of_experience);
      setHasUserData(true);
    } catch (e: any) {
      if (e.response?.status === 404) {
        // No user_data yet — pre-fill from signup info + calculated YOE
        const prefill: Partial<UserOnboarding> = { email_address: userEmail };
        try {
          const infoRes = await axios.get(getApiUrl(`/user-info?email=${encodeURIComponent(userEmail)}`));
          const u = infoRes.data;
          prefill.full_name = u.name ?? '';
          prefill.phone_number = u.phone ?? '';
        } catch { /* ignore */ }
        try {
          const yoeRes = await axios.get(getApiUrl(`/profile/yoe?email=${encodeURIComponent(userEmail)}`));
          if (yoeRes.data?.years_of_experience) {
            setCalcYoe(yoeRes.data.years_of_experience);
            prefill.years_of_experience = yoeRes.data.years_of_experience;
          }
        } catch { /* ignore */ }
        setForm({ ...EMPTY_FORM, ...prefill });
      }
    }
    finally { setLoadingForm(false); }
  }, [userEmail]);

  useEffect(() => { loadResumes(); loadUserData(); }, []);
  useEffect(() => { if (resumeId) loadResumeDetail(resumeId); }, [resumeId]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length) return;
    const file = e.target.files[0];
    if (!file.name.toLowerCase().endsWith('.docx')) {
      showSnack('Please upload a .docx file only.', 'error'); return;
    }
    if (!userEmail) { showSnack('No user email found. Please log in again.', 'error'); return; }
    const fd = new FormData();
    fd.append('file', file);
    setUploading(true);
    try {
      const up = await axios.post<{ resume_id: number; path: string }>(
        getApiUrl(`/upload?user_email=${encodeURIComponent(userEmail)}`), fd,
        { headers: { 'Content-Type': 'multipart/form-data' } },
      );
      await axios.post<number>(getApiUrl('/upload-resume'), { path: up.data.path });
      await loadResumes();
      showSnack('Resume uploaded and parsed successfully!', 'success');
    } catch (err: any) {
      const msg = axios.isAxiosError(err) && err.response?.data?.detail
        ? err.response.data.detail : 'Failed to upload resume.';
      showSnack(msg, 'error');
    } finally { setUploading(false); }
  };

  const set = (key: keyof UserOnboarding, val: any) =>
    setForm((f) => ({ ...f, [key]: val }));

  const handleSave = async () => {
    if (!form.email_address) { showSnack('Email is required.', 'error'); return; }
    setSaving(true);
    try {
      await axios.post(getApiUrl('/user-form'), form);
      setHasUserData(true);
      localStorage.setItem('hasOnboarded', '1');
      showSnack('Application details saved!', 'success');
    } catch (err: any) {
      const msg = axios.isAxiosError(err) && err.response?.data?.detail
        ? err.response.data.detail : 'Failed to save details.';
      showSnack(msg, 'error');
    } finally { setSaving(false); }
  };

  const p = resumeData ?? {
    contact: { name: '', email: '', location: '', phone: '', country_code: '', linkedin: '', github: '' },
    job_exp: [], skills: [], education: [], certifications: [], projects: [], achievements: [],
  };

  return (
    <Box sx={{ display: 'flex', height: 'calc(100vh - 64px)', overflow: 'hidden', background: 'var(--clay-bg)' }}>

      {/* Sidebar */}
      <Box sx={{
        width: 200, flexShrink: 0,
        borderRight: '1px solid var(--clay-border)',
        background: 'var(--clay-surface)',
        display: 'flex', flexDirection: 'column', pt: 1,
      }}>
        {/* Completion */}
        <Box sx={{ px: 2, pb: 2, pt: 1 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
            <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary' }}>Profile</Typography>
            <Typography sx={{ fontSize: '0.7rem', color: completion === 100 ? '#10b981' : '#f59e0b', fontWeight: 600 }}>
              {completion}%
            </Typography>
          </Box>
          <LinearProgress
            variant="determinate" value={completion}
            sx={{
              height: 4, borderRadius: 2,
              '& .MuiLinearProgress-bar': { background: completion === 100 ? '#10b981' : '#6366f1' },
              background: 'var(--clay-surface-2)',
            }}
          />
        </Box>

        <Divider sx={{ borderColor: 'var(--clay-border)', mb: 0.5 }} />

        <SidebarItem
          icon={<DescriptionOutlinedIcon sx={{ fontSize: 16 }} />}
          label="Resume"
          active={section === 'resume'}
          done={hasResume}
          onClick={() => setSection('resume')}
        />
        <SidebarItem
          icon={<PersonOutlineIcon sx={{ fontSize: 16 }} />}
          label="Application Details"
          active={section === 'application'}
          done={hasUserData}
          onClick={() => setSection('application')}
        />
      </Box>

      {/* Main content */}
      <Box sx={{ flex: 1, overflowY: 'auto', p: 3 }}>

        {/* ── RESUME SECTION ── */}
        {section === 'resume' && (
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
              <Typography variant="h6" sx={{ flex: 1, fontWeight: 600 }}>Resume</Typography>
              {resumes.length > 1 && (
                <FormControl size="small" sx={{ minWidth: 130 }}>
                  <InputLabel>Resume</InputLabel>
                  <Select value={resumeId} label="Resume" onChange={(e) => setResumeId(e.target.value)}>
                    {resumes.map((id) => (
                      <MenuItem key={id} value={String(id)}>Resume #{id}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              )}
              <Tooltip title="Only .docx files are supported">
                <Button variant="contained" component="label" disabled={uploading} size="small">
                  {uploading ? <><CircularProgress size={14} sx={{ mr: 1 }} />Uploading…</> : 'Upload Resume'}
                  <input type="file" hidden accept=".docx" onChange={handleUpload} />
                </Button>
              </Tooltip>
            </Box>

            {!hasResume && (
              <Alert severity="info" sx={{ mb: 3 }}>
                No resume uploaded yet. Upload a .docx file to get started.
              </Alert>
            )}

            {loadingResume ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', mt: 6 }}><CircularProgress /></Box>
            ) : resumeData && (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>

                {/* Contact */}
                <Section title="Contact">
                  <FieldRow>
                    {(['name', 'email', 'phone', 'location', 'linkedin', 'github'] as const).map((f) => (
                      <TextField key={f} label={f.charAt(0).toUpperCase() + f.slice(1)}
                        value={p.contact[f] ?? ''} size="small" slotProps={{ input: { readOnly: true } }} />
                    ))}
                  </FieldRow>
                </Section>

                {/* Experience */}
                {p.job_exp.length > 0 && (
                  <Section title="Experience">
                    {p.job_exp.map((job, i) => (
                      <Box key={i} sx={{ mb: i < p.job_exp.length - 1 ? 2 : 0 }}>
                        <FieldRow>
                          <TextField label="Title" value={job.job_title ?? ''} size="small" slotProps={{ input: { readOnly: true } }} />
                          <TextField label="Company" value={job.company_name ?? ''} size="small" slotProps={{ input: { readOnly: true } }} />
                          <TextField label="Location" value={job.location ?? ''} size="small" slotProps={{ input: { readOnly: true } }} />
                          <TextField label="From" value={formatLocalDate(job.from_date)} size="small" slotProps={{ input: { readOnly: true } }} />
                          <TextField label="To" value={formatLocalDate(job.to_date)} size="small" slotProps={{ input: { readOnly: true } }} />
                        </FieldRow>
                        <TextField fullWidth multiline rows={2} label="Experience" size="small"
                          value={job.experience?.join('\n') ?? ''} slotProps={{ input: { readOnly: true } }} />
                        {i < p.job_exp.length - 1 && <Divider sx={{ mt: 2, borderColor: 'var(--clay-border)' }} />}
                      </Box>
                    ))}
                  </Section>
                )}

                {/* Education */}
                {p.education.length > 0 && (
                  <Section title="Education">
                    {p.education.map((edu, i) => (
                      <Box key={i} sx={{ mb: i < p.education.length - 1 ? 2 : 0 }}>
                        <FieldRow>
                          <TextField label="Degree" value={edu.degree ?? ''} size="small" slotProps={{ input: { readOnly: true } }} />
                          <TextField label="Major" value={edu.major ?? ''} size="small" slotProps={{ input: { readOnly: true } }} />
                          <TextField label="College" value={edu.college ?? ''} size="small" slotProps={{ input: { readOnly: true } }} />
                          <TextField label="From" value={formatLocalDate(edu.from_date)} size="small" slotProps={{ input: { readOnly: true } }} />
                          <TextField label="To" value={formatLocalDate(edu.to_date)} size="small" slotProps={{ input: { readOnly: true } }} />
                        </FieldRow>
                        {i < p.education.length - 1 && <Divider sx={{ mt: 1, borderColor: 'var(--clay-border)' }} />}
                      </Box>
                    ))}
                  </Section>
                )}

                {/* Skills */}
                {p.skills.length > 0 && (
                  <Section title="Skills">
                    {p.skills.map((s, i) => (
                      <Box key={i} sx={{ mb: 1.5 }}>
                        <Typography sx={{ fontSize: '0.72rem', color: 'text.secondary', mb: 0.5 }}>{s.title}</Typography>
                        <TextField fullWidth value={s.skills ?? ''} size="small" slotProps={{ input: { readOnly: true } }} />
                      </Box>
                    ))}
                  </Section>
                )}

                {/* Certifications */}
                {p.certifications.length > 0 && (
                  <Section title="Certifications">
                    {p.certifications.map((c, i) => (
                      <Box key={i} sx={{ mb: i < p.certifications.length - 1 ? 1.5 : 0 }}>
                        <FieldRow>
                          <TextField label="Title" value={c.title ?? ''} size="small" slotProps={{ input: { readOnly: true } }} />
                          <TextField label="Obtained" value={formatLocalDate(c.obtained_date)} size="small" slotProps={{ input: { readOnly: true } }} />
                          <TextField label="Expires" value={c.expiry_date ?? 'N/A'} size="small" slotProps={{ input: { readOnly: true } }} />
                        </FieldRow>
                      </Box>
                    ))}
                  </Section>
                )}
              </Box>
            )}
          </Box>
        )}

        {/* ── APPLICATION DETAILS SECTION ── */}
        {section === 'application' && (
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 600, mb: 3 }}>Application Details</Typography>
            {loadingForm ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', mt: 6 }}><CircularProgress /></Box>
            ) : (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>

                <Section title="Personal Information">
                  <FieldRow>
                    <TextField label="Full Name" value={form.full_name} onChange={(e) => set('full_name', e.target.value)} size="small" required />
                    <TextField label="Email" value={form.email_address} onChange={(e) => set('email_address', e.target.value)} size="small" required />
                    <TextField label="Phone" value={form.phone_number} onChange={(e) => set('phone_number', e.target.value)} size="small" required />
                    <TextField label="Date of Birth" value={form.date_of_birth ?? ''} onChange={(e) => set('date_of_birth', e.target.value)} size="small" placeholder="MM/DD/YYYY" />
                  </FieldRow>
                  <FieldRow>
                    <TextField label="Street Address" value={form.street_address} onChange={(e) => set('street_address', e.target.value)} size="small" required />
                    <TextField label="City" value={form.city} onChange={(e) => set('city', e.target.value)} size="small" required />
                    <TextField label="State" value={form.state} onChange={(e) => set('state', e.target.value)} size="small" required />
                    <TextField label="ZIP Code" value={form.zip_code} onChange={(e) => set('zip_code', e.target.value)} size="small" required />
                  </FieldRow>
                  <Box sx={{ display: 'flex', gap: 3 }}>
                    <FormControlLabel control={<Switch checked={form.age_18_or_older} onChange={(e) => set('age_18_or_older', e.target.checked)} size="small" />} label={<Typography sx={{ fontSize: '0.82rem' }}>18 or older</Typography>} />
                  </Box>
                </Section>

                <Section title="Work Authorization">
                  <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                    <FormControlLabel control={<Switch checked={form.work_eligible_us} onChange={(e) => set('work_eligible_us', e.target.checked)} size="small" />} label={<Typography sx={{ fontSize: '0.82rem' }}>Eligible to work in the US</Typography>} />
                    <FormControlLabel control={<Switch checked={form.visa_sponsorship} onChange={(e) => set('visa_sponsorship', e.target.checked)} size="small" />} label={<Typography sx={{ fontSize: '0.82rem' }}>Requires visa sponsorship</Typography>} />
                  </Box>
                  <Box sx={{ mt: 2 }}>
                    <FormControl size="small" sx={{ minWidth: 180 }}>
                      <InputLabel>Security Clearance</InputLabel>
                      <Select value={form.security_clearance} label="Security Clearance" onChange={(e) => set('security_clearance', e.target.value)}>
                        {['Yes', 'No', 'N/A'].map((v) => <MenuItem key={v} value={v}>{v}</MenuItem>)}
                      </Select>
                    </FormControl>
                  </Box>
                </Section>

                <Section title="Position Preferences">
                  <FieldRow>
                    <TextField label="Available Start Date" value={form.available_start_date} onChange={(e) => set('available_start_date', e.target.value)} size="small" required placeholder="e.g. Immediately, 2 weeks" />
                    <TextField label="Desired Salary" value={form.desired_salary} onChange={(e) => set('desired_salary', e.target.value)} size="small" required placeholder="e.g. $120,000" />
                    <FormControl size="small">
                      <InputLabel>Employment Type</InputLabel>
                      <Select value={form.employment_type} label="Employment Type" onChange={(e) => set('employment_type', e.target.value)}>
                        {['Full-time', 'Part-time', 'Either'].map((v) => <MenuItem key={v} value={v}>{v}</MenuItem>)}
                      </Select>
                    </FormControl>
                    <TextField
                      label="Years of Experience" type="number"
                      value={form.years_of_experience ?? ''}
                      onChange={(e) => set('years_of_experience', e.target.value ? Number(e.target.value) : undefined)}
                      size="small" inputProps={{ min: 0, max: 60 }}
                      helperText={calcYoe ? `Calculated from resume: ${calcYoe} yrs` : 'Total professional experience'}
                    />
                  </FieldRow>
                  <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap', mb: 2 }}>
                    <FormControlLabel control={<Switch checked={form.willing_relocate} onChange={(e) => set('willing_relocate', e.target.checked)} size="small" />} label={<Typography sx={{ fontSize: '0.82rem' }}>Willing to relocate</Typography>} />
                    <FormControlLabel control={<Switch checked={form.willing_travel} onChange={(e) => set('willing_travel', e.target.checked)} size="small" />} label={<Typography sx={{ fontSize: '0.82rem' }}>Willing to travel</Typography>} />
                  </Box>
                  {form.willing_travel && (
                    <TextField label="Travel Percentage" value={form.travel_percentage ?? ''} onChange={(e) => set('travel_percentage', e.target.value)} size="small" placeholder="e.g. 25%" sx={{ maxWidth: 200 }} />
                  )}
                </Section>

                <Section title="Employment History">
                  <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap', mb: 2 }}>
                    <FormControlLabel control={<Switch checked={form.current_employee} onChange={(e) => set('current_employee', e.target.checked)} size="small" />} label={<Typography sx={{ fontSize: '0.82rem' }}>Currently employed</Typography>} />
                    <FormControlLabel control={<Switch checked={form.ever_terminated} onChange={(e) => set('ever_terminated', e.target.checked)} size="small" />} label={<Typography sx={{ fontSize: '0.82rem' }}>Ever terminated/asked to resign</Typography>} />
                  </Box>
                  {form.ever_terminated && (
                    <TextField fullWidth label="Explanation" value={form.termination_explanation ?? ''} onChange={(e) => set('termination_explanation', e.target.value)} size="small" multiline rows={2} />
                  )}
                </Section>

                <Section title="EEO Information (Voluntary)">
                  <FieldRow>
                    <FormControl size="small">
                      <InputLabel>Gender</InputLabel>
                      <Select value={form.gender ?? ''} label="Gender" onChange={(e) => set('gender', e.target.value || undefined)}>
                        <MenuItem value="">Prefer not to answer</MenuItem>
                        {['Male', 'Female', 'Non-binary', 'Prefer not to answer'].map((v) => <MenuItem key={v} value={v}>{v}</MenuItem>)}
                      </Select>
                    </FormControl>
                    <FormControl size="small">
                      <InputLabel>Race / Ethnicity</InputLabel>
                      <Select value={form.race_ethnicity ?? ''} label="Race / Ethnicity" onChange={(e) => set('race_ethnicity', e.target.value || undefined)}>
                        <MenuItem value="">Prefer not to answer</MenuItem>
                        {['Hispanic or Latino', 'White', 'Black or African American', 'Asian', 'American Indian or Alaska Native', 'Native Hawaiian or Other Pacific Islander', 'Two or More Races', 'Prefer not to answer'].map((v) => <MenuItem key={v} value={v}>{v}</MenuItem>)}
                      </Select>
                    </FormControl>
                    <FormControl size="small">
                      <InputLabel>Veteran Status</InputLabel>
                      <Select value={form.veteran_status ?? ''} label="Veteran Status" onChange={(e) => set('veteran_status', e.target.value || undefined)}>
                        <MenuItem value="">Prefer not to answer</MenuItem>
                        {['Not a veteran', 'Disabled veteran', 'Recently separated veteran', 'Active wartime veteran', 'Armed Forces service medal veteran', 'Other protected veteran', 'Prefer not to answer'].map((v) => <MenuItem key={v} value={v}>{v}</MenuItem>)}
                      </Select>
                    </FormControl>
                    <FormControl size="small">
                      <InputLabel>Disability Status</InputLabel>
                      <Select value={form.disability_status ?? ''} label="Disability Status" onChange={(e) => set('disability_status', e.target.value || undefined)}>
                        <MenuItem value="">Prefer not to answer</MenuItem>
                        {['Yes, I have a disability', 'No, I do not have a disability', 'Prefer not to answer'].map((v) => <MenuItem key={v} value={v}>{v}</MenuItem>)}
                      </Select>
                    </FormControl>
                  </FieldRow>
                </Section>

                <Section title="Declarations">
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                    {([
                      ['cert_accuracy', 'All information provided is true and accurate'],
                      ['cert_dismissal', 'False statements may result in dismissal'],
                      ['cert_background_check', 'I authorize background/reference checks'],
                      ['cert_drug_testing', 'I authorize drug testing (if applicable)'],
                      ['cert_at_will', 'I understand this is at-will employment'],
                      ['cert_job_description', 'I have read and understand the job description'],
                      ['cert_privacy_notice', 'I acknowledge receipt of privacy notice'],
                      ['cert_data_processing', 'I consent to data processing for this application'],
                    ] as [keyof UserOnboarding, string][]).map(([key, label]) => (
                      <FormControlLabel key={key}
                        control={<Checkbox checked={!!form[key]} onChange={(e) => set(key, e.target.checked)} size="small" />}
                        label={<Typography sx={{ fontSize: '0.82rem' }}>{label}</Typography>}
                      />
                    ))}
                  </Box>
                </Section>

                <Section title="Signature">
                  <FieldRow>
                    <TextField label="Electronic Signature" value={form.electronic_signature} onChange={(e) => set('electronic_signature', e.target.value)} size="small" placeholder="Type your full name" />
                    <TextField label="Date" value={form.signature_date} onChange={(e) => set('signature_date', e.target.value)} size="small" type="date" slotProps={{ inputLabel: { shrink: true } }} />
                  </FieldRow>
                </Section>

                <Box>
                  <Button variant="contained" onClick={handleSave} disabled={saving} sx={{ minWidth: 140 }}>
                    {saving ? <><CircularProgress size={16} sx={{ mr: 1 }} />Saving…</> : 'Save Details'}
                  </Button>
                </Box>
              </Box>
            )}
          </Box>
        )}
      </Box>

      <Snackbar open={snackbar.open} autoHideDuration={5000} onClose={() => setSnackbar((s) => ({ ...s, open: false }))}>
        <Alert severity={snackbar.severity} onClose={() => setSnackbar((s) => ({ ...s, open: false }))} sx={{ width: '100%' }}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}

// ── Small section wrapper ──────────────────────────────────────────────────────
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Box sx={{ background: 'var(--clay-surface)', border: '1px solid var(--clay-border)', borderRadius: 2, p: 2.5 }}>
      <Typography sx={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'text.secondary', mb: 2 }}>
        {title}
      </Typography>
      {children}
    </Box>
  );
}
