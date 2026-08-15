import { describe, expect, it } from 'vitest';
import { normalizeCommand, stripAnsi, taskPassed } from './progress';
import type { LessonTask } from './types';

const task: LessonTask = {
  id: 'nmap', command: 'nmap -p 3000 target', label: 'scan',
  expected: ['3000/tcp', 'open'], successMessage: 'ok', hint: 'retry',
};

describe('lesson progress', () => {
  it('accepts output containing every expected marker', () => {
    expect(taskPassed(task, '\x1b[32m3000/tcp open http\x1b[0m')).toBe(true);
  });
  it('rejects incomplete output', () => {
    expect(taskPassed(task, '3000/tcp closed')).toBe(false);
  });
  it('normalizes commands and terminal colors', () => {
    expect(normalizeCommand(' nmap   target ')).toBe('nmap target');
    expect(stripAnsi('\x1b[32mready\x1b[0m')).toBe('ready');
  });
});
