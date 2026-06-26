/**
 * Touch Scroll Module for SocialCalc
 * 
 * Replaces the default "page-jump on swipe" behavior with smooth,
 * continuous scrolling while the finger moves, plus momentum/inertia
 * scrolling on release — similar to native mobile scroll.
 *
 * Both vertical and horizontal scrolling are supported. Scroll events
 * are batched via requestAnimationFrame so at most one re-render
 * occurs per frame (~60fps), preventing excessive DOM thrashing.
 *
 * Usage:
 *   import { enableTouchScroll, disableTouchScroll } from './touch-scroll.js';
 *   enableTouchScroll();   // call after SocialCalc is initialized
 *   disableTouchScroll();  // call on cleanup / unmount
 */

const SocialCalc = new Proxy({}, {
  get: (target, prop) => {
    const sc = typeof window !== "undefined" && window.SocialCalc 
      ? window.SocialCalc 
      : (typeof global !== "undefined" && global.SocialCalc ? global.SocialCalc : null);
    if (sc) {
      const val = sc[prop];
      if (typeof val === "function") {
        return val.bind(sc);
      }
      return val;
    }
    return undefined;
  },
  set: (target, prop, value) => {
    const sc = typeof window !== "undefined" && window.SocialCalc 
      ? window.SocialCalc 
      : (typeof global !== "undefined" && global.SocialCalc ? global.SocialCalc : null);
    if (sc) {
      sc[prop] = value;
      return true;
    }
    return false;
  }
});

// ─── Configuration ───────────────────────────────────────────────────────────
const TOUCH_SCROLL_CONFIG = {
    scrollDeadzone: 8,
    pixelsPerRow: 36,
    pixelsPerCol: 50,

    momentumEnabled: true,
    momentumFriction: 0.92,
    momentumMinVelocity: 0.3,
    momentumFrameInterval: 16,
    maxMomentumStep: 4,

    velocitySampleWindow: 100,

    doubleTapMaxGap: 400,
};

// ─── State ───────────────────────────────────────────────────────────────────
let _enabled = false;
let _origProcessTouchStart = null;
let _origProcessTouchMove = null;
let _origProcessTouchEnd = null;
let _origProcessTouchCancel = null;

