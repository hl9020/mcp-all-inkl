import { kasCall, requireParams } from "../kas-client.js";
import type { ToolInput, McpResult } from "../types.js";

const A: Record<string, string> = {
  list: "get_directoryprotection",
  create: "add_directoryprotection",
  update: "update_directoryprotection",
  delete: "delete_directoryprotection",
};

const REQ: Record<string, string[]> = {
  create: ["directory_user", "directory_path", "directory_password", "directory_authname"],
  update: ["directory_user", "directory_path", "directory_password", "directory_authname"],
  delete: ["directory_user", "directory_path"],
};

export async function handleDirectoryProtection(input: ToolInput): Promise<McpResult> {
  const fn = A[input.action];
  if (!fn) return { isError: true, content: [{ type: "text", text: `Unbekannte Action: ${input.action}` }] };
  const e = requireParams(input.params, REQ[input.action] ?? []);
  if (e) return { isError: true, content: [{ type: "text", text: e }] };
  return kasCall(fn, input.params ?? {});
}
