#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import type { ToolInput, McpResult } from "./types.js";
import { applyPickAndFilter } from "./kas-client.js";
import { handleDns } from "./tools/dns.js";
import { handleDomain } from "./tools/domain.js";
import { handleSubdomain } from "./tools/subdomain.js";
import { handleDatabase } from "./tools/database.js";
import { handleMail } from "./tools/mail.js";
import { handleCronjob } from "./tools/cronjob.js";
import { handleSsl } from "./tools/ssl.js";
import { handleAccount } from "./tools/account.js";
import { handleSystem } from "./tools/system.js";

const PF = `
Optional params for all tools: "pick" (array of field names to return, reduces tokens) and "filter" (object to match, e.g. {"record_type":"MX"} returns only matching entries).`;

const TOOLS = [
  {
    name: "kas_dns",
    description: `Manage DNS records (A, AAAA, CNAME, MX, TXT, SRV...).
IMPORTANT: zone_host MUST end with a trailing dot (e.g. "example.com." NOT "example.com").
Actions:
- list: params {zone_host} - list all DNS records of a zone
- create: params {record_aux: "0"} - record_aux must be a STRING not a number (e.g. "0"), record_name="" for zone root
- update: params {record_id, ...fields} - modify a record (get record_id from list)
- delete: params {record_id} - delete a record
- reset: params {zone_host} - reset zone to defaults` + PF,
    actions: ["list", "create", "update", "delete", "reset"],
  },
  {
    name: "kas_domain",
    description: `Manage domains.
Actions:
- list: no params - list all domains
- list_tlds: no params - available TLDs
- create: params {domain_name, domain_tld, domain_path, ssl_proxy, redirect_status}
- update: params {domain_name, ...fields}
- delete: params {domain_name}
- move: params {domain_name, target_kas_login}` + PF,
    actions: ["list", "list_tlds", "create", "update", "delete", "move"],
  },
  {
    name: "kas_subdomain",
    description: `Manage subdomains.
Actions:
- list: no params - list all subdomains
- create: params {subdomain_name, domain_name} - e.g. subdomain_name="www", domain_name="example.com"
- update: params {subdomain_name, ...fields} - may fail with "in_progress" right after creation, retry after a few seconds
- delete: params {subdomain_name}
- move: params {subdomain_name, target_kas_login}` + PF,
    actions: ["list", "create", "update", "delete", "move"],
  },
  {
    name: "kas_database",
    description: `Manage MySQL databases.
Actions:
- list: no params - list all databases
- create: params {database_password} - name is auto-generated
- update: params {database_name, database_login, ...fields} - database_login required (same value as database_name), e.g. database_comment, database_password
- delete: params {database_name, database_login} - database_login required (same value as database_name)` + PF,
    actions: ["list", "create", "update", "delete"],
  },
  {
    name: "kas_mail",
    description: `Manage email: mailboxes, forwards, mailing lists, filters.
Actions:
- list/create/update/delete: mailboxes (params: mail_login, mail_password, ...)
- list_forwards: list all email forwards
- create_forward: params {local_part, domain_part, target_0, target_1, ...} - target_N are the forward destinations (numbered from 0), e.g. target_0="user@example.com"; may fail with "fetch failed" on first attempt, retry once
- update_forward: params {mail_forward, target_0, target_1, ...} - mail_forward is the full address e.g. "alias@example.com"; note: update may fail with "in_progress" right after creation, retry after a few seconds
- delete_forward: params {mail_forward} - mail_forward is the full address e.g. "alias@example.com"
- list_lists/create_list/update_list/delete_list: mailing lists
- list_filters/add_filter/delete_filter: mail filters` + PF,
    actions: ["list", "create", "update", "delete", "list_forwards", "create_forward", "update_forward", "delete_forward", "list_lists", "create_list", "update_list", "delete_list", "list_filters", "add_filter", "delete_filter"],
  },
  {
    name: "kas_cronjob",
    description: `Manage cronjobs.
Actions:
- list: no params - list all cronjobs
- create: params {protocol, http_url, minute, hour, day_of_month, month, day_of_week} - protocol="https"|"http", http_url without protocol prefix, time values like crontab (* for every)
- update: params {cronjob_id, ...fields}
- delete: params {cronjob_id}` + PF,
    actions: ["list", "create", "update", "delete"],
  },
  {
    name: "kas_ssl",
    description: "Manage SSL certificates. Action: update - params {domain_name, ssl_certificate_sni_crt, ssl_certificate_sni_key, ssl_certificate_sni_bundle}" + PF,
    actions: ["update"],
  },
  {
    name: "kas_account",
    description: `Manage KAS accounts and settings.
Actions:
- list: list all accounts
- get_resources: resource limits and usage
- get_settings: account settings
- get_server_info: server information (PHP versions, MySQL, OS)
- create/update/delete: account management
- update_settings/update_superuser: change settings` + PF,
    actions: ["list", "get_resources", "get_settings", "get_server_info", "create", "update", "update_settings", "update_superuser", "delete"],
  },
  {
    name: "kas_system",
    description: `Sessions, disk space, traffic.
Actions:
- create_session: create new auth session
- get_space: disk space overview
- get_space_usage: detailed space usage per directory
- get_traffic: traffic statistics` + PF,
    actions: ["create_session", "get_space", "get_space_usage", "get_traffic"],
  },
];

const handlers: Record<string, (i: ToolInput) => Promise<McpResult>> = {
  kas_dns: handleDns,
  kas_domain: handleDomain,
  kas_subdomain: handleSubdomain,
  kas_database: handleDatabase,
  kas_mail: handleMail,
  kas_cronjob: handleCronjob,
  kas_ssl: handleSsl,
  kas_account: handleAccount,
  kas_system: handleSystem,
};

const server = new Server(
  { name: "mcp-all-inkl", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: TOOLS.map((t) => ({
    name: t.name,
    description: t.description,
    inputSchema: {
      type: "object",
      properties: {
        action: { type: "string", enum: t.actions },
        params: { type: "object", additionalProperties: true },
        pick: { type: "array", items: { type: "string" }, description: "Return only these fields from each result (reduces token usage)" },
        filter: { type: "object", additionalProperties: true, description: "Filter array results by field values, e.g. {record_type: \"MX\"}" },
      },
      required: ["action"],
    },
  })),
}));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const { name, arguments: args } = req.params;
  const handler = handlers[name];
  if (!handler) {
    return {
      isError: true,
      content: [{ type: "text", text: `Unbekanntes Tool: ${name}` }],
    };
  }
  const input = args as unknown as ToolInput;
  const result = await handler(input);
  if (!result.isError && (input.pick || input.filter)) {
    const data = JSON.parse(result.content[0].text);
    const filtered = applyPickAndFilter(data, input.pick, input.filter);
    return { content: [{ type: "text", text: JSON.stringify(filtered, null, 2) }] };
  }
  return result;
});

const transport = new StdioServerTransport();
await server.connect(transport);
