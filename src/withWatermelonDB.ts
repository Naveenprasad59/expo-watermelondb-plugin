/**
 * Expo config plugin for @nozbe/watermelondb
 *
 * Auto-configures WatermelonDB's native JSI module for Android in Expo projects
 * using the Continuous Native Generation (CNG) workflow. Survives expo prebuild /
 * EAS Build regenerating the native folders from scratch.
 *
 * Adapted from @morrowdigital/watermelondb-expo-plugin (MIT, Copyright (c) Morrow Digital).
 *
 * What this plugin does:
 *  1. settings.gradle  - includes ':watermelondb-jsi' and points its projectDir at
 *                        node_modules/@nozbe/watermelondb/native/android-jsi
 *  2. app/build.gradle - adds implementation project(':watermelondb-jsi') and
 *                        pickFirst rule for libc++_shared.so to packagingOptions
 *  3. MainApplication  - imports and registers WatermelonDBJSIPackage
 *  4. proguard-rules   - adds -keep rule for com.nozbe.watermelondb.**
 *
 * iOS requires no config plugin changes - autolinking + WatermelonDB's podspec
 * handle it automatically.
 */

import {
  withSettingsGradle,
  withAppBuildGradle,
  withMainApplication,
  withDangerousMod,
  type ConfigPlugin,
} from "@expo/config-plugins";
import type { ExpoConfig } from "@expo/config-types";
import { promises as fs } from "fs";
import path from "path";

// --- Constants ---------------------------------------------------------------

const JSI_PROJECT = ":watermelondb-jsi";
const JSI_IMPORT_PATH = "com.nozbe.watermelondb.jsi.WatermelonDBJSIPackage";
const JSI_PACKAGE_CALL = "WatermelonDBJSIPackage()";
const PROGUARD_KEEP_RULE = "-keep class com.nozbe.watermelondb.** { *; }";
const PACKAGING_PICK_FIRST = "pickFirst '**/libc++_shared.so'";

// --- Types -------------------------------------------------------------------

export type WatermelonDBPluginOptions = {
  /**
   * Disable JSI support for Android builds.
   *
   * When true, only the standard autolinked WatermelonDB module is used
   * (no fast synchronous JSI). Useful for debugging JSI-related issues.
   *
   * @default false
   */
  disableJsi?: boolean;
};

// --- 1. settings.gradle ------------------------------------------------------
// Adds 'include :watermelondb-jsi' and resolves the projectDir dynamically
// using the same providers.exec pattern Expo's own template uses.
// This is more robust than the reference plugin's .execute() approach and
// works correctly in monorepo setups.

const withWatermelonDBSettingsGradle: ConfigPlugin<void> = (config) => {
  return withSettingsGradle(config, (mod) => {
    if (mod.modResults.contents.includes(JSI_PROJECT)) {
      return mod; // Idempotent: already configured
    }

    mod.modResults.contents += [
      "",
      "include '" + JSI_PROJECT + "'",
      "project('" + JSI_PROJECT + "').projectDir = new File(",
      "  providers.exec {",
      '    workingDir(rootDir)',
      '    commandLine("node", "--print", "require.resolve(\'@nozbe/watermelondb/package.json\')")',
      "  }.standardOutput.asText.get().trim(),",
      '  "../native/android-jsi"',
      ")",
      "",
    ].join("\n");

    return mod;
  });
};

// --- 2. app/build.gradle -----------------------------------------------------
// Adds the JSI project as a dependency and picks the first libc++_shared.so
// to avoid duplicate .so packaging errors (recommended by WatermelonDB docs).

const withWatermelonDBAppBuildGradle: ConfigPlugin<void> = (config) => {
  return withAppBuildGradle(config, (mod) => {
    let contents = mod.modResults.contents;

    // Add dependency on the JSI project
    const depLine = "implementation project('" + JSI_PROJECT + "')";
    if (!contents.includes(depLine)) {
      contents = contents.replace(
        "dependencies {",
        "dependencies {\n    " + depLine
      );
    }

    // Add pickFirst for libc++_shared.so to packagingOptions
    if (!contents.includes(PACKAGING_PICK_FIRST)) {
      if (contents.includes("packagingOptions {")) {
        contents = contents.replace(
          "packagingOptions {",
          "packagingOptions {\n        " + PACKAGING_PICK_FIRST
        );
      } else {
        // If no packagingOptions block exists, add one inside android {}
        contents = contents.replace(
          "android {",
          "android {\n    packagingOptions {\n        " + PACKAGING_PICK_FIRST + "\n    }"
        );
      }
    }

    mod.modResults.contents = contents;
    return mod;
  });
};

