import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  Bot, Box, Check, ChevronRight, CircleStop, Clock3, ExternalLink, GraduationCap,
  HelpCircle, LoaderCircle, Play, RefreshCw, ShieldCheck, Sparkles, TerminalSquare, X,
} from 'lucide-react';
import { api } from './api';
import { allTasks, lessons } from './lessons';
import { normalizeCommand, taskPassed } from './progress';
import TerminalPanel, { type TerminalPanelHandle } from './TerminalPanel';
import type { AiExplanation, AiStatus, AssistantReply, LabSession, LessonTask } from './types';

const PROGRESS_KEY = 'cyberbox-progress-v1';
const TUTORIAL_KEY = 'cyberbox-tutorial-v1';
const formatTime = (seconds: number) => `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;

type Feedback = { taskId: string; passed: boolean; message: string } | null;

export default function App() {
  const [session, setSession] = useState<LabSession | null>(null);
  const [selectedLesson, setSelectedLesson] = useState(lessons[0]);
  const [secondsLeft, setSecondsLeft] = useState(3600);
  const [busy, setBusy] = useState(false);
  const [commandBusy, setCommandBusy] = useState(false);
  const [error, setError] = useState('');
  const [lastResult, setLastResult] = useState({ command: '', output: '' });
  const [explanation, setExplanation] = useState<AiExplanation | null>(null);
  const [assistantMessage, setAssistantMessage] = useState('');
  const [assistantReply, setAssistantReply] = useState<AssistantReply | null>(null);
  const [aiStatus, setAiStatus] = useState<AiStatus | null>(null);
  const [tutorialOpen, setTutorialOpen] = useState(false);
  const [tutorialStep, setTutorialStep] = useState(0);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [completed, setCompleted] = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem(PROGRESS_KEY) || '[]')); } catch { return new Set(); }
  });
  const terminalRef = useRef<TerminalPanelHandle>(null);

  useEffect(() => {
    if (!session) return;
    const tick = () => setSecondsLeft(Math.max(0, Math.floor((new Date(session.expiresAt).getTime() - Date.now()) / 1000)));
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [session]);

  useEffect(() => { localStorage.setItem(PROGRESS_KEY, JSON.stringify([...completed])); }, [completed]);

  const start = async () => {
    setBusy(true); setError('');
    try {
      setSession(await api.startLab());
      setAiStatus(await api.aiStatus().catch(() => null));
      if (!localStorage.getItem(TUTORIAL_KEY)) { setTutorialStep(0); setTutorialOpen(true); }
    } catch (e) { setError(e instanceof Error ? e.message : 'ラボの起動に失敗しました。'); }
    finally { setBusy(false); }
  };

  const stop = async () => {
    if (!session) return;
    setBusy(true);
    try { await api.stopLab(session.sessionId); setSession(null); setExplanation(null); }
    catch (e) { setError(e instanceof Error ? e.message : 'ラボの停止に失敗しました。'); }
    finally { setBusy(false); }
  };

  const rememberOutput = useCallback((command: string, output: string) => {
    setExplanation(null);
    setLastResult({ command, output });
    const task = allTasks.find((candidate) => normalizeCommand(candidate.command) === normalizeCommand(command));
    if (!task) { setFeedback(null); return; }
    const passed = taskPassed(task, output);
    setFeedback({ taskId: task.id, passed, message: passed ? task.successMessage : task.hint });
    if (passed) setCompleted((current) => new Set(current).add(task.id));
  }, []);

  const handleCommandBusy = useCallback((running: boolean) => {
    setCommandBusy(running);
    if (running) setExplanation(null);
  }, []);

  const runTask = (task: LessonTask) => {
    setFeedback(null);
    const started = terminalRef.current?.runCommand(task.command);
    if (!started) setError(commandBusy ? '前のコマンドが完了するまでお待ちください。' : 'ターミナルの接続を確認してください。');
    else setError('');
  };

  const explain = async () => {
    if (!session || !lastResult.command) return;
    setBusy(true); setError('');
    try { setExplanation(await api.explain(session.sessionId, selectedLesson.id, lastResult.command, lastResult.output)); }
    catch (e) { setError(e instanceof Error ? e.message : 'AI解説を取得できませんでした。'); }
    finally { setBusy(false); }
  };

  const askAssistant = async () => {
    if (!session || !assistantMessage.trim()) return;
    setBusy(true); setError(''); setAssistantReply(null);
    try { setAssistantReply(await api.askAssistant(session.sessionId, selectedLesson.id, assistantMessage.trim())); }
    catch (e) { setError(e instanceof Error ? e.message : 'Geminiへの相談に失敗しました。'); }
    finally { setBusy(false); }
  };

  const runAiCommand = (command: string) => {
    if (!window.confirm(`安全検査を通過した次のコマンドを、隔離ターミナルで実行しますか？\n\n${command}`)) return;
    const started = terminalRef.current?.runCommand(command);
    if (!started) setError(commandBusy ? '前のコマンドが完了するまでお待ちください。' : 'ターミナルの接続を確認してください。');
    else setError('');
  };

  const completedCount = completed.size;
  const lessonDone = (lessonId: number) => lessons.find((lesson) => lesson.id === lessonId)!.tasks.every((task) => completed.has(task.id));

  if (!session) return <Home busy={busy} error={error} onStart={start} />;

  return <main className="app-shell">
    <header className="topbar"><Brand/><div className="top-actions">
      <div className="course-progress"><span>進捗 {completedCount}/{allTasks.length}</span><i><b style={{ width: `${completedCount / allTasks.length * 100}%` }}/></i></div>
      <div className="timer"><Clock3 size={15}/><span>LAB TIME</span><strong>{formatTime(secondsLeft)}</strong><i style={{ width: `${secondsLeft / 36}%` }}/></div>
      <button className="guide-button" onClick={() => { setTutorialStep(0); setTutorialOpen(true); }}><HelpCircle size={15}/> ガイド</button>
      <span className="online"><b/> {session.demoMode ? 'DEMO' : 'ISOLATED'}</span>
      <button className="stop" onClick={stop} disabled={busy}><CircleStop size={16}/> Stop Lab</button>
    </div></header>
    {error && <div className="error-bar">{error}<button onClick={() => setError('')} aria-label="閉じる"><X size={13}/></button></div>}
    <div className="workspace">
      <aside className="lessons"><div className="section-heading"><GraduationCap size={15}/> LESSONS</div>
        {lessons.map((lesson) => <button key={lesson.id} className={selectedLesson.id === lesson.id ? 'lesson active' : 'lesson'} onClick={() => { setSelectedLesson(lesson); setFeedback(null); }}>
          <span>{lessonDone(lesson.id) ? <Check size={12}/> : String(lesson.id).padStart(2, '0')}</span><div><strong>{lesson.short}</strong><small>{lesson.title}</small></div><ChevronRight size={15}/>
        </button>)}
        <div className="session-id"><span>SESSION</span><code>{session.sessionId.slice(0, 12)}</code></div>
      </aside>
      <section className="main-grid">
        <article className="lesson-card panel"><div className="panel-title"><span><GraduationCap size={14}/> LESSON {selectedLesson.id}</span><span>{selectedLesson.tasks.filter((task) => completed.has(task.id)).length}/{selectedLesson.tasks.length} 完了</span></div>
          <div className="lesson-body"><p className="kicker">{selectedLesson.objective}</p><h2>{selectedLesson.title}</h2><p>{selectedLesson.description}</p>
            <div className="task-list">{selectedLesson.tasks.map((task) => <div className={`task-row ${completed.has(task.id) ? 'done' : ''}`} key={task.id}>
              <span className="task-check">{completed.has(task.id) ? <Check size={13}/> : <TerminalSquare size={13}/>}</span>
              <div><strong>{task.label}</strong><code>$ {task.command}</code></div>
              <button onClick={() => runTask(task)} disabled={commandBusy}>{commandBusy ? <LoaderCircle className="spin" size={13}/> : <Play size={13} fill="currentColor"/>} 実行</button>
            </div>)}</div>
            {feedback && selectedLesson.tasks.some((task) => task.id === feedback.taskId) && <div className={`validation ${feedback.passed ? 'passed' : 'failed'}`}><strong>{feedback.passed ? '正解' : 'もう一度確認'}</strong>{feedback.message}</div>}
            {selectedLesson.caution && <div className="caution">{selectedLesson.caution}</div>}
          </div>
        </article>
        <TargetPanel sessionId={session.sessionId}/>
        <article className="terminal panel"><div className="panel-title"><span><TerminalSquare size={14}/> TERMINAL</span><span className="shell-label">{commandBusy ? '実行中…' : 'cyberbox@lab'}</span></div>
          <TerminalPanel ref={terminalRef} sessionId={session.sessionId} onOutput={rememberOutput} onBusyChange={handleCommandBusy}/>
          <div className="terminal-footer"><span>{lastResult.command ? `Last: ${lastResult.command}` : '上の「実行」ボタン、またはターミナルからコマンドを実行できます'}</span><button onClick={explain} disabled={busy || !lastResult.command}><Sparkles size={14}/> Geminiで解説</button></div>
        </article>
        <article className="ai panel"><div className="panel-title"><span><Bot size={14}/> GEMINI CHAT</span><span className="ai-panel-actions"><span className={`ai-badge ${aiStatus?.configured ? 'ready' : ''}`}>{aiStatus?.configured ? 'READY' : '固定ガイド'}</span></span></div>
          <div className="ai-content ai-chat">
            <form className="ai-chat-form" onSubmit={(event) => { event.preventDefault(); void askAssistant(); }}>
              <textarea value={assistantMessage} onChange={(event) => setAssistantMessage(event.target.value)} maxLength={1200} placeholder="例：Juice Shopのログイン画面でSQLインジェクションを試すには？"/>
              <button type="submit" disabled={busy || !assistantMessage.trim()}>{busy ? <LoaderCircle className="spin" size={14}/> : <Sparkles size={14}/>} 相談する</button>
            </form>
            {assistantReply && <section className="assistant-reply">
              <div className={`answer-source ${assistantReply.source}`}>{assistantReply.source === 'gemini' ? `AI生成・${assistantReply.model}` : '固定回答（AI未使用）'}</div>
              <p>{assistantReply.summary}</p>
              {assistantReply.commands.map((proposal, index) => <div className={`command-proposal ${proposal.safe ? 'safe' : 'blocked'}`} key={`${proposal.command}-${index}`}>
                <div><span>{proposal.safe ? '安全検査 OK' : '安全検査 BLOCK'}</span><code>{proposal.command}</code><p>{proposal.explanation}</p>{proposal.blockedReason && <small>{proposal.blockedReason}</small>}</div>
                <button disabled={!proposal.safe || commandBusy} onClick={() => runAiCommand(proposal.command)}><Play size={13}/> 確認して実行</button>
              </div>)}
              <small className="safety-note">{assistantReply.safetyNote}</small>
              <button className="ai-clear" onClick={() => { setAssistantReply(null); setAssistantMessage(''); }}><X size={12}/> 新しく相談する</button>
            </section>}
            {explanation && <section className="execution-explanation"><div className={`answer-source ${explanation.source}`}>{explanation.source === 'gemini' ? `AI生成・${explanation.model}` : '固定回答（AI未使用）'}</div><h3>{explanation.summary}</h3><ul>{explanation.details.map((detail) => <li key={detail}>{detail}</li>)}</ul><div className="next"><span>NEXT STEP</span><code>{explanation.nextStep}</code></div><button className="ai-clear" onClick={() => setExplanation(null)}><X size={12}/> 解説を閉じる</button></section>}
          </div>
        </article>
      </section>
    </div>
    {tutorialOpen && <Tutorial
      step={tutorialStep}
      onStep={setTutorialStep}
      onClose={() => { localStorage.setItem(TUTORIAL_KEY, 'done'); setTutorialOpen(false); }}
    />}
  </main>;
}

function TargetPanel({ sessionId }: { sessionId: string }) {
  const [ready, setReady] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [reloadKey, setReloadKey] = useState(0);
  const [delayed, setDelayed] = useState(false);

  const check = useCallback(async () => {
    setAttempt((value) => value + 1);
    try { const status = await api.targetStatus(sessionId); if (status.ready) { setReady(true); setDelayed(false); } }
    catch { /* 次回のポーリングで再確認 */ }
  }, [sessionId]);

  useEffect(() => {
    setReady(false); setAttempt(0); setDelayed(false); void check();
    const timer = window.setInterval(() => void check(), 2500);
    const delayTimer = window.setTimeout(() => setDelayed(true), 45000);
    return () => { clearInterval(timer); clearTimeout(delayTimer); };
  }, [check]);

  return <article className="target panel"><div className="panel-title"><span><Box size={14}/> TARGET WEB</span><span className="target-actions">
    {ready && <button title="再読み込み" onClick={() => setReloadKey((value) => value + 1)}><RefreshCw size={14}/></button>}
    <a href={`/lab/${sessionId}/target/`} target="_blank" rel="noreferrer" title="別タブで開く"><ExternalLink size={14}/></a>
  </span></div>
    {ready ? <iframe key={reloadKey} title="OWASP Juice Shop" src={`/lab/${sessionId}/target/?view=${reloadKey}`} sandbox="allow-scripts allow-forms allow-same-origin allow-popups" onLoad={(event) => {
      try {
        const body = event.currentTarget.contentDocument?.body?.innerText || '';
        if (/502 Bad Gateway|演習サイトを準備しています/.test(body)) {
          setReady(false);
          window.setTimeout(() => void check(), 1000);
        }
      } catch { /* 同一オリジンでない場合は状態APIのポーリングに任せる */ }
    }}/> :
      <div className="target-loading"><LoaderCircle className="spin" size={30}/><h3>演習サイトを起動しています</h3><p>{delayed ? '通常より時間がかかっています。自動で再確認を続けています。' : '通常は10〜30秒で準備できます。このままお待ちください。'}</p><small>確認中 {attempt}回目</small>{delayed && <button onClick={() => void check()}><RefreshCw size={13}/> 今すぐ再確認</button>}</div>}
  </article>;
}

const tutorial = [
  { title: 'CyberRoomへようこそ', text: '7つのレッスンを順番に進め、Kali LinuxからJuice Shopへの安全な実攻撃を体験します。進捗はこのブラウザに保存されます。' },
  { title: '「実行」を押す', text: 'レッスン内の実行ボタンを押すと、対応するコマンドが下のターミナルへ送られます。自分で入力しても構いません。' },
  { title: '結果を自動判定', text: 'コマンドが終わると出力を自動で確認します。正解ならチェックが付き、不正解なら確認ポイントを表示します。' },
  { title: 'TargetとGemini', text: '右上が演習用Juice Shopです。右下では自然言語で相談でき、AI提案コマンドは安全検査と確認後にだけ実行できます。' },
];

function Tutorial({ step, onStep, onClose }: { step: number; onStep: (value: number) => void; onClose: () => void }) {
  const item = tutorial[step];
  return <div className="tutorial-backdrop" role="presentation"><section className="tutorial-dialog" role="dialog" aria-modal="true" aria-labelledby="tutorial-title">
    <button className="tutorial-close" onClick={onClose} aria-label="チュートリアルを閉じる"><X size={17}/></button>
    <div className="tutorial-icon">{step === 0 ? <GraduationCap/> : step === 1 ? <Play/> : step === 2 ? <Check/> : <Sparkles/>}</div>
    <span>はじめてガイド {step + 1}/{tutorial.length}</span><h2 id="tutorial-title">{item.title}</h2><p>{item.text}</p>
    <div className="tutorial-dots">{tutorial.map((_, index) => <i key={index} className={index === step ? 'active' : ''}/>)}</div>
    <div className="tutorial-buttons">{step > 0 && <button onClick={() => onStep(step - 1)}>戻る</button>}<button className="primary" onClick={() => step === tutorial.length - 1 ? onClose() : onStep(step + 1)}>{step === tutorial.length - 1 ? 'レッスンを始める' : '次へ'}<ChevronRight size={16}/></button></div>
  </section></div>;
}

function Home({ busy, error, onStart }: { busy: boolean; error: string; onStart: () => void }) {
  return <main className="home"><div className="grid-noise"/><header className="home-nav"><Brand/><span className="secure-label"><ShieldCheck size={15}/> isolated learning environment</span></header><section className="hero">
    <div className="eyebrow"><span/> BROWSER-BASED CYBERSECURITY LABORATORY</div><h1>触れて、確かめて、<br/><em>仕組みから学ぶ。</em></h1>
    <p>Linux、ネットワーク、Webセキュリティをブラウザだけで実践。安全に隔離された演習環境と、段階的なガイドで最初の一歩を支えます。</p>
    <button className="primary large" onClick={onStart} disabled={busy}><Play size={18} fill="currentColor"/>{busy ? '環境を準備中…' : 'Start Lab'}<ChevronRight size={18}/></button>{error && <p className="error">{error}</p>}
    <div className="feature-row"><Feature icon={<TerminalSquare/>} title="Kali Linux Terminal" text="ブラウザから隔離Kali環境へ"/><Feature icon={<Box/>} title="OWASP Juice Shop" text="実際の脆弱アプリで演習"/><Feature icon={<Sparkles/>} title="Gemini Assistant" text="自然言語の相談と安全な実行支援"/></div>
  </section></main>;
}

function Brand() { return <div className="brand"><div className="brand-mark"><span/><span/><span/></div><div><strong>CyberRoom</strong><small>Browser-Based Cybersecurity Laboratory</small></div></div>; }
function Feature({ icon, title, text }: { icon: ReactNode; title: string; text: string }) { return <div className="feature"><span>{icon}</span><div><strong>{title}</strong><small>{text}</small></div></div>; }
