import { FormControl, InputLabel, Select, MenuItem } from '@mui/material';
import { useStore } from '../store';

export default function ResumeSelector({ disabled }: { disabled?: boolean }) {
  const resumeId    = useStore((s) => s.resumeId);
  const allResumeIds = useStore((s) => s.allResumeIds);
  const setResumeId = useStore((s) => s.setResumeId);

  if (allResumeIds.length === 0) return null;

  return (
    <FormControl fullWidth size="small" disabled={disabled}>
      <InputLabel sx={{ fontSize: '0.82rem' }}>Resume</InputLabel>
      <Select
        value={resumeId ?? ''}
        label="Resume"
        onChange={(e) => setResumeId(Number(e.target.value))}
        sx={{ fontSize: '0.82rem', background: 'var(--clay-surface-2)', borderRadius: '8px' }}
      >
        {allResumeIds.map((id) => (
          <MenuItem key={id} value={id} sx={{ fontSize: '0.82rem' }}>
            Resume #{id}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
}
