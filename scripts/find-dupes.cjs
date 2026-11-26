const fs = require("fs");
const path = require("path");

const DIR = "C:/Users/godav/Downloads/E-blood_backend/src";
function walk(d) {
  const out = [];
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory() && e.name !== "node_modules") out.push(...walk(p));
    else if (e.name.endsWith(".ts")) out.push(p);
  }
  return out;
}
const files = walk(DIR);
for (const f of files) {
  const content = fs.readFileSync(f, "utf8");
  const lines = content.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const nums = [...line.matchAll(/:(\d+)/g)].map((m) => m[1]);
    const seen = {};
    for (const n of nums) seen[n] = (seen[n] || 0) + 1;
    const dupes = Object.entries(seen)
      .filter(([, v]) => v > 1)
      .map(([k, v]) => `:${k}x${v}`);
    if (dupes.length) {
      console.log(path.relative(DIR, f) + ":" + (i + 1) + "  " + dupes.join(" "));
    }
  }
}
