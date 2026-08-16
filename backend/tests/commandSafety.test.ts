import { describe, expect, it } from 'vitest';
import { inspectCommand } from '../src/commandSafety.js';

describe('AI command safety', () => {
  it.each([
    'pwd',
    'cat /etc/os-release',
    'ping -c 3 target',
    'nmap -sV -p 3000 target',
    'curl -I http://target:3000',
    `curl -s -X POST http://target:3000/rest/user/login -H "Content-Type: application/json" --data "{\\"email\\":\\"admin' OR 1=1--\\",\\"password\\":\\"x\\"}"`,
  ])('allows an isolated lab command: %s', (command) => {
    expect(inspectCommand(command)).toEqual({ safe: true });
  });

  it.each([
    'curl https://example.com',
    'nmap 192.168.1.1',
    'curl http://target:3000; whoami',
    'nmap --script vuln target',
    'nc -l 4444',
    'cat /etc/shadow',
  ])('blocks an unsafe or out-of-scope command: %s', (command) => {
    expect(inspectCommand(command).safe).toBe(false);
  });
});
