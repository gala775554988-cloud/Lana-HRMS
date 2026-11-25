import { z } from "zod";
export const automationPolicySchema=z.object({enabled:z.boolean(),documents:z.boolean(),contracts:z.boolean(),approvals:z.boolean(),syncErrors:z.boolean(),noticeDays:z.number().int().min(1).max(90),escalationHours:z.number().int().min(1).max(720)}).strict();
export type AutomationPolicy=z.infer<typeof automationPolicySchema>;
export const defaultAutomationPolicy:AutomationPolicy={enabled:false,documents:true,contracts:true,approvals:true,syncErrors:true,noticeDays:30,escalationHours:48};
export const automationSettingKey="madar.automation.alerts.v1";
export function reminderKey(rule:string,source:string,window:string,userId:string){return JSON.stringify(["madar-automation-v1",rule,source,window,userId]);}
export function riyadhDay(date:Date){return new Intl.DateTimeFormat("sv-SE",{timeZone:"Asia/Riyadh",year:"numeric",month:"2-digit",day:"2-digit"}).format(date);}
export function isApprovalLate(now:Date,stageStart:Date,hours:number,deferredUntil?:string){
 if(!Number.isFinite(hours)||hours<=0)return false;
 const until=deferredUntil?Date.parse(deferredUntil):0;
 if(Number.isFinite(until)&&until>now.getTime())return false;
 return now.getTime()-stageStart.getTime()>=hours*3600000;
}
