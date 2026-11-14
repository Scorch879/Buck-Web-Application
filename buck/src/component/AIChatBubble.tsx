"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { animate, motion, useMotionValue, useReducedMotion, type Transition } from "framer-motion";
import { FaCommentDots } from "react-icons/fa";
import AIChat, { ADVISOR_CHAT_IDS } from "@/component/AIChat";
import "./AIChatBubble.css";

/** Any page can open the chat with `window.dispatchEvent(new Event(OPEN_AI_CHAT_EVENT))`. */
export const OPEN_AI_CHAT_EVENT = "open-ai-chat";

const STORAGE_KEY = "buck.aiChatBubble.position";
const SIZE_KEY = "buck.aiChatBubble.size";
const PANEL_ID = "ai-chat-panel";
const SIZE = 58; // bubble diameter (px)
const MARGIN = 16; // gap to the viewport edges and sticky chrome
const PANEL_GAP = 12; // gap between bubble and panel
const PANEL_W = 380; // default panel width (px)
const PANEL_MAX_H = 560; // default panel height cap: min(70vh, 560px)
const PANEL_MIN_W = 300;
const PANEL_MIN_H = 360;
const PANEL_MAX_W = 720;
const TAP_SLOP = 6; // pointer travel below this is a tap, not a drag
const NUDGE = 24; // arrow-key step (Shift: x4)
const MOBILE_QUERY = "(max-width: 767px)";

type Side = "left" | "right";
interface StoredPosition {
  side: Side;
  /** Bubble top as a fraction of the viewport height. */
  y: number;
}

interface DragState {
  pointerId: number;
  startX: number;
  startY: number;
  originX: number;
  originY: number;
  dragging: boolean;
}

interface PanelSize {
  w: number;
  h: number;
}

interface ResizeState {
  pointerId: number;
  startX: number;
  startY: number;
  startW: number;
  startH: number;
}

function readStoredSize(): PanelSize | null {
  try {
    const raw = window.localStorage.getItem(SIZE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PanelSize>;
    if (Number.isFinite(parsed.w) && Number.isFinite(parsed.h)) {
      return { w: Number(parsed.w), h: Number(parsed.h) };
    }
  } catch {
    // Storage blocked or corrupt: use the default size.
  }
  return null;
}

function writeStoredSize(size: PanelSize) {
  try {
    window.localStorage.setItem(SIZE_KEY, JSON.stringify(size));
  } catch {
    // Private mode or blocked storage: the size just won't persist.
  }
}

function readStoredPosition(): StoredPosition | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (
      parsed &&
      typeof parsed === "object" &&
      ((parsed as StoredPosition).side === "left" || (parsed as StoredPosition).side === "right") &&
      typeof (parsed as StoredPosition).y === "number" &&
      Number.isFinite((parsed as StoredPosition).y)
    ) {
      return parsed as StoredPosition;
    }
  } catch {
    // Storage blocked or corrupt: fall back to the default corner.
  }
  return null;
}

function writeStoredPosition(position: StoredPosition) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(position));
  } catch {
    // Private mode or blocked storage: the position just won't persist.
  }
}

/**
 * Vertical room for the bubble: below any sticky bar spanning the content
 * (mobile header, desktop top bar) and above the bottom edge.
 */
function verticalBounds() {
  let top = MARGIN;
  for (const selector of [".dashboard-header", ".dashboard-topbar"]) {
    const el = document.querySelector(selector);
    if (!el) continue;
    const position = getComputedStyle(el).position;
    if (position !== "sticky" && position !== "fixed") continue;
    const rect = el.getBoundingClientRect();
    // The desktop sidebar is a column, not a bar across the top.
    if (rect.width < window.innerWidth * 0.5 || rect.bottom <= 0) continue;
    top = Math.max(top, rect.bottom + MARGIN);
  }
  const bottom = window.innerHeight - SIZE - MARGIN;
  return { top: Math.min(top, bottom), bottom };
}

