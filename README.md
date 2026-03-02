# mcp-all-inkl

MCP Server for managing [All-Inkl.com](https://all-inkl.com) web hosting via the KAS SOAP API. Gives Claude and other MCP-compatible AI assistants direct access to domains, DNS, email, databases, cronjobs, SSL, and more.

**9 tools, 53 actions** - full coverage of the KAS API, with all SOAP/XML complexity abstracted into clean JSON responses.

## Features

- Complete KAS API coverage across 9 tool categories
- Plain-text authentication over HTTPS (secure via TLS)
- Automatic session token management with re-auth on expiry
- Flood protection awareness - respects KAS API rate limits
- Stack-based SOAP/XML parser that correctly handles deeply nested `<item>` structures
- Auto-fix for common parameter issues (e.g. missing trailing dot on DNS zone_host)
- `pick` and `filter` params on all tools to reduce response size and token usage

## Requirements

- Node.js 22+
- All-Inkl.com KAS account with API access
- KAS login (format: `w0XXXXXXX`) and password

## Setup

### Claude Desktop / Claude.ai

Add to `claude_desktop_config.json`:

**Windows:** `%APPDATA%\Claude\claude_desktop_config.json`
**macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "all-inkl": {
      "command": "npx",
      "args": ["-y", "mcp-all-inkl"],
      "env": {
        "KAS_LOGIN": "w0XXXXXXX",
        "KAS_PASSWORD": "your-kas-password"
      }
    }
  }
}
```

Restart Claude Desktop after saving.

### Claude Code

```bash
claude mcp add all-inkl \
  -e KAS_LOGIN=w0XXXXXXX \
  -e KAS_PASSWORD=your-kas-password \
  -- npx -y mcp-all-inkl
```

Or add to `.mcp.json` in your project root:

```json
{
  "mcpServers": {
    "all-inkl": {
      "command": "npx",
      "args": ["-y", "mcp-all-inkl"],
      "env": {
        "KAS_LOGIN": "w0XXXXXXX",
        "KAS_PASSWORD": "your-kas-password"
      }
    }
  }
}
```

### Cursor

Add to `~/.cursor/mcp.json` (global) or `.cursor/mcp.json` (project):

```json
{
  "mcpServers": {
    "all-inkl": {
      "command": "npx",
      "args": ["-y", "mcp-all-inkl"],
      "env": {
        "KAS_LOGIN": "w0XXXXXXX",
        "KAS_PASSWORD": "your-kas-password"
      }
    }
  }
}
```

### Windsurf

Add to `~/.codeium/windsurf/mcp_config.json`:

Same JSON format as above.

### VS Code + GitHub Copilot

Add to `.vscode/mcp.json` in your workspace:

```json
{
  "servers": {
    "all-inkl": {
      "command": "npx",
      "args": ["-y", "mcp-all-inkl"],
      "env": {
        "KAS_LOGIN": "w0XXXXXXX",
        "KAS_PASSWORD": "your-kas-password"
      }
    }
  }
}
```

### Cline

Open Cline -> MCP Servers icon -> Edit MCP Settings, then add the same JSON as Claude Desktop.

### Continue.dev

Create `.continue/mcpServers/all-inkl.json` with the same JSON format.

### OpenAI Codex CLI

```bash
codex mcp add all-inkl \
  --env KAS_LOGIN=w0XXXXXXX \
  --env KAS_PASSWORD=your-kas-password \
  -- npx -y mcp-all-inkl
