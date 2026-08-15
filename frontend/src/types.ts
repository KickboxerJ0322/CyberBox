export type LabSession={sessionId:string;createdAt:string;expiresAt:string;status:'starting'|'running'|'stopping'|'stopped'|'failed';demoMode?:boolean};
export type AiExplanation={summary:string;details:string[];nextStep:string};
export type Lesson={id:number;short:string;title:string;objective:string;description:string;commands:string[];points:string[];caution?:string};
