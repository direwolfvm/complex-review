// Deploy Review Works to cloud.gov without printing or uploading local credentials (ported from permitfast2).
// Usage: npm run deploy:cloud            (dry run)
//        npm run deploy:cloud -- --apply (build, push, configure, start)
// Reads the hosted environment from DEPLOY_ENV_FILE (default .env.cloudgov), which .gitignore and .cfignore exclude.
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";

const app = "reviewworks";
const envFile = process.env.DEPLOY_ENV_FILE ?? ".env.cloudgov";
if (existsSync(envFile)) process.loadEnvFile(envFile);

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!url || !anonKey)
  throw new Error(`Load the hosted Supabase environment first (NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in ${envFile})`);
if (!process.env.SUPABASE_SECRET_KEY)
  throw new Error("SUPABASE_SECRET_KEY is required: every write goes through the API routes using it");
if (!process.env.SUPABASE_SECRET_KEY.startsWith("sb_secret_"))
  throw new Error("SUPABASE_SECRET_KEY is not a Supabase secret key (sb_secret_...); check the environment file");
if (anonKey.startsWith("sb_secret_"))
  throw new Error("NEXT_PUBLIC_SUPABASE_ANON_KEY holds a secret key; it is sent to the browser and must be the publishable key");

const tenant = process.env.NEXT_PUBLIC_TENANT_SLUG ?? "reviewworks";
const variables = {
  NODE_ENV: "production",
  NPM_CONFIG_PRODUCTION: "true",
  NEXT_TELEMETRY_DISABLED: "1",
  NEXT_PUBLIC_SUPABASE_URL: url,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: anonKey,
  NEXT_PUBLIC_TENANT_SLUG: tenant,
  CANONICAL_TENANT_SLUG: process.env.CANONICAL_TENANT_SLUG ?? tenant,
  NEXT_PUBLIC_APP_BASE_URL: process.env.DEPLOY_APP_BASE_URL ?? `https://${app}.app.cloud.gov`,
  SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY,
};
// HedgeDoc is optional; without it the app uses the internal Markdown editor.
for (const name of ["HEDGEDOC_BASE_URL", "HEDGEDOC_API_TOKEN"])
  if (process.env[name]) variables[name] = process.env[name];

if (!process.argv.includes("--apply")) {
  console.log(`Dry run: build and deploy ${app}, configure ${Object.keys(variables).length} runtime variables (${Object.keys(variables).join(", ")}), then start. Add --apply to deploy.`);
  process.exit(0);
}
// Statically rendered pages embed the public Supabase settings at build time, so build with the hosted environment.
execFileSync("npm", ["run", "build"], { stdio: "inherit", env: { ...process.env, ...variables, NODE_ENV: "production" } });
execFileSync("cf", ["push", app, "-f", "manifest.yml", "--no-start"], { stdio: "inherit" });
const guid = execFileSync("cf", ["app", app, "--guid"], { encoding: "utf8" }).trim();
const result = JSON.parse(
  execFileSync(
    "cf",
    ["curl", `/v3/apps/${guid}/environment_variables`, "-X", "PATCH", "-d", JSON.stringify({ var: variables })],
    { encoding: "utf8" },
  ),
);
if (result.errors) throw new Error("Cloud.gov environment configuration failed");
console.log(`Configured ${app} runtime without logging credentials.`);
execFileSync("cf", ["start", app], { stdio: "inherit" });
