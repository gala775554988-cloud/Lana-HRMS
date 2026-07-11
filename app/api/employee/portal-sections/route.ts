import { NextRequest, NextResponse } from 'next/server';
import { requireEmployee, getEmployeeSetting, setEmployeeSetting } from '@/lib/employee/portal';

const sections = new Set(['qualifications','experiences','skills','languages','bank','family','permissionRequests','chat','tasks','securitySettings']);

export async function GET(request: NextRequest) {
  const { employee } = await requireEmployee();
  const section = request.nextUrl.searchParams.get('section') || '';
  if (!sections.has(section)) return NextResponse.json({ success: false, message: 'Invalid section' }, { status: 400 });
  const data = await getEmployeeSetting(employee.id, section, section === 'bank' ? {} : []);
  return NextResponse.json({ success: true, section, data });
}

export async function POST(request: NextRequest) {
  const { employee } = await requireEmployee();
  const body = await request.json();
  const section = String(body.section || '');
  if (!sections.has(section)) return NextResponse.json({ success: false, message: 'Invalid section' }, { status: 400 });
  await setEmployeeSetting(employee.id, section, body.data ?? (section === 'bank' ? {} : []));
  return NextResponse.json({ success: true });
}
