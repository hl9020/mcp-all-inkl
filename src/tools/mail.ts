import { kasCall, requireParams } from "../kas-client.js";
import type { ToolInput, McpResult } from "../types.js";

const A: Record<string, string> = {
  list: "get_mailaccounts",
  create: "add_mailaccount",
  update: "update_mailaccount",
  delete: "delete_mailaccount",
  list_forwards: "get_mailforwards",
  create_forward: "add_mailforward",
  update_forward: "update_mailforward",
  delete_forward: "delete_mailforward",
  list_lists: "get_mailinglists",
  create_list: "add_mailinglist",
  update_list: "update_mailinglist",
  delete_list: "delete_mailinglist",
  list_filters: "get_mailstandardfilter",
  add_filter: "add_mailstandardfilter",
  delete_filter: "delete_mailstandardfilter",
};

const REQ: Record<string, string[]> = {
  create: ["mail_password", "local_part", "domain_part"],
  update: ["mail_login"],
  delete: ["mail_login"],
  create_forward: ["local_part", "domain_part"],
  update_forward: ["mail_forward"],
  delete_forward: ["mail_forward"],
  create_list: ["mailinglist_name", "mailinglist_domain", "mailinglist_password"],
  update_list: ["mailinglist_name"],
  delete_list: ["mailinglist_name"],
  add_filter: ["mail_login", "filter"],
  delete_filter: ["mail_login"],
};

export async function handleMail(input: ToolInput): Promise<McpResult> {
  const fn = A[input.action];
  if (!fn) return { isError: true, content: [{ type: "text", text: `Unbekannte Action: ${input.action}` }] };
  const e = requireParams(input.params, REQ[input.action] ?? []);
  if (e) return { isError: true, content: [{ type: "text", text: e }] };
  return kasCall(fn, input.params ?? {});
}
