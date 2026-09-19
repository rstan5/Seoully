import type { CollectorInterest, Profile, User } from "./types";

/** Safe account/profile projection returned by authenticated server operations. */
export interface IdentityProfileDTO {
  user: Pick<User, "id" | "handle" | "displayName" | "joinedAt">;
  profile: Pick<
    Profile,
    | "userId"
    | "tagline"
    | "bio"
    | "location"
    | "favoriteGroupIds"
    | "biasMemberIds"
    | "favoriteEraIds"
    | "collectorInterests"
    | "collectorType"
  >;
}

export interface CurrentProfilePatch {
  handle?: string;
  displayName?: string;
  tagline?: string;
  bio?: string;
  location?: string;
  favoriteGroupIds?: string[];
  biasMemberIds?: string[];
  favoriteEraIds?: string[];
  collectorInterests?: CollectorInterest[];
  collectorType?: string;
}

export type AuthFailure =
  | "configuration"
  | "unavailable"
  | "invalid-input"
  | "handle-taken"
  | "email-taken"
  | "invalid-credentials"
  | "email-confirmation"
  | "profile-missing";

export type AuthActionResult =
  | { ok: true; identity: IdentityProfileDTO }
  | { ok: true; needsEmailConfirmation: true }
  | { ok: false; reason: AuthFailure };