/**
 * Horizontal room for the bubble: the content column (.dashboard-main), not
 * the viewport, so it never slides under the desktop sidebar.
 */
function horizontalBounds() {
  const rect = document.querySelector(".dashboard-main")?.getBoundingClientRect();
  const hasMain = rect && rect.width > 0;
  const left = (hasMain ? rect.left : 0) + MARGIN;
  const right = (hasMain ? rect.right : window.innerWidth) - SIZE - MARGIN;
  return { left, right: Math.max(left, right) };
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const edgeX = (side: Side) => {
  const { left, right } = horizontalBounds();
  return side === "left" ? left : right;
};

/**
 * Messenger-style chat head for the AI Financial Advisor, mounted once in the
 * dashboard layout so the conversation survives page navigation. Drag it with
 * mouse, touch or pen (it snaps to the nearest side), tap it to open the chat
 * panel, or focus it and use the arrow keys to move it.
 */
export default function AIChatBubble() {
  const reduceMotion = useReducedMotion();
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const [ready, setReady] = useState(false);
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [side, setSide] = useState<Side>("right");
  const [panelStyle, setPanelStyle] = useState<CSSProperties>({});
  // True while the bubble is dragged with the chat open: the window folds
  // back into the bubble and unfolds again where the bubble lands.
  const [tucked, setTucked] = useState(false);
  const [resizing, setResizing] = useState(false);

  const bubbleRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const sideRef = useRef<Side>("right");
  const fractionRef = useRef<number | null>(null);
  const openRef = useRef(false);
  const dragRef = useRef<DragState | null>(null);
  const suppressClickRef = useRef(false);
  const frameRef = useRef(0);
  const pendingRef = useRef<{ x: number; y: number } | null>(null);
  // User-chosen panel size (desktop only); null = the default size.
  const sizeRef = useRef<PanelSize | null>(null);
  const resizeRef = useRef<ResizeState | null>(null);

  const spring: Transition = reduceMotion
    ? { duration: 0 }
    : { type: "spring", stiffness: 520, damping: 38, mass: 0.8 };

  /** Places the panel beside the bubble (desktop) or as a sheet (mobile). */
  const layoutPanel = useCallback(() => {
    const { top: minTop } = verticalBounds();
    const bubbleY = y.get();
    const currentSide = sideRef.current;
    const originY = bubbleY + SIZE / 2;

    if (window.matchMedia(MOBILE_QUERY).matches) {
      const sheetTop = Math.max(8, minTop - MARGIN + 8);
      // left/right/bottom come from .ai-chat-panel--sheet (safe-area aware).
      setPanelStyle({
        top: sheetTop,
        transformOrigin: `${currentSide} ${Math.max(0, originY - sheetTop)}px`,
      });
      return;
    }

    // Room beside the bubble, inside the viewport.
    const { left, right } = horizontalBounds();
    const roomW =
      currentSide === "left"
        ? window.innerWidth - (left + SIZE + PANEL_GAP) - MARGIN
        : right - PANEL_GAP - MARGIN;
    const roomH = window.innerHeight - minTop - MARGIN;
    const chosen = sizeRef.current;
    const width = clamp(chosen?.w ?? PANEL_W, Math.min(PANEL_MIN_W, roomW), Math.min(PANEL_MAX_W, roomW));
    const height = clamp(
      chosen?.h ?? Math.min(window.innerHeight * 0.7, PANEL_MAX_H),
      Math.min(PANEL_MIN_H, roomH),
      roomH
    );
    const maxTop = window.innerHeight - height - MARGIN;
    // Bottom-align with the bubble, so the panel grows up and out of it.
    const top = clamp(bubbleY + SIZE - height, Math.min(minTop, maxTop), maxTop);
    // Beside the bubble, measured from the bubble's outer edge.
    const inset =
      currentSide === "left"
        ? left + SIZE + PANEL_GAP
        : window.innerWidth - right + PANEL_GAP;
    setPanelStyle({
      top,
      width,
      height,
      [currentSide]: inset,
      transformOrigin: `${currentSide} ${clamp(originY - top, 0, height)}px`,
    });
  }, [y]);

  /** Moves the bubble to a side and height (clamped), optionally persisting it. */
  const settle = useCallback(
    (nextSide: Side, nextY: number, persist: boolean, transition: Transition) => {
      const { top, bottom } = verticalBounds();
      const clampedY = clamp(nextY, top, bottom);
      sideRef.current = nextSide;
      fractionRef.current = clampedY / window.innerHeight;
      setSide(nextSide);
      void animate(x, edgeX(nextSide), transition);
      void animate(y, clampedY, transition);
      if (persist) writeStoredPosition({ side: nextSide, y: fractionRef.current });
    },
    [x, y]
  );

  // Initial position: the stored side and height, else bottom-right.
  useLayoutEffect(() => {
    sizeRef.current = readStoredSize();
    const stored = readStoredPosition();
    const { top, bottom } = verticalBounds();
    const nextSide = stored?.side ?? "right";
    const nextY = clamp(stored ? stored.y * window.innerHeight : bottom, top, bottom);
    sideRef.current = nextSide;
    fractionRef.current = stored ? nextY / window.innerHeight : null;
    setSide(nextSide);
    x.set(edgeX(nextSide));
    y.set(nextY);
    setIsMobile(window.matchMedia(MOBILE_QUERY).matches);
    setReady(true);
  }, [x, y]);

  // Re-clamp on resize and rotation, and when the content column changes
  // width (sidebar collapse/expand), keeping the side and relative height.
  useEffect(() => {
    let frame = 0;
    const reflow = () => {
      frame = 0;
      if (dragRef.current) return; // the drag owns the position until release
      const { top, bottom } = verticalBounds();
      const fraction = fractionRef.current;
      const nextY = fraction === null ? bottom : fraction * window.innerHeight;
      x.jump(edgeX(sideRef.current));
      y.jump(clamp(nextY, top, bottom));
      setIsMobile(window.matchMedia(MOBILE_QUERY).matches);
      if (openRef.current) layoutPanel();
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(reflow);
    };

    window.addEventListener("resize", schedule);
    window.addEventListener("orientationchange", schedule);
    const main = document.querySelector(".dashboard-main");
    const observer =
      main && typeof ResizeObserver !== "undefined" ? new ResizeObserver(schedule) : null;
    if (main) observer?.observe(main);

    return () => {
      cancelAnimationFrame(frame);
      observer?.disconnect();
      window.removeEventListener("resize", schedule);
      window.removeEventListener("orientationchange", schedule);
    };
  }, [layoutPanel, x, y]);

  useEffect(() => () => cancelAnimationFrame(frameRef.current), []);

  const openPanel = useCallback(() => {
    layoutPanel();
    openRef.current = true;
    setOpen(true);
    setUnread(false);
  }, [layoutPanel]);

  const closePanel = useCallback(() => {
    openRef.current = false;
    setOpen(false);
    bubbleRef.current?.focus();
  }, []);

  // Focus the question box once the panel is open.
  useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() => {
      document.getElementById(ADVISOR_CHAT_IDS.input)?.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [open]);

  // Escape closes (when focus is in the chat); a tap outside closes on phones.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.defaultPrevented) return;
      const active = document.activeElement;
      if (
        active === document.body ||
        active === bubbleRef.current ||
        panelRef.current?.contains(active)
      ) {
        e.preventDefault();
        closePanel();
      }
    };
    const onPointerDown = (e: PointerEvent) => {
      if (!window.matchMedia(MOBILE_QUERY).matches) return;
      const target = e.target as Node | null;
      if (panelRef.current?.contains(target) || bubbleRef.current?.contains(target)) return;
      closePanel();
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open, closePanel]);

  // Other pages (e.g. the Advisor's "Ask the Advisor about this") can open it.
  useEffect(() => {
    const onOpen = () => openPanel();
    window.addEventListener(OPEN_AI_CHAT_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_AI_CHAT_EVENT, onOpen);
  }, [openPanel]);

  const onReplyDone = useCallback(() => {
    if (!openRef.current) setUnread(true);
  }, []);

  const onPointerDown = (e: ReactPointerEvent<HTMLButtonElement>) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    suppressClickRef.current = false;
    x.stop();
    y.stop();
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      originX: x.get(),
      originY: y.get(),
      dragging: false,
    };
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;
    if (!drag.dragging) {
      if (Math.hypot(dx, dy) < TAP_SLOP) return;
      drag.dragging = true;
      setDragging(true);
      if (openRef.current) setTucked(true);
    }
    pendingRef.current = { x: drag.originX + dx, y: drag.originY + dy };
    if (!frameRef.current) {
      frameRef.current = requestAnimationFrame(() => {
        frameRef.current = 0;
        const next = pendingRef.current;
        if (!next) return;
        const { left, right } = horizontalBounds();
        x.set(clamp(next.x, left, right));
        y.set(clamp(next.y, MARGIN, window.innerHeight - SIZE - MARGIN));
      });
    }
  };

  const endDrag = (e: ReactPointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    dragRef.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    if (!drag.dragging) return; // a tap: the click handler opens the chat

    // A drag never opens the chat.
    suppressClickRef.current = true;
    setDragging(false);
    cancelAnimationFrame(frameRef.current);
    frameRef.current = 0;
    const final = pendingRef.current ?? { x: x.get(), y: y.get() };
    pendingRef.current = null;
    const { left, right } = horizontalBounds();
    const nextSide: Side = final.x < (left + right) / 2 ? "left" : "right";
    settle(nextSide, final.y, true, spring);
    if (openRef.current) {
      // Let the snap land, then unfold the chat from the bubble's new spot.
      window.setTimeout(() => {
        layoutPanel();
        setTucked(false);
      }, reduceMotion ? 0 : 260);
    }
  };

  // Resize from the panel's free top corner (desktop). The panel stays
  // bottom-aligned with the bubble, so it grows up and away from it.
  const onResizeDown = (e: ReactPointerEvent<HTMLButtonElement>) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    const rect = panelRef.current?.getBoundingClientRect();
    if (!rect) return;
    e.preventDefault();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Pointer already gone: the resize still follows moves over the handle.
    }
    resizeRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      startW: rect.width,
      startH: rect.height,
    };
    setResizing(true);
  };

  const onResizeMove = (e: ReactPointerEvent<HTMLButtonElement>) => {
    const resize = resizeRef.current;
    if (!resize || resize.pointerId !== e.pointerId) return;
    const dx = e.clientX - resize.startX;
    const dy = e.clientY - resize.startY;
    sizeRef.current = {
      w: resize.startW + (sideRef.current === "right" ? -dx : dx),
      h: resize.startH - dy,
    };
    layoutPanel(); // clamps to the room available
  };

  const saveSize = () => {
    window.requestAnimationFrame(() => {
      const rect = panelRef.current?.getBoundingClientRect();
      if (!rect) return;
      sizeRef.current = { w: Math.round(rect.width), h: Math.round(rect.height) };
      writeStoredSize(sizeRef.current);
    });
  };

  const onResizeEnd = (e: ReactPointerEvent<HTMLButtonElement>) => {
    const resize = resizeRef.current;
    if (!resize || resize.pointerId !== e.pointerId) return;
    resizeRef.current = null;
    setResizing(false);
    saveSize();
  };

  // Keyboard resizing for the handle: arrows grow or shrink by 24px.
  const onResizeKey = (e: ReactKeyboardEvent<HTMLButtonElement>) => {
    const rect = panelRef.current?.getBoundingClientRect();
    if (!rect) return;
    const step = e.shiftKey ? NUDGE * 4 : NUDGE;
    const outward = sideRef.current === "right" ? -1 : 1;
    let w = rect.width;
    let h = rect.height;
    if (e.key === "ArrowUp") h += step;
    else if (e.key === "ArrowDown") h -= step;
    else if (e.key === "ArrowLeft") w -= step * outward;
    else if (e.key === "ArrowRight") w += step * outward;
    else return;
    e.preventDefault();
    sizeRef.current = { w, h };
    layoutPanel();
    saveSize();
  };

  const onClick = () => {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
    if (openRef.current) closePanel();
    else openPanel();
  };

  // Keyboard alternative to dragging: Up/Down move, Left/Right switch sides.
  const onKeyDown = (e: ReactKeyboardEvent<HTMLButtonElement>) => {
    const step = e.shiftKey ? NUDGE * 4 : NUDGE;
    let nextSide = sideRef.current;
    let nextY = y.get();
    switch (e.key) {
      case "ArrowUp":
        nextY -= step;
        break;
      case "ArrowDown":
        nextY += step;
        break;
      case "ArrowLeft":
        nextSide = "left";
        break;
      case "ArrowRight":
        nextSide = "right";
        break;
      default:
        return;
    }
    e.preventDefault();
    settle(nextSide, nextY, true, spring);
    if (openRef.current) window.setTimeout(layoutPanel, reduceMotion ? 0 : 260);
  };

  const panelHidden = { opacity: 0, scale: reduceMotion ? 1 : 0.4, transitionEnd: { visibility: "hidden" as const } };
  const panelShown = { opacity: 1, scale: 1, visibility: "visible" as const };

  return (
    <>
      {isMobile ? (
        <motion.div
          className="ai-chat-backdrop"
          aria-hidden="true"
          initial={false}
          animate={open ? { opacity: 1, visibility: "visible" } : { opacity: 0, transitionEnd: { visibility: "hidden" } }}
          transition={{ duration: reduceMotion ? 0 : 0.18 }}
        />
      ) : null}

      <motion.div
        ref={panelRef}
        id={PANEL_ID}
        role="dialog"
        aria-label="AI Advisor chat"
        className={`ai-chat-panel${isMobile ? " ai-chat-panel--sheet" : ""}${resizing ? " ai-chat-panel--resizing" : ""}`}
        data-side={side}
        style={panelStyle}
        initial={false}
        animate={open && !tucked ? panelShown : panelHidden}
        transition={
          reduceMotion
            ? { duration: 0 }
            : open
              ? { type: "spring", stiffness: 420, damping: 34, mass: 0.9 }
              : { duration: 0.16, ease: "easeIn" }
        }
        inert={!open || tucked}
      >
        {!isMobile ? (
          <button
            type="button"
            className="ai-chat-panel__resize"
            aria-label="Resize the chat window. Drag, or use the arrow keys."
            title="Drag to resize"
            onPointerDown={onResizeDown}
            onPointerMove={onResizeMove}
            onPointerUp={onResizeEnd}
            onPointerCancel={onResizeEnd}
            onKeyDown={onResizeKey}
          />
        ) : null}
        <AIChat variant="panel" onClose={closePanel} onReplyDone={onReplyDone} />
      </motion.div>

      <motion.button
        ref={bubbleRef}
        type="button"
        className={`ai-bubble${dragging ? " ai-bubble--dragging" : ""}${open ? " ai-bubble--open" : ""}`}
        style={{ x, y, opacity: ready ? 1 : 0 }}
        data-side={side}
        aria-label={unread ? "Ask the AI Advisor (new reply)" : "Ask the AI Advisor"}
        aria-expanded={open}
        aria-controls={PANEL_ID}
        aria-keyshortcuts="ArrowUp ArrowDown ArrowLeft ArrowRight"
        title="Ask the AI Advisor. Drag to move, or use the arrow keys."
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onClick={onClick}
        onKeyDown={onKeyDown}
        whileTap={reduceMotion || dragging ? undefined : { scale: 0.94 }}
      >
        <FaCommentDots aria-hidden="true" />
        {unread ? <span className="ai-bubble__badge" aria-hidden="true" /> : null}
      </motion.button>
    </>
  );
}
