# expo-watermelondb-plugin

<div align="center">

**Expo config plugin that auto-configures [`@nozbe/watermelondb`](https://github.com/Nozbe/WatermelonDB)'s native JSI module for Android in CNG workflows.**

No committed `android/` / `ios/` folders needed. Survives `expo prebuild` and `EAS Build` regenerating native code from scratch.

</div>

---

## Why this exists

The most-used community plugin ([`@morrowdigital/watermelondb-expo-plugin`](https://github.com/morrowdigital/watermelondb-expo-plugin)) last released `2.4.0-beta.0` (Nov 2025) and only claims tested support through **Expo SDK 54**. Current Expo is **SDK 57** (Aug 2026). Other community forks are stuck at SDK 52–53. This plugin tracks current Expo SDKs, is verified across **SDK 54–57**, and uses modern Gradle APIs (`providers.exec` instead of deprecated `.execute()`).

## Tested against

| Expo SDK | React Native | WatermelonDB | Android | iOS | Status |
|----------|-------------|-------------|---------|-----|--------|
| 54       | 0.81        | 0.28.0      | ✅      | ✅  | Supported |
| 55       | 0.83        | 0.28.0      | ✅      | ✅  | Supported |
| 56       | 0.85        | 0.28.0      | ✅      | ✅  | Supported |
| 57       | 0.86        | 0.28.0      | ✅      | ✅  | **Active** |

> Verified by running `expo prebuild` against each SDK's bare template and
> confirming all four Android files are patched correctly (settings.gradle,
> app/build.gradle, MainApplication, proguard-rules.pro).

> **Note**: WatermelonDB requires a **custom development client** — it does **not** work with Expo Go. This is a fundamental limitation of any JSI-based native module, shared by all WatermelonDB config plugins.

## What it does

### Android (the work that matters)

1. **`settings.gradle`** — Adds `include ':watermelondb-jsi'` and dynamically resolves its `projectDir` to `node_modules/@nozbe/watermelondb/native/android-jsi` using the modern `providers.exec` API (same pattern Expo's own template uses).

2. **`app/build.gradle`** — Adds `implementation project(':watermelondb-jsi')` to dependencies and `pickFirst '**/libc++_shared.so'` to `packagingOptions` (prevents duplicate `.so` build errors — recommended by WatermelonDB docs, missing from the reference plugin).

3. **`MainApplication.kt`** (or `.java`) — Imports `com.nozbe.watermelondb.jsi.WatermelonDBJSIPackage` and registers it via `add(WatermelonDBJSIPackage())` in the packages list.

4. **`proguard-rules.pro`** — Adds `-keep class com.nozbe.watermelondb.** { *; }` to prevent ProGuard from stripping WatermelonDB classes in release builds.

### iOS

No config plugin changes needed. WatermelonDB's podspec + React Native autolinking handle iOS automatically. Just run `expo prebuild` and `pod install` as usual.

## Installation

```bash
npm install expo-watermelondb-plugin @nozbe/watermelondb
# or
yarn add expo-watermelondb-plugin @nozbe/watermelondb
```

## Usage

Add the plugin to your `app.json` or `app.config.js`:

```json
{
  "expo": {
    "plugins": ["expo-watermelondb-plugin"]
  }
}
```

### With options

```json
{
  "expo": {
    "plugins": [
      ["expo-watermelondb-plugin", { "disableJsi": false }]
    ]
  }
}
```

### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `disableJsi` | `boolean` | `false` | Disable JSI support for Android. Falls back to the standard (non-JSI) WatermelonDB bridge module. Useful for debugging JSI crashes. |

## Complete setup example

### 1. Install dependencies

```bash
npm install expo-watermelondb-plugin @nozbe/watermelondb
npm install --save-dev @babel/plugin-proposal-decorators
```

### 2. Configure Babel (`babel.config.js`)

```js
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [['@babel/plugin-proposal-decorators', { legacy: true }]],
  };
};
```

### 3. Add plugin to `app.json`

```json
{
  "expo": {
    "plugins": ["expo-watermelondb-plugin"]
  }
}
```

### 4. Rebuild native code

```bash
npx expo prebuild --clean
```

### 5. Use WatermelonDB in your app

```tsx
import { Database } from '@nozbe/watermelondb';
import SQLiteAdapter from '@nozbe/watermelondb/adapters/sqlite';

const adapter = new SQLiteAdapter({
  schema: {
    version: 1,
    tables: {
      tasks: {
        columns: [{ name: 'name', type: 'string' }],
      },
    },
  },
  jsi: true, // ← JSI enabled by this plugin
  dbName: 'app.db',
});

const database = new Database({
  adapter,
  modelClasses: [],
});
```

## How it works

This plugin hooks into Expo's config plugin system. When you run `expo prebuild` or `EAS Build`, Expo generates fresh `android/` and `ios/` directories from templates. This plugin's mods run during that generation, patching the four Android files listed above before the build starts.

Each modification is **idempotent** — it checks whether the change has already been applied before making it, so re-running prebuild won't cause duplicate entries.

## Attribution

This plugin adapts logic from [`@morrowdigital/watermelondb-expo-plugin`](https://github.com/morrowdigital/watermelondb-expo-plugin) (MIT, Copyright © Morrow Digital). Key improvements:

- Uses `providers.exec` (modern Gradle) instead of deprecated `.execute()` for `settings.gradle`
- Adds `pickFirst '**/libc++_shared.so'` to `packagingOptions` (missing from reference plugin)
- Handles both Kotlin and Java `MainApplication` files
- Full TypeScript types
- Verified against Expo SDK 54–57 with explicit prebuild testing

## License

MIT — see [LICENSE](./LICENSE)
