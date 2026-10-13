import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import fs from "node:fs/promises";
import path from "node:path";
import type { Env, S3Config } from "./env.ts";

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

function isMissing(err: unknown): boolean {
  return typeof err === "object" && err !== null && "name" in err && (err.name === "NoSuchKey" || err.name === "NotFound");
}

class S3Store implements ObjectStore {
  constructor(
    private client: S3Client,
    private cfg: Pick<S3Config, "bucket" | "prefix">,
  ) {}

  private objectKey(key: string) {
    assertObjectKey(key);
    return this.cfg.prefix + key;
  }

  async put(key: string, body: Buffer, contentType: string) {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.cfg.bucket,
        Key: this.objectKey(key),
        Body: body,
        ContentType: contentType,
      }),
    );
  }

  async get(key: string): Promise<StoredObject | null> {
    try {
      const out = await this.client.send(new GetObjectCommand({ Bucket: this.cfg.bucket, Key: this.objectKey(key) }));
      if (!out.Body) return null;
      const bytes = await out.Body.transformToByteArray();
      return { body: Buffer.from(bytes), contentType: out.ContentType ?? "application/octet-stream" };
    } catch (err) {
      if (isMissing(err)) return null;
      throw err;
    }
  }

  async delete(key: string) {
    try {
      await this.client.send(new DeleteObjectCommand({ Bucket: this.cfg.bucket, Key: this.objectKey(key) }));
    } catch (err) {
      if (isMissing(err)) return;
      throw err;
    }
  }
}

export function createObjectStore(env: Env): ObjectStore {
  if (!env.s3) return new LocalStore(path.join(env.dataDir, "objects"));
  const client = new S3Client({
    region: env.s3.region,
    endpoint: env.s3.endpoint,
    forcePathStyle: false,
    credentials: { accessKeyId: env.s3.accessKeyId, secretAccessKey: env.s3.secretAccessKey },
  });
  return new S3Store(client, { bucket: env.s3.bucket, prefix: env.s3.prefix });
}
