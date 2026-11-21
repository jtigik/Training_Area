"use client";

import { useEffect, useRef } from "react";

/**
 * Calls `onPoll` every `intervalMs` while `enabled` and the tab is visible
 * (Page Visibility API). Hidden tab: the timer is paused. Visible again: polls
 * once right away and restarts the timer. Everything is cleaned up on unmount.
 */
export function useVisibilityPolling(onPoll: () => void, intervalMs: number, enabled: boolean) {
  const pollRef = useRef(onPoll);
  useEffect(() => {
    pollRef.current = onPoll;
  });

  useEffect(() => {
    if (!enabled || typeof document === "undefined") return;
    let timer: ReturnType<typeof setInterval> | null = null;
    const stop = () => {
      if (timer !== null) clearInterval(timer);
      timer = null;
    };
    const start = () => {
      stop();
      timer = setInterval(() => pollRef.current(), intervalMs);
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        pollRef.current();
        start();
      } else {
        stop();
      }
    };
    if (document.visibilityState === "visible") start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [enabled, intervalMs]);
}
