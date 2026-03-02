import { kasCall, requireParams } from "../kas-client.js";
import type { ToolInput, McpResult } from "../types.js";

const A: Record<string, string> = {
  list: "get_dns_settings",
  create: "add_dns_settings",
  update: "update_dns_settings",
  delete: "delete_dns_settings",
  reset: "reset_dns_settings",
};

const REQ: Record<string, string[]> = {
  list: ["zone_host"],
  create: ["zone_host", "record_type", "record_name", "record_data", "record_aux"],
  update: ["record_id"],
  delete: ["record_id"],
  reset: ["zone_host"],
};

export async function handleDns(input: ToolInput): Promise<McpResult> {
  const fn = A[input.action];
  if (!fn) return { isError: true, content: [{ type: "text", text: `Unbekannte Action: ${input.action}` }] };
  const e = requireParams(input.params, REQ[input.action] ?? []);
  if (e) return { isError: true, content: [{ type: "text", text: e }] };
  const p = { ...input.params };
  if (p?.zone_host && typeof p.zone_host === "string" && !p.zone_host.endsWith(".")) {
    p.zone_host = p.zone_host + ".";
  }
  return kasCall(fn, p ?? {});
}
