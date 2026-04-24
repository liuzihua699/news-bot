import fs from "fs";
import path from "path";
import test from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const serverSource = fs.readFileSync(path.join(__dirname, "..", "server.js"), "utf-8");

test("preview desktop layout keeps sidebar in flow to avoid horizontal overflow", () => {
  assert.doesNotMatch(serverSource, /\.main\s*\{[^}]*margin-left:\s*260px;/s);
  assert.match(serverSource, /\.layout\s*\{[^}]*grid-template-columns:\s*260px minmax\(0,\s*1fr\);/s);
  assert.match(serverSource, /\.sidebar\s*\{[^}]*position:\s*sticky;[^}]*top:\s*52px;/s);
  assert.match(serverSource, /\.main\s*\{[^}]*min-width:\s*0;/s);
});
