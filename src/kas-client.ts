import type { KasSession, McpResult } from "./types.js";

const AUTH_URL = "https://kasapi.kasserver.com/soap/KasAuth.php";
const API_URL = "https://kasapi.kasserver.com/soap/KasApi.php";

let session: KasSession | null = null;
const lastFloodDelay: Record<string, number> = {};

function buildSoap(ns: string, method: string, params: Record<string, unknown>): string {
  const p = JSON.stringify(params);
  return `<?xml version="1.0" encoding="UTF-8"?><SOAP-ENV:Envelope xmlns:SOAP-ENV="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ns1="${ns}"><SOAP-ENV:Body><ns1:${method}><Params>${p.replace(/&/g, "&amp;")}</Params></ns1:${method}></SOAP-ENV:Body></SOAP-ENV:Envelope>`;
}

async function soapPost(url: string, ns: string, method: string, params: Record<string, unknown>): Promise<string> {
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "text/xml; charset=utf-8" },
    body: buildSoap(ns, method, params),
  });
  return r.text();
}

function parseReturn(xml: string): string {
  const m = xml.match(/<return[^>]*>([^<]+)<\/return>/);
  if (m) return m[1];
  const f = xml.match(/<faultstring>([^<]+)<\/faultstring>/);
  throw new Error(f ? f[1] : `SOAP Fehler: ${xml.slice(0, 300)}`);
}
// --- Stack-basierter XML Parser ---

function extractTopLevelItems(xml: string): string[] {
  const items: string[] = [];
  let depth = 0;
  let start = -1;
  let i = 0;
  while (i < xml.length) {
    if (xml[i] !== '<') { i++; continue; }
    const gt = xml.indexOf('>', i);
    if (gt === -1) break;
    const tag = xml.slice(i, gt + 1);
    if (tag.startsWith('<item') && !tag.endsWith('/>')) {
      if (depth === 0) start = i;
      depth++;
    } else if (tag === '</item>') {
      depth--;
      if (depth === 0 && start >= 0) {
        items.push(xml.slice(start, gt + 1));
        start = -1;
      }
    }
    i = gt + 1;
  }
  return items;
}

function getInner(itemXml: string): string {
  const gt = itemXml.indexOf('>');
  const last = itemXml.lastIndexOf('</item>');
  return itemXml.slice(gt + 1, last);
}

function findValueTag(xml: string): { attrs: string; content: string } | null {
  const vs = xml.indexOf('<value');
  if (vs === -1) return null;
  const gt = xml.indexOf('>', vs);
  const tag = xml.slice(vs, gt + 1);
  if (tag.endsWith('/>')) return { attrs: tag, content: '' };
  let depth = 1;
  let i = gt + 1;
  while (i < xml.length && depth > 0) {
    if (xml[i] === '<') {
      const e = xml.indexOf('>', i);
      const t = xml.slice(i, e + 1);
      if (t.startsWith('<value') && !t.endsWith('/>')) depth++;
      else if (t === '</value>') depth--;
      i = e + 1;
    } else i++;
  }
  return { attrs: tag, content: xml.slice(gt + 1, i - 8) };
}

function parseVal(attrs: string, content: string): unknown {
  if (attrs.includes('xsi:nil')) return null;
  if (attrs.includes('SOAP-ENC:Array') || attrs.includes('arrayType')) return parseArray(content);
  if (attrs.includes('ns2:Map')) return parseMap(content);
  const s = content.trim();
  if (s === '') return null;
  if (/^-?\d+$/.test(s)) return parseInt(s);
  if (/^-?\d+\.\d+$/.test(s)) return parseFloat(s);
  return s;
}

function parseMap(xml: string): Record<string, unknown> {
  const obj: Record<string, unknown> = {};
  for (const item of extractTopLevelItems(xml)) {
    const inner = getInner(item);
    const km = inner.match(/<key[^>]*>([^<]*)<\/key>/);
    if (!km) continue;
    const vt = findValueTag(inner);
    obj[km[1]] = vt ? parseVal(vt.attrs, vt.content) : null;
  }
  return obj;
}

function parseArray(xml: string): unknown[] {
  return extractTopLevelItems(xml).map(item => parseMap(getInner(item)));
}

