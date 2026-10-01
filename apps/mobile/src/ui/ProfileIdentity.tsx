import { createContext, useCallback, useContext, useState, type PropsWithChildren } from "react";
import { useFocusEffect } from "expo-router";
import { colors } from "../theme";
import { IDENTITY_LIGHT, type IdentityPalette } from "./profileContrast";

const ProfileIdentityContext = createContext<IdentityPalette | null>(null);
const PublishedIdentityContext = createContext<IdentityPalette | null>(null);
const PublishIdentityContext = createContext<(palette: IdentityPalette | null) => void>(() => {});

export function ProfileIdentityProvider({
  palette,
  children,
}: PropsWithChildren<{ palette: IdentityPalette }>) {
  return <ProfileIdentityContext.Provider value={palette}>{children}</ProfileIdentityContext.Provider>;
}

/**
 * Tabs-shell channel for the same IdentityPalette. Profile publishes while
 * focused; the tab bar reads it. Screen trees keep using ProfileIdentityProvider
 * so Discover/Search never inherit a collector theme.
 */
export function ProfileIdentityScope({ children }: PropsWithChildren) {
  const [published, setPublished] = useState<IdentityPalette | null>(null);
  return (
    <PublishIdentityContext.Provider value={setPublished}>
      <PublishedIdentityContext.Provider value={published}>
        {children}
      </PublishedIdentityContext.Provider>
    </PublishIdentityContext.Provider>
  );
}

export function useProfileIdentity(): IdentityPalette | null {
  return useContext(ProfileIdentityContext);
}

export function usePublishedProfileIdentity(): IdentityPalette | null {
  return useContext(PublishedIdentityContext);
}

export function usePublishProfileIdentity(palette: IdentityPalette) {
  const publish = useContext(PublishIdentityContext);
  useFocusEffect(useCallback(() => {
    publish(palette);
    return () => publish(null);
  }, [publish, palette]));
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
