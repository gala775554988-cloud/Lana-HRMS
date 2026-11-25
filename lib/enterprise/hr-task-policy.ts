import {z} from "zod";
export const hrTaskKinds=["DOCUMENT","CONTRACT","INSURANCE","PAYROLL","APPROVAL","PENALTY","SETTLEMENT","ODOO_ERROR"] as const;
export const hrTaskPolicySchema=z.object({enabled:z.boolean(),ownerEmployeeId:z.string().max(128),reviewerUserId:z.string().max(128),kinds:z.array(z.enum(hrTaskKinds)).max(8),noticeDays:z.number().int().min(1).max(90),responseHours:z.number().int().min(1).max(720)}).strict().refine(p=>!p.enabled||(!!p.ownerEmployeeId&&!!p.reviewerUserId&&p.kinds.length>0));
export type HrTaskPolicy=z.infer<typeof hrTaskPolicySchema>;
export const defaultHrTaskPolicy:HrTaskPolicy={enabled:false,ownerEmployeeId:"",reviewerUserId:"",kinds:[...hrTaskKinds],noticeDays:30,responseHours:48};
export const hrTaskPolicyKey="madar.work-task.hr-events.v1";
export function hrEventKey(kind:string,id:string,version:string){return JSON.stringify(["madar-hr-event-v1",kind,id,version]);}
export function eventDue(now:Date,deadline:Date|null,hours:number){return new Date(Math.max(now.getTime()+3600000,deadline?Math.min(deadline.getTime(),now.getTime()+hours*3600000):now.getTime()+hours*3600000));}
