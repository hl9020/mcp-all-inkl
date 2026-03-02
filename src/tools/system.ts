import { kasCall, requireParams } from "../kas-client.js";
import type { ToolInput, McpResult } from "../types.js";

const A: Record<string, string> = {
  create_session: "create_session",
  get_space: "get_space",
  get_space_usage: "get_space_usage",
  get_traffic: "get_traffic",
};

const REQ: Record<string, string[]> = {
  get_space_usage: ["directory"],
};

export async function handleSystem(input: ToolInput): Promise<McpResult> {
  const fn = A[input.action];
  if (!fn) return { isError: true, content: [{ type: "text", text: `Unbekannte Action: ${input.action}` }] };
  const e = requireParams(input.params, REQ[input.action] ?? []);
  if (e) return { isError: true, content: [{ type: "text", text: e }] };
  return kasCall(fn, input.params ?? {});
}
