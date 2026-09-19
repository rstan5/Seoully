"use server";

import { z } from "zod";
import type { AuthActionResult, CurrentProfilePatch, IdentityProfileDTO } from "@/domain/identity";
import { normalizeHandle } from "@/domain/session";
import { currentProfilePatchSchema, getCurrentIdentity, updateCurrentProfile } from "@/server/dal/profile";
import { createSupabaseServerClient, hasSupabaseConfiguration } from "@/server/supabase/server";

const handleSchema = z.string().trim().min(3).max(32).transform(normalizeHandle).pipe(z.string().regex(/^[a-z][a-z0-9_]{2,15}$/));
const signupSchema = z.object({
  handle: handleSchema,
  displayName: z.string().trim().min(1).max(48),
  email: z.string().trim().email().max(254),
  password: z.string().min(8).max(128),
}).strict();
const signinSchema = z.object({ email: z.string().trim().email().max(254), password: z.string().min(1).max(128) }).strict();

export async function createSeoullyAccount(input: unknown): Promise<AuthActionResult> {
  const parsed = signupSchema.safeParse(input);
  if (!parsed.success) return { ok: false, reason: "invalid-input" };
  if (!hasSupabaseConfiguration()) return { ok: false, reason: "configuration" };
  const siteUrl = safeSiteUrl();
  if (!siteUrl) return { ok: false, reason: "configuration" };

  try {
    const supabase = await createSupabaseServerClient();
    const { data: existingHandle, error: handleLookupError } = await supabase
      .from("profiles")
      .select("user_id")
      .eq("handle", parsed.data.handle)
      .maybeSingle();
    if (handleLookupError) return { ok: false, reason: "unavailable" };
    if (existingHandle) return { ok: false, reason: "handle-taken" };
    const { data, error } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: {
        data: { handle: parsed.data.handle, display_name: parsed.data.displayName },
        emailRedirectTo: new URL("/auth/callback?next=/", siteUrl).toString(),
      },
    });
    if (error) {
      if (error.code === "user_already_exists") return { ok: false, reason: "email-taken" };
      if (/handle.*(unique|duplicate)|profiles_handle/i.test(error.message)) return { ok: false, reason: "handle-taken" };
      if (error.code === "weak_password" || error.code === "email_address_invalid") return { ok: false, reason: "invalid-input" };
      return { ok: false, reason: "unavailable" };
    }
    if (!data.session) return { ok: true, needsEmailConfirmation: true };
    const identity = await getCurrentIdentity();
    return identity ? { ok: true, identity } : { ok: false, reason: "profile-missing" };
  } catch {
    return { ok: false, reason: "unavailable" };
  }
}

export async function signInToSeoully(input: unknown): Promise<AuthActionResult> {
  const parsed = signinSchema.safeParse(input);
  if (!parsed.success) return { ok: false, reason: "invalid-input" };
  if (!hasSupabaseConfiguration()) return { ok: false, reason: "configuration" };
  try {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.signInWithPassword(parsed.data);
    if (error) {
      if (error.code === "invalid_credentials" || error.code === "email_not_confirmed") {
        return { ok: false, reason: "invalid-credentials" };
      }
      return { ok: false, reason: "unavailable" };
    }
    const identity = await getCurrentIdentity();
    return identity ? { ok: true, identity } : { ok: false, reason: "profile-missing" };
  } catch {
    return { ok: false, reason: "unavailable" };
  }
}

export async function resolveCurrentSeoullyIdentity(): Promise<IdentityProfileDTO | null | { unavailable: true }> {
  if (!hasSupabaseConfiguration()) return null;
  try {
    return await getCurrentIdentity();
  } catch {
    return { unavailable: true };
  }
}

export async function updateMySeoullyProfile(input: CurrentProfilePatch): Promise<AuthActionResult> {
  const parsed = currentProfilePatchSchema.safeParse(input);
  if (!parsed.success) return { ok: false, reason: "invalid-input" };
  try {
    const identity = await updateCurrentProfile(parsed.data);
    return { ok: true, identity };
  } catch (error) {
    if (error instanceof Error && error.message === "unauthenticated") return { ok: false, reason: "invalid-credentials" };
    if (error instanceof Error && error.message === "handle_taken") return { ok: false, reason: "handle-taken" };
    if (error instanceof Error && error.message === "profile_missing") return { ok: false, reason: "profile-missing" };
    if (!hasSupabaseConfiguration()) return { ok: false, reason: "configuration" };
    return { ok: false, reason: "unavailable" };
  }
}

export async function signOutOfSeoully(): Promise<{ ok: boolean }> {
  if (!hasSupabaseConfiguration()) return { ok: true };
  try {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.signOut();
    return { ok: !error };
  } catch {
    return { ok: false };
  }
}

function safeSiteUrl(): string | null {
  const value = process.env.SITE_URL;
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && url.hostname !== "localhost") return null;
    return url.origin;
  } catch {
    return null;
  }
}
