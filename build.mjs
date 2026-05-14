import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import { rm } from "node:fs/promises";

const dir = path.dirname(fileURLToPath(import.meta.url));

await rm(path.join(dir, "dist"), { recursive: true, force: true });

await build({
  entryPoints: [path.join(dir, "src/index.ts")],
  platform: "node",
  bundle: true,
  format: "esm",
  outdir: path.join(dir, "dist"),
  outExtension: { ".js": ".mjs" },
  logLevel: "info",
  external: ["*.node"],
  sourcemap: "linked",
  banner: {
    js: [
      "import { createRequire as __crReq } from \"node:module\";",
      "import __nodePath from \"node:path\";",
      "import __nodeUrl from \"node:url\";",
      "globalThis.require = __crReq(import.meta.url);",
      "globalThis.__filename = __nodeUrl.fileURLToPath(import.meta.url);",
      "globalThis.__dirname = __nodePath.dirname(globalThis.__filename);"
    ].join("\n")
  }
});

