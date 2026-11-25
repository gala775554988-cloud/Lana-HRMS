import {z} from "zod";
export const taskStates=["NEW","IN_PROGRESS","REVIEW","COMPLETED"] as const;
export const createTaskSchema=z.object({title:z.string().trim().min(3).max(180),description:z.string().trim().max(3000),priority:z.enum(["LOW","NORMAL","HIGH","URGENT"]),dueAt:z.string().datetime(),employeeIds:z.array(z.string().min(1)).max(100),departmentId:z.string().min(1).optional(),checklist:z.array(z.string().trim().min(1).max(180)).max(20)}).strict().refine(v=>!!v.departmentId!==!!v.employeeIds.length);
export const taskActionSchema=z.discriminatedUnion("action",[
 z.object({action:z.literal("progress"),progress:z.number().int().min(0).max(100),version:z.string().datetime()}).strict(),
 z.object({action:z.literal("move"),status:z.enum(taskStates),version:z.string().datetime()}).strict(),
 z.object({action:z.literal("check"),checkId:z.string().min(1),done:z.boolean(),version:z.string().datetime()}).strict(),
 z.object({action:z.literal("comment"),body:z.string().trim().min(1).max(2000),version:z.string().datetime()}).strict()
]);
export function canTransition(from:string,to:string,assignee:boolean,reviewer:boolean,progress:number){
 if(from==="COMPLETED")return false;
 if(from==="REVIEW")return reviewer&&!assignee&&["IN_PROGRESS","COMPLETED"].includes(to)&&(to!=="COMPLETED"||progress===100);
 return assignee&&((from==="NEW"&&to==="IN_PROGRESS")||(from==="IN_PROGRESS"&&to==="REVIEW"&&progress===100));
}
export const checklistProgress=(items:{done:boolean}[])=>items.length?Math.floor(items.filter(x=>x.done).length*100/items.length):0;
