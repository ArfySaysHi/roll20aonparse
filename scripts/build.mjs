// Usage: node scripts/build.mjs [chrome|firefox|all]   (default: all)
import { build } from "esbuild";
import { copyFile, mkdir, rm } from "node:fs/promises";

const TARGETS = ["chrome", "firefox"];
const requested = process.argv[2] ?? "all";
const targets = requested === "all" ? TARGETS : [requested];

if (!targets.every((t) => TARGETS.includes(t))) {
  console.error(`Unknown target "${requested}". Use chrome, firefox or all.`);
  process.exit(1);
}

for (const target of targets) {
  const outdir = `dist/${target}`;
  await rm(outdir, { recursive: true, force: true });
  await mkdir(outdir, { recursive: true });

  await build({
    entryPoints: {
      background: "src/background/index.ts",
      content: "src/content/index.ts",
      injected: "src/injected/index.ts",
    },
    outdir,
    bundle: true,
    format: "iife", // content scripts can't be ES modules
    target: "es2022",
    sourcemap: true,
    loader: {
      ".css": "text",
    },
    logLevel: "info",
  });

  await copyFile(`manifest/${target}.json`, `${outdir}/manifest.json`);
  console.log(`built ${outdir}`);
}
