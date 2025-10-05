// frontend/scripts/check-imports.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const exts = [".ts", ".tsx", ".js", ".jsx"];
const srcDirs = ["app", "components", "lib"];

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(p));
    else if (exts.includes(path.extname(entry.name))) out.push(p);
  }
  return out;
}

function existsCaseSensitive(absPath) {
  // Ensure each path segment matches exact case on disk
  const parts = absPath.split(path.sep);
  let cur = parts[0] === "" ? path.sep : parts[0];
  for (let i = 1; i < parts.length; i++) {
    const seg = parts[i];
    if (!fs.existsSync(cur)) return false;
    const names = new Set(fs.readdirSync(cur));
    if (!names.has(seg)) return false;
    cur = path.join(cur, seg);
  }
  return fs.existsSync(absPath);
}

const files = srcDirs
  .map((d) => path.join(ROOT, d))
  .filter((p) => fs.existsSync(p))
  .flatMap(walk);

const importRe = /from\s+["'](@\/[^"']+)["']/g;

let failures = [];
for (const file of files) {
  const text = fs.readFileSync(file, "utf8");
  let m;
  while ((m = importRe.exec(text))) {
    const spec = m[1]; // e.g. "@/lib/utils"
    const rel = spec.replace(/^@\//, "");
    // try with extension resolution
    const candidates = exts.map((e) => path.join(ROOT, rel + e));
    const indexCandidates = exts.map((e) => path.join(ROOT, rel, "index" + e));
    const all = [...candidates, ...indexCandidates];

    const found = all.find((p) => fs.existsSync(p));
    if (!found) {
      failures.push({
        file,
        import: spec,
        reason: "Target file not found with any known extension",
        tried: all.map((p) => path.relative(ROOT, p)),
      });
      continue;
    }
    if (!existsCaseSensitive(found)) {
      failures.push({
        file,
        import: spec,
        reason: "Case mismatch (exists with different casing on disk)",
        resolved: path.relative(ROOT, found),
      });
    }
  }
}

if (failures.length) {
  console.error("❌ Alias import check failed:");
  for (const f of failures) {
    console.error(
      `- In ${path.relative(ROOT, f.file)}: import ${f.import}\n  Reason: ${f.reason}\n  ${
        f.resolved ? `Resolved as: ${f.resolved}` : `Tried: ${f.tried.join(", ")}`
      }\n`
    );
  }
  process.exit(1);
} else {
  console.log("✅ All @/ imports resolve with correct casing.");
}
