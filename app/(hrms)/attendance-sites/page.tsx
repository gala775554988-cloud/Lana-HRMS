import { listAttendanceSites } from '@/lib/attendance/sites';
import { AttendanceSitesClient } from '@/components/hrms/AttendanceSitesClient';

export const dynamic = 'force-dynamic';

export default async function AttendanceSitesPage() {
  const sites = await listAttendanceSites();
  return <AttendanceSitesClient initialSites={sites} />;
}
