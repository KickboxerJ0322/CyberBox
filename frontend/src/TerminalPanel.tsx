import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { stripAnsi } from './progress';

export type TerminalPanelHandle = {
  runCommand: (command: string) => boolean;
  focus: () => void;
};

type Props = {
  sessionId: string;
  onOutput: (command: string, output: string) => void;
  onBusyChange?: (busy: boolean) => void;
};

const TerminalPanel = forwardRef<TerminalPanelHandle, Props>(function TerminalPanel(
  { sessionId, onOutput, onBusyChange },
  ref,
) {
  const host = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const commandBuffer = useRef('');
  const pending = useRef<{ command: string; output: string } | null>(null);
  const completionTimer = useRef<number>();

  const beginCommand = (command: string) => {
    if (!command || pending.current) return false;
    pending.current = { command, output: '' };
    onBusyChange?.(true);
    return true;
  };

  useImperativeHandle(ref, () => ({
    runCommand(command: string) {
      const socket = socketRef.current;
      if (!socket || socket.readyState !== WebSocket.OPEN || !beginCommand(command)) return false;
      socket.send(`${command}\r`);
      terminalRef.current?.focus();
      return true;
    },
    focus() {
      terminalRef.current?.focus();
    },
  }));

  useEffect(() => {
    if (!host.current) return;
    const terminal = new Terminal({
      cursorBlink: true,
      fontSize: 13,
      fontFamily: '"JetBrains Mono", "Cascadia Code", monospace',
      theme: { background: '#080d12', foreground: '#d7e2ea', cursor: '#43f5c5', selectionBackground: '#21495a' },
      scrollback: 3000,
    });
    terminalRef.current = terminal;
    const fit = new FitAddon();
    terminal.loadAddon(fit);
    terminal.open(host.current);
    fit.fit();

    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const socket = new WebSocket(`${protocol}//${location.host}/ws/terminal?sessionId=${encodeURIComponent(sessionId)}`);
    socketRef.current = socket;
    socket.binaryType = 'arraybuffer';
    socket.onopen = () => terminal.focus();
    socket.onmessage = (event) => {
      const text = typeof event.data === 'string' ? event.data : new TextDecoder().decode(event.data);
      terminal.write(text);
      if (!pending.current) return;
      pending.current.output = (pending.current.output + text).slice(-20000);
      const plain = stripAnsi(pending.current.output);
      if (/cyberbox@lab:[^\r\n]*\$\s*$/.test(plain)) {
        window.clearTimeout(completionTimer.current);
        completionTimer.current = window.setTimeout(() => {
          const finished = pending.current;
          pending.current = null;
          onBusyChange?.(false);
          if (finished) onOutput(finished.command, finished.output);
        }, 120);
      }
    };
    socket.onerror = () => terminal.writeln('\r\n\x1b[31mターミナルに接続できませんでした。\x1b[0m');

    const input = terminal.onData((data) => {
      if (data === '\r') {
        const command = commandBuffer.current.trim();
        beginCommand(command);
        commandBuffer.current = '';
      } else if (data === '\x7f') {
        commandBuffer.current = commandBuffer.current.slice(0, -1);
      } else if (!data.startsWith('\x1b') && data >= ' ') {
        commandBuffer.current += data;
      }
      if (socket.readyState === WebSocket.OPEN) socket.send(data);
    });
    const observer = new ResizeObserver(() => fit.fit());
    observer.observe(host.current);
    return () => {
      window.clearTimeout(completionTimer.current);
      observer.disconnect();
      input.dispose();
      socket.close();
      terminal.dispose();
      terminalRef.current = null;
      socketRef.current = null;
      pending.current = null;
    };
  }, [sessionId, onOutput, onBusyChange]);

  return <div className="terminal-host" ref={host} aria-label="CyberBox terminal" />;
});

export default TerminalPanel;
