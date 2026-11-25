import {z} from "zod";
export const taskStates=["NEW","IN_PROGRESS","REVIEW","COMPLETED"] as const;
export const createTaskSchema=z.object({title:z.string().trim().min(3).max(180),description:z.string().trim().max(3000),priority:z.enum(["LOW","NORMAL","HIGH","URGENT"]),dueAt:z.string().datetime(),employeeIds:z.array(z.string().min(1)).max(100),departmentId:z.string().min(1).optional(),checklist:z.array(z.string().trim().min(1).max(180)).max(20),repeatEvery:z.enum(["DAILY","WEEKLY","MONTHLY","YEARLY"]).optional(),repeatUntil:z.string().datetime().optional()}).strict().refine(v=>!!v.departmentId!==!!v.employeeIds.length).refine(v=>Boolean(v.repeatEvery)===Boolean(v.repeatUntil));
export const taskActionSchema=z.discriminatedUnion("action",[
 z.object({action:z.literal("progress"),progress:z.number().int().min(0).max(100),version:z.string().datetime()}).strict(),
 z.object({action:z.literal("move"),status:z.enum(taskStates),version:z.string().datetime()}).strict(),
 z.object({action:z.literal("check"),checkId:z.string().min(1),done:z.boolean(),version:z.string().datetime()}).strict(),
 z.object({action:z.literal("recurrence"),frequency:z.enum(["DAILY","WEEKLY","MONTHLY","YEARLY"]).nullable(),until:z.string().datetime().nullable(),version:z.string().datetime()}).strict(),
 z.object({action:z.literal("comment"),body:z.string().trim().min(1).max(2000),version:z.string().datetime()}).strict()
]);
export function canTransition(from:string,to:string,assignee:boolean,reviewer:boolean,progress:number){
 if(from==="COMPLETED")return false;
 if(from==="REVIEW")return reviewer&&!assignee&&["IN_PROGRESS","COMPLETED"].includes(to)&&(to!=="COMPLETED"||progress===100);
 return assignee&&((from==="NEW"&&to==="IN_PROGRESS")||(from==="IN_PROGRESS"&&to==="REVIEW"&&progress===100));
}
export const checklistProgress=(items:{done:boolean}[])=>items.length?Math.floor(items.filter(x=>x.done).length*100/items.length):0;

export function nextTaskDue(previous:Date,frequency:string,anchor:Date){
 const d=new Date(previous);
 if(frequency==="DAILY"||frequency==="WEEKLY"){d.setUTCDate(d.getUTCDate()+(frequency==="DAILY"?1:7));return d;}
 if(frequency!=="MONTHLY"&&frequency!=="YEARLY")throw Error("تكرار غير معروف");
 const day=anchor.getUTCDate();d.setUTCDate(1);
 if(frequency==="MONTHLY")d.setUTCMonth(d.getUTCMonth()+1);else{d.setUTCFullYear(d.getUTCFullYear()+1);d.setUTCMonth(anchor.getUTCMonth());}
 const last=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,0)).getUTCDate();d.setUTCDate(Math.min(day,last));return d;
}
export function taskOccurrenceKey(rootId:string,due:Date){return JSON.stringify([rootId,due.toISOString()]);}
export function taskReminderKey(taskId:string,userId:string,day:string,kind:string){return JSON.stringify(["madar-task",taskId,userId,day,kind]);}

export function recurrenceAfter(anchor:Date,frequency:string,now:Date,until:Date){
 if(until<=now||until.getTime()-now.getTime()>366*5*86400000)throw Error("نهاية التكرار غير صالحة");
 let next=nextTaskDue(anchor,frequency,anchor);
 for(let i=0;next<=now;i++){if(i>=10000)throw Error("سلسلة قديمة جداً؛ أنشئ تكليفاً دورياً جديداً");next=nextTaskDue(next,frequency,anchor);}
 return next<=until?next:null;
}
export function taskMetrics(rows:{status:string;progress:number;dueAt:Date;reviewedAt:Date|null}[],now:Date){
 const completed=rows.filter(r=>r.status==="COMPLETED");
 const onTime=completed.filter(r=>r.reviewedAt&&r.reviewedAt<=r.dueAt).length;
 return {total:rows.length,completed:completed.length,late:rows.filter(r=>r.status!=="COMPLETED"&&r.dueAt<now).length,onTime,completionRate:rows.length?Math.round(completed.length/rows.length*100):0,onTimeRate:completed.length?Math.round(onTime/completed.length*100):0,averageProgress:rows.length?Math.round(rows.reduce((n,r)=>n+r.progress,0)/rows.length):0};
}
