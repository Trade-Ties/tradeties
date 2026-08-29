"use client";

import { useEffect, useRef } from "react";

/**
 * Standing between somebody and the door while the form still holds answers nobody has stored.
 *
 * The wizard keeps its form in one component and writes a step at a time, so every way out that
 * is not one of its own buttons takes whatever has not been written with it. There are two such
 * ways and they are not the same mechanism, which is why this covers both:
 *
 * 1. **The document going away** — the tab closed, the page reloaded, the address bar used.
 *    `beforeunload` is the only hook, and all it can do is ask the browser to put its own prompt
 *    up. Nothing asynchronous is allowed to run there, so saving on the way out is not an option
 *    that exists; the question is only whether the prompt is warranted.
 * 2. **The Back button** — which never unloads the document, so `beforeunload` never sees it.
 *    It raises `popstate`, and by then the history has already moved. Staying means going
 *    forward again, which is what the entry pushed below exists for.
 */
export function useLeaveGuard(isUnwritten: () => boolean, onHeldBack: () => void): void {
  /**
   * A question rather than an answer, because answering it walks the whole form and serialises
   * every step — work worth doing when somebody presses something and not on every keystroke of
   * every screen, which is the same reason `buildReview` is only built on the step that shows it.
   *
   * Both held in refs, and that is not tidiness: both are rebuilt every render, and listing
   * either as a dependency would tear the listeners down and push a second history entry each
   * time, filling the back stack with copies of this page.
   */
  const held = useRef(isUnwritten);
  const announce = useRef(onHeldBack);

  // In an effect rather than in the render, which is where a ref may not be written. Both are
  // read from an event handler — always after a render and its effects — so what they hold at
  // the moment somebody presses something is the latest either has been.
  useEffect(() => {
    held.current = isUnwritten;
    announce.current = onHeldBack;
  });

  useEffect(() => {
    const warnOnUnload = (event: BeforeUnloadEvent) => {
      if (!held.current()) return;

      // `preventDefault` is the whole of the modern API; `returnValue` is what older Chrome
      // still reads. The wording is the browser's own and cannot be set.
      event.preventDefault();
      event.returnValue = "";
    };

    // The entry that turns the first Back press into something this can answer rather than
    // something already gone.
    window.history.pushState(null, "", window.location.href);

    /**
     * Set while this is doing the leaving itself. `history.back()` raises `popstate` again, and
     * without the flag the second pass would read "nothing to lose" a second time and walk the
     * history backwards for as long as there is history.
     */
    let leaving = false;

    const guardBack = () => {
      if (leaving) return;

      if (!held.current()) {
        // The press above was spent on the entry this pushed, so this is the one that leaves.
        leaving = true;
        window.history.back();
        return;
      }

      // Put the entry back and say so, in the wizard's own words rather than a browser dialog:
      // it already has a way to store this and a way to abandon it, and pressing Back is asking
      // for one of the two.
      window.history.pushState(null, "", window.location.href);
      announce.current();
    };

    window.addEventListener("beforeunload", warnOnUnload);
    window.addEventListener("popstate", guardBack);

    return () => {
      window.removeEventListener("beforeunload", warnOnUnload);
      window.removeEventListener("popstate", guardBack);
    };
  }, []);
}
