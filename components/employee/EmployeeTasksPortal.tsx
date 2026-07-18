"use client";
import { useState, useTransition } from 'react';
import { Paperclip, Plus, Save, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type Task = { id: string; title: string; status: string; progress: number; comments: string[]; attachments: string[]; dueDate?: string; source?: string };

export function EmployeeTasksPortal({ initialTasks }: { initialTasks: Task[] }) {
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [title, setTitle] = useState('');
  const [pending, startTransition] = useTransition();
  function persist(next: Task[]) { setTasks(next); startTransition(()=>{ void fetch('/api/employee/portal-sections',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({section:'tasks',data:next})}); }); }
  function addTask(){ if(!title.trim()) return; persist([{id:crypto.randomUUID(), title:title.trim(), status:'PENDING', progress:0, comments:[], attachments:[], source:'employee'}, ...tasks]); setTitle(''); }
  function update(id:string, patch:Partial<Task>){ persist(tasks.map(t=>t.id===id?{...t,...patch}:t)); }
  function remove(id:string){ persist(tasks.filter(t=>t.id!==id)); }
  function addComment(id:string, comment:string){ if(!comment.trim()) return; const t=tasks.find(x=>x.id===id); if(t) update(id,{comments:[comment.trim(),...(t.comments||[])]}); }
  function addAttachment(id:string, file?:File){ if(!file) return; const t=tasks.find(x=>x.id===id); if(t) update(id,{attachments:[file.name,...(t.attachments||[])]}); }
  return <main className="space-y-6" dir="rtl"><div><h1 className="text-3xl font-black">المهام</h1><p className="text-muted-foreground">المهام المسندة ونسبة الإنجاز والتعليقات والمرفقات.</p></div><div className="flex gap-2 rounded-3xl border p-4"><Input value={title} onChange={e=>setTitle(e.target.value)} placeholder="مهمة جديدة"/><Button disabled={pending} onClick={addTask}><Plus className="ml-2 h-4 w-4"/>إضافة</Button></div><div className="space-y-3">{tasks.map(task=><TaskCard key={task.id} task={task} update={update} remove={remove} addComment={addComment} addAttachment={addAttachment}/>) }{!tasks.length&&<div className="rounded-2xl border border-dashed p-6 text-muted-foreground">لا توجد مهام حالياً.</div>}</div></main>;
}
function TaskCard({task, update, remove, addComment, addAttachment}:{task:Task; update:(id:string,p:Partial<Task>)=>void; remove:(id:string)=>void; addComment:(id:string,c:string)=>void; addAttachment:(id:string,f?:File)=>void}){const [comment,setComment]=useState('');return <div className="rounded-3xl border bg-card p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-black">{task.title}</h3><p className="text-xs text-muted-foreground">{task.source||'portal'} · {task.status}</p></div><Button variant="destructive" size="sm" onClick={()=>remove(task.id)}><Trash2 className="h-4 w-4"/></Button></div><div className="mt-4 grid gap-3 md:grid-cols-[1fr_140px]"><div><div className="h-3 rounded-full bg-muted"><div className="h-3 rounded-full bg-primary" style={{width:`${task.progress||0}%`}}/></div><input type="range" min={0} max={100} value={task.progress||0} onChange={e=>update(task.id,{progress:Number(e.target.value),status:Number(e.target.value)>=100?'COMPLETED':'IN_PROGRESS'})} className="mt-2 w-full"/></div><div className="text-center font-black">{task.progress||0}%</div></div><div className="mt-4 flex gap-2"><Input value={comment} onChange={e=>setComment(e.target.value)} placeholder="تعليق"/><Button onClick={()=>{addComment(task.id,comment);setComment('')}}><Save className="h-4 w-4"/></Button><label className="inline-flex cursor-pointer items-center rounded-xl border px-3"><Paperclip className="h-4 w-4"/><input type="file" className="hidden" onChange={e=>addAttachment(task.id,e.target.files?.[0])}/></label></div><div className="mt-3 grid gap-2 md:grid-cols-2"><div>{task.comments?.map((c,i)=><p key={i} className="rounded-xl bg-muted p-2 text-sm">{c}</p>)}</div><div>{task.attachments?.map((a,i)=><p key={i} className="rounded-xl border p-2 text-sm">📎 {a}</p>)}</div></div></div>}