function parseKasResponse(xml: string): unknown {
  const fault = xml.match(/<faultstring>([^<]+)<\/faultstring>/);
  if (fault) throw new Error(fault[1]);
  const riIdx = xml.indexOf('<key');
  if (riIdx === -1) throw new Error('Keine Response-Daten');
  const returnStart = xml.indexOf('<return');
  const returnEnd = xml.lastIndexOf('</return>');
  if (returnStart === -1 || returnEnd === -1) throw new Error('Return-Block nicht gefunden');
  const returnTag = xml.indexOf('>', returnStart);
  const returnContent = xml.slice(returnTag + 1, returnEnd);
  const topMap = parseMap(returnContent);
  const resp = topMap['Response'] as Record<string, unknown> | undefined;
  if (!resp) throw new Error('Response-Block nicht gefunden');
  return resp['ReturnInfo'] ?? resp['ReturnString'] ?? resp;
}
// --- Session & API ---

async function getSession(): Promise<string> {
  const now = Date.now();
  if (session && session.expiresAt > now + 30_000) return session.token;
  const user = process.env.KAS_LOGIN;
  const pwd = process.env.KAS_PASSWORD;
  if (!user || !pwd) throw new Error("KAS_LOGIN und KAS_PASSWORD nicht gesetzt");
  const xml = await soapPost(AUTH_URL, "urn:KasAuth", "KasAuth", {
    kas_login: user, kas_auth_type: "plain", kas_auth_data: pwd,
    session_lifetime: 3600, session_update_lifetime: "Y",
  });
  const token = parseReturn(xml);
  session = { token, expiresAt: now + 3_600_000 };
  return token;
}

export async function kasCall(action: string, params: Record<string, unknown> = {}): Promise<McpResult> {
  const user = process.env.KAS_LOGIN!;
  const floodUntil = lastFloodDelay[action];
  if (floodUntil && Date.now() < floodUntil) {
    await new Promise((r) => setTimeout(r, floodUntil - Date.now()));
  }
  let token: string;
  try { token = await getSession(); }
  catch (e) { return err(`Auth-Fehler: ${String(e)}`); }

  const doCall = async (tok: string) =>
    soapPost(API_URL, "urn:KasApi", "KasApi", {
      kas_login: user, kas_auth_type: "session", kas_auth_data: tok,
      kas_action: action, KasRequestParams: params,
    });

  try {
    let xml = await doCall(token);
    const topMap = parseReturnMap(xml);
    const req = topMap['Request'] as Record<string, unknown> | undefined;
    const flood = req?.['KasFloodDelay'];
    if (typeof flood === 'number' && flood > 0) lastFloodDelay[action] = Date.now() + flood * 1000;

    if (xml.includes("session_invalid") || xml.includes("session_not_exist")) {
      session = null;
      token = await getSession();
      xml = await doCall(token);
    }

    const result = parseKasResponse(xml);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  } catch (e) {
    return err(`KAS Fehler bei ${action}: ${String(e)}`);
  }
}

export function applyPickAndFilter(data: unknown, pick?: string[], filter?: Record<string, unknown>): unknown {
  if (!Array.isArray(data)) return pick ? pickFields(data, pick) : data;
  let arr = data as Record<string, unknown>[];
  if (filter) {
    arr = arr.filter(item => {
      for (const [k, v] of Object.entries(filter)) {
        if (String(item[k]) !== String(v)) return false;
      }
      return true;
    });
  }
  if (pick) arr = arr.map(item => pickFields(item, pick) as Record<string, unknown>);
  return arr;
}

function pickFields(obj: unknown, fields: string[]): unknown {
  if (!obj || typeof obj !== 'object') return obj;
  const src = obj as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const f of fields) {
    if (f in src) out[f] = src[f];
  }
  return out;
}

function parseReturnMap(xml: string): Record<string, unknown> {
  const returnStart = xml.indexOf('<return');
  const returnEnd = xml.lastIndexOf('</return>');
  if (returnStart === -1 || returnEnd === -1) return {};
  const returnTag = xml.indexOf('>', returnStart);
  return parseMap(xml.slice(returnTag + 1, returnEnd));
}

function err(text: string): McpResult {
  return { isError: true, content: [{ type: "text", text: `Fehler: ${text}` }] };
}

export function requireParams(params: Record<string, unknown> | undefined, required: string[]): string | null {
  for (const k of required) {
    if (!params?.[k]) return `Pflichtfeld fehlt: ${k}`;
  }
  return null;
}