import { kasCall, requireParams } from "../kas-client.js";
import type { ToolInput, McpResult } from "../types.js";

const A: Record<string, string> = {
  list: "get_databases",
  create: "add_database",
  update: "update_database",
  delete: "delete_database",
};

const REQ: Record<string, string[]> = {
  create: ["database_password"],
  update: ["database_login"],
  delete: ["database_login"],
};

export async function handleDatabase(input: ToolInput): Promise<McpResult> {
  const fn = A[input.action];
  if (!fn) return { isError: true, content: [{ type: "text", text: `Unbekannte Action: ${input.action}` }] };
  const e = requireParams(input.params, REQ[input.action] ?? []);
  if (e) return { isError: true, content: [{ type: "text", text: e }] };
  return kasCall(fn, input.params ?? {});
}
