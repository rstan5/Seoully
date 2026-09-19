# Seoully

> **Turn your fandom into a home.**

Seoully is the social home for K-pop fans and collectors. It brings collecting, discovery, conversation, and a personal digital room together in one tactile, community-driven experience.

## Overview

Seoully helps collectors keep track of what they own and want, discover people with similar interests, share collection moments, and make their fandom feel like a place they can return to.

## Core Experience

- Build a personal K-pop collection and wishlist
- Discover collectors, posts, rooms, groups, and collectibles
- Create posts with media, captions, collector tags, and collectible references
- Explore and arrange a personal digital Room
- Compare collection interests and discover meaningful connections
- Ask Seoully for guidance through the heart companion

## Key Features

- Guided onboarding with first-collectible setup
- Community catalog search and manual collectible creation
- Separate ownership, wishlist, trade, and Room-placement state
- Profile customization, appearance presets, and room-synced themes
- Social feed, search/explore, messages, notifications, and profile pages
- English and Korean localization
- Responsive mobile experience

## Tech Stack

- Next.js 16 with React 19 and TypeScript
- Zustand for client-side application state
- Zod for server-boundary validation
- Motion for interaction and transition animation
- Supabase SSR/Auth and PostgreSQL foundation
- Playwright tooling for browser QA

## Current Development Status

Seoully’s UI/product prototype is frozen after comprehensive product QA. The current repository contains the working local prototype, fixture-backed social and collection data, Room experience, Ask Seoully fallback, and the initial Supabase User/Profile foundation.

The production migration is intentionally incremental. Catalog, Holdings, wishlist, Room persistence, social data, messaging, media storage, and recommendations remain prototype/local systems until their dedicated production phases.

## Local Development

```bash
npm install
npm run dev
```

The development server runs at [http://localhost:3000](http://localhost:3000) by default.

Useful checks:

```bash
npm run typecheck
git diff --check
```

Supabase-backed account features require local environment values based on [`.env.example`](.env.example). Never commit real credentials or service keys.

## Project Structure

```text
src/app/       Next.js entry points, API routes, and auth callback
src/domain/    Domain types, repositories, fixtures, search, and collection logic
src/server/    Server-only authentication, Supabase, and data-access boundaries
src/world/     Room rendering, social UI, onboarding, and client stores
src/locale/    English/Korean localization
supabase/      Versioned database migrations and RLS tests
public/        Prototype media and brand assets
```
