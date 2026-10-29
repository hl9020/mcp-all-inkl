import { kasCall, requireParams } from "../kas-client.js";
import type { ToolInput, McpResult } from "../types.js";

const A: Record<string, string> = {
  list: "get_softwareinstall",
  install: "add_softwareinstall",
};

const REQ: Record<string, string[]> = {
  install: ["software_id", "software_database", "software_database_password", "software_hostname", "software_path", "software_admin_mail", "software_admin_user", "software_admin_pass"],
};

export async function handleSoftware(input: ToolInput): Promise<McpResult> {
  const fn = A[input.action];
  if (!fn) return { isError: true, content: [{ type: "text", text: `Unbekannte Action: ${input.action}` }] };
  const e = requireParams(input.params, REQ[input.action] ?? []);
  if (e) return { isError: true, content: [{ type: "text", text: e }] };
  return kasCall(fn, input.params ?? {});
}
