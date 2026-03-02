
export interface KasSession {
  token: string;
  expiresAt: number;
}

export interface McpResult {
  isError?: boolean;
  content: Array<{ type: "text"; text: string }>;
  [key: string]: unknown;
}

export interface ToolInput {
  action: string;
  params?: Record<string, unknown>;
  pick?: string[];
  filter?: Record<string, unknown>;
}
