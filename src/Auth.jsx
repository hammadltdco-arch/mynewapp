import { useState } from "react";
import { ArrowRight, MessageCircle, ShieldCheck, Mail } from "lucide-react";
import { supabase, legal, unwrap } from "./lib/backend";
import { authRedirect } from "./lib/native";
export default function Auth({ recovery = false, onRecovered }) {
  const [mode, setMode] = useState(recovery ? "recover" : "login"),
    [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [name, setName] = useState(""),
    [agree, setAgree] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  async function submit(e) {
    e.preventDefault();
    setError("");
    setNotice("");
    setBusy(true);
    try {
      if (mode === "login")
        unwrap(
          await supabase.auth.signInWithPassword({
            email: email.trim(),
            password,
          }),
        );
      if (mode === "signup") {
        if (!agree)
          throw Error("Please accept the terms and community standards.");
        const r = unwrap(
          await supabase.auth.signUp({
            email: email.trim(),
            password,
            options: {
              data: {
                display_name: name.trim(),
                terms_version: "2026-10-26",
                age_confirmed: true,
              },
              emailRedirectTo: await authRedirect(),
            },
          }),
        );
        if (!r.session)
          setNotice("Check your email to confirm your account, then sign in.");
      }
      if (mode === "forgot") {
        unwrap(
          await supabase.auth.resetPasswordForEmail(email.trim(), {
            redirectTo: await authRedirect(),
          }),
        );
        setNotice(
          "If an account exists, a password reset link has been sent. Open it on this device.",
        );
      }
      if (mode === "recover") {
        unwrap(await supabase.auth.updateUser({ password }));
        onRecovered?.();
        setMode("login");
        setNotice("Your password has been updated.");
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="auth-page">
      <section className="auth-art">
        <a className="auth-brand" href="/">
          loop<span>•</span>
        </a>
        <div className="auth-illustration">
          <div className="auth-orbit one" />
          <div className="auth-orbit two" />
          <div className="floating-note">
            Hey, you. 👋<span>A good conversation starts here.</span>
          </div>
          <div className="floating-reply">
            A little closer. 🌿<span>Wherever you are.</span>
          </div>
          <MessageCircle className="big-chat" size={95} />
          <span className="art-spark">✳</span>
        </div>
        <h1>
          Your people.
          <br />
          Just a message away.
        </h1>
        <p>Less noise. More connection.</p>
      </section>
      <section className="auth-card">
        <span className="eyebrow">A LITTLE SPACE FOR YOUR PEOPLE</span>
        <h1>
          {mode === "signup"
            ? "Find your circle."
            : mode === "forgot"
              ? "Let’s get you back."
              : mode === "recover"
                ? "A fresh start."
                : "Welcome back."}
        </h1>
        <p>
          {mode === "signup"
            ? "Make yourself at home."
            : mode === "forgot"
              ? "We’ll email you a secure reset link."
              : mode === "recover"
                ? "Choose a new, strong password."
                : "Your next good conversation is waiting."}
        </p>
        <form onSubmit={submit}>
          {mode === "signup" && (
            <label>
              Your name
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                maxLength={60}
                autoComplete="name"
              />
            </label>
          )}
          {mode !== "recover" && (
            <label>
              Email address
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                maxLength={254}
              />
            </label>
          )}
          {mode !== "forgot" && (
            <label>
              Password
              <input
                aria-label="Password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={mode === "login" ? 1 : 12}
                maxLength={128}
                autoComplete={
                  mode === "login" ? "current-password" : "new-password"
                }
              />
              {mode !== "login" && (
                <small>At least 12 characters. Use a unique password.</small>
              )}
            </label>
          )}
          {mode === "signup" && (
            <label className="agreement">
              <input
                type="checkbox"
                checked={agree}
                onChange={(e) => setAgree(e.target.checked)}
                required
              />
              <span>
                I’m at least 13 and agree to the{" "}
                <a href="/legal/terms.html" target="_blank" rel="noreferrer">
                  terms and community standards
                </a>{" "}
                and{" "}
                <a href="/legal/privacy.html" target="_blank" rel="noreferrer">
                  privacy policy
                </a>
                .
              </span>
            </label>
          )}
          {error && (
            <p role="alert" className="form-error">
              {error}
            </p>
          )}
          {notice && (
            <p role="status" className="form-success">
              {notice}
            </p>
          )}
          <button className="primary-button" disabled={busy}>
            {busy
              ? "One moment…"
              : mode === "signup"
                ? "Create account"
                : mode === "forgot"
                  ? "Send reset link"
                  : mode === "recover"
                    ? "Update password"
                    : "Sign in"}
            <ArrowRight size={18} />
          </button>
        </form>
        {mode === "login" && (
          <button
            className="text-button"
            onClick={() => {
              setMode("forgot");
              setError("");
              setNotice("");
            }}
          >
            Forgot your password?
          </button>
        )}
        {mode !== "recover" && (
          <p className="auth-switch">
            {mode === "login" ? "New around here?" : "Already have an account?"}{" "}
            <button
              onClick={() => {
                setMode(mode === "login" ? "signup" : "login");
                setError("");
                setNotice("");
              }}
            >
              {mode === "login" ? "Create an account" : "Sign in"}
            </button>
          </p>
        )}
        <footer>
          <ShieldCheck size={15} />
          Private conversations. No ads. No contact uploads.
        </footer>
        <div className="legal-links">
          <a href="/legal/privacy.html" target="_blank" rel="noreferrer">
            Privacy
          </a>
          <a href="/legal/terms.html" target="_blank" rel="noreferrer">
            Terms
          </a>
          <a
            href={legal.deletion || "/legal/delete-account.html"}
            target="_blank"
            rel="noreferrer"
          >
            Delete account
          </a>
          {legal.support && <a href={`mailto:${legal.support}`}>Support</a>}
        </div>
      </section>
    </div>
  );
}