// --- 3. MainApplication.kt / .java -------------------------------------------
// Adds the WatermelonDB JSI package import and registers it in the packages list.
// Handles both Kotlin (SDK 53+ default) and Java (legacy) MainApplication files.

const withWatermelonDBMainApplication: ConfigPlugin<void> = (config) => {
  return withMainApplication(config, (mod) => {
    const contents = mod.modResults.contents;
    const language = mod.modResults.language;
    let updated = contents;

    // -- Add import --
    if (!updated.includes(JSI_IMPORT_PATH)) {
      if (language === "kt") {
        // Kotlin: add after the first import line
        updated = updated.replace(
          "import android.app.Application",
          "import android.app.Application\nimport " + JSI_IMPORT_PATH
        );
      } else {
        // Java: add import before the class declaration
        const importStatement = "import " + JSI_IMPORT_PATH + ";";
        if (updated.includes("public class MainApplication")) {
          updated = updated.replace(
            "public class MainApplication",
            importStatement + "\npublic class MainApplication"
          );
        } else if (updated.includes("class MainApplication")) {
          updated = updated.replace(
            "class MainApplication",
            importStatement + "\n\nclass MainApplication"
          );
        }
      }
    }

    // -- Register package --
    if (!updated.includes(JSI_PACKAGE_CALL)) {
      if (language === "kt") {
        // Kotlin: add after the example comment hook inside packages.apply {}
        // This comment is a stable Expo template hook present since SDK 53+
        updated = updated.replace(
          "// add(MyReactNativePackage())",
          "// add(MyReactNativePackage())\n        add(" + JSI_PACKAGE_CALL + ")"
        );
      } else {
        // Java: add inside the Arrays.asList() call
        if (updated.includes("// new MyReactNativePackage()")) {
          updated = updated.replace(
            "// new MyReactNativePackage()",
            "// new MyReactNativePackage()\n            new " + JSI_PACKAGE_CALL + ","
          );
        } else {
          // Fallback: add before the closing of getPackages()
          updated = updated.replace(
            "return Arrays.<ReactPackage>asList(",
            "return Arrays.<ReactPackage>asList(\n            new " + JSI_PACKAGE_CALL + ","
          );
        }
      }
    }

    mod.modResults.contents = updated;
    return mod;
  });
};

// --- 4. proguard-rules.pro ---------------------------------------------------
// Adds the keep rule to prevent ProGuard from stripping WatermelonDB classes.

const withWatermelonDBProGuard: ConfigPlugin<void> = (config) => {
  return withDangerousMod(config, [
    "android",
    async (modConfig) => {
      const filePath = path.join(
        modConfig.modRequest.platformProjectRoot,
        "app",
        "proguard-rules.pro"
      );

      const contents = await fs.readFile(filePath, "utf-8");

      if (contents.includes(PROGUARD_KEEP_RULE)) {
        return modConfig; // Idempotent
      }

      const updated = contents.trim() + "\n\n# WatermelonDB JSI\n" + PROGUARD_KEEP_RULE + "\n";
      await fs.writeFile(filePath, updated, "utf-8");

      return modConfig;
    },
  ]);
};

// --- Main plugin function ----------------------------------------------------

/**
 * Expo config plugin that auto-configures @nozbe/watermelondb's JSI module
 * for Android in Expo projects using CNG (Continuous Native Generation).
 *
 * @example
 * // app.json
 * {
 *   "plugins": ["expo-watermelondb-plugin"]
 * }
 *
 * @example
 * // app.config.js - with options
 * {
 *   "plugins": [
 *     ["expo-watermelondb-plugin", { "disableJsi": true }]
 *   ]
 * }
 */
const withWatermelonDB: ConfigPlugin<WatermelonDBPluginOptions | undefined> = (
  config,
  options
) => {
  if (options?.disableJsi) {
    return config;
  }

  config = withWatermelonDBSettingsGradle(config);
  config = withWatermelonDBAppBuildGradle(config);
  config = withWatermelonDBMainApplication(config);
  config = withWatermelonDBProGuard(config);

  return config;
};

export default withWatermelonDB;
export { withWatermelonDB };