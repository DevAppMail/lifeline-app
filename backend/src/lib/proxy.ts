import { config } from "../config.js";
import type { FederatedIdentity } from "./jwt.js";

export interface ProxyOptions {
  identity: FederatedIdentity;
  method?: string;
  body?: string;
  contentType?: string;
}

export async function proxyToAdmin(
  path: string,
  queryString: string,
  options: ProxyOptions,
): Promise<Response> {
  const url = `${config.adminApiUrl}${path}${queryString ? `?${queryString}` : ""}`;

  const headers: Record<string, string> = {
    "X-BFF-Api-Key": config.adminBffApiKey,
    "X-Federated-Identity": JSON.stringify(options.identity),
  };

  if (options.contentType) {
    headers["Content-Type"] = options.contentType;
  }

  const fetchInit: RequestInit = {
    method: options.method || "GET",
    headers,
  };

  if (options.body && options.method !== "GET" && options.method !== "HEAD") {
    fetchInit.body = options.body;
  }

  const response = await fetch(url, fetchInit);

  return response;
}

export function extractQueryString(url: URL): string {
  return url.searchParams.toString();
}
