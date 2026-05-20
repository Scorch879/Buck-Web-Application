import { useRef, useState } from "react";
import type { MouseEvent } from "react";

type PointerPosition = {
  x: number;
  y: number;
};

export function usePointerGradient<TElement extends HTMLElement>() {
  const ref = useRef<TElement>(null);
  const [pointer, setPointer] = useState<PointerPosition | null>(null);

  const handlePointerMove = (event: MouseEvent<TElement>) => {
    const bounds = ref.current?.getBoundingClientRect();
    if (!bounds) return;

    setPointer({
      x: event.clientX - bounds.left,
      y: event.clientY - bounds.top,
    });
  };

  return {
    ref,
    pointer,
    handlePointerMove,
    handlePointerLeave: () => setPointer(null),
  };
}
