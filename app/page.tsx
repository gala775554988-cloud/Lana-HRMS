import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { resolveRoleDashboard } from "@/config/auth";
// test
export default async function HomePage() {
  const session = await auth();
  if (session?.user) {
    const roles = (session.user.roles as string[]) || [];
    redirect(resolveRoleDashboard(roles));
  }
  redirect("/login");
}
