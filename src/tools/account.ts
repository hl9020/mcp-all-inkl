import { kasCall, requireParams } from "../kas-client.js";
import type { ToolInput, McpResult } from "../types.js";

const A: Record<string, string> = {
  list: "get_accounts",
  get_resources: "get_accountresources",
  get_settings: "get_accountsettings",
  get_server_info: "get_server_information",
  create: "add_account",
  update: "update_account",
  update_settings: "update_accountsettings",
  update_superuser: "update_superusersettings",
  delete: "delete_account",
};

const REQ: Record<string, string[]> = {
  create: ["account_kas_password", "account_ftp_password"],
  update: ["account_login", "account_kas_password"],
  update_superuser: ["account_login"],
  delete: ["account_login"],
};

export async function handleAccount(input: ToolInput): Promise<McpResult> {
  const fn = A[input.action];
  if (!fn) return { isError: true, content: [{ type: "text", text: `Unbekannte Action: ${input.action}` }] };
  const e = requireParams(input.params, REQ[input.action] ?? []);
  if (e) return { isError: true, content: [{ type: "text", text: e }] };
  return kasCall(fn, input.params ?? {});
}
