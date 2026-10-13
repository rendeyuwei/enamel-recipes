export class ApiError extends Error {
  status: number;
  fields?: { field: string; message: string }[];

  constructor(status: number, message: string, fields?: { field: string; message: string }[]) {
    super(message);
    this.name = "ApiError";
    this.status = status;
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
  const body = (text ? JSON.parse(text) : {}) as { error?: string; fields?: { field: string; message: string }[] };
  if (!res.ok) throw new ApiError(res.status, body.error ?? "请求失败", body.fields);
  return body as T;
}
