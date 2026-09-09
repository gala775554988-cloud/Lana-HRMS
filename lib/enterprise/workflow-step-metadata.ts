export type WorkflowStepMetadata = {
  note?: string;
  priority?: "Low" | "Normal" | "High";
  deferredUntil?: string;
  transferred?: boolean;
  transferredBy?: string;
};

export function parseWorkflowStepMetadata(value: string | null | undefined): WorkflowStepMetadata {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value) as Record<string, unknown>;
    if (!parsed || Array.isArray(parsed) || typeof parsed !== "object") return { note: value };
    return {
      note: typeof parsed.note === "string" ? parsed.note : undefined,
      priority: parsed.priority === "Low" || parsed.priority === "Normal" || parsed.priority === "High" ? parsed.priority : undefined,
      deferredUntil: typeof parsed.deferredUntil === "string" ? parsed.deferredUntil : undefined,
      transferred: parsed.transferred === true,
      transferredBy: typeof parsed.transferredBy === "string"
        ? parsed.transferredBy
        : typeof parsed.by === "string"
          ? parsed.by
          : undefined
    };
  } catch {
    return { note: value };
  }
}

export function mergeWorkflowStepMetadata(
  current: string | null | undefined,
  patch: Partial<WorkflowStepMetadata>
) {
  const merged = { ...parseWorkflowStepMetadata(current), ...patch };
  return JSON.stringify(Object.fromEntries(Object.entries(merged).filter(([, value]) => value !== undefined && value !== "")));
}
