import { kasCall, requireParams } from "../kas-client.js";
import type { ToolInput, McpResult } from "../types.js";

const A: Record<string, string> = {
  list: "get_sambausers",
  create: "add_sambauser",
  update: "update_sambauser",
  delete: "delete_sambauser",
};

const REQ: Record<string, string[]> = {
  create: ["samba_path", "samba_new_password", "samba_comment"],
  update: ["samba_login"],
  delete: ["samba_login"],
};

export async function handleSamba(input: ToolInput): Promise<McpResult> {
  const fn = A[input.action];
  if (!fn) return { isError: true, content: [{ type: "text", text: `Unbekannte Action: ${input.action}` }] };
  const e = requireParams(input.params, REQ[input.action] ?? []);
  if (e) return { isError: true, content: [{ type: "text", text: e }] };
  return kasCall(fn, input.params ?? {});
}
