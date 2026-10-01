import { createContext, useContext, type PropsWithChildren } from "react";
import { colors } from "../theme";
import { IDENTITY_LIGHT, type IdentityPalette } from "./profileContrast";

const ProfileIdentityContext = createContext<IdentityPalette | null>(null);

export function ProfileIdentityProvider({
  palette,
  children,
}: PropsWithChildren<{ palette: IdentityPalette }>) {
  return <ProfileIdentityContext.Provider value={palette}>{children}</ProfileIdentityContext.Provider>;
}

export function useProfileIdentity(): IdentityPalette | null {
  return useContext(ProfileIdentityContext);
}

export function useProfileInk(): string {
  return useContext(ProfileIdentityContext)?.ink ?? colors.ink;
}

export function useProfileMute(): string {
  return useContext(ProfileIdentityContext)?.mute ?? colors.muted;
}

export function useProfileAccent(): string {
  return useContext(ProfileIdentityContext)?.primaryDeep ?? colors.plum;
}

export { IDENTITY_LIGHT };
