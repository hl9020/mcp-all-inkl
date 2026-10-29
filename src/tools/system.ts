import { kasCall, requireParams } from "../kas-client.js";
import type { ToolInput, McpResult } from "../types.js";

const A: Record<string, string> = {
  create_session: "create_session",
  get_space: "get_space",
  get_space_usage: "get_space_usage",
  get_traffic: "get_traffic",
  create_symlink: "add_symlink",
  chown: "update_chown",
};

const REQ: Record<string, string[]> = {
  get_space_usage: ["directory"],
  create_symlink: ["symlink_target", "symlink_name"],
  chown: ["chown_path", "chown_user", "recursive"],
};

export async function handleSystem(input: ToolInput): Promise<McpResult> {
  const fn = A[input.action];
  if (!fn) return { isError: true, content: [{ type: "text", text: `Unbekannte Action: ${input.action}` }] };
  const e = requireParams(input.params, REQ[input.action] ?? []);
  if (e) return { isError: true, content: [{ type: "text", text: e }] };
  return kasCall(fn, input.params ?? {});
}
