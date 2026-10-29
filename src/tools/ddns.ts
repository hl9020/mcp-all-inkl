import { kasCall, requireParams } from "../kas-client.js";
import type { ToolInput, McpResult } from "../types.js";

const A: Record<string, string> = {
  list: "get_ddnsusers",
  create: "add_ddnsuser",
  update: "update_ddnsuser",
  delete: "delete_ddnsuser",
};

const REQ: Record<string, string[]> = {
  create: ["dyndns_comment", "dyndns_password", "dyndns_zone", "dyndns_label", "dyndns_target_ip"],
  update: ["dyndns_login"],
  delete: ["dyndns_login"],
};

export async function handleDdns(input: ToolInput): Promise<McpResult> {
  const fn = A[input.action];
  if (!fn) return { isError: true, content: [{ type: "text", text: `Unbekannte Action: ${input.action}` }] };
  const e = requireParams(input.params, REQ[input.action] ?? []);
  if (e) return { isError: true, content: [{ type: "text", text: e }] };
  return kasCall(fn, input.params ?? {});
}
