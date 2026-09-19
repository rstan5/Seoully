/**
 * The Seoully heart mark. Welcome mascot, onboarding companion, and the
 * later corner assistant all share this asset so it stays one character.
 */
export function SeoullyHeartMark({
  className,
  alt = "",
}: {
  className?: string;
  alt?: string;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      className={className}
      src="/brand/seoully-heart-mark.png"
      alt={alt}
      draggable={false}
    />
  );
}
