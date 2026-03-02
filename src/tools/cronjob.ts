import { kasCall, requireParams } from "../kas-client.js";
import type { ToolInput, McpResult } from "../types.js";

const A: Record<string, string> = {
  list: "get_cronjobs",
  create: "add_cronjob",
  update: "update_cronjob",
  delete: "delete_cronjob",
};

const REQ: Record<string, string[]> = {
  create: ["protocol", "http_url", "cronjob_comment", "minute", "hour", "day_of_month", "month", "day_of_week"],
  update: ["cronjob_id"],
  delete: ["cronjob_id"],
};

export async function handleCronjob(input: ToolInput): Promise<McpResult> {
  const fn = A[input.action];
  if (!fn) return { isError: true, content: [{ type: "text", text: `Unbekannte Action: ${input.action}` }] };
  const e = requireParams(input.params, REQ[input.action] ?? []);
  if (e) return { isError: true, content: [{ type: "text", text: e }] };
  return kasCall(fn, input.params ?? {});
}
