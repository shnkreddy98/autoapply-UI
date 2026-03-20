import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface TailorJob {
  status: 'idle' | 'running' | 'done' | 'failed';
  resumePath?: string;
}

export interface ApplySession {
  sessionId: string;
  status: 'queued' | 'running' | 'completed' | 'failed' | 'paused';
  currentStep?: string;
}

interface AppStore {
  userEmail: string | null;
  resumeId: number | null;
  allResumeIds: number[];
  jobUrls: string[];
  tailorJobs: Record<string, TailorJob>;
  applySessions: Record<string, ApplySession>;
  vncSessionId: string | null;
  setUser(email: string, resumeId: number): void;
  setResumeId(id: number): void;
  setAllResumeIds(ids: number[]): void;
  setJobUrls(urls: string[]): void;
  setTailorJob(url: string, job: TailorJob): void;
  setApplySession(url: string, session: ApplySession): void;
  openVnc(sessionId: string): void;
  closeVnc(): void;
}

export const useStore = create<AppStore>()(
  persist(
    (set) => ({
      userEmail: null,
      resumeId: null,
      allResumeIds: [],
      jobUrls: [],
      tailorJobs: {},
      applySessions: {},
      vncSessionId: null,

      setUser: (email, resumeId) => set({ userEmail: email, resumeId }),
      setResumeId: (id) => set({ resumeId: id }),
      setAllResumeIds: (ids) => set({ allResumeIds: ids }),
      setJobUrls: (urls) => set({ jobUrls: urls, tailorJobs: {}, applySessions: {} }),
      setTailorJob: (url, job) =>
        set((s) => ({ tailorJobs: { ...s.tailorJobs, [url]: job } })),
      setApplySession: (url, session) =>
        set((s) => ({ applySessions: { ...s.applySessions, [url]: session } })),
      openVnc: (sessionId) => set({ vncSessionId: sessionId }),
      closeVnc: () => set({ vncSessionId: null }),
    }),
    {
      name: 'autoapply-store',
      partialize: (state) => ({
        userEmail: state.userEmail,
        resumeId: state.resumeId,
      }),
    }
  )
);
