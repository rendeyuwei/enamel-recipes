import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import fs from "node:fs/promises";
import path from "node:path";
import type { Env, R2Config } from "./env.ts";

export type StoredObject = { body: Buffer; contentType: string };

export interface ObjectStore {
  put(key: string, body: Buffer, contentType: string): Promise<void>;
  get(key: string): Promise<StoredObject | null>;
  delete(key: string): Promise<void>;
}

export function assertObjectKey(key: string) {
  if (key !== path.basename(key) || key.includes("..")) throw new Error("bad object key");
}

export class LocalStore implements ObjectStore {
  constructor(private dir: string) {}

  private file(key: string) {
    assertObjectKey(key);
    return path.join(this.dir, key);
  }

  async put(key: string, body: Buffer, _contentType: string) {
    await fs.mkdir(this.dir, { recursive: true });
    await fs.writeFile(this.file(key), body);
  }

  async get(key: string): Promise<StoredObject | null> {
    try {
      const body = await fs.readFile(this.file(key));
      return { body, contentType: "application/octet-stream" };
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw err;
    }
  }

  async delete(key: string) {
    await fs.rm(this.file(key), { force: true });
  }
}

type ObjectBody = { transformToByteArray: () => Promise<Uint8Array> };
type Sent = {
  Body?: ObjectBody;
  ContentType?: string;
};

export class R2Store implements ObjectStore {
  constructor(
    private cfg: R2Config,
    private send: (command: PutObjectCommand | GetObjectCommand | DeleteObjectCommand) => Promise<Sent>,
  ) {}

  async put(key: string, body: Buffer, contentType: string) {
    assertObjectKey(key);
    await this.send(new PutObjectCommand({ Bucket: this.cfg.bucket, Key: key, Body: body, ContentType: contentType }));
  }

  async get(key: string): Promise<StoredObject | null> {
    assertObjectKey(key);
    try {
      const out = await this.send(new GetObjectCommand({ Bucket: this.cfg.bucket, Key: key }));
      if (!out.Body) return null;
      const bytes = await out.Body.transformToByteArray();
      return { body: Buffer.from(bytes), contentType: out.ContentType ?? "application/octet-stream" };
    } catch (err) {
      if (isMissing(err)) return null;
      throw err;
    }
  }

  async delete(key: string) {
    assertObjectKey(key);
    try {
      await this.send(new DeleteObjectCommand({ Bucket: this.cfg.bucket, Key: key }));
    } catch (err) {
      if (isMissing(err)) return;
      throw err;
    }
  }
}

function isMissing(err: unknown): boolean {
  return typeof err === "object" && err !== null && "name" in err && (err.name === "NoSuchKey" || err.name === "NotFound");
}

export function createR2Store(cfg: R2Config): R2Store {
  const client = new S3Client({
    region: "auto",
    endpoint: `https://${cfg.accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: cfg.accessKeyId, secretAccessKey: cfg.secretAccessKey },
  });
  return new R2Store(cfg, (command) => client.send(command) as Promise<Sent>);
}

export function createObjectStore(env: Env): ObjectStore {
  if (env.r2) return createR2Store(env.r2);
  return new LocalStore(path.join(env.dataDir, "objects"));
}
