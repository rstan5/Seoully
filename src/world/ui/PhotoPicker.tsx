"use client";

import { useRef, type ChangeEvent } from "react";

interface PhotoPickerProps {
  onPhotoSelected: (file: File) => void;
  disabled?: boolean;
  className?: string;
  takeLabel?: string;
  libraryLabel?: string;
}

/** Shared, business-logic-free photo acquisition for mobile web and desktop. */
export function PhotoPicker({
  onPhotoSelected,
  disabled = false,
  className,
  takeLabel = "Take Photo",
  libraryLabel = "Choose from Library",
}: PhotoPickerProps) {
  const libraryRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const choose = (input: HTMLInputElement | null) => input?.click();
  const selected = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) onPhotoSelected(file);
  };

  return (
    <div className={className} role="group" aria-label="Choose a photo source">
      <div className="onboard-row photo-picker-actions">
        <button type="button" className="onboard-btn" disabled={disabled} onClick={() => choose(cameraRef.current)}>
          {takeLabel}
        </button>
        <button type="button" className="onboard-btn is-ghost" disabled={disabled} onClick={() => choose(libraryRef.current)}>
          {libraryLabel}
        </button>
      </div>
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" hidden onChange={selected} />
      <input ref={libraryRef} type="file" accept="image/*" hidden onChange={selected} />
    </div>
  );
}
