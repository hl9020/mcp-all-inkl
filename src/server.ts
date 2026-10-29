import { Server } from "@modelcontextprotocol/sdk/server/index.js";
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
import { handleFtp } from "./tools/ftp.js";
import { handleDdns } from "./tools/ddns.js";
import { handleSamba } from "./tools/samba.js";
import { handleDirectoryProtection } from "./tools/directoryprotection.js";
import { handleSoftware } from "./tools/software.js";

const PF = `
Optional params for all tools: "pick" (array of field names to return, reduces tokens) and "filter" (object to match, e.g. {"record_type":"MX"} returns only matching entries).`;

export const TOOLS = [
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
    description: `Manage SSL certificates.
Actions:
- update: params {hostname, ssl_certificate_sni_key, ssl_certificate_sni_crt} - hostname is the (sub)domain, e.g. "sub.example.com"
  optional: ssl_certificate_is_active ("Y"|"N" - a stored certificate is only served when "Y"), ssl_certificate_sni_csr, ssl_certificate_sni_bundle (intermediate), ssl_certificate_force_https ("Y"|"N", HTTP 301 to HTTPS), ssl_certificate_hsts_max_age (seconds, -1 disables)` + PF,
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
- get_traffic: traffic statistics
- create_symlink: params {symlink_target, symlink_name}
- chown: params {chown_path, chown_user, recursive} - chown_user "phpuser" or the KAS login (e.g. "w0123456"), recursive "Y"|"N"` + PF,
    actions: ["create_session", "get_space", "get_space_usage", "get_traffic", "create_symlink", "chown"],
  },
  {
    name: "kas_ftp",
    description: `Manage FTP users.
Actions:
- list: optional params {ftp_login}
- create: params {ftp_password, ftp_comment} - optional: ftp_path (default "/"), ftp_permission_read/ftp_permission_write/ftp_permission_list/ftp_virus_clamav ("Y"|"N", default "Y"); login is auto-generated
- update: params {ftp_login, ...fields} - e.g. ftp_new_password, ftp_path, ftp_comment, ftp_permission_*
- delete: params {ftp_login}` + PF,
    actions: ["list", "create", "update", "delete"],
  },
  {
    name: "kas_ddns",
    description: `Manage DynDNS users.
Actions:
- list: optional params {ddns_login}
- create: params {dyndns_comment, dyndns_password, dyndns_zone, dyndns_label, dyndns_target_ip} - zone e.g. "example.com", label e.g. "home"; optional dyndns_dual_stack
- update: params {dyndns_login, ...fields} - e.g. dyndns_password, dyndns_comment, dyndns_dual_stack
- delete: params {dyndns_login}` + PF,
    actions: ["list", "create", "update", "delete"],
  },
  {
    name: "kas_samba",
    description: `Manage Samba (network drive) users.
Actions:
- list: optional params {samba_login}
- create: params {samba_path, samba_new_password, samba_comment}
- update: params {samba_login, ...fields} - e.g. samba_path, samba_new_password, samba_comment
- delete: params {samba_login}` + PF,
    actions: ["list", "create", "update", "delete"],
  },
  {
    name: "kas_directory_protection",
    description: `Manage password-protected directories (.htaccess/.htpasswd).
Actions:
- list: optional params {directory_path}
- create: params {directory_user, directory_path, directory_password, directory_authname} - authname is the realm/comment shown in the login prompt
- update: params {directory_user, directory_path, directory_password, directory_authname}
- delete: params {directory_user, directory_path}` + PF,
    actions: ["list", "create", "update", "delete"],
  },
  {
    name: "kas_software",
    description: `One-click software installation (e.g. WordPress).
Actions:
- list: optional params {software_id} - available software and their software_id
- install: params {software_id, software_database, software_database_password, software_hostname, software_path, software_admin_mail, software_admin_user, software_admin_pass} - optional: software_install_example_data ("Y"|"N"), language ("de"|"en")` + PF,
    actions: ["list", "install"],
  },
];

const READ_ACTIONS = new Set([
  "list", "list_tlds", "list_forwards", "list_lists", "list_filters",
  "get_resources", "get_settings", "get_server_info",
  "get_space", "get_space_usage", "get_traffic",
]);

function isWriteAction(action: string): boolean {
  return !READ_ACTIONS.has(action);
}

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
  kas_ftp: handleFtp,
  kas_ddns: handleDdns,
  kas_samba: handleSamba,
  kas_directory_protection: handleDirectoryProtection,
  kas_software: handleSoftware,
};

export function createServer(opts: { readonly?: boolean } = {}): Server {
  const readonly = opts.readonly ?? false;
  const server = new Server(
    { name: "mcp-all-inkl", version: "1.0.4" },
    { capabilities: { tools: {} } }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: TOOLS.map((t) => {
      const actions = readonly ? t.actions.filter((a) => !isWriteAction(a)) : t.actions;
      return {
        name: t.name,
        description: readonly ? `[READONLY] ${t.description}` : t.description,
        inputSchema: {
          type: "object",
          properties: {
            action: { type: "string", enum: actions },
            params: { type: "object", additionalProperties: true },
            pick: { type: "array", items: { type: "string" }, description: "Return only these fields from each result (reduces token usage)" },
            filter: { type: "object", additionalProperties: true, description: "Filter array results by field values, e.g. {record_type: \"MX\"}" },
          },
          required: ["action"],
        },
      };
    }).filter((t) => (t.inputSchema.properties.action.enum as string[]).length > 0),
  }));

  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    const { name, arguments: args } = req.params;
    const handler = handlers[name];
    if (!handler) {
      return { isError: true, content: [{ type: "text", text: `Unbekanntes Tool: ${name}` }] };
    }
    const input = args as unknown as ToolInput;
    if (readonly && isWriteAction(input.action)) {
      return { isError: true, content: [{ type: "text", text: `Aktion '${input.action}' ist im Readonly-Modus gesperrt.` }] };
    }
    const result = await handler(input);
    if (!result.isError && (input.pick || input.filter)) {
      const data = JSON.parse(result.content[0].text);
      const filtered = applyPickAndFilter(data, input.pick, input.filter);
      return { content: [{ type: "text", text: JSON.stringify(filtered, null, 2) }] };
    }
    return result;
  });

  return server;
}
