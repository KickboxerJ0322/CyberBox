export type SessionStatus='starting'|'running'|'stopping'|'stopped'|'failed';
export type LabSession={sessionId:string;createdAt:string;expiresAt:string;status:SessionStatus;attackerId?:string;targetId?:string;networkId?:string;targetIp?:string;demoMode?:boolean;timer?:NodeJS.Timeout};
export interface TerminalHandle{write(data:Buffer|string):void;resize?(cols:number,rows:number):void;close():void;onData(handler:(chunk:Buffer|string)=>void):void;onClose(handler:()=>void):void}
export interface LabManager{start():Promise<LabSession>;stop(id:string):Promise<void>;get(id:string):LabSession|undefined;terminal(id:string):Promise<TerminalHandle>;target(id:string):{host:string;port:number}|undefined;shutdown():Promise<void>}
