import {z} from "zod";
const legacyTask=z.object({id:z.union([z.number().int().safe(),z.string().min(1).max(100)]),title:z.string().trim().min(1).max(180),dept:z.string().max(200).optional().default(""),cat:z.string().max(200).optional().default(""),prio:z.enum(["عادي","مهم","عاجل"]),due:z.string().max(40).optional().default(""),notes:z.string().max(3000).optional().default(""),status:z.enum(["جديد","قيد التنفيذ","مراجعة","مكتمل"]),subtasks:z.array(z.object({text:z.string().min(1).max(180),done:z.boolean()})).max(20).optional().default([]),comments:z.array(z.object({text:z.string().min(1).max(2000),time:z.string().optional()})).max(100).optional().default([]),docs:z.array(z.object({name:z.string().min(1).max(180),size:z.string().optional(),data:z.string().max(1400000)})).max(10).optional().default([])}).passthrough();
export function parseLegacyTaskBackup(raw:unknown){
 const data=z.object({tasks:z.array(legacyTask).min(1).max(100)}).passthrough().parse(raw);
 if(new Set(data.tasks.map(t=>String(t.id))).size!==data.tasks.length)throw Error("معرف مهمة مكرر في النسخة القديمة");
 return data.tasks;
}
export function legacyStatus(t:ReturnType<typeof parseLegacyTaskBackup>[number]){
 const progress=t.subtasks.length?Math.floor(t.subtasks.filter(s=>s.done).length*100/t.subtasks.length):t.status==="مكتمل"||t.status==="مراجعة"?100:0;
 return {progress,status:t.status==="جديد"&&progress===0?"NEW":progress===100&&(t.status==="مكتمل"||t.status==="مراجعة")?"REVIEW":"IN_PROGRESS",priority:({عادي:"NORMAL",مهم:"HIGH",عاجل:"URGENT"} as const)[t.prio]};
}
export function legacyFileBytes(name:string,data:string){
 const match=/^data:(?:application\/pdf|image\/png|image\/jpeg);base64,([A-Za-z0-9+/]+={0,2})$/.exec(data);
 if(!match)return null;
 const bytes=Buffer.from(match[1],"base64"),hex=bytes.subarray(0,8).toString("hex");
 if(bytes.length<4||bytes.length>1000000)return null;
 return (/\.pdf$/i.test(name)&&hex.startsWith("255044462d"))||(/\.png$/i.test(name)&&hex==="89504e470d0a1a0a")||(/\.jpe?g$/i.test(name)&&hex.startsWith("ffd8ff"))?bytes:null;
}
