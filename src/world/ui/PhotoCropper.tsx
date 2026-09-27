"use client";

import { useRef, useState } from "react";
import { CARD_RATIO } from "@/world/objects/Photocard";

interface PhotoCropperProps {
  src: string;
  onConfirm: (croppedDataUrl: string) => void;
  onBack: () => void;
}

/** Small, touch-friendly crop surface for personal photocard media. */
export function PhotoCropper({ src, onConfirm, onBack }: PhotoCropperProps) {
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);

  const confirm = () => {
    const image = new Image();
    image.onload = () => {
      const width = 660;
      const height = Math.round(width / CARD_RATIO);
      const sourceRatio = image.naturalWidth / image.naturalHeight;
      const cropRatio = CARD_RATIO;
      let cropWidth = image.naturalWidth;
      let cropHeight = image.naturalHeight;
      if (sourceRatio > cropRatio) cropWidth = image.naturalHeight * cropRatio;
      else cropHeight = image.naturalWidth / cropRatio;
      const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight) * zoom;
      const sourceShiftX = offset.x / scale;
      const sourceShiftY = offset.y / scale;
      const sx = Math.max(0, Math.min(image.naturalWidth - cropWidth, (image.naturalWidth - cropWidth) / 2 - sourceShiftX));
      const sy = Math.max(0, Math.min(image.naturalHeight - cropHeight, (image.naturalHeight - cropHeight) / 2 - sourceShiftY));
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(image, sx, sy, cropWidth, cropHeight, 0, 0, width, height);
      onConfirm(canvas.toDataURL("image/jpeg", 0.9));
    };
    image.src = src;
  };

  return (
    <section aria-label="Crop photocard" className="photo-cropper">
      <div
        className="photo-cropper-frame"
        style={{ aspectRatio: String(CARD_RATIO) }}
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId);
          drag.current = { x: event.clientX, y: event.clientY, ox: offset.x, oy: offset.y };
        }}
        onPointerMove={(event) => {
          if (!drag.current) return;
          setOffset({ x: drag.current.ox + event.clientX - drag.current.x, y: drag.current.oy + event.clientY - drag.current.y });
        }}
        onPointerUp={() => { drag.current = null; }}
        onPointerCancel={() => { drag.current = null; }}
      >
        <img src={src} alt="Selected photocard" style={{ transform: `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px)) scale(${zoom})` }} />
      </div>
      <label className="photo-cropper-zoom">Zoom<input type="range" min="1" max="2.5" step="0.05" value={zoom} onChange={(event) => setZoom(Number(event.target.value))} /></label>
      <div className="onboard-actions">
        <button type="button" className="onboard-btn" onClick={confirm}>Confirm Crop</button>
        <button type="button" className="onboard-btn is-ghost" onClick={onBack}>Back</button>
      </div>
    </section>
  );
}
