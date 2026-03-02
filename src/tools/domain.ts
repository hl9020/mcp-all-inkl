import { kasCall, requireParams } from "../kas-client.js";
import type { ToolInput, McpResult } from "../types.js";

const A: Record<string, string> = {
  list: "get_domains",
  list_tlds: "get_topleveldomains",
  create: "add_domain",
  update: "update_domain",
  delete: "delete_domain",
  move: "move_domain",
};

const REQ: Record<string, string[]> = {
  create: ["domain_name", "domain_tld"],
  update: ["domain_name"],
  delete: ["domain_name"],
  move: ["domain_name", "source_account", "target_account"],
};

export async function handleDomain(input: ToolInput): Promise<McpResult> {
  const fn = A[input.action];
  if (!fn) return { isError: true, content: [{ type: "text", text: `Unbekannte Action: ${input.action}` }] };
  const e = requireParams(input.params, REQ[input.action] ?? []);
  if (e) return { isError: true, content: [{ type: "text", text: e }] };
  return kasCall(fn, input.params ?? {});
}
