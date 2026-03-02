import { kasCall, requireParams } from "../kas-client.js";
import type { ToolInput, McpResult } from "../types.js";

const A: Record<string, string> = {
  list: "get_subdomains",
  create: "add_subdomain",
  update: "update_subdomain",
  delete: "delete_subdomain",
  move: "move_subdomain",
};

const REQ: Record<string, string[]> = {
  create: ["subdomain_name", "domain_name"],
  update: ["subdomain_name"],
  delete: ["subdomain_name"],
  move: ["subdomain_name", "source_account", "target_account"],
};

export async function handleSubdomain(input: ToolInput): Promise<McpResult> {
  const fn = A[input.action];
  if (!fn) return { isError: true, content: [{ type: "text", text: `Unbekannte Action: ${input.action}` }] };
  const e = requireParams(input.params, REQ[input.action] ?? []);
  if (e) return { isError: true, content: [{ type: "text", text: e }] };
  return kasCall(fn, input.params ?? {});
}
