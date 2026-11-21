import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useVisibilityPolling } from "./use-visibility-polling";

let visibility: DocumentVisibilityState = "visible";

function setVisibility(v: DocumentVisibilityState) {
  visibility = v;
  document.dispatchEvent(new Event("visibilitychange"));
}

function Poller({ onPoll, enabled = true }: { onPoll: () => void; enabled?: boolean }) {
  useVisibilityPolling(onPoll, 30_000, enabled);
  return null;
}

describe("useVisibilityPolling", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    visibility = "visible";
    vi.spyOn(document, "visibilityState", "get").mockImplementation(() => visibility);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("polls every 30 s while visible", () => {
    const onPoll = vi.fn();
    render(<Poller onPoll={onPoll} />);
    act(() => void vi.advanceTimersByTime(29_999));
    expect(onPoll).not.toHaveBeenCalled();
    act(() => void vi.advanceTimersByTime(1));
    expect(onPoll).toHaveBeenCalledTimes(1);
    act(() => void vi.advanceTimersByTime(60_000));
    expect(onPoll).toHaveBeenCalledTimes(3);
  });

  it("pauses while hidden and checks right away when visible again", () => {
    const onPoll = vi.fn();
    render(<Poller onPoll={onPoll} />);
    act(() => setVisibility("hidden"));
    act(() => void vi.advanceTimersByTime(120_000));
    expect(onPoll).not.toHaveBeenCalled();
    act(() => setVisibility("visible"));
    expect(onPoll).toHaveBeenCalledTimes(1);
    act(() => void vi.advanceTimersByTime(30_000));
    expect(onPoll).toHaveBeenCalledTimes(2);
  });

  it("does nothing when disabled and cleans up on unmount", () => {
    const onPoll = vi.fn();
    const { rerender, unmount } = render(<Poller onPoll={onPoll} enabled={false} />);
    act(() => void vi.advanceTimersByTime(60_000));
    expect(onPoll).not.toHaveBeenCalled();
    rerender(<Poller onPoll={onPoll} enabled />);
    unmount();
    act(() => void vi.advanceTimersByTime(60_000));
    act(() => setVisibility("hidden"));
    act(() => setVisibility("visible"));
    expect(onPoll).not.toHaveBeenCalled();
  });
});
