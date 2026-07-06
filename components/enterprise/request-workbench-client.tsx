"use client";

import { useEffect, useState, useTransition } from "react";
import { Archive, CheckCircle2, Eye, Inbox, RotateCcw, Send, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const tabs = [
  { key: "pending", label: "Pending Requests", icon: Inbox },
  { key: "approved", label: "Approved", icon: CheckCircle2 },
  { key: "rejected", label: "Rejected", icon: XCircle },
  { key: "returned", label: "Returned", icon: RotateCcw },
  { key: "archived", label: "Archived", icon: Archive }
];

type RequestRecord = {
  id: string;
  type: string;
  entityId: string;
  status: string;
  currentStep: number;
  createdAt: string;
  updatedAt: string;
  employee?: { employeeNumber: string; firstName: string; lastName: string; department?: { name: string } | null; branch?: { name: string } | null };
  steps: { id: string; step: number; status: string; approverUserId: string | null; comments: string | null }[];
};

export function RequestWorkbenchClient({ mode = "center" }: { mode?: "center" | "inbox" | "outbox" }) {
  const [activeTab, setActiveTab] = useState("pending");
  const [requests, setRequests] = useState<RequestRecord[]>([]);
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  const load = () => {
    fetch(`/api/enterprise/requests?tab=${activeTab}&mode=${mode}`, { cache: "no-store" })
      .then((response) => response.json())
      .then((data) => {
        if (!data.success) throw new Error(data.message || "Failed to load requests");
        setRequests(data.requests ?? []);
      })
      .catch((error) => setMessage(error.message));
  };

  useEffect(load, [activeTab, mode]);

  function decide(id: string, decision: "APPROVE" | "REJECT" | "RETURN") {
    startTransition(async () => {
      const comments = decision === "RETURN" ? "Returned for employee update" : undefined;
      const response = await fetch(`/api/enterprise/workflows/${id}/decision`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision, comments })
      });
      const data = await response.json();
      if (!data.success) {
        setMessage(data.message || "Failed to update request");
        return;
      }
      setMessage("Request updated successfully");
      load();
    });
  }

  return (
    <div className="space-y-4">
      {mode === "center" ? (
        <div className="flex flex-wrap gap-2">
          {tabs.map(({ key, label, icon: Icon }) => (
            <Button key={key} type="button" variant={activeTab === key ? "default" : "outline"} onClick={() => setActiveTab(key)} className="gap-2">
              <Icon className="h-4 w-4" />{label}
            </Button>
          ))}
        </div>
      ) : null}

      {message ? <div className="rounded-xl border bg-background p-3 text-sm text-muted-foreground">{message}</div> : null}

      <div className="grid gap-3">
        {requests.length === 0 ? <div className="rounded-2xl border bg-card p-8 text-center text-muted-foreground">No requests found.</div> : null}
        {requests.map((request) => (
          <Card key={request.id}>
            <CardHeader>
              <CardTitle className="flex flex-wrap items-center justify-between gap-3 text-base">
                <span>{request.type} • {request.employee?.employeeNumber} - {request.employee?.firstName} {request.employee?.lastName}</span>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-700 dark:bg-slate-800 dark:text-slate-200">{request.status}</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="text-muted-foreground">{request.employee?.department?.name ?? "No department"} • {request.employee?.branch?.name ?? "No branch"}</div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" size="sm" className="gap-2"><Eye className="h-4 w-4" />View Details</Button>
                {mode !== "outbox" && request.status === "PENDING" ? (
                  <>
                    <Button type="button" size="sm" onClick={() => decide(request.id, "APPROVE")} disabled={isPending}>Approve</Button>
                    <Button type="button" variant="destructive" size="sm" onClick={() => decide(request.id, "REJECT")} disabled={isPending}>Reject</Button>
                    <Button type="button" variant="outline" size="sm" onClick={() => decide(request.id, "RETURN")} disabled={isPending}>Return</Button>
                  </>
                ) : null}
              </div>
              <div className="grid gap-2 border-t pt-3">
                {request.steps.map((step) => <div key={step.id} className="flex justify-between rounded-lg bg-muted/40 px-3 py-2"><span>Step {step.step}</span><span>{step.status}</span></div>)}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
