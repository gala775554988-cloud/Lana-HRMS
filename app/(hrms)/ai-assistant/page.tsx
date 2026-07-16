import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { LanaAiFullPageClient } from "./client";

export const dynamic = "force-dynamic";

export default async function AiAssistantPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  return <LanaAiFullPageClient />;
}
