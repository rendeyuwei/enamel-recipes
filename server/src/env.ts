export type S3Config = {
  endpoint: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  prefix: string;
};

export type Env = {
  adminUser: string;
  adminPasswordHash: string;
  sessionSecret: string;
  cookieSecure: boolean;
  trustProxy: boolean;
  dataDir: string;
  port: number;
  s3: S3Config | null;
};

const S3_ENV = {
  endpoint: "S3_ENDPOINT",
  region: "S3_REGION",
  accessKeyId: "S3_ACCESS_KEY_ID",
  secretAccessKey: "S3_SECRET_ACCESS_KEY",
  bucket: "S3_BUCKET",
} as const satisfies Record<Exclude<keyof S3Config, "prefix">, string>;

const S3_FIELDS = Object.keys(S3_ENV) as (keyof typeof S3_ENV)[];

function parseS3(src: NodeJS.ProcessEnv): S3Config | null {
  const trimmed = (name: string) => (src[name] ?? "").trim();
  const present = S3_FIELDS.filter((field) => trimmed(S3_ENV[field]) !== "");
  if (present.length === 0) return null;
  if (present.length !== S3_FIELDS.length) {
    const names = S3_FIELDS.map((field) => S3_ENV[field]);
    const got = present.map((field) => S3_ENV[field]);
    throw new Error(`Set all of ${names.join(", ")} or none. Got ${got.join(", ")}.`);
  }
  const prefix = trimmed("S3_PREFIX");
  if (/^[/\\]/.test(prefix)) throw new Error("S3_PREFIX must not start with / or \\");
  return {
    endpoint: trimmed(S3_ENV.endpoint),
    region: trimmed(S3_ENV.region),
    accessKeyId: trimmed(S3_ENV.accessKeyId),
    secretAccessKey: trimmed(S3_ENV.secretAccessKey),
    bucket: trimmed(S3_ENV.bucket),
    prefix,
  };
}

export function parseEnv(src: NodeJS.ProcessEnv): Env {
  const adminUser = src.ADMIN_USER?.trim() ?? "";
  const adminPasswordHash = src.ADMIN_PASSWORD_HASH?.trim() ?? "";
  const sessionSecret = src.SESSION_SECRET?.trim() ?? "";
  const missing: string[] = [];
  if (!adminUser) missing.push("ADMIN_USER");
  if (!adminPasswordHash) missing.push("ADMIN_PASSWORD_HASH");
  if (sessionSecret.length < 16) missing.push("SESSION_SECRET");
  if (missing.length > 0) throw new Error(`Missing or short env: ${missing.join(", ")}`);
  if (!/^scrypt\$[a-f0-9]+\$[a-f0-9]+$/.test(adminPasswordHash)) {
    throw new Error("ADMIN_PASSWORD_HASH must be scrypt$<salt hex>$<hash hex>. Run npm run hash-password.");
  }
  const port = Number(src.PORT ?? "3030");
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("PORT must be an integer");
  return {
    adminUser,
    adminPasswordHash,
    sessionSecret,
    cookieSecure: src.COOKIE_SECURE !== "0",
    trustProxy: src.TRUST_PROXY === "1",
    dataDir: src.DATA_DIR?.trim() || "data",
    port,
    s3: parseS3(src),
  };
}
