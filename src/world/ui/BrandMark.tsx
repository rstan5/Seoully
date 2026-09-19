/** Wordmark used wherever the Seoully brand label appears. */
export function BrandMark() {
  return (
    <span className="brand-mark">
      Seoully
      <span className="brand-heart" aria-hidden="true">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/seoully-heart-mark.png" alt="" draggable={false} />
      </span>
    </span>
  );
}
