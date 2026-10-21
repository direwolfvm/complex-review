// Software bill of materials for the shipped artifact (ported from permitfast2): a CycloneDX inventory of
// production dependencies from the lockfile, plus its SHA-256 for the release record. CI keeps it as a build
// artifact; it is not served by the app.
// Usage: node scripts/sbom.mjs [--out <file>] [--print-hash]
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const args = process.argv.slice(2);
const arg = (name) => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined);
const out = resolve(arg("--out") ?? "sbom/sbom.cdx.json");
const pkg = JSON.parse(readFileSync("package.json", "utf8"));
const raw = execFileSync("npm", ["sbom", "--sbom-format", "cyclonedx", "--omit", "dev", "--package-lock-only"], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
const bom = JSON.parse(raw);
// npm names the root after the directory; the artifact is the package.
bom.metadata.component.name = pkg.name;
bom.metadata.component.version = pkg.version;
let revision;
try {
  revision = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
} catch {
  revision = undefined;
}
bom.metadata.properties = [...(bom.metadata.properties ?? []), ...(revision ? [{ name: "vcs:revision", value: revision }] : [])];
const text = JSON.stringify(bom, null, 2);
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, text);
const hash = createHash("sha256").update(text).digest("hex");
writeFileSync(`${out}.sha256`, `${hash}  ${out.split("/").pop()}\n`);
console.log(`SBOM: ${bom.components?.length ?? 0} components, ${pkg.name}@${pkg.version}${revision ? ` (${revision.slice(0, 12)})` : ""}, sha256 ${hash}`);
