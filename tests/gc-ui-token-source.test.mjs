import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
const load = path => readFileSync(new URL("../"+path,import.meta.url));
const upstreamBlob="dd9a918eb4239cdd47fb13f383ee3496de459489";
test("bundled GC UI alpha tokens exactly match the reviewed source blob",()=>{
  const bytes=load("src/gc-ui-tokens.css");
  const actual=createHash("sha1").update("blob "+bytes.length+"\\0").update(bytes).digest("hex");
  assert.equal(actual,upstreamBlob);
  const text=bytes.toString("utf8");
  for (const name of ["--gc-canvas:","--gc-brand:","--gc-on-brand:","--gc-font-ui:","--gc-focus-ring:"]) {
    assert.ok(text.includes(name),name);
  }
  assert.doesNotMatch(text,/@import\\b|@font-face\\b|url\\(\\s*https?:/i);
});
test("Maps builds entirely from current local semantic roles",()=>{
  const pkg=JSON.parse(load("package.json").toString());
  const lock=JSON.parse(load("package-lock.json").toString());
  assert.equal(pkg.dependencies["@goreecloud/gc-ui"],undefined);
  assert.equal(lock.packages["node_modules/@goreecloud/gc-ui"],undefined);
  assert.deepEqual(lock.packages[""].dependencies,pkg.dependencies);
  const css=load("src/style.css").toString();
  assert.match(css,/@import "\\.\\/gc-ui-tokens\\.css"/);
  assert.doesNotMatch(css,/--gc-v1-/);
  assert.match(css,/--canvas:var\\(--gc-canvas\\)/);
});
