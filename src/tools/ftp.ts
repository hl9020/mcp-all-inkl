import { kasCall, requireParams } from "../kas-client.js";
import type { ToolInput, McpResult } from "../types.js";

const A: Record<string, string> = {
  list: "get_ftpusers",
  create: "add_ftpuser",
  update: "update_ftpuser",
  delete: "delete_ftpuser",
};

const REQ: Record<string, string[]> = {
  create: ["ftp_password", "ftp_comment"],
  update: ["ftp_login"],
  delete: ["ftp_login"],
};

export async function handleFtp(input: ToolInput): Promise<McpResult> {
  const fn = A[input.action];
  if (!fn) return { isError: true, content: [{ type: "text", text: `Unbekannte Action: ${input.action}` }] };
  const e = requireParams(input.params, REQ[input.action] ?? []);
  if (e) return { isError: true, content: [{ type: "text", text: e }] };
  return kasCall(fn, input.params ?? {});
}
