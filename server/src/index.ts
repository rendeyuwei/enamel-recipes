import path from "node:path";
import { buildApp } from "./app.ts";
import { parseEnv } from "./env.ts";
import { loadEnvFile } from "./loadenv.ts";
import { seedIfEmpty } from "./seed.ts";

loadEnvFile();
const env = parseEnv(process.env);
const { app, repo } = await buildApp({
  env,
  dbPath: path.join(env.dataDir, "caiben.sqlite"),
  logger: true,
});

if (process.env.SEED_DEMO === "1") seedIfEmpty(repo);

const shutdown = () => {
  app.close().then(() => process.exit(0));
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

await app.listen({ host: "127.0.0.1", port: env.port });
app.log.info(`家常菜本 listening on http://127.0.0.1:${env.port}/recipes`);
