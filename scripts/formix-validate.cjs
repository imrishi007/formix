#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */
"use strict";

const fs = require("node:fs");
const path = require("node:path");

const inputs = process.argv.slice(2);
if (inputs.length === 0) {
  console.error("Usage: node scripts/formix-validate.cjs <file-or-directory> [...]");
  process.exit(2);
}

function collect(target) {
  const absolute = path.resolve(target);
  if (!fs.existsSync(absolute)) throw new Error(`Not found: ${target}`);
  const stat = fs.statSync(absolute);
  if (stat.isFile()) return absolute.endsWith(".forml") ? [absolute] : [];
  return fs.readdirSync(absolute, { withFileTypes: true }).flatMap((entry) => {
    if (entry.name === "node_modules" || entry.name === ".git") return [];
    return collect(path.join(absolute, entry.name));
  });
}

const files = [...new Set(inputs.flatMap(collect))];
if (files.length === 0) {
  console.error("No .forml files found in the supplied paths.");
  process.exit(2);
}

const compiler = require(path.resolve(__dirname, "../public/wasm/forml.js"));

async function main() {
  for (let attempt = 0; typeof compiler.compileForml !== "function" && attempt < 200; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  if (typeof compiler.compileForml !== "function") throw new Error("FormL WASM compiler did not initialize");

  let failed = 0;
  for (const file of files) {
    const result = JSON.parse(compiler.compileForml(fs.readFileSync(file, "utf8")));
    const errors = (result.diagnostics || []).filter((diagnostic) => diagnostic.severity === "error");
    if (!result.ast || errors.length > 0) {
      failed += 1;
      console.error(`\n${path.relative(process.cwd(), file)}`);
      for (const error of errors) console.error(`  ${error.line}:${error.col} ${error.message}`);
    } else {
      console.log(`PASS ${path.relative(process.cwd(), file)}`);
    }
  }
  if (failed > 0) {
    console.error(`\n${failed} FormL file(s) failed compiler verification.`);
    process.exit(1);
  }
  console.log(`\n${files.length} FormL file(s) compiler verified.`);
}

main().catch((error) => { console.error(error.message); process.exit(1); });
