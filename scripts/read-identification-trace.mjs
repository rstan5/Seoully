import fs from "node:fs/promises";

const file = ".tmp/identification-trace.jsonl";
const lines = (await fs.readFile(file, "utf8")).trim().split("\n").filter(Boolean);
if (!lines.length) {
  console.log("No identification traces recorded.");
  process.exit(0);
}
console.log(JSON.stringify(JSON.parse(lines.at(-1)), null, 2));
