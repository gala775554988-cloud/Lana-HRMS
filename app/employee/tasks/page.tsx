import { getCurrentEmployee, getRecentTasks } from "@/lib/employee/data";
import { TasksPage } from "@/components/employee/TasksPage";

export default async function Tasks() {
  const employee = await getCurrentEmployee();
  const tasks = employee ? await getRecentTasks(employee.id) : [];
  return <TasksPage tasks={tasks} />;
}
