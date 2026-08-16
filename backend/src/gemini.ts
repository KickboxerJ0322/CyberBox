import { GoogleGenAI } from '@google/genai';
import { z } from 'zod';
import { inspectCommand } from './commandSafety.js';
import { config } from './config.js';
import { logger } from './logger.js';

const explanationSchema = z.object({ summary: z.string().min(1).max(500), details: z.array(z.string().min(1).max(500)).min(1).max(6), nextStep: z.string().min(1).max(300) });
const assistantSchema = z.object({
  summary: z.string().min(1).max(1000),
  commands: z.array(z.object({ command: z.string().min(1).max(800), explanation: z.string().min(1).max(500) })).max(4),
  safetyNote: z.string().min(1).max(500),
});
export type AnswerSource = 'gemini' | 'fallback';
export type Explanation = z.infer<typeof explanationSchema> & { source: AnswerSource; model: string };
export type AssistantReply = { summary: string; commands: Array<{ command: string; explanation: string; safe: boolean; blockedReason?: string }>; safetyNote: string; source: AnswerSource; model: string };

const explanationFallback = (command: string): Explanation => ({
  summary: 'コマンドは実行されました。現在は固定ガイドを表示しています。',
  details: [`実行したコマンド: ${command}`, '出力中のステータス、ポート番号、サービス名を確認してください。', 'Geminiに接続できない場合も、レッスンの自動判定は利用できます。'],
  nextStep: command.startsWith('nmap') ? 'curl -I http://target:3000' : 'nmap -sV -p 3000 target',
  source: 'fallback', model: config.GEMINI_MODEL,
});

function assistantFallback(message: string): AssistantReply {
  const lower = message.toLowerCase();
  const suggestion = lower.includes('sql') || message.includes('ログイン')
    ? { command: `curl -s -X POST http://target:3000/rest/user/login -H "Content-Type: application/json" --data "{\\"email\\":\\"admin' OR 1=1--\\",\\"password\\":\\"x\\"}"`, explanation: 'Juice Shopの隔離されたログインAPIでSQLインジェクションを検証します。' }
    : lower.includes('header') || message.includes('ヘッダー')
      ? { command: 'curl -I http://target:3000', explanation: '対象WebサーバーのHTTPレスポンスヘッダーを確認します。' }
      : { command: 'nmap -sV -p 3000 target', explanation: '隔離されたtargetの3000番ポートとサービスを確認します。' };
  const safety = inspectCommand(suggestion.command);
  return { summary: 'Geminiに接続できないため、質問に近い固定ガイドを表示します。', commands: [{ ...suggestion, safe: safety.safe, blockedReason: safety.reason }], safetyNote: '実行対象は、このラボ内の target のみに限定してください。', source: 'fallback', model: config.GEMINI_MODEL };
}

export async function explain(input: { lesson: string; description: string; command: string; output: string }): Promise<Explanation> {
  if (!config.GEMINI_API_KEY) return explanationFallback(input.command);
  const started = Date.now();
  try {
    const ai = new GoogleGenAI({ apiKey: config.GEMINI_API_KEY });
    const result = await ai.models.generateContent({
      model: config.GEMINI_MODEL,
      contents: `レッスン: ${input.lesson}\n説明: ${input.description}\nコマンド: ${input.command.slice(0, 300)}\n出力:\n${input.output.slice(-8000)}\n\n結果から分かったこと、重要な行、次の安全な確認手順を説明してください。`,
      config: { systemInstruction: 'あなたはCyberRoomのサイバーセキュリティ学習アシスタントです。日本語で簡潔に説明してください。対象は許可済みの隔離環境 target のみです。', responseMimeType: 'application/json', responseSchema: { type: 'OBJECT', properties: { summary: { type: 'STRING' }, details: { type: 'ARRAY', items: { type: 'STRING' } }, nextStep: { type: 'STRING' } }, required: ['summary', 'details', 'nextStep'] } },
    });
    const parsed = explanationSchema.parse(JSON.parse(result.text ?? '{}'));
    logger.info({ model: config.GEMINI_MODEL, responseTimeMs: Date.now() - started, success: true }, 'gemini request');
    return { ...parsed, source: 'gemini', model: config.GEMINI_MODEL };
  } catch (error) {
    logger.warn({ error, model: config.GEMINI_MODEL, responseTimeMs: Date.now() - started, success: false }, 'gemini unavailable');
    return explanationFallback(input.command);
  }
}

export async function advise(input: { lesson: string; description: string; message: string }): Promise<AssistantReply> {
  if (!config.GEMINI_API_KEY) return assistantFallback(input.message);
  const started = Date.now();
  try {
    const ai = new GoogleGenAI({ apiKey: config.GEMINI_API_KEY });
    const result = await ai.models.generateContent({
      model: config.GEMINI_MODEL,
      contents: `現在のレッスン: ${input.lesson}\n説明: ${input.description}\n学習者の相談: ${input.message}`,
      config: {
        systemInstruction: ['あなたはCyberRoom内の許可済みサイバー演習を支援する日本語アシスタントです。', '攻撃・調査対象はDocker隔離環境内のホスト名 target、Webは http://target:3000 のみです。', '質問に答え、必要ならKali Linuxで実行できる短い単一コマンドを最大4件提案してください。', '外部IP・外部ドメイン、永続化、権限昇格、破壊、リバースシェル、待受、ファイル書込は提案しないでください。', 'コマンドを提案しなくてもよい質問ではcommandsを空配列にしてください。'].join('\n'),
        responseMimeType: 'application/json',
        responseSchema: { type: 'OBJECT', properties: { summary: { type: 'STRING' }, commands: { type: 'ARRAY', items: { type: 'OBJECT', properties: { command: { type: 'STRING' }, explanation: { type: 'STRING' } }, required: ['command', 'explanation'] } }, safetyNote: { type: 'STRING' } }, required: ['summary', 'commands', 'safetyNote'] },
      },
    });
    const parsed = assistantSchema.parse(JSON.parse(result.text ?? '{}'));
    const commands = parsed.commands.map((proposal) => { const safety = inspectCommand(proposal.command); return { ...proposal, safe: safety.safe, blockedReason: safety.reason }; });
    logger.info({ model: config.GEMINI_MODEL, responseTimeMs: Date.now() - started, success: true, commandCount: commands.length }, 'gemini assistant request');
    return { ...parsed, commands, source: 'gemini', model: config.GEMINI_MODEL };
  } catch (error) {
    logger.warn({ error, model: config.GEMINI_MODEL, responseTimeMs: Date.now() - started, success: false }, 'gemini assistant unavailable');
    return assistantFallback(input.message);
  }
}
