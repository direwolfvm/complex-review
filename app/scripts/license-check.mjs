// License policy check over production dependencies (ported from permitfast2). Reads the installed lockfile, evaluates
// every non-development package against license-policy.json, and exits non-zero on anything not
// allowed, chosen or excepted. Usage: node scripts/license-check.mjs [--json]
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

export function evaluateLicenses(lock, policy) {
  const findings = [];
  const seen = new Map();
  for (const [path, meta] of Object.entries(lock.packages ?? {})) {
    if (!path || meta.dev) continue;
    const name = path.replace(/^.*node_modules\//, "");
    if (seen.has(name)) continue;
    const declared = meta.license ?? null;
    seen.set(name, declared);
    if (policy.exceptions[name]) continue;
    const choice = policy.choices[name];
    if (choice) {
      if (choice.expression !== declared) findings.push({ name, declared, problem: `dual-license expression changed from ${choice.expression}` });
      else if (!policy.allowed.includes(choice.chosen)) findings.push({ name, declared, problem: `chosen license ${choice.chosen} is not allowed` });
      continue;
    }
    if (!declared) {
      findings.push({ name, declared, problem: "no license declared; verify and record an exception" });
      continue;
    }
    const parts = declared.replace(/^\(|\)$/g, "").split(/\s+(?:AND|OR)\s+/);
    const conjunctive = /\bAND\b/.test(declared), disjunctive = /\bOR\b/.test(declared);
    const denied = parts.filter((p) => policy.denied.includes(p)), allowed = parts.filter((p) => policy.allowed.includes(p));
    if (disjunctive && !conjunctive) findings.push({ name, declared, problem: allowed.length ? "dual license: record the chosen license in policy.choices" : "no allowed choice in the expression" });
    else if (denied.length) findings.push({ name, declared, problem: `denied license ${denied.join(", ")}` });
    else if (allowed.length !== parts.length) findings.push({ name, declared, problem: `unrecognized license ${parts.filter((p) => !policy.allowed.includes(p)).join(", ")}` });
  }
  // An exception marked optional is platform-specific (npm installs only the host's variant), so its absence is not staleness.
  for (const name of [...Object.keys(policy.choices), ...Object.keys(policy.exceptions).filter((n) => !policy.exceptions[n].optional)])
    if (!seen.has(name)) findings.push({ name, declared: null, problem: "recorded in the policy but no longer a production dependency; remove the entry" });
  return { checked: seen.size, findings };
}

export function evaluateInstallScripts(lock, policy) {
  const findings = [];
  const seen = new Set();
  for (const [path, meta] of Object.entries(lock.packages ?? {})) {
    if (!path) continue;
    const name = path.replace(/^.*node_modules\//, "");
    if (seen.has(name)) continue;
    if (!meta.hasInstallScript) continue;
    seen.add(name);
    if (!policy.installScripts[name]) findings.push({ name, problem: "runs an install script that has not been reviewed; record it in policy.installScripts or remove the dependency" });
  }
  // An entry marked optional is platform- or architecture-specific (npm omits it elsewhere), so its
  // absence is not staleness. Every other reviewed entry must still be installed here.
  for (const [name, entry] of Object.entries(policy.installScripts))
    if (!seen.has(name) && !entry.optional)
      findings.push({ name, problem: "reviewed install script no longer present; remove the entry" });
  return { checked: seen.size, findings };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const root = process.cwd();
  const policy = JSON.parse(readFileSync(resolve(root, "license-policy.json"), "utf8"));
  const lock = JSON.parse(readFileSync(resolve(root, "node_modules/.package-lock.json"), "utf8"));
  const licenses = evaluateLicenses(lock, policy), scripts = evaluateInstallScripts(lock, policy);
  const findings = [...licenses.findings, ...scripts.findings];
  if (process.argv.includes("--json")) console.log(JSON.stringify({ licenses, scripts }, null, 2));
  else {
    console.log(`Checked ${licenses.checked} production packages and ${scripts.checked} install scripts.`);
    for (const f of findings) console.log(`  ${f.name}${f.declared !== undefined && f.declared !== null ? ` (${f.declared})` : ""}: ${f.problem}`);
  }
  process.exit(findings.length ? 1 : 0);
}
