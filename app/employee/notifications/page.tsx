import { getCurrentEmployee, getRecentNotifications } from "@/lib/employee/data";
import { NotificationsPage } from "@/components/employee/NotificationsPage";

export default async function Notifications() {
  const employee = await getCurrentEmployee();
  const notifs = employee ? await getRecentNotifications(employee.id) : [];
  return <NotificationsPage notifications={notifs} />;
}