```

### Zed

Add to Zed `settings.json` (via Agent Panel -> Settings):

```json
{
  "context_servers": {
    "all-inkl": {
      "command": {
        "path": "npx",
        "args": ["-y", "mcp-all-inkl"],
        "env": {
          "KAS_LOGIN": "w0XXXXXXX",
          "KAS_PASSWORD": "your-kas-password"
        }
      }
    }
  }
}
```

### Compatibility Matrix

| Tool | Config Location |
|------|----------------|
| Claude Desktop / Claude.ai | `claude_desktop_config.json` |
| Claude Code | `.mcp.json` |
| Cursor | `.cursor/mcp.json` |
| Windsurf | `~/.codeium/windsurf/mcp_config.json` |
| VS Code + Copilot | `.vscode/mcp.json` |
| Cline | MCP Settings JSON |
| Continue.dev | `.continue/mcpServers/*.json` |
| Zed | `settings.json` |
| Codex CLI | `.codex/config.toml` |
| Roo Code | MCP Settings JSON |
| Google Antigravity | `~/.gemini/settings.json` |

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `KAS_LOGIN` | Yes | - | KAS account login (format: `w0XXXXXXX`) |
| `KAS_PASSWORD` | Yes | - | KAS account password |

Get your KAS login from the [KAS admin panel](https://kas.all-inkl.com) - it's shown in the top right after login.

## pick & filter - Response Optimization

All tools support optional `pick` and `filter` parameters to reduce token usage on large responses.

### pick - Return only specific fields

```jsonc
// Without pick: full DNS records with 8 fields each (~2,000 tokens for 18 records)
{ "action": "list", "params": { "zone_host": "example.com." } }

// With pick: only type and data (~400 tokens)
{ "action": "list", "params": { "zone_host": "example.com." }, "pick": ["record_type", "record_data"] }
```

### filter - Filter array results by field values

```jsonc
// Only MX records
{ "action": "list", "params": { "zone_host": "example.com." }, "filter": { "record_type": "MX" } }

// Only a specific database
{ "action": "list", "filter": { "database_name": "d03f4990" } }
```

### Combined - filter + pick

```jsonc
// MX records with only server and priority
{ "action": "list", "params": { "zone_host": "example.com." }, "filter": { "record_type": "MX" }, "pick": ["record_data", "record_aux"] }
// Returns: [{"record_data": "aspmx.l.google.com.", "record_aux": 1}, ...]
```

When to use:
- **DNS zones with many records** - filter by `record_type` to get only A, MX, TXT, etc.
- **Mail accounts** - pick only `mail_login` and `domain_part` instead of full quota details
- **Databases** - filter by `database_comment` or pick only `database_name` and `used_database_space`
- **Any list action** returning more data than needed

## Tools & Actions

### kas_dns - DNS Records

Manage A, AAAA, CNAME, MX, TXT, SRV records.

> **Important:** `zone_host` must end with a trailing dot: `"example.com."` not `"example.com"`. The server auto-appends it if missing, but best practice is to include it.

| Action | Required Params | Description |
|--------|----------------|-------------|
| `list` | `zone_host` | List all DNS records of a zone |
| `create` | `zone_host`, `record_type`, `record_name`, `record_data`, `record_aux` | Create record. `record_name=""` for zone root. `record_aux=0` for most types, MX priority for MX |
| `update` | `record_id` | Update record (get `record_id` from `list`) |
| `delete` | `record_id` | Delete a record |
| `reset` | `zone_host` | Reset zone to defaults |

### kas_domain - Domains

| Action | Required Params | Description |
|--------|----------------|-------------|
| `list` | - | List all domains |
| `list_tlds` | - | List available TLDs |
| `create` | `domain_name`, `domain_tld` | Register a new domain |
| `update` | `domain_name` | Update domain settings (path, redirect, PHP version, etc.) |
| `delete` | `domain_name` | Delete a domain |
| `move` | `domain_name`, `source_account`, `target_account` | Move domain to another KAS account |

### kas_subdomain - Subdomains

| Action | Required Params | Description |
|--------|----------------|-------------|
| `list` | - | List all subdomains |
| `create` | `subdomain_name`, `domain_name` | Create subdomain (e.g. `"www"` + `"example.com"`) |
| `update` | `subdomain_name` | Update subdomain settings |
| `delete` | `subdomain_name` | Delete a subdomain |
| `move` | `subdomain_name`, `source_account`, `target_account` | Move to another account |

### kas_database - MySQL Databases

| Action | Required Params | Description |
|--------|----------------|-------------|
| `list` | - | List all databases with size and comments |
| `create` | `database_password` | Create database (name auto-generated by KAS) |
| `update` | `database_login` | Update password, comment, or allowed hosts |
| `delete` | `database_login` | Delete a database |

### kas_mail - Email

Manages mailboxes, forwards, mailing lists, and filters.

| Action | Required Params | Description |
|--------|----------------|-------------|
| `list` | - | List all mailboxes |
| `create` | `mail_password`, `local_part`, `domain_part` | Create mailbox |
| `update` | `mail_login` | Update mailbox settings |
| `delete` | `mail_login` | Delete mailbox |
| `list_forwards` | - | List email forwards |
| `create_forward` | `local_part`, `domain_part` | Create forward |
| `update_forward` | `mail_forward` | Update forward targets |
| `delete_forward` | `mail_forward` | Delete forward |
| `list_lists` | - | List mailing lists |
| `create_list` | `mailinglist_name`, `mailinglist_domain`, `mailinglist_password` | Create mailing list |
| `update_list` | `mailinglist_name` | Update mailing list |
| `delete_list` | `mailinglist_name` | Delete mailing list |
| `list_filters` | - | List mail filters |
| `add_filter` | `mail_login`, `filter` | Add mail filter |
| `delete_filter` | `mail_login` | Delete mail filter |

### kas_cronjob - Cronjobs

| Action | Required Params | Description |
|--------|----------------|-------------|
| `list` | - | List all cronjobs |
| `create` | `protocol`, `http_url`, `cronjob_comment`, `minute`, `hour`, `day_of_month`, `month`, `day_of_week` | Create cronjob. Time values use crontab syntax (`*` for every) |
| `update` | `cronjob_id` | Update cronjob settings |
| `delete` | `cronjob_id` | Delete a cronjob |

### kas_ssl - SSL Certificates

| Action | Required Params | Description |
|--------|----------------|-------------|
| `update` | `hostname`, `ssl_certificate_sni_key`, `ssl_certificate_sni_crt` | Install/update SSL certificate |

### kas_account - Account Management

| Action | Required Params | Description |
|--------|----------------|-------------|
| `list` | - | List all accounts |
| `get_resources` | - | Resource limits and current usage |
| `get_settings` | - | Account settings |
| `get_server_info` | - | Server info (PHP versions, MySQL, OS) |
| `create` | `account_kas_password`, `account_ftp_password` | Create sub-account |
| `update` | `account_login`, `account_kas_password` | Update account |
| `update_settings` | - | Update account settings |
| `update_superuser` | `account_login` | Update superuser settings |
| `delete` | `account_login` | Delete an account |

### kas_system - System

| Action | Required Params | Description |
|--------|----------------|-------------|
| `create_session` | - | Create new auth session |
| `get_space` | - | Disk space overview |
| `get_space_usage` | `directory` | Detailed space usage for a directory |
| `get_traffic` | - | Traffic statistics |

## Example Responses

### DNS Records
```json
[
  {
    "record_zone": "example.com",
    "record_name": null,
    "record_type": "A",
    "record_data": "85.13.151.85",
    "record_aux": 0,
    "record_id": 56652527,
    "record_changeable": "Y",
    "record_deleteable": "Y"
  }
]
```

### Databases
```json
[
  {
    "database_name": "d03f4990",
    "database_login": "d03f4990",
    "database_password": null,
    "database_comment": "My App Database",
    "database_allowed_hosts": "localhost",
    "used_database_space": 44075.3
  }
]
```

### Server Info
```json
[
  { "service": "mysql", "version": "10.11.14", "version_type": "server" },
  { "service": "php", "interface": "cgi-fcgi", "file_extension": "php84", "version": 8.4 },
  { "service": "os", "distribution": "ubuntu", "version": 24 }
]
```

## Architecture

### Authentication Flow

1. SOAP POST to `https://kasapi.kasserver.com/soap/KasAuth.php` with `kas_auth_type: "plain"`
2. Receives session token (valid 60 minutes, auto-refreshes)
3. All subsequent API calls use `kas_auth_type: "session"` with the token
4. On session expiry or invalidation, automatic re-authentication

### SOAP XML Parser

The KAS API returns deeply nested SOAP/XML with `<item>` tags at multiple levels. Standard regex-based parsing fails because greedy matching can't distinguish between nested `<item>` open/close pairs.

This server uses a **stack-based parser** that:
- Tracks `<item>` tag depth with a counter
- Only captures top-level items when depth returns to 0
- Recursively parses `ns2:Map` objects and `SOAP-ENC:Array` arrays
- Handles `xsi:nil`, `xsd:int`, `xsd:float`, and `xsd:string` types
- Returns clean JavaScript objects/arrays

### API Parameter Format

The KAS API expects parameters as JSON inside a SOAP envelope. One critical detail: the parameter key for request params must be `KasRequestParams` (CamelCase), not `kas_request_params` (snake_case). Actions without parameters work with either format, which can mask this bug during development.

### Flood Protection

KAS returns a `KasFloodDelay` value with each response. The server tracks this per action and automatically waits before sending the next request to the same endpoint.

### pick & filter

All tools accept optional `pick` (array of field names) and `filter` (object with key-value pairs) parameters. These are applied client-side after the API response is parsed - `filter` removes non-matching entries from arrays, `pick` strips all fields except the specified ones. Both combine to dramatically reduce token usage: a full DNS zone with 18 records and 8 fields each (~2,000 tokens) can be reduced to just 5 MX records with 2 fields (~100 tokens).

## Verify

Start a new conversation and ask:

```
List all my domains
```

The AI should call `kas_domain` with action `list` and return your domain list as JSON.

Other test queries:
- `"Show me DNS records for example.com"` - tests DNS with trailing dot auto-fix
- `"How much disk space is left?"` - tests system tools
- `"What PHP versions are available?"` - tests server info

## Development

```bash
git clone https://github.com/hl9020/mcp-all-inkl.git
cd mcp-all-inkl
npm install
npm run build
```

### Testing locally

Create a test file (excluded from git):

```javascript
// test.mjs
process.env.KAS_LOGIN = "w0XXXXXXX";
process.env.KAS_PASSWORD = "your-password";
const { kasCall } = await import("./dist/kas-client.js");

const result = await kasCall("get_domains");
console.log(result.content[0].text);
```

```bash
node test.mjs
```

### Project Structure

```
src/
  index.ts          # MCP server setup, tool definitions with descriptions
  kas-client.ts     # SOAP client, auth, XML parser, API caller
  types.ts          # TypeScript interfaces
  tools/
    dns.ts          # DNS records (5 actions)
    domain.ts       # Domains (6 actions)
    subdomain.ts    # Subdomains (5 actions)
    database.ts     # MySQL databases (4 actions)
    mail.ts         # Email, forwards, lists, filters (15 actions)
    cronjob.ts      # Cronjobs (4 actions)
    ssl.ts          # SSL certificates (1 action)
    account.ts      # Account management (9 actions)
    system.ts       # System info (4 actions)
```

## Known Limitations

- KAS flood protection can cause temporary delays when making rapid successive calls
- SSL tool only supports `update` (installing certificates), not listing or deleting
- The KAS API itself has no pagination - large result sets are returned in full

## Links

- [All-Inkl.com KAS API Documentation](https://kasapi.kasserver.com/dokumentation/phpdoc/)
- [KAS API SOAP Examples](https://kasapi.kasserver.com/dokumentation/?open=quellcode)
- [All-Inkl.com](https://all-inkl.com)

## License

MIT
