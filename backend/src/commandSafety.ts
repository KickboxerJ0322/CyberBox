export type CommandSafety = { safe: boolean; reason?: string };

const localCommands = [
  /^pwd$/,
  /^whoami$/,
  /^ls(?:\s+-[a-zA-Z]+)?(?:\s+\.)?$/,
  /^cat\s+\/(?:etc\/os-release|home\/cyberbox\/README\.txt)$/,
  /^ip\s+(?:addr|route)$/,
];

const allowedExecutables = new Set(['ping', 'nmap', 'curl', 'gobuster', 'nikto', 'sqlmap', 'dirb']);

export function inspectCommand(rawCommand: string): CommandSafety {
  const command = rawCommand.trim();
  if (!command || command.length > 800) return { safe: false, reason: 'Command is empty or too long.' };
  if (/[;&|><`\n\r]/.test(command) || command.includes('$(')) {
    return { safe: false, reason: 'Shell operators, redirection and substitution are blocked.' };
  }
  if (/\b(?:sudo|su|bash|sh|zsh|eval|exec|nc|netcat|socat)\b/i.test(command)) {
    return { safe: false, reason: 'Shells, privilege changes and listeners are blocked.' };
  }
  if (localCommands.some((pattern) => pattern.test(command))) return { safe: true };

  const executable = (command.split(/\s+/, 1)[0] ?? '').toLowerCase();
  if (!allowedExecutables.has(executable)) {
    return { safe: false, reason: `Tool is not allowed: ${executable}` };
  }
  if (/\b(?:file|ftp|gopher|dict):\/\//i.test(command) || /(?:^|\s)@\//.test(command)) {
    return { safe: false, reason: 'Local files and non-HTTP protocols are blocked.' };
  }
  if (!/(?:^|[\s/:])target(?::3000)?(?:[\s/'"?]|$)/i.test(command)) {
    return { safe: false, reason: 'The destination must be the isolated host named target.' };
  }
  if (/(?:^|\s)(?:--script|--interactive|--os-shell|--file-write|--file-dest|-oN|-oX|-oG|-oA)(?:\s|=|$)/i.test(command)) {
    return { safe: false, reason: 'Dangerous execution and file-output options are blocked.' };
  }
  if (executable === 'ping' && !/^ping\s+-c\s+[1-5]\s+target$/i.test(command)) {
    return { safe: false, reason: 'Use ping -c 1..5 target.' };
  }
  if (executable === 'nmap' && !/^nmap\s+(?:-sV\s+)?-p\s+3000\s+target$/i.test(command)) {
    return { safe: false, reason: 'nmap is limited to port 3000 on target.' };
  }
  if (executable === 'curl') {
    const urls = command.match(/https?:\/\/[^\s'"}]+/gi) ?? [];
    if (urls.length !== 1 || !/^http:\/\/target:3000(?:\/[^\s]*)?$/i.test(urls[0] ?? '')) {
      return { safe: false, reason: 'curl must use one URL on http://target:3000 only.' };
    }
    if (/(?:^|\s)(?:-o|-O|-T|--output|--remote-name|--upload-file)(?:\s|=|$)/.test(command)) {
      return { safe: false, reason: 'File transfer options are blocked.' };
    }
  }
  return { safe: true };
}
