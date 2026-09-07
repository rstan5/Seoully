"use client";

import { Room } from "@/world/Room";
import { useWorld } from "@/world/store/worldStore";

export default function Page() {
  const roomId = useWorld((s) => s.roomId);
  return (
    <main>
      <Room roomId={roomId} />
    </main>
  );
}
