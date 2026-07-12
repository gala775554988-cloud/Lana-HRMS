import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { resolveRoleDashboard } from "@/config/auth";

export default async function HomePage() {
  const session = await auth();

  if (session?.user) {
    const roles = (session.user.roles as string[]) || [];
    const target = resolveRoleDashboard(roles);
    const r = encodeURIComponent(`app/page.tsx: session.user EXISTS → resolveRoleDashboard(${JSON.stringify(roles)}) → ${target}`);
    redirect(`${target}?reason=${r}`);
  }

  const r = encodeURIComponent(`app/page.tsx: NO session → redirect("/login")`);
  redirect(`/login?reason=${r}`);
}
