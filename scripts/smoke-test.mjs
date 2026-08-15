#!/usr/bin/env node
/**
 * Smoke test for expo-watermelondb-plugin.
 *
 * Usage: node scripts/smoke-test.mjs <expo-sdk>
 *
 * Creates a minimal Expo project pinned to the given SDK, installs this plugin
 * from the local checkout, runs `expo prebuild`, and verifies that all four
 * Android files are patched correctly. Exits non-zero on any failure.
 */
import { execSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const sdk = process.argv[2];
if (!sdk) {
  console.error("usage: node scripts/smoke-test.mjs <expo-sdk>");
  process.exit(1);
}

const repoRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

// --- Resolve react / react-native versions from the SDK's bare template ------
let templateDeps;
try {
  templateDeps = JSON.parse(
    execSync(`npm view expo-template-bare-minimum@~${sdk}.0.0 dependencies --json`, {
      encoding: "utf8",
    })
  );
} catch (e) {
  console.error(`[smoke] could not resolve template for SDK ${sdk}: ${e.message}`);
  process.exit(1);
}
const react = templateDeps.react;
const reactNative = templateDeps["react-native"];

const dir = fs.mkdtempSync(path.join(os.tmpdir(), `wdb-smoke-${sdk}-`));
console.log(`[smoke] SDK ${sdk}: react=${react} react-native=${reactNative} in ${dir}`);

// --- Write minimal project files ---------------------------------------------
fs.writeFileSync(
  path.join(dir, "package.json"),
  JSON.stringify(
    {
      name: "smoke-test",
      version: "1.0.0",
      main: "index.js",
      private: true,
      dependencies: {
        expo: `~${sdk}.0.0`,
        react,
        "react-native": reactNative,
        "expo-watermelondb-plugin": `file:${repoRoot}`,
      },
    },
    null,
    2
  )
);

fs.writeFileSync(
  path.join(dir, "app.json"),
  JSON.stringify(
    {
      expo: {
        name: "smoke-test",
        slug: "smoke-test",
        version: "1.0.0",
        android: { package: "com.example.smoketest" },
        plugins: ["expo-watermelondb-plugin"],
      },
    },
    null,
    2
  )
);

fs.writeFileSync(
  path.join(dir, "index.js"),
  "import { registerRootComponent } from 'expo';\nimport App from './App';\nregisterRootComponent(App);\n"
);
fs.writeFileSync(
  path.join(dir, "App.js"),
  "import React from 'react';\nimport { Text, View } from 'react-native';\nexport default function App(){ return <View><Text>test</Text></View>; }\n"
);
fs.writeFileSync(
  path.join(dir, "babel.config.js"),
  "module.exports = function(api){ api.cache(true); return { presets: ['babel-preset-expo'] }; };\n"
);

// --- Install + prebuild ------------------------------------------------------
console.log("[smoke] npm install...");
execSync("npm install --no-audit --no-fund", { cwd: dir, stdio: "inherit" });

console.log("[smoke] expo prebuild...");
execSync("npx expo prebuild --no-install", { cwd: dir, stdio: "inherit" });

// --- Verify the four patched files -------------------------------------------
function findMainApplication(root) {
  const walk = (p) => {
    for (const entry of fs.readdirSync(p, { withFileTypes: true })) {
      const full = path.join(p, entry.name);
      if (entry.isDirectory()) {
        const found = walk(full);
        if (found) return found;
      } else if (/^MainApplication\.(kt|java)$/.test(entry.name)) {
        return full;
      }
    }
    return null;
  };
  return walk(root);
}

const checks = [
  ["settings.gradle include+projectDir", "android/settings.gradle", [":watermelondb-jsi", "android-jsi"]],
  ["app/build.gradle dependency", "android/app/build.gradle", ["implementation project(':watermelondb-jsi')"]],
  ["app/build.gradle pickFirst", "android/app/build.gradle", ["pickFirst '**/libc++_shared.so'"]],
  ["MainApplication import+register", null, ["WatermelonDBJSIPackage"]],
  ["proguard keep rule", "android/app/proguard-rules.pro", ["com.nozbe.watermelondb.**"]],
];

let pass = true;
for (const [label, relPath, needles] of checks) {
  let content;
  if (relPath) {
    content = fs.readFileSync(path.join(dir, relPath), "utf8");
  } else {
    const mainApp = findMainApplication(path.join(dir, "android"));
    if (!mainApp) {
      console.log(`[smoke] ${label}: FAIL (MainApplication not found)`);
      pass = false;
      continue;
    }
    content = fs.readFileSync(mainApp, "utf8");
  }
  const ok = needles.every((n) => content.includes(n));
  console.log(`[smoke] ${label}: ${ok ? "PASS" : "FAIL"}`);
  if (!ok) pass = false;
}

// Best-effort cleanup (Windows can hold file locks on node_modules).
try {
  fs.rmSync(dir, { recursive: true, force: true });
} catch (e) {
  console.warn(`[smoke] warning: could not remove temp dir ${dir}: ${e.message}`);
}

if (!pass) {
  console.error(`[smoke] SDK ${sdk} FAILED`);
  process.exit(1);
}
console.log(`[smoke] SDK ${sdk} PASSED`);
