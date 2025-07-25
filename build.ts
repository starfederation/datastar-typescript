// ex. scripts/build_npm.ts
import { build, emptyDir } from "@deno/dnt";
import { VERSION } from "./src/consts.ts";

await emptyDir("./npm");

await build({
  entryPoints: [
    "./src/node/serverSentEventGenerator.ts",
    "./src/web/serverSentEventGenerator.ts"
  ],
  outDir: "./npm",
  shims: {
    // see JS docs for overview and more options
    deno: true,
  },
  package: {
    // package.json properties
    name: "@starfederation/datastar-sdk",
    version: Deno.args[0] || VERSION,
    description: "Cross-runtime Javascript SDK for Datastar",
    license: "MIT",
    repository: {
      type: "git",
      url: "git+https://github.com/starfederation/datastar-typescript.git",
    },
    bugs: {
      url: "https://github.com/starfederation/datastar-typescript/issues",
    },
    exports: {
      "./abstractServerSentEventGenerator": {
        "types": "./esm/abstractServerSentEventGenerator.d.ts",
        "import": "./esm/abstractServerSentEventGenerator.js",
        "require": "./script/abstractServerSentEventGenerator.js",
      },
      "./consts": {
        "types": "./esm/consts.d.ts",
        "import": "./esm/consts.js",
        "require": "./script/consts.js",
      },
      "./types": {
        "types": "./esm/types.d.ts",
      },
      "./node": {
        "types": "./esm/node/serverSentEventGenerator.d.ts",
        "import": "./esm/node/serverSentEventGenerator.js",
        "require": "./script/node/serverSentEventGenerator.js",
      },
      "./web": {
        "types": "./esm/web/serverSentEventGenerator.d.ts",
        "import": "./esm/web/serverSentEventGenerator.js",
        "require": "./script/web/serverSentEventGenerator.js",
      },
      ".": {
        "types": "./esm/node/serverSentEventGenerator.d.ts",
        "import": "./esm/node/serverSentEventGenerator.js",
        "require": "./script/node/serverSentEventGenerator.js",
      },
    },
  },
  postBuild() {
    // steps to run after building and before running the tests
    Deno.copyFileSync("LICENSE.md", "npm/LICENSE.md");
    Deno.copyFileSync("README.md", "npm/README.md");
  },
  rootTestDir: "./src",
});