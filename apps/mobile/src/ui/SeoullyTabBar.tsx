import { Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, elevation, radii, sizes } from "../theme";
import { IconChat, IconHome, IconPlus, IconSearch, IconUser } from "./icons";
import { pressShift, useReduceMotion } from "./motion";
import { usePublishedProfileIdentity } from "./ProfileIdentity";
import { profileTabChrome } from "./profileContrast";

type TabRoute = { key: string; name: string; params?: object };
type TabOptions = { title?: string; tabBarAccessibilityLabel?: string };
type TabNavigation = {
  emit: (event: { type: "tabPress"; target: string; canPreventDefault: true }) => { defaultPrevented: boolean };
  navigate: (name: string, params?: object) => void;
};
type SeoullyTabBarProps = {
  state: { index: number; routes: TabRoute[] };
  descriptors: Record<string, { options: TabOptions }>;
  navigation: TabNavigation;
};

const icons = {
  index: IconHome,
  search: IconSearch,
  create: IconPlus,
  messages: IconChat,
  profile: IconUser,
} as const;

export function SeoullyTabBar({ state, descriptors, navigation }: SeoullyTabBarProps) {
  const insets = useSafeAreaInsets();
  const reduceMotion = useReduceMotion();
  const identity = usePublishedProfileIdentity();
  const chrome = identity ? profileTabChrome(identity) : null;

  return (
    <View style={[
      styles.bar,
      { paddingBottom: insets.bottom },
      chrome ? { backgroundColor: chrome.bar, borderTopColor: chrome.border } : null,
    ]}>
      {state.routes.filter((route) => route.name in icons).map((route) => {
        const focused = state.routes[state.index]?.name === route.name;
        const { options } = descriptors[route.key];
        const label = options.tabBarAccessibilityLabel ?? options.title ?? route.name;
        const Icon = icons[route.name as keyof typeof icons] ?? IconHome;
        const isCreate = route.name === "create";
        const iconColor = isCreate && focused
          ? (chrome?.createOnFg ?? colors.onPrimary)
          : focused || isCreate
            ? (chrome?.active ?? colors.plum)
            : (chrome?.inactive ?? colors.muted);

        return (
          <Pressable
            key={route.key}
            accessibilityRole="button"
            accessibilityLabel={label}
            accessibilityState={{ selected: focused }}
            onPress={() => {
              const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true as const });
              if (!focused && !event.defaultPrevented) navigation.navigate(route.name, route.params);
            }}
            style={({ pressed }) => [
              styles.tab,
              focused && !isCreate && styles.tabOn,
              focused && !isCreate && chrome ? { backgroundColor: chrome.activeBg } : null,
              isCreate && styles.create,
              isCreate && chrome ? { backgroundColor: chrome.createBg, borderColor: chrome.createBorder } : null,
              isCreate && focused && styles.createOn,
              isCreate && focused && chrome ? { backgroundColor: chrome.createOnBg, borderColor: chrome.createOnBg } : null,
              pressShift(pressed, reduceMotion),
            ]}
          >
            <Icon
              color={iconColor}
              filled={focused && (route.name === "index" || route.name === "messages" || route.name === "profile")}
            />
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    alignItems: "center",
    backgroundColor: colors.canvas,
    borderTopColor: colors.border,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    justifyContent: "space-around",
    minHeight: sizes.tabBar,
    paddingTop: 2,
  },
  tab: {
    alignItems: "center",
    borderRadius: radii.nav,
    height: sizes.tab,
    justifyContent: "center",
    width: sizes.tab,
  },
  tabOn: {
    backgroundColor: colors.lilacSoft,
    ...elevation.raise,
  },
  create: {
    backgroundColor: colors.lilacSoft,
    borderColor: "#fad4de",
    borderRadius: radii.create,
    borderWidth: 1,
    height: sizes.create,
    width: sizes.create,
    ...elevation.raise,
  },
  createOn: {
    backgroundColor: colors.lilac,
    borderColor: colors.lilac,
  },
});
