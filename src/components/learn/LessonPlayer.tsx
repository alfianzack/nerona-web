"use client";

import { useEffect, useRef, useState } from "react";
import Player from "@vimeo/player";

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
      {completed && <p className="mt-2 text-sm text-emerald-400">✓ Selesai</p>}
    </div>
  );
}
