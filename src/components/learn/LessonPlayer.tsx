"use client";

import { useEffect, useRef, useState } from "react";
import Player from "@vimeo/player";
import { Icon } from "@/components/ui/icons";

interface LessonPlayerProps {
  lessonId: string;
  vimeoId: string;
  initiallyCompleted: boolean;
  onCompleted?: () => void;
}

export function LessonPlayer({
  lessonId,
  vimeoId,
  initiallyCompleted,
  onCompleted,
}: LessonPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [completed, setCompleted] = useState(initiallyCompleted);

  useEffect(() => {
    if (!containerRef.current) {
      return;
    }
    const player = new Player(containerRef.current, { id: vimeoId, responsive: true });

    async function handleEnded() {
      const res = await fetch(`/api/learn/lessons/${lessonId}/complete`, { method: "POST" });
      if (res.ok) {
        setCompleted(true);
        onCompleted?.();
      }
    }

    player.on("ended", handleEnded);

    return () => {
      player.off("ended", handleEnded);
      player.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lessonId, vimeoId]);

  return (
    <div>
      <div ref={containerRef} />
      {/* Centangnya dulu emoji hijau muda: bentuknya berbeda di tiap sistem
          operasi, dan langkah warnanya terlalu terang untuk dibaca di atas
          permukaan putih. Sekarang ikon plus token status. */}
      {completed && (
        <p className="mt-2 inline-flex items-center gap-1.5 text-caption text-success">
          <Icon name="check" className="h-3.5 w-3.5 flex-none" />
          Selesai
        </p>
      )}
    </div>
  );
}
