"use client";

import { useEffect, useRef } from "react";

/**
 * Cloudflare Turnstile ("KI-Captcha") for the auth forms. It scores the visitor
 * with ML in the background — usually no puzzle — and yields a single-use token
 * that Supabase Auth verifies server-side (config.toml → [auth.captcha]).
 *
 * The api.js script is injected at runtime by this (already-trusted) React
 * bundle, so it passes the `strict-dynamic` CSP without host-allow-listing for
 * scripts. The widget's iframe + XHR to challenges.cloudflare.com are covered by
 * the `frame-src` / `connect-src` additions in proxy.ts.
 */

type TurnstileApi = {
  render: (
    el: HTMLElement,
    opts: {
      sitekey: string;
      callback: (token: string) => void;
      "error-callback"?: () => void;
      "expired-callback"?: () => void;
      theme?: "light" | "dark" | "auto";
      language?: string;
    }
  ) => string;
  remove: (id: string) => void;
  reset: (id?: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
let scriptPromise: Promise<void> | null = null;

function loadTurnstile(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.turnstile) return Promise.resolve();
  if (!scriptPromise) {
    scriptPromise = new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = SCRIPT_SRC;
      s.async = true;
      s.defer = true;
      s.onload = () => resolve();
      s.onerror = () => reject(new Error("turnstile-load-failed"));
      document.head.appendChild(s);
    });
  }
  return scriptPromise;
}

export function TurnstileWidget({
  siteKey,
  onToken,
  language = "auto",
  resetSignal = 0
}: {
  siteKey: string;
  onToken: (token: string | null) => void;
  language?: string;
  /**
   * Bumped by the parent after every auth attempt. A Turnstile token is
   * single-use, so once it has been spent on a sign-in/-up/reset call the widget
   * must reset to mint a fresh one — otherwise a retry re-sends the spent token
   * and the server rejects it as duplicate.
   */
  resetSignal?: number;
}) {
  const holder = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadTurnstile()
      .then(() => {
        if (cancelled || !holder.current || !window.turnstile) return;
        widgetId.current = window.turnstile.render(holder.current, {
          sitekey: siteKey,
          callback: (token) => onToken(token),
          "error-callback": () => onToken(null),
          "expired-callback": () => onToken(null),
          theme: "light",
          language
        });
      })
      .catch(() => onToken(null));

    return () => {
      cancelled = true;
      if (widgetId.current && window.turnstile) {
        try {
          window.turnstile.remove(widgetId.current);
        } catch {
          /* widget already gone */
        }
        widgetId.current = null;
      }
    };
  }, [siteKey, onToken, language]);

  // Re-run the challenge whenever the parent bumps resetSignal (after a spent
  // token). reset() re-fires the render callback with a fresh token. Skip the
  // initial mount (resetSignal === 0) — the render effect above already ran it.
  useEffect(() => {
    if (resetSignal > 0 && widgetId.current && window.turnstile) {
      window.turnstile.reset(widgetId.current);
    }
  }, [resetSignal]);

  return <div ref={holder} className="min-h-[65px]" />;
}
