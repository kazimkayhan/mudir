const POPOVER_WIDTH = 320;
const POPOVER_HEIGHT = 220;
const GAP = 12;
const MARGIN = 16;

export interface TargetRect {
  height: number;
  left: number;
  top: number;
  width: number;
}

export function computeTourPopoverStyle(rect: TargetRect | null): {
  left: number;
  maxWidth: number;
  top: number;
} {
  if (!rect) {
    return { left: MARGIN, maxWidth: POPOVER_WIDTH, top: MARGIN };
  }

  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const rtl = document.documentElement.dir === "rtl";
  const tallTarget = rect.height > vh * 0.45;

  let left = Math.max(MARGIN, Math.min(rect.left, vw - POPOVER_WIDTH - MARGIN));
  let top = rect.top + rect.height + GAP;

  if (top + POPOVER_HEIGHT > vh - MARGIN) {
    top = rect.top - POPOVER_HEIGHT - GAP;
  }

  if (top < MARGIN || tallTarget) {
    if (rtl) {
      left = Math.max(MARGIN, rect.left - POPOVER_WIDTH - GAP);
    } else {
      left = Math.min(
        vw - POPOVER_WIDTH - MARGIN,
        rect.left + rect.width + GAP
      );
    }
    top = Math.max(MARGIN, Math.min(rect.top, vh - POPOVER_HEIGHT - MARGIN));
  }

  if (left + POPOVER_WIDTH > vw - MARGIN) {
    left = Math.max(MARGIN, vw - POPOVER_WIDTH - MARGIN);
  }

  top = Math.max(MARGIN, Math.min(top, vh - POPOVER_HEIGHT - MARGIN));

  return { left, maxWidth: POPOVER_WIDTH, top };
}
