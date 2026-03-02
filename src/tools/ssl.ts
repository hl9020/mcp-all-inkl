import { kasCall, requireParams } from "../kas-client.js";
import type { ToolInput, McpResult } from "../types.js";

export async function handleSsl(input: ToolInput): Promise<McpResult> {
  if (input.action !== "update")
    return { isError: true, content: [{ type: "text", text: `Unbekannte Action: ${input.action}` }] };
  const e = requireParams(input.params, ["hostname", "ssl_certificate_sni_key", "ssl_certificate_sni_crt"]);
  if (e) return { isError: true, content: [{ type: "text", text: e }] };
  return kasCall("update_ssl", input.params ?? {});
}