const _gesture = {
    active: false,
    isScrolling: false,
    startX: 0,
    startY: 0,
    lastX: 0,
    lastY: 0,

    // Cached editor for the current gesture
    editor: null,

    // Fractional debt accumulated from finger movement
    rowDebt: 0,
    colDebt: 0,

    // rAF-based scroll loop
    scrollRAF: null,

    // Velocity tracking
    velocitySamples: [],

    // Momentum animation
    momentumRAF: null,
    momentumVY: 0,
    momentumVX: 0,

    // Tap detection
    startTime: 0,
    lastTapTime: 0,
    tapTimeout: null,
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getEditor() {
    if (SocialCalc.GetCurrentWorkBookControl) {
        const ctrl = SocialCalc.GetCurrentWorkBookControl();
        if (ctrl && ctrl.workbook && ctrl.workbook.spreadsheet && ctrl.workbook.spreadsheet.editor) {
            return ctrl.workbook.spreadsheet.editor;
        }
    }
    const touchinfo = SocialCalc.TouchInfo;
    if (touchinfo && touchinfo.registeredElements) {
        for (const re of touchinfo.registeredElements) {
            if (re.functionobj && re.functionobj.editor) {
                return re.functionobj.editor;
            }
        }
    }
    return null;
}

function getCachedEditor() {
    if (_gesture.editor) return _gesture.editor;
    _gesture.editor = getEditor();
    return _gesture.editor;
}

function editorCanScroll(editor) {
    if (!editor) return false;
    if (editor.busy) return false;
    if (editor.state !== "start") return false;
    return true;
}

function cancelMomentum() {
    if (_gesture.momentumRAF) {
        cancelAnimationFrame(_gesture.momentumRAF);
        _gesture.momentumRAF = null;
    }
    _gesture.momentumVY = 0;
    _gesture.momentumVX = 0;
}

function cancelScrollRAF() {
    if (_gesture.scrollRAF) {
        cancelAnimationFrame(_gesture.scrollRAF);
        _gesture.scrollRAF = null;
    }
}

function addVelocitySample(dx, dy) {
    const now = performance.now();
    _gesture.velocitySamples.push({ t: now, dx, dy });
    const cutoff = now - TOUCH_SCROLL_CONFIG.velocitySampleWindow;
    while (_gesture.velocitySamples.length > 0 && _gesture.velocitySamples[0].t < cutoff) {
        _gesture.velocitySamples.shift();
    }
}

function computeVelocity() {
    const samples = _gesture.velocitySamples;
    if (samples.length < 2) return { vx: 0, vy: 0 };

    const first = samples[0];
    const last = samples[samples.length - 1];
    const dt = last.t - first.t;
    if (dt === 0) return { vx: 0, vy: 0 };

    let totalDX = 0;
    let totalDY = 0;
    for (const s of samples) {
        totalDX += s.dx;
        totalDY += s.dy;
    }

    const pxPerMsY = totalDY / dt;
    const pxPerMsX = totalDX / dt;

    return {
        vy: (pxPerMsY / TOUCH_SCROLL_CONFIG.pixelsPerRow) * TOUCH_SCROLL_CONFIG.momentumFrameInterval,
        vx: (pxPerMsX / TOUCH_SCROLL_CONFIG.pixelsPerCol) * TOUCH_SCROLL_CONFIG.momentumFrameInterval,
    };
}

/**
 * Execute a scroll by the given integer row/col delta.
 * Calls SocialCalc's ScrollRelativeBoth which triggers a single sheet re-render.
 */
function doScroll(editor, rowDelta, colDelta) {
    if (rowDelta === 0 && colDelta === 0) return;
    if (!editorCanScroll(editor)) return;

    if (editor.ScrollRelativeBoth) {
        editor.ScrollRelativeBoth(rowDelta, colDelta);
    } else if (SocialCalc.ScrollRelativeBoth) {
        SocialCalc.ScrollRelativeBoth(editor, rowDelta, colDelta);
    }
}

/**
 * Flush accumulated scroll debt. Called via rAF so at most once per frame.
 */
function flushScrollDebt() {
    const rowStep = Math.trunc(_gesture.rowDebt);
    const colStep = Math.trunc(_gesture.colDebt);

    if (rowStep === 0 && colStep === 0) {
        _gesture.scrollRAF = null;
        return;
    }

    const editor = getCachedEditor();
    if (!editorCanScroll(editor)) {
        // Editor busy — try again next frame
        _gesture.scrollRAF = requestAnimationFrame(flushScrollDebt);
        return;
    }

    _gesture.rowDebt -= rowStep;
    _gesture.colDebt -= colStep;

    doScroll(editor, rowStep, colStep);

    // If there's still fractional debt remaining, schedule another tick
    if (Math.abs(_gesture.rowDebt) >= 0.5 || Math.abs(_gesture.colDebt) >= 0.5) {
        _gesture.scrollRAF = requestAnimationFrame(flushScrollDebt);
    } else {
        _gesture.scrollRAF = null;
    }
}

function scheduleScrollTick() {
    if (_gesture.scrollRAF) return; // already scheduled
    _gesture.scrollRAF = requestAnimationFrame(flushScrollDebt);
}

function clearGestureState() {
    _gesture.active = false;
    _gesture.isScrolling = false;
    _gesture.editor = null;
    _gesture.rowDebt = 0;
    _gesture.colDebt = 0;
}

// ─── Replacement Touch Handlers ──────────────────────────────────────────────

function handleTouchStart(event) {
    if (event.touches.length !== 1) return;

    const touch = event.touches[0];

    cancelMomentum();
    cancelScrollRAF();

    _gesture.active = true;
    _gesture.isScrolling = false;
    _gesture.editor = null;
    _gesture.startX = touch.pageX;
    _gesture.startY = touch.pageY;
    _gesture.lastX = touch.pageX;
    _gesture.lastY = touch.pageY;
    _gesture.rowDebt = 0;
    _gesture.colDebt = 0;
    _gesture.velocitySamples = [];
    _gesture.startTime = performance.now();
}

function handleTouchMove(event) {
    if (!_gesture.active) return;
    if (event.touches.length !== 1) return;

    const touch = event.touches[0];
    const dx = _gesture.lastX - touch.pageX;   // positive = finger left  → scroll right
    const dy = _gesture.lastY - touch.pageY;   // positive = finger up    → scroll down

    // Deadzone: wait for enough movement to start scrolling
    if (!_gesture.isScrolling) {
        const totalDY = Math.abs(touch.pageY - _gesture.startY);
        const totalDX = Math.abs(touch.pageX - _gesture.startX);
        const totalDist = Math.sqrt(totalDX * totalDX + totalDY * totalDY);
        if (totalDist < TOUCH_SCROLL_CONFIG.scrollDeadzone) {
            return;
        }
        _gesture.isScrolling = true;
    }

    event.preventDefault();
    event.stopPropagation();

    addVelocitySample(dx, dy);

    // Accumulate fractional debt for both axes
    _gesture.rowDebt += dy / TOUCH_SCROLL_CONFIG.pixelsPerRow;
    _gesture.colDebt += dx / TOUCH_SCROLL_CONFIG.pixelsPerCol;

    // Schedule a single rAF tick to flush both debts
    scheduleScrollTick();

    _gesture.lastX = touch.pageX;
    _gesture.lastY = touch.pageY;
}

function handleTouchEnd(event) {
    if (!_gesture.active) return;
    _gesture.active = false;

    const elapsed = performance.now() - _gesture.startTime;

    if (!_gesture.isScrolling) {
        cancelScrollRAF();
        clearGestureState();
        handleTap(event, elapsed);
        return;
    }

    // Flush any remaining fractional debt immediately
    cancelScrollRAF();
    const rowStep = Math.trunc(_gesture.rowDebt);
    const colStep = Math.trunc(_gesture.colDebt);
    if (rowStep !== 0 || colStep !== 0) {
        const editor = getCachedEditor();
        if (editor) {
            doScroll(editor, rowStep, colStep);
        }
    }
    _gesture.rowDebt = 0;
    _gesture.colDebt = 0;

    // ── Momentum ──
    if (!TOUCH_SCROLL_CONFIG.momentumEnabled) {
        clearGestureState();
        return;
    }

    const { vx, vy } = computeVelocity();

    if (Math.abs(vy) < TOUCH_SCROLL_CONFIG.momentumMinVelocity &&
        Math.abs(vx) < TOUCH_SCROLL_CONFIG.momentumMinVelocity) {
        clearGestureState();
        return;
    }

    _gesture.momentumVY = vy;
    _gesture.momentumVX = vx;

    let rowAccum = 0;
    let colAccum = 0;

    function momentumTick() {
        _gesture.momentumVY *= TOUCH_SCROLL_CONFIG.momentumFriction;
        _gesture.momentumVX *= TOUCH_SCROLL_CONFIG.momentumFriction;

        if (Math.abs(_gesture.momentumVY) < TOUCH_SCROLL_CONFIG.momentumMinVelocity &&
            Math.abs(_gesture.momentumVX) < TOUCH_SCROLL_CONFIG.momentumMinVelocity) {
            _gesture.momentumRAF = null;
            clearGestureState();
            return;
        }

        rowAccum += _gesture.momentumVY;
        colAccum += _gesture.momentumVX;

        let rowStep = Math.trunc(rowAccum);
        let colStep = Math.trunc(colAccum);

        const max = TOUCH_SCROLL_CONFIG.maxMomentumStep;
        rowStep = Math.max(-max, Math.min(max, rowStep));
        colStep = Math.max(-max, Math.min(max, colStep));

        if (rowStep !== 0 || colStep !== 0) {
            const editor = getCachedEditor();
            if (editor) {
                doScroll(editor, rowStep, colStep);
            }
            rowAccum -= rowStep;
            colAccum -= colStep;
        }

        _gesture.momentumRAF = requestAnimationFrame(momentumTick);
    }

    _gesture.momentumRAF = requestAnimationFrame(momentumTick);
}

function handleTouchCancel() {
    cancelMomentum();
    cancelScrollRAF();
    clearGestureState();
}

// ─── Tap / Double-Tap Detection ──────────────────────────────────────────────

function handleTap(event, elapsed) {
    const now = performance.now();
    const touchinfo = SocialCalc.TouchInfo;
    const wobj = SocialCalc.FindTouchElement
        ? SocialCalc.FindTouchElement(event)
        : null;

    if (!wobj) return;

    if (_gesture.lastTapTime &&
        (now - _gesture.lastTapTime) < TOUCH_SCROLL_CONFIG.doubleTapMaxGap) {
        _gesture.lastTapTime = 0;
        if (wobj.functionobj && wobj.functionobj.DoubleTap) {
            wobj.functionobj.DoubleTap(event, touchinfo, wobj);
        }
        return;
    }

    _gesture.lastTapTime = now;

    if (_gesture.tapTimeout) clearTimeout(_gesture.tapTimeout);
    _gesture.tapTimeout = setTimeout(() => {
        if (wobj.functionobj && wobj.functionobj.SingleTap) {
            wobj.functionobj.SingleTap(event, touchinfo, wobj);
        }
        _gesture.tapTimeout = null;
    }, TOUCH_SCROLL_CONFIG.doubleTapMaxGap);
}

// ─── Public API ──────────────────────────────────────────────────────────────

export function enableTouchScroll() {
    if (_enabled) return;
    if (!SocialCalc || !SocialCalc.HasTouch) {
        return;
    }

    _origProcessTouchStart = SocialCalc.ProcessTouchStart;
    _origProcessTouchMove = SocialCalc.ProcessTouchMove;
    _origProcessTouchEnd = SocialCalc.ProcessTouchEnd;
    _origProcessTouchCancel = SocialCalc.ProcessTouchCancel;

    SocialCalc.ProcessTouchStart = handleTouchStart;
    SocialCalc.ProcessTouchMove = handleTouchMove;
    SocialCalc.ProcessTouchEnd = handleTouchEnd;
    SocialCalc.ProcessTouchCancel = handleTouchCancel;

    const touchinfo = SocialCalc.TouchInfo;
    if (touchinfo && touchinfo.registeredElements) {
        for (const re of touchinfo.registeredElements) {
            const el = re.element;
            if (!el || !el.removeEventListener) continue;

            el.removeEventListener("touchstart", _origProcessTouchStart, false);
            el.removeEventListener("touchmove", _origProcessTouchMove, false);
            el.removeEventListener("touchend", _origProcessTouchEnd, false);
            el.removeEventListener("touchcancel", _origProcessTouchCancel, false);

            el.removeEventListener("touchstart", _origProcessTouchStart, true);
            el.removeEventListener("touchmove", _origProcessTouchMove, true);

            el.addEventListener("touchstart", handleTouchStart, { passive: true });
            el.addEventListener("touchmove", handleTouchMove, { passive: false });
            el.addEventListener("touchend", handleTouchEnd, { passive: true });
            el.addEventListener("touchcancel", handleTouchCancel, { passive: true });
        }
    }

    _enabled = true;
    console.log("[TouchScroll] Smooth touch scrolling enabled (v + h)");
}

export function disableTouchScroll() {
    if (!_enabled) return;

    cancelMomentum();
    cancelScrollRAF();
    if (_gesture.tapTimeout) {
        clearTimeout(_gesture.tapTimeout);
        _gesture.tapTimeout = null;
    }

    SocialCalc.ProcessTouchStart = _origProcessTouchStart;
    SocialCalc.ProcessTouchMove = _origProcessTouchMove;
    SocialCalc.ProcessTouchEnd = _origProcessTouchEnd;
    SocialCalc.ProcessTouchCancel = _origProcessTouchCancel;

    const touchinfo = SocialCalc.TouchInfo;
    if (touchinfo && touchinfo.registeredElements) {
        for (const re of touchinfo.registeredElements) {
            const el = re.element;
            if (!el || !el.removeEventListener) continue;

            el.removeEventListener("touchstart", handleTouchStart);
            el.removeEventListener("touchmove", handleTouchMove);
            el.removeEventListener("touchend", handleTouchEnd);
            el.removeEventListener("touchcancel", handleTouchCancel);

            el.addEventListener("touchstart", _origProcessTouchStart, false);
            el.addEventListener("touchmove", _origProcessTouchMove, false);
            el.addEventListener("touchend", _origProcessTouchEnd, false);
            el.addEventListener("touchcancel", _origProcessTouchCancel, false);
        }
    }

    _enabled = false;
    console.log("[TouchScroll] Smooth touch scrolling disabled, originals restored");
}

export function configureTouchScroll(overrides) {
    Object.assign(TOUCH_SCROLL_CONFIG, overrides);
}
