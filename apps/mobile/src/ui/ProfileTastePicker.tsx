import { readSelectedCatalogIdentity } from "../data/collectorIdentity";
import { prepareIdentitySubmission, finishIdentitySubmission, readIdentitySubmission } from "../data/identitySubmission";
import { SeoullyButton } from "./SeoullyControls";
import { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { contributeCatalogIdentity, searchCollectorGroups, searchCollectorMembers } from "../api";
import { useCopy } from "../locale";
import { RetryNotice } from "../components/RetryNotice";
import { SeoullyField } from "./SeoullyField";
import { SeoullyText } from "./SeoullyText";
import { IDENTITY_LIGHT, useProfileIdentity } from "./ProfileIdentity";
import { toggleIdentitySelection, unselectedIdentityOptions } from "./collectorArchetypes";
export type TasteOption = { id: string; name: string; groupId?: string; groupName?: string; catalogId?: string };

export function ProfileTastePicker({ kind, selected, onChange, initialOptions, preferredGroups = [], disabled, live = true, canContribute = false, userId, onBusyChange, showHeading = true, style }: {
  style?: StyleProp<ViewStyle>; showHeading?: boolean; kind: "groups" | "biases"; selected: string[]; onChange: (ids: string[]) => void | Promise<void>;
  initialOptions: TasteOption[]; preferredGroups?: string[]; disabled?: boolean; live?: boolean; canContribute?: boolean; userId: string; onBusyChange: (active: boolean) => void;
}) {
  const copy = useCopy();
  const palette = useProfileIdentity() ?? IDENTITY_LIGHT;
  const [query, setQuery] = useState("");
  const queryEdited = useRef(false);
  const [results, setResults] = useState<TasteOption[]>([]);
  const [known, setKnown] = useState<TasteOption[]>([]);
  const [error, setError] = useState(false);
  const [pending, setPending] = useState(live);
  const [attempt, setAttempt] = useState(0);
  const contributionLock = useRef(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState(false);
  const [manualGroupQuery, setManualGroupQuery] = useState("");
  const [manualGroups, setManualGroups] = useState<{ id: string; name: string }[]>([]);
  const [manualGroup, setManualGroup] = useState<{ id: string; name: string } | null>(null);
  const [limit, setLimit] = useState(false);
  useEffect(() => {
    if (!live || !canContribute) return;
    let active = true;
    // Resume an ambiguous contribution with its exact name, group, and UUID.
    void readIdentitySubmission(userId, kind === "groups" ? "group" : "member").then(async submission => {
      if (!submission || !active) return;
      const selectedGroup = submission.groupId
        ? (await readSelectedCatalogIdentity([submission.groupId], [])).groups[0] : null;
      if (!active || queryEdited.current) return;
      setQuery(submission.name);
      if (selectedGroup) { setManualGroup(selectedGroup); setManualGroupQuery(selectedGroup.name); }
    }).catch(() => { if (active) setCreateError(true); });
    return () => { active = false; };
  }, [userId, kind, live, canContribute]);
  useEffect(() => {
    void attempt;
    if (!live) return;
    const controller = new AbortController();
    let active = true;
    async function search() {
      setPending(true); setError(false);
      try {
        const options = kind === "groups"
          ? (await searchCollectorGroups(query, controller.signal)).map(g => ({ id: g.id, name: g.name, catalogId: g.catalogId }))
          : (await searchCollectorMembers(query, controller.signal)).map(m => ({ id: m.id, name: m.stageName, groupId: m.groupId, groupName: m.groupName }));
        if (!active) return;
        setResults(options);
        setKnown(previous => [...new Map([...previous, ...options].map(o => [o.id, o])).values()]);
      } catch { if (active) setError(true); }
      finally { if (active) setPending(false); }
    }
    void search();
    return () => { active = false; controller.abort(); };
  }, [kind, query, attempt, live]);
  useEffect(() => {
    if (kind !== "biases" || !canContribute || !live) return;
    const controller = new AbortController();
    void searchCollectorGroups(manualGroupQuery, controller.signal).then(groups => {
      if (!controller.signal.aborted) setManualGroups(groups.filter(g => g.catalogId).map(g => ({ id: g.catalogId!, name: g.name })));
    }).catch(() => { if (!controller.signal.aborted) setCreateError(true); });
    return () => controller.abort();
  }, [manualGroupQuery, kind, canContribute, live]);
  async function contribute() {
    if (contributionLock.current || creating || disabled || !canContribute || !query.trim() || (kind === "biases" && !manualGroup)) return;
    contributionLock.current = true;
    onBusyChange(true);
    setCreating(true); setCreateError(false);
    try {
      const submission = await prepareIdentitySubmission(userId, { kind: kind === "groups" ? "group" : "member", name: query, ...(kind === "biases" ? { groupId: manualGroup!.id } : {}) });
      const saved = await contributeCatalogIdentity(submission);
      const option = { id: saved.memberId ?? saved.groupId, name: saved.submittedName, ...(saved.memberId ? { groupId: saved.groupId, groupName: manualGroup!.name } : {}) };
      setKnown(previous => [...previous.filter(o => o.id !== option.id), option]);
      if (!selected.includes(option.id)) await toggle(option.id);
      await finishIdentitySubmission(userId, submission).catch(() => {});
      setQuery("");
    } catch { setCreateError(true); }
    finally { contributionLock.current = false; onBusyChange(false); setCreating(false); }
  }
  const options = new Map([...initialOptions, ...known].map(o => [o.id, o]));
  const ordered = unselectedIdentityOptions(results, selected).sort((a,b) => Number(preferredGroups.includes(b.groupId ?? "")) - Number(preferredGroups.includes(a.groupId ?? "")) || a.name.localeCompare(b.name));
  function toggle(id: string) {
    if (!selected.includes(id) && selected.length >= (kind === "groups" ? 24 : 48)) { setLimit(true); return; }
    setLimit(false); return onChange(toggleIdentitySelection(selected, id));
  }
  function pick(option: TasteOption, isSelected: boolean) {
    return <Pressable key={option.id} disabled={disabled || creating} accessibilityRole="checkbox" accessibilityState={{ checked: isSelected, disabled }}
      onPress={() => { void Promise.resolve(toggle(option.id)).catch(() => {}); }} style={[styles.option, { backgroundColor: isSelected ? palette.primarySoft : palette.paper, borderColor: isSelected ? palette.primary : palette.line }]}>
      <SeoullyText variant="body">{option.name}{isSelected ? "  ✓" : ""}</SeoullyText>
      {option.groupName ? <SeoullyText variant="caption">{option.groupName}</SeoullyText> : null}
    </Pressable>;
  }
  return <View style={[styles.section, style]}>
    {showHeading ? <SeoullyText variant="section">{kind === "groups" ? copy.profileFavoriteGroups : copy.profileBiases}</SeoullyText> : null}
    {selected.length ? <>
      <SeoullyText variant="caption">{copy.profileSelected}</SeoullyText>
      <View style={styles.options}>{selected.map(id => pick(options.get(id) ?? { id, name: copy.profileSavedSelection }, true))}</View>
    </> : null}
    <SeoullyField label={kind === "groups" ? copy.profileSearchGroups : copy.profileSearchBiases} value={query} onChangeText={text => { queryEdited.current = true; setQuery(text); }} maxLength={120} editable={!disabled && !creating} autoCorrect={false} />
    {error ? <RetryNotice message={copy.profileCatalogFailure} retryLabel={copy.retry} onRetry={() => setAttempt(n => n + 1)} /> : null}
    {limit ? <SeoullyText variant="caption">{copy.profileSelectionLimit}</SeoullyText> : null}
    {!pending && !error && !results.length ? <View style={styles.empty}>
      <SeoullyText variant="body">{copy.profileCatalogEmpty}{query.trim() ? ` “${query.trim()}”` : ""}</SeoullyText>
      <SeoullyText variant="secondary">{canContribute ? copy.profileCommunityIdentity : copy.profileMissingCapability}</SeoullyText>
      {canContribute && query.trim() ? <>
        {kind === "biases" ? <>
          <SeoullyField label={copy.profileMemberGroup} value={manualGroupQuery} onChangeText={setManualGroupQuery} editable={!creating} />
          {manualGroups.slice(0, manualGroupQuery.trim() ? 20 : 6).map(g => <Pressable key={g.id} accessibilityRole="radio" accessibilityState={{ checked: manualGroup?.id === g.id }} disabled={creating} onPress={() => setManualGroup(g)} style={[styles.option, { backgroundColor: palette.paper, borderColor: manualGroup?.id === g.id ? palette.primary : palette.line }]}><SeoullyText>{g.name}{manualGroup?.id === g.id ? " ✓" : ""}</SeoullyText></Pressable>)}
        </> : null}
        <SeoullyButton label={creating ? copy.saving : `${copy.profileAddName} “${query}”`} disabled={creating || disabled || (kind === "biases" && !manualGroup)} onPress={() => { void contribute(); }} />
      </> : null}
    </View> : null}
    {createError ? <SeoullyText accessibilityRole="alert">{copy.profileContributionFailed}</SeoullyText> : null}
    {pending ? <SeoullyText variant="caption">{copy.profileCatalogSearching}</SeoullyText> : null}
    <View style={styles.options}>{(!pending ? ordered.slice(0, query.trim() ? 24 : 8) : []).map(o => pick(o, selected.includes(o.id)))}</View>
  </View>;
}
const styles = StyleSheet.create({
  section: { marginTop: 24, gap: 12 }, options: { gap: 8 },
  option: { minHeight: 48, borderRadius: 16, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 12, gap: 4 },
  empty: { gap: 8, paddingVertical: 8 },
});
