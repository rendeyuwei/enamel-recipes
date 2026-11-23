export type FieldIssue = { field: string; code?: string; message: string };

export class ApiError extends Error {
  status: number;
  code?: string;
  fields?: FieldIssue[];

  constructor(status: number, message: string, code?: string, fields?: FieldIssue[]) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.fields = fields;
  }
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  if (init?.body && !(init.body instanceof FormData) && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }
  const res = await fetch(`/recipes/api${path}`, { ...init, headers, credentials: "same-origin" });
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  const body = (text ? JSON.parse(text) : {}) as { error?: string; code?: string; fields?: FieldIssue[] };
  if (!res.ok) throw new ApiError(res.status, body.error ?? "", body.code, body.fields);
  return body as T;
}
