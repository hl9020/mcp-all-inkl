import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';

interface Client { client_id: string; redirect_uris: string[]; }
interface AuthCode { client_id: string; redirect_uri: string; challenge: string; }

const clients = new Map<string, Client>();
const codes = new Map<string, AuthCode>();

const b64url = (b: Buffer) => b.toString('base64url');
const rand = () => b64url(randomBytes(32));

function safeEq(a: string, b: string): boolean {
  const ab = Buffer.from(a), bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

// Stateless tokens: HMAC-signed, survive redeploys. Secret = MCP_AUTH_TOKEN (env, persistent).
let signKey = '';
export function initTokenSecret(secret: string) { signKey = secret; }

function signToken(): string {
  const payload = b64url(Buffer.from(JSON.stringify({ iat: Date.now(), jti: rand() })));
  const sig = b64url(createHmac('sha256', signKey).update(payload).digest());
  return `${payload}.${sig}`;
}

export function isValidToken(t: string): boolean {
  const dot = t.indexOf('.');
  if (dot < 0) return false;
  const payload = t.slice(0, dot), sig = t.slice(dot + 1);
  const expected = b64url(createHmac('sha256', signKey).update(payload).digest());
  return safeEq(sig, expected);
}

function json(res: ServerResponse, code: number, body: unknown) {
  res.writeHead(code, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
  res.end(JSON.stringify(body));
}

async function readJson(req: IncomingMessage): Promise<any> {
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(c as Buffer);
  if (!chunks.length) return {};
  const raw = Buffer.concat(chunks).toString('utf8');
  try { return JSON.parse(raw); } catch { return Object.fromEntries(new URLSearchParams(raw)); }
}

function loginPage(params: string, error?: string): string {
  return `<!doctype html><html lang="de"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>all-inkl Login</title><style>
body{font-family:system-ui,sans-serif;background:#0f172a;color:#e2e8f0;display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0}
.card{background:#1e293b;padding:2rem;border-radius:12px;width:320px;box-shadow:0 10px 30px rgba(0,0,0,.4)}
h1{font-size:1.1rem;margin:0 0 1.25rem}input{width:100%;padding:.7rem;border-radius:8px;border:1px solid #334155;background:#0f172a;color:#e2e8f0;box-sizing:border-box;font-size:1rem}
button{width:100%;padding:.7rem;margin-top:1rem;border:0;border-radius:8px;background:#3b82f6;color:#fff;font-size:1rem;cursor:pointer}
.err{color:#f87171;font-size:.85rem;margin-top:.75rem}
</style></head><body><div class="card"><h1>all-inkl</h1>
<form method="POST" action="/authorize?${params}">
<input type="password" name="password" placeholder="Passwort" autofocus autocomplete="current-password">
<button type="submit">Anmelden</button>
${error ? `<div class="err">${error}</div>` : ''}
</form></div></body></html>`;
}

export async function handleOAuth(
  req: IncomingMessage, res: ServerResponse, url: URL, baseUrl: string, password: string
): Promise<boolean> {
  const p = url.pathname;

  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type,Authorization,mcp-protocol-version',
    });
    res.end();
    return true;
  }

  if (p === '/.well-known/oauth-protected-resource' || p.startsWith('/.well-known/oauth-protected-resource/')) {
    json(res, 200, { resource: baseUrl, authorization_servers: [baseUrl] });
    return true;
  }

  if (p === '/.well-known/oauth-authorization-server' || p.startsWith('/.well-known/oauth-authorization-server/')) {
    json(res, 200, {
      issuer: baseUrl,
      authorization_endpoint: `${baseUrl}/authorize`,
      token_endpoint: `${baseUrl}/token`,
      registration_endpoint: `${baseUrl}/register`,
      response_types_supported: ['code'],
      grant_types_supported: ['authorization_code'],
      code_challenge_methods_supported: ['S256'],
      token_endpoint_auth_methods_supported: ['none'],
    });
    return true;
  }

  if (p === '/register' && req.method === 'POST') {
    const body = await readJson(req);
    const client_id = rand();
    const redirect_uris: string[] = Array.isArray(body.redirect_uris) ? body.redirect_uris : [];
    clients.set(client_id, { client_id, redirect_uris });
    json(res, 201, {
      client_id,
      redirect_uris,
      token_endpoint_auth_method: 'none',
      grant_types: ['authorization_code'],
      response_types: ['code'],
    });
    return true;
  }

  if (p === '/authorize') {
    const q = url.searchParams;
    const client_id = q.get('client_id') || '';
    const redirect_uri = q.get('redirect_uri') || '';
    const state = q.get('state') || '';
    const challenge = q.get('code_challenge') || '';
    const method = q.get('code_challenge_method') || '';

    const client = clients.get(client_id);
    if (!client || method !== 'S256' || !challenge) {
      json(res, 400, { error: 'invalid_request' });
      return true;
    }
    if (client.redirect_uris.length && !client.redirect_uris.includes(redirect_uri)) {
      json(res, 400, { error: 'invalid_request', error_description: 'redirect_uri mismatch' });
      return true;
    }

    const fwd = url.searchParams.toString();

    if (req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(loginPage(fwd));
      return true;
    }

    if (req.method === 'POST') {
      const body = await readJson(req);
      if (!body.password || !safeEq(String(body.password), password)) {
        res.writeHead(401, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(loginPage(fwd, 'Falsches Passwort'));
        return true;
      }
      const code = rand();
      codes.set(code, { client_id, redirect_uri, challenge });
      const sep = redirect_uri.includes('?') ? '&' : '?';
      const loc = `${redirect_uri}${sep}code=${encodeURIComponent(code)}${state ? `&state=${encodeURIComponent(state)}` : ''}`;
      res.writeHead(302, { Location: loc });
      res.end();
      return true;
    }
  }

  if (p === '/token' && req.method === 'POST') {
    const body = await readJson(req);
    const code = String(body.code || '');
    const verifier = String(body.code_verifier || '');
    const entry = codes.get(code);
    if (!entry || body.grant_type !== 'authorization_code') {
      json(res, 400, { error: 'invalid_grant' });
      return true;
    }
    codes.delete(code);
    const computed = b64url(createHash('sha256').update(verifier).digest());
    if (!safeEq(computed, entry.challenge)) {
      json(res, 400, { error: 'invalid_grant', error_description: 'PKCE failed' });
      return true;
    }
    const access_token = signToken();
    json(res, 200, { access_token, token_type: 'Bearer' });
    return true;
  }

  return false;
}
