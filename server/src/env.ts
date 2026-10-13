export type R2Config = {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
};

export type Env = {
  adminUser: string;
  adminPasswordHash: string;
  sessionSecret: string;
  cookieSecure: boolean;
  trustProxy: boolean;
  dataDir: string;
  port: number;
  r2: R2Config | null;
};

const R2_KEYS = ["R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET"] as const;

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
  const present = R2_KEYS.filter((key) => (src[key] ?? "").trim() !== "");
  if (present.length > 0 && present.length < R2_KEYS.length) {
    throw new Error(`Set all of ${R2_KEYS.join(", ")} or none. Got ${present.join(", ")}.`);
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
    r2:
      present.length === 0
        ? null
        : {
            accountId: src.R2_ACCOUNT_ID!.trim(),
            accessKeyId: src.R2_ACCESS_KEY_ID!.trim(),
            secretAccessKey: src.R2_SECRET_ACCESS_KEY!.trim(),
            bucket: src.R2_BUCKET!.trim(),
          },
  };
}
