import { Image, StyleSheet, View } from "react-native";
import type { NativeCatalogTemplate } from "../api";
import { collectibleKindLabel } from "../i18n";
import { useCopy } from "../locale";
import { colors } from "../theme";
import { PhotocardCollectorCount } from "./PhotocardCollectorCount";
import { SeoullyText } from "./SeoullyText";

/** Shared public identity. Never resolves or signs private Holding media. */
export function CollectibleDetailIdentity({ template, imageUrl, onImageError }: { template: NativeCatalogTemplate; imageUrl?: string; onImageError?: () => void }) {
  return <>
    {imageUrl ? <Image accessibilityLabel={template.name} source={{ uri: imageUrl }} onError={onImageError} resizeMode="cover" style={[styles.image, template.kind !== "photocard" && styles.object]} /> :
      <View style={[styles.image, styles.fallback, template.kind !== "photocard" && styles.object]}><SeoullyText variant="title" style={styles.center}>{template.name}</SeoullyText></View>}
    <CollectibleDetailMetadata template={template} />
  </>;
}
export function CollectibleDetailMetadata({ template }: { template: NativeCatalogTemplate }) {
  const copy = useCopy();
  return <>
    <SeoullyText variant="caption" color={colors.plum} style={styles.kind}>{collectibleKindLabel(template.kind, copy)}</SeoullyText>
    <SeoullyText variant="title">{template.name}</SeoullyText>
    <PhotocardCollectorCount templateId={template.id} kind={template.kind} />
    {template.needsReferenceImage ? <SeoullyText variant="caption">{copy.catalogNeedsMedia}</SeoullyText> : null}
    <SeoullyText variant="secondary" style={styles.meta}>{[template.groupName, template.memberName, template.releaseName].filter(Boolean).join(" · ")}</SeoullyText>
    {template.descriptor ? <SeoullyText variant="body" style={styles.description}>{template.descriptor}</SeoullyText> : null}
  </>;
}
const styles = StyleSheet.create({
  image: { width: "78%", aspectRatio: 24 / 37, alignSelf: "center", borderRadius: 18, marginTop: 16 },
  object: { aspectRatio: 1 }, fallback: { backgroundColor: colors.lilacSoft, alignItems: "center", justifyContent: "center", padding: 18 },
  center: { textAlign: "center" }, kind: { marginTop: 18, textTransform: "uppercase" }, meta: { marginTop: 4 }, description: { marginTop: 12, lineHeight: 20 },
});
