import { requireEmployee, getEmployeeSetting } from '@/lib/employee/portal';
import ChatClient from './portal-chat-client';

export const dynamic = "force-dynamic";
export default async function ChatPage(){const {employee}=await requireEmployee(); const messages=await getEmployeeSetting<any[]>(employee.id,'chat',[]); return <main className="space-y-6" dir="rtl"><h1 className="text-3xl font-black">المحادثات</h1><ChatClient initial={messages}/></main>}
