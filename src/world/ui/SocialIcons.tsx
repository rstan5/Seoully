export function IconHome({ filled = false }: { filled?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
      {filled ? (
        <path fill="currentColor" d="M12 3.2 3 11h2v9h6v-6h2v6h6v-9h2L12 3.2Z" />
      ) : (
        <path
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinejoin="round"
          d="M4.5 11.2 12 4.8l7.5 6.4V20a1 1 0 0 1-1 1h-4.2v-6.2H9.7V21H5.5a1 1 0 0 1-1-1v-8.8Z"
        />
      )}
    </svg>
  );
}

export function IconSearch() {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
      <circle cx="11" cy="11" r="6.2" fill="none" stroke="currentColor" strokeWidth="1.7" />
      <path d="M15.8 15.8 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

export function IconPlus() {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
      <rect x="4.4" y="4.4" width="15.2" height="15.2" rx="4" fill="none" stroke="currentColor" strokeWidth="1.7" />
      <path d="M12 8.2v7.6M8.2 12h7.6" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

export function IconChat({ filled = false }: { filled?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
      <path
        d="M5.2 18.6 4 21l3.2-.9A8.8 8.8 0 1 0 5.2 18.6Z"
        fill={filled ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function IconUser({ filled = false }: { filled?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
      <circle cx="12" cy="8.2" r="3.2" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.7" />
      <path
        d="M5.4 19.4c.8-3.2 3.3-5 6.6-5s5.8 1.8 6.6 5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function IconBell() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
      <path
        d="M6.4 16.6h11.2L16.4 15v-3.4a4.4 4.4 0 1 0-8.8 0V15L6.4 16.6Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path d="M10 18.4a2 2 0 0 0 4 0" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

export function IconHeart({ filled = false }: { filled?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
      <path
        d="M12 20s-7.2-4.4-9-8.6C1.6 8.2 3.3 5 6.6 5c2 0 3.4 1.2 4.4 2.6C12 6.2 13.4 5 15.4 5c3.3 0 5 3.2 3.6 6.4C19.2 15.6 12 20 12 20Z"
        fill={filled ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function IconComment() {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
      <path
        d="M5 18.2 4.2 21l3.4-1A8.4 8.4 0 1 0 5 18.2Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function IconShare() {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
      <path
        d="M7.4 10.4 12 6l4.6 4.4M12 6.4V16"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M5.4 14.8V18a1.4 1.4 0 0 0 1.4 1.4h10.4A1.4 1.4 0 0 0 18.6 18v-3.2" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

export function IconRepost() {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
      <path
        d="M7.4 4.2h11.4v8.2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="miter"
      />
      <path
        d="M16.6 10.2 18.8 12.6 21 10.2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="miter"
      />
      <path
        d="M16.6 19.8H5.2V11.6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="miter"
      />
      <path
        d="M7.4 13.8 5.2 11.4 3 13.8"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="miter"
      />
    </svg>
  );
}

export function IconBookmark({ filled = false }: { filled?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
      <path
        d="M7 4.8h10a1 1 0 0 1 1 1V19l-6-3.4L6 19V5.8a1 1 0 0 1 1-1Z"
        fill={filled ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function IconDoor() {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
      <path
        d="M6.4 20V5.6A1.6 1.6 0 0 1 8 4h8a1.6 1.6 0 0 1 1.6 1.6V20"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path d="M5 20h14" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M14.6 12.2h.2" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

export function IconPhoto() {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
      <rect
        x="4.2"
        y="6.2"
        width="15.6"
        height="11.6"
        rx="2.2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
      />
      <circle cx="9" cy="11" r="1.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M7.2 16.2 10.4 13l2.2 2.1 2.4-2.8 3.6 3.7"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function IconCard() {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
      <rect
        x="6.2"
        y="4.6"
        width="11.6"
        height="14.8"
        rx="2.2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
      />
      <path d="M8.6 8.2h6.8M8.6 11.2h4.6" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

export function IconGroup() {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
      <circle cx="9" cy="8.4" r="2.6" fill="none" stroke="currentColor" strokeWidth="1.7" />
      <circle cx="15.4" cy="8.8" r="2.2" fill="none" stroke="currentColor" strokeWidth="1.7" />
      <path
        d="M4.8 18.6c.7-3 2.8-4.6 5.6-4.6s4.9 1.6 5.6 4.6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
      <path
        d="M14.2 14.4c1.6.2 3.2 1.2 3.8 3.2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function IconPlay() {
  return (
    <svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true">
      <circle cx="12" cy="12" r="11" fill="rgba(0,0,0,0.45)" />
      <path d="M10 8.2 16.4 12 10 15.8V8.2Z" fill="#fff" />
    </svg>
  );
}
