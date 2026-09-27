# Native Device QA

These checks require a physical iPhone and Android device. They are intentionally not
claimed by static TypeScript or Expo validation.

## Physical iPhone — Room startup crash (Expo Go)

- Date: 2026-09-27
- Branch: `mobile-native`
- Checkpoint before the crash: `ae8e155`
- Device: physical iPhone through Expo Go
- Reproduction: Metro bundled `expo-router/entry.js`, then the app died on launch with
  `TypeError: undefined is not a function` attributed to
  `NativeRoomRenderer.tsx:3` (`import … from "@react-three/fiber/native"`).
  Expo Router also warned that `room.tsx`, `(tabs)/room.tsx`, and
  `collector-room.tsx` were missing a default export.

### Root cause

The crash happens while **evaluating** `@react-three/fiber@9.8.1` native, not because
the import path is the web build.

Installed native entry (`native/dist/react-three-fiber-native.{esm,cjs.*.js}`) runs
`polyfills()` at module load when `Platform.OS !== "web"`. That function does:

```js
THREE.LoaderUtils.extractUrlBase.bind(THREE.LoaderUtils)
```

`undefined is not a function` is `.bind` being called on a missing
`extractUrlBase`. `three@0.186.1` still implements the method on the real
`LoaderUtils` class in `three.core.js`, but Metro’s `require("three")` interop
through the deprecated 631-byte `three.cjs` shim can leave the static missing on
the namespace R3F actually sees. That matches the stack (import-time, not first
frame).

The Expo Router “missing default export” warnings are **cascading**: those route
modules import the renderer at the top level, so they throw before
`export default` is reached. The route exports themselves were already correct.

`expo-gl` is part of Expo Go for SDK 57. This crash is a JS evaluation bug, not
a missing Expo Go native module. A development build is **not** required to
retest this specific failure.

### Resolution

- Guard the R3F native polyfill (patch-package on `@react-three/fiber@9.8.1`).
- Restore `LoaderUtils.extractUrlBase` before the R3F import.
- Resolve `three` to `three.module.js` in Metro so the CJS shim is not used.
- Lazy-load the Room renderer from route files so Expo Router can evaluate
  Room routes without importing R3F during app startup.

### Still requiring device verification

- [ ] iOS Expo Go launches to the tab shell without the import-time TypeError
- [ ] Room tab mounts the GL canvas and shows the world
- [ ] Feed / Search / Profile still open if Room is not visited
- [ ] SafeAreaView deprecation is unrelated and still pending layout QA

## Remaining physical checks

- [ ] iOS launch and safe-area layout
- [ ] Android launch and insets/back gesture
- [ ] Supabase session restoration and logout
- [ ] camera permission, capture, orientation, and retry
- [ ] photo-library permission and selection
- [ ] photocard crop pan/zoom and memory behavior
- [ ] keyboard avoidance on auth/forms
- [ ] Feed/search/profile scrolling and native navigation gestures
- [ ] Room renderer proof FPS, texture memory, gestures, and thermal behavior
- [ ] Binder lift/return gestures and personal image textures
