import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const [events, queues, schedulers, connectors] = await Promise.all([
    prisma.eventStoreRecord.count().catch(() => 0), prisma.messageQueueRecord.count().catch(() => 0), prisma.schedulerRecord.count().catch(() => 0), prisma.infrastructureConnector.count().catch(() => 0)
  ]);
  const body = [`lana_events_total ${events}`, `lana_queue_jobs_total ${queues}`, `lana_scheduler_jobs_total ${schedulers}`, `lana_connectors_total ${connectors}`].join("\n") + "\n";
  return new NextResponse(body, { headers: { "Content-Type": "text/plain; version=0.0.4" } });
}
