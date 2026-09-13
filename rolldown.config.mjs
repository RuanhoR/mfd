// @ts-check
import { defineConfig } from "rolldown";
import { dts } from "rolldown-plugin-dts";
import { readFileSync, rmSync } from "node:fs";
import * as path from "node:path";

const pkg = JSON.parse(
  readFileSync(path.join(import.meta.dirname, "package.json"), "utf-8"),
);

const external = [/^node:/, ...Object.keys(pkg.dependencies || {})];

// rolldown does not clean the output dir; stale chunks from earlier
// builds (e.g. with different externals) would ship in the npm package
let distCleaned = false;
const cleanDist = {
  name: "clean-dist",
  buildStart() {
    if (distCleaned) return;
    distCleaned = true;
    rmSync(path.join(import.meta.dirname, "dist"), {
      recursive: true,
      force: true,
    });
  },
};

export default defineConfig([
  {
    input: {
      index: "src/index.ts",
      "style-types": "src/style-types.ts",
    },
    output: {
      dir: "dist",
      entryFileNames: "[name].mjs",
      format: "esm",
      sourcemap: false,
    },
    plugins: [cleanDist, dts()],
    external,
  },
]);
