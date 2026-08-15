# WatermelonDB Plugin Example App

A minimal Expo app that demonstrates `expo-watermelondb-plugin` working with `@nozbe/watermelondb` and JSI enabled.

## Setup

```bash
# From the example directory:
npm install
```

## Run

### Prebuild (generates android/ and ios/ folders with the plugin applied)

```bash
npx expo prebuild --clean
```

### Verify the plugin worked

After prebuild, check the generated Android files:

```bash
# settings.gradle should include :watermelondb-jsi
grep "watermelondb-jsi" android/settings.gradle

# app/build.gradle should have the implementation + pickFirst
grep "watermelondb-jsi" android/app/build.gradle
grep "libc++_shared.so" android/app/build.gradle

# MainApplication.kt should import and register the JSI package
grep "WatermelonDBJSIPackage" android/app/src/main/java/*/MainApplication.kt

# proguard-rules.pro should have the keep rule
grep "com.nozbe.watermelondb" android/app/proguard-rules.pro
```

### Run on device/emulator

```bash
# Android
npx expo run:android

# iOS (requires macOS + Xcode)
npx expo run:ios
```

## What this verifies

1. **JSI is active** — The app creates a SQLite database with `{ jsi: true }`. If the plugin didn't work, the app would crash on launch with a JSI module not found error.
2. **CRUD operations** — Add, toggle, and delete tasks. All operations go through the JSI bridge for synchronous, high-performance database access.
3. **ProGuard safety** — Release builds with minification enabled won't strip WatermelonDB classes thanks to the keep rule.
