import type { LessonTask } from './types';

export function stripAnsi(value: string) {
  return value.replace(/[\u001B\u009B][[\]()#;?]*(?:(?:(?:[a-zA-Z\d]*(?:;[-a-zA-Z\d\/#&.:=?%@~_]+)*)?\u0007)|(?:(?:\d{1,4}(?:[;:]\d{0,4})*)?[\dA-PR-TZcf-nq-uy=><~]))/g, '');
}

export function normalizeCommand(value: string) {
  return value.trim().replace(/\s+/g, ' ');
}

export function taskPassed(task: LessonTask, output: string) {
  const normalized = stripAnsi(output).toLowerCase();
  return task.expected.every((value) => normalized.includes(value.toLowerCase()));
}
