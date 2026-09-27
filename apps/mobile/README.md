# Seoully Mobile

This is the native Expo/React Native client under active migration. It uses the same
Supabase project and production identity model as the Next.js reference application.

## Local configuration

Copy `env.example` to a local environment file and provide only the Supabase project
URL and publishable key. Never put service-role keys or other server secrets in this
client. Expo inlines `EXPO_PUBLIC_*` values into the bundle, so they must be treated as
public configuration and protected by Supabase RLS.

## Commands

```sh
npm install
npx expo start
npx tsc --noEmit
```

The current foundation is iOS/Android-first. Web export is not a required validation
target for the native client.
