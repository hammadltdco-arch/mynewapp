import React, { useState, useEffect } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource/dm-sans/400.css";
import "@fontsource/dm-sans/500.css";
import "@fontsource/dm-sans/600.css";
import "@fontsource/manrope/700.css";
import "@fontsource/manrope/800.css";
import "./style.css";
import "./release.css";
import { supabase, configured } from "./lib/backend";
import Auth from "./Auth";
import { initNative } from "./lib/native";
import Messenger from "./Messenger";
function Root() {
  const [session, setSession] = useState(null),
    [loading, setLoading] = useState(true),
    [recovery, setRecovery] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    let cleanup;
    let alive = true;
    initNative({
      onBack: () =>
        !window.dispatchEvent(new Event("loop:back", { cancelable: true })),
      onError: (message) => setError(message),
    })
      .then((fn) => {
        if (alive) cleanup = fn;
        else fn();
      })
      .catch((e) => setError(e.message));
    return () => {
      alive = false;
      cleanup?.();
    };
  }, []);
  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    let alive = true;
    supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (!alive) return;
        if (error) setError(error.message);
        setSession(data.session);
        setLoading(false);
      })
      .catch((e) => {
        if (alive) {
          setError(e.message);
          setLoading(false);
        }
      });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      if (event === "PASSWORD_RECOVERY") setRecovery(true);
    });
    return () => {
      alive = false;
      subscription.unsubscribe();
    };
  }, []);
  if (loading)
    return (
      <div className="app-loading">
        <span className="auth-brand">
          loop<span>•</span>
        </span>
        <p>Getting your space ready…</p>
      </div>
    );
  if (!configured)
    return (
      <div className="app-loading">
        <span className="auth-brand">
          loop<span>•</span>
        </span>
        <h1>A little closer. Soon.</h1>
        <p>
          This installation hasn’t been connected to its messaging service yet.
        </p>
        <p>
          The app owner needs to complete service setup before accounts and
          chats can be used.
        </p>
        {import.meta.env.DEV && <a href="/demo">Open the UI demo</a>}
      </div>
    );
  if (error)
    return (
      <div className="app-loading" role="alert">
        <h1>We couldn’t restore your session.</h1>
        <p>{error}</p>
        <button className="primary-button" onClick={() => location.reload()}>
          Try again
        </button>
      </div>
    );
  return recovery ? (
    <Auth recovery onRecovered={() => setRecovery(false)} />
  ) : session ? (
    <Messenger session={session} onRecovery={() => setRecovery(true)} />
  ) : (
    <Auth />
  );
}
// Sample conversations are never included in a production release.
if (
  (import.meta.env.DEV && location.pathname === "/demo") ||
  import.meta.env.VITE_DEMO_BUILD === "true"
)
  import("./DemoApp").then(({ default: Demo }) =>
    createRoot(document.getElementById("root")).render(
      <div className="demo-shell">
        <div className="demo-label" role="status">
          DEMO MODE · Messages stay on this device · No live delivery or calls
        </div>
        <Demo />
      </div>,
    ),
  );
else createRoot(document.getElementById("root")).render(<Root />);
