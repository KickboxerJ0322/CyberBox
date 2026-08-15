export type LabSession = {
  sessionId: string;
  createdAt: string;
  expiresAt: string;
  status: 'starting' | 'running' | 'stopping' | 'stopped' | 'failed';
  demoMode?: boolean;
};

export type AiExplanation = { summary: string; details: string[]; nextStep: string };

export type LessonTask = {
  id: string;
  command: string;
  label: string;
  successMessage: string;
  expected: string[];
  hint: string;
};

export type Lesson = {
  id: number;
  short: string;
  title: string;
  objective: string;
  description: string;
  tasks: LessonTask[];
  points: string[];
  caution?: string;
};

export type TargetStatus = { ready: boolean; state: 'starting' | 'ready' };
export type AiStatus = { configured: boolean; model: string };
