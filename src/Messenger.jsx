import { useState, useEffect, useRef, useMemo } from "react";
import {
  MessageCircle,
  Search,
  SquarePen,
  Settings,
  ArrowLeft,
  Send,
  Smile,
  Paperclip,
  X,
  MoreHorizontal,
  LogOut,
  Shield,
  Flag,
  Ban,
  Trash2,
  Check,
  RefreshCw,
  ChevronDown,
  ArrowUpRight,
  User,
  Users,
  Bell,
  Heart,
} from "lucide-react";
import {
  supabase,
  unwrap,
  loadInbox,
  loadMessages,
  postMessage,
  deleteMessage,
  unregisterPush,
  legal,
} from "./lib/backend";
import { enablePush } from "./lib/native";
const colors = ["#e4c5ab", "#d2dfe0", "#e8cad4", "#e0d2bc", "#d9d5e9"];
function Avatar({ profile, small = false }) {
  const name = profile?.display_name || "?";
  return (
    <div
      className={`avatar ${small ? "tiny" : ""} initials`}
      style={{ background: colors[name.charCodeAt(0) % colors.length] }}
    >
      {name
        .split(/\s+/)
        .slice(0, 2)
        .map((n) => n[0])
        .join("")
        .toUpperCase()}
    </div>
  );
}
const when = (t) =>
  new Date(t).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
const date = (t) =>
  new Date(t).toLocaleDateString([], {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
async function prepareImage(file) {
  if (
    !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
    file.size > 5 * 1024 * 1024
  )
    throw Error("Choose a JPEG, PNG, or WebP photo under 5 MB.");
  const bitmap = await createImageBitmap(file);
  try {
    if (bitmap.width * bitmap.height > 24000000)
      throw Error("This photo is too large. Choose one under 24 megapixels.");
    const scale = Math.min(1, 2048 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas
      .getContext("2d")
      .drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const type = file.type === "image/png" ? "image/png" : "image/jpeg";
    const blob = await new Promise((resolve, reject) =>
      canvas.toBlob(
        (b) =>
          b ? resolve(b) : reject(Error("Could not prepare this photo.")),
        type,
        0.85,
      ),
    );
    if (blob.size > 5 * 1024 * 1024)
      throw Error("The prepared photo exceeds 5 MB. Choose a smaller photo.");
    return new File([blob], type === "image/png" ? "photo.png" : "photo.jpg", {
      type,
    });
  } finally {
    bitmap.close();
  }
}
export default function Messenger({ session }) {
  const user = session.user;
  const [profile, setProfile] = useState(null),
    [chats, setChats] = useState([]),
    [active, setActive] = useState(null),
    [messages, setMessages] = useState([]),
    [filter, setFilter] = useState("All"),
    [query, setQuery] = useState(""),
    [mobile, setMobile] = useState(false),
    [draft, setDraft] = useState(""),
    [attachment, setAttachment] = useState(null),
    [emoji, setEmoji] = useState(false),
    [modal, setModal] = useState(null),
    [details, setDetails] = useState(false),
    [busy, setBusy] = useState(false),
    [sending, setSending] = useState(false),
    [loading, setLoading] = useState(true),
    [chatLoading, setChatLoading] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [blocked, setBlocked] = useState([]),
    [search, setSearch] = useState(""),
    [results, setResults] = useState([]),
    [finding, setFinding] = useState(false),
    [form, setForm] = useState({}),
    [older, setOlder] = useState(false),
    [network, setNetwork] = useState(navigator.onLine);
  const fileRef = useRef(),
    bottom = useRef(),
    activeRef = useRef(active),
    messageSeq = useRef(0),
    inboxSeq = useRef(0),
    mounted = useRef(true),
    timer = useRef(),
    searchSeq = useRef(0);
  activeRef.current = active;
  const viewingRef = useRef(false);
  viewingRef.current = Boolean(active && (window.innerWidth > 700 || mobile));
  const current = chats.find((c) => c.id === active),
    peer = current?.peer;
  const preview = useMemo(
    () => (attachment ? URL.createObjectURL(attachment) : null),
    [attachment],
  );
  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview);
    },
    [preview],
  );
  const toast = (text) => {
    setNotice(text);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setNotice(""), 4500);
  };
  async function run(fn) {
    setError("");
    setBusy(true);
    try {
      return await fn();
    } catch (e) {
      setError(e.message || "Something went wrong. Please try again.");
      return null;
    } finally {
      if (mounted.current) setBusy(false);
    }
  }
  async function refreshInbox() {
    const seq = ++inboxSeq.current;
    const rows = await loadInbox(user.id);
    if (mounted.current && seq === inboxSeq.current) setChats(rows);
    return rows;
  }
  async function refreshMessages(cid = activeRef.current) {
    if (!cid) return;
    const seq = ++messageSeq.current;
    const rows = await loadMessages(cid);
    if (
      mounted.current &&
      cid === activeRef.current &&
      seq === messageSeq.current
    ) {
      setMessages(rows);
      setOlder(rows.length === 50);
    }
    return rows;
  }
  async function refreshBlocks() {
    const data = unwrap(await supabase.from("blocks").select("blocked_id"));
    if (mounted.current) setBlocked(data.map((b) => b.blocked_id));
  }
  async function refreshAll() {
    const [rows] = await Promise.all([
      refreshInbox(),
      refreshMessages(),
      refreshBlocks(),
    ]);
    const open = rows.find((c) => c.id === activeRef.current);
    if (
      viewingRef.current &&
      document.visibilityState === "visible" &&
      open?.unread
    ) {
      unwrap(await supabase.rpc("mark_read", { cid: open.id }));
      setChats((cs) =>
        cs.map((c) => (c.id === open.id ? { ...c, unread: 0 } : c)),
      );
    }
  }
  useEffect(() => {
    mounted.current = true;
    let alive = true;
    (async () => {
      try {
        const p = unwrap(
          await supabase
            .from("profiles")
            .select("*")
            .eq("id", user.id)
            .single(),
        );
        if (alive) setProfile(p);
        await refreshAll();
      } catch (e) {
        if (alive) setError(e.message);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    const onChange = () => {
      if (document.visibilityState === "visible")
        refreshAll().catch((e) => setError(e.message));
    };
    const connection = () => {
      setNetwork(navigator.onLine);
      if (navigator.onLine) onChange();
    };
    const channel = supabase
      .channel(`inbox-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "messages" },
        onChange,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "conversation_members" },
        onChange,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "blocks" },
        onChange,
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") onChange();
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT")
          setError(
            "Live updates disconnected. Refreshing periodically; check your connection.",
          );
      });
    // Polling also reconciles deletes and refreshes expiring signed photo URLs.
    const interval = setInterval(onChange, 30000);
    window.addEventListener("focus", onChange);
    window.addEventListener("loop:refresh", onChange);
    document.addEventListener("visibilitychange", onChange);
    window.addEventListener("online", connection);
    window.addEventListener("offline", connection);
    return () => {
      alive = false;
      mounted.current = false;
      clearInterval(interval);
      clearTimeout(timer.current);
      supabase.removeChannel(channel);
      window.removeEventListener("focus", onChange);
      window.removeEventListener("loop:refresh", onChange);
      document.removeEventListener("visibilitychange", onChange);
      window.removeEventListener("online", connection);
      window.removeEventListener("offline", connection);
    };
  }, [user.id]);
  useEffect(() => {
    if (!active) return;
    let alive = true;
    setChatLoading(true);
    setMessages([]);
    setOlder(false);
    setError("");
    refreshMessages(active)
      .then(() => supabase.rpc("mark_read", { cid: active }))
      .then(unwrap)
      .then(() => {
        if (alive) {
          setChats((cs) =>
            cs.map((c) => (c.id === active ? { ...c, unread: 0 } : c)),
          );
          setTimeout(
            () => bottom.current?.scrollIntoView({ behavior: "instant" }),
            50,
          );
        }
      })
      .catch((e) => {
        if (alive) setError(e.message);
      })
      .finally(() => {
        if (alive) setChatLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [active]);
  useEffect(() => {
    const back = (e) => {
      if (modal) {
        setModal(null);
        e.preventDefault();
      } else if (details) {
        setDetails(false);
        e.preventDefault();
      } else if (mobile) {
        setMobile(false);
        e.preventDefault();
      }
    };
    window.addEventListener("loop:back", back);
    return () => window.removeEventListener("loop:back", back);
  }, [modal, details, mobile]);
  function select(id) {
    setActive(id);
    setMobile(true);
    setDraft("");
    setAttachment(null);
    setEmoji(false);
    setDetails(false);
    setModal(null);
    setChats((cs) => cs.map((c) => (c.id === id ? { ...c, unread: 0 } : c)));
  }
  async function submit(e) {
    e.preventDefault();
    if (sending || (!draft.trim() && !attachment) || !active) return;
    const cid = active,
      body = draft,
      file = attachment;
    setSending(true);
    setError("");
    try {
      await postMessage(cid, body, file);
      if (activeRef.current === cid) {
        setDraft("");
        setAttachment(null);
        setEmoji(false);
        await refreshMessages(cid);
        setTimeout(
          () => bottom.current?.scrollIntoView({ behavior: "smooth" }),
          40,
        );
      }
      await refreshInbox();
    } catch (e) {
      setError(e.message);
    } finally {
      setSending(false);
    }
  }
  async function find(e) {
    e.preventDefault();
    const seq = ++searchSeq.current;
    setFinding(true);
    setError("");
    try {
      const data = unwrap(
        await supabase.rpc("search_profiles", {
          prefix: search.trim().toLowerCase().replace(/^@/, ""),
        }),
      );
      if (seq === searchSeq.current) setResults(data);
    } catch (e) {
      setError(e.message);
    } finally {
      if (seq === searchSeq.current) setFinding(false);
    }
  }
  async function start(p) {
    await run(async () => {
      const id = unwrap(
        await supabase.rpc("start_direct_chat", { other_id: p.id }),
      );
      await refreshInbox();
      select(id);
    });
  }
  async function saveProfile(e) {
    e.preventDefault();
    await run(async () => {
      const p = unwrap(
        await supabase
          .from("profiles")
          .update({
            username: form.username?.trim().toLowerCase(),
            display_name: (form.name ?? profile.display_name).trim(),
            about: form.about?.trim() || "",
          })
          .eq("id", user.id)
          .select()
          .single(),
      );
      setProfile(p);
      setModal(null);
      toast("Profile updated.");
    });
  }
  function editProfile() {
    setForm({
      username: profile?.username || "",
      name: profile?.display_name || "",
      about: profile?.about || "",
    });
    setModal("profile");
  }
  async function toggleBlock() {
    if (!peer?.id) return;
    await run(async () => {
      if (blocked.includes(peer.id))
        unwrap(
          await supabase.from("blocks").delete().eq("blocked_id", peer.id),
        );
      else
        unwrap(await supabase.from("blocks").insert({ blocked_id: peer.id }));
      await refreshBlocks();
      setModal(null);
      toast(
        blocked.includes(peer.id)
          ? "User unblocked."
          : "User blocked. They can no longer send you messages.",
      );
    });
  }
  async function report(e) {
    e.preventDefault();
    await run(async () => {
      unwrap(
        await supabase
          .from("reports")
          .insert({
            reported_id: peer.id,
            message_id: form.messageId || null,
            reason: form.reason || "spam",
            details: form.details || "",
          }),
      );
      setModal(null);
      toast("Report submitted for review. You can also block this user.");
    });
  }
  async function signOut() {
    await run(async () => {
      await unregisterPush();
      unwrap(await supabase.auth.signOut({ scope: "local" }));
    });
  }
  async function removeAccount(e) {
    e.preventDefault();
    await run(async () => {
      if (form.confirm !== "DELETE") throw Error("Type DELETE to confirm.");
      unwrap(
        await supabase.auth.signInWithPassword({
          email: user.email,
          password: form.password,
        }),
      );
      unwrap(
        await supabase.functions.invoke("delete-account", {
          body: { confirm: "DELETE" },
        }),
      );
      localStorage.removeItem("loop.push-token");
      await supabase.auth.signOut({ scope: "local" });
      location.reload();
    });
  }
  const visible = chats
    .filter(
      (c) =>
        c.peer.display_name.toLowerCase().includes(query.toLowerCase()) ||
        c.peer.username?.includes(query.toLowerCase()),
    )
    .filter((c) => filter !== "Unread" || c.unread > 0);
  const isBlocked = blocked.includes(peer?.id);
  if (loading)
    return (
      <div className="app-loading">
        <span className="auth-brand">
          loop<span>•</span>
        </span>
        <p>Loading your conversations…</p>
      </div>
    );
  const mustProfile = profile && !profile.username;
  return (
    <div className={`app ${mobile ? "mobile-chat" : ""}`}>
      <aside className="rail">
        <button
          className="brand"
          onClick={() => setMobile(false)}
          aria-label="Loop home"
        >
          <span className="loop-mark">
            l<span>oo</span>p
          </span>
          <span className="brand-dot" />
        </button>
        <div className="rail-nav">
          <button
            className="nav-item selected"
            onClick={() => setMobile(false)}
          >
            <MessageCircle size={23} />
            <span>Chats</span>
            {chats.some((c) => c.unread) && (
              <b>{chats.reduce((a, c) => a + c.unread, 0)}</b>
            )}
          </button>
          <button
            className="nav-item"
            onClick={() => {
              setSearch("");
              setResults([]);
              setModal("new");
            }}
          >
            <Users size={23} />
            <span>Find people</span>
          </button>
        </div>
        <div className="rail-bottom">
          <button className="nav-item" onClick={() => setModal("settings")}>
            <Settings size={22} />
            <span>Settings</span>
          </button>
          <button
            className="profile-self"
            onClick={editProfile}
            aria-label="Your profile"
          >
            <Avatar profile={profile} />
          </button>
        </div>
      </aside>
      <aside className="inbox">
        <div className="inbox-heading">
          <div>
            <span className="eyebrow">YOUR EVERYDAY, CONNECTED</span>
            <h1>
              Chats<span>.</span>
            </h1>
          </div>
          <button
            className="icon-button new-chat"
            onClick={() => {
              setSearch("");
              setResults([]);
              setModal("new");
            }}
            aria-label="New chat"
          >
            <SquarePen size={21} />
          </button>
        </div>
        <label className="search">
          <Search size={18} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search conversations"
          />
        </label>
        <div className="filters">
          {["All", "Unread"].map((f) => (
            <button
              key={f}
              className={filter === f ? "active" : ""}
              onClick={() => setFilter(f)}
            >
              {f}
            </button>
          ))}
        </div>
        <div className="list-label">
          MESSAGES <span>{visible.length}</span>
        </div>
        <div className="chat-list">
          {visible.map((c) => (
            <button
              key={c.id}
              className={`chat-row ${c.id === active ? "active" : ""}`}
              onClick={() => select(c.id)}
            >
              <Avatar profile={c.peer} />
              <div className="chat-summary">
                <div>
                  <strong>{c.peer.display_name}</strong>
                  <time>{c.last ? date(c.last.created_at) : ""}</time>
                </div>
                <div>
                  <p>
                    {c.last
                      ? (c.last.sender_id === user.id ? "You: " : "") +
                        (c.last.body || "Photo")
                      : "Say hello 👋"}
                  </p>
                  {c.unread > 0 && <b className="unread">{c.unread}</b>}
                </div>
              </div>
            </button>
          ))}
          {!visible.length && (
            <div className="no-chats">
              <MessageCircle size={34} />
              <h2>Your people, right here.</h2>
              <p>
                {query || filter === "Unread"
                  ? "No conversations match this filter."
                  : "Start a conversation by finding someone’s username."}
              </p>
              {!query && filter === "All" && (
                <button
                  className="primary-button"
                  onClick={() => {
                    setSearch("");
                    setResults([]);
                    setModal("new");
                  }}
                >
                  Find your people
                  <ArrowUpRight size={17} />
                </button>
              )}
            </div>
          )}
        </div>
        <div className="inbox-footer">
          <span className="small-flower">✳</span>
          <div>
            A little closer.<p>Good conversations start here.</p>
          </div>
          <Heart size={16} />
        </div>
      </aside>
      <main className="conversation">
        {!current ? (
          <div className="welcome-chat">
            <div className="welcome-orbit">
              <MessageCircle size={58} />
              <span>✦</span>
            </div>
            <h1>
              Small talk.
              <br />
              Big connections.
            </h1>
            <p>
              Choose a conversation or find someone new.
              <br />A little hello can go a long way.
            </p>
            <span className="pill">YOUR PEOPLE. YOUR SPACE.</span>
          </div>
        ) : (
          <>
            <header className="conversation-header">
              <button
                className="icon-button back"
                aria-label="Back to conversations"
                onClick={() => setMobile(false)}
              >
                <ArrowLeft />
              </button>
              <Avatar profile={peer} />
              <button
                className="contact-heading"
                onClick={() => setDetails(!details)}
              >
                <h2>
                  {peer.display_name}
                  <ChevronDown size={15} />
                </h2>
                <p>
                  {peer.username
                    ? `@${peer.username}`
                    : "Account no longer available"}
                </p>
              </button>
              <div className="header-actions">
                <button
                  className="icon-button"
                  aria-label="Refresh conversation"
                  onClick={() => run(refreshAll)}
                >
                  <RefreshCw size={18} />
                </button>
                <button
                  className="icon-button"
                  aria-label="Conversation information"
                  onClick={() => setDetails(!details)}
                >
                  <MoreHorizontal size={23} />
                </button>
              </div>
            </header>
            {!network && (
              <div role="status" className="connection-banner">
                You’re offline. Reconnect to send and receive messages.
              </div>
            )}
            <div className="conversation-body">
              <div className="friend-banner">
                <span>✦</span> A little space for a good conversation.{" "}
                <span>✦</span>
              </div>
              {older && (
                <button
                  className="load-older"
                  disabled={busy}
                  onClick={() =>
                    run(async () => {
                      const cid = active;
                      const rows = await loadMessages(cid, messages[0]);
                      if (activeRef.current === cid) {
                        setMessages((ms) => [...rows, ...ms]);
                        setOlder(rows.length === 50);
                      }
                    })
                  }
                >
                  Load earlier messages
                </button>
              )}
              {chatLoading ? (
                <p className="empty-small">Loading messages…</p>
              ) : !messages.length ? (
                <div className="empty-thread">
                  <MessageCircle size={36} />
                  <h2>Make the first move.</h2>
                  <p>Say hello to {peer.display_name}.</p>
                </div>
              ) : (
                <div className="messages">
                  {messages.map((m, i) => (
                    <div key={m.id}>
                      {(i === 0 ||
                        date(m.created_at) !==
                          date(messages[i - 1].created_at)) && (
                        <div className="date-divider">
                          <span>{date(m.created_at)}</span>
                        </div>
                      )}
                      <div
                        className={`message-row ${m.sender_id === user.id ? "mine" : ""}`}
                      >
                        {m.sender_id !== user.id && (
                          <Avatar profile={peer} small />
                        )}
                        <div
                          className={`bubble ${m.image ? "photo-bubble" : ""}`}
                        >
                          {m.image && (
                            <button
                              className="photo-open"
                              onClick={() => setModal({ image: m.image })}
                            >
                              <img
                                className="message-photo"
                                src={m.image}
                                alt="Shared photo"
                              />
                              <span>
                                <ArrowUpRight size={16} />
                              </span>
                            </button>
                          )}
                          {m.body && <p>{m.body}</p>}
                          <div className="message-meta">
                            <time>{when(m.created_at)}</time>
                            {m.sender_id === user.id && (
                              <Check size={13} aria-label="Sent to server" />
                            )}
                            <button
                              className="message-menu"
                              aria-label={`Options for message ${m.id}`}
                              onClick={() => {
                                setForm({
                                  message: m,
                                  messageId: m.id,
                                  reason: "spam",
                                  details: "",
                                });
                                setModal("message");
                              }}
                            >
                              <MoreHorizontal size={13} />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <div ref={bottom} />
            </div>
            <div className="composer-area">
              {isBlocked || !peer.id ? (
                <div className="blocked-banner">
                  {isBlocked
                    ? "You blocked this user. Unblock them in conversation details to chat again."
                    : "This account is no longer available."}
                </div>
              ) : (
                <>
                  {preview && (
                    <div className="attachment-preview">
                      <img src={preview} alt="Attachment preview" />
                      <span>Ready to send · location metadata removed</span>
                      <button
                        className="icon-button"
                        aria-label="Remove attachment"
                        onClick={() => setAttachment(null)}
                      >
                        <X size={17} />
                      </button>
                    </div>
                  )}
                  {emoji && (
                    <div className="emoji-picker">
                      {[
                        "😊",
                        "❤️",
                        "😂",
                        "🙌",
                        "☀️",
                        "🌿",
                        "☕",
                        "✨",
                        "👍",
                        "🎉",
                        "👋",
                        "🔥",
                      ].map((e) => (
                        <button
                          key={e}
                          onClick={() =>
                            setDraft((d) => (d + e).slice(0, 4000))
                          }
                        >
                          {e}
                        </button>
                      ))}
                    </div>
                  )}
                  <form className="composer" onSubmit={submit}>
                    <button
                      type="button"
                      className="icon-button"
                      aria-label="Choose emoji"
                      onClick={() => setEmoji(!emoji)}
                    >
                      <Smile size={23} />
                    </button>
                    <input
                      aria-label="Message"
                      placeholder={`Message ${peer.display_name.split(" ")[0]}…`}
                      value={draft}
                      maxLength={4000}
                      disabled={sending}
                      onChange={(e) => setDraft(e.target.value)}
                    />
                    <button
                      type="button"
                      className="icon-button"
                      disabled={sending || busy}
                      aria-label="Attach photo"
                      onClick={() => fileRef.current.click()}
                    >
                      <Paperclip size={21} />
                    </button>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      hidden
                      ref={fileRef}
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        e.target.value = "";
                        if (f)
                          run(async () => setAttachment(await prepareImage(f)));
                      }}
                    />
                    <button
                      className="send-button"
                      aria-label="Send message"
                      disabled={
                        sending ||
                        busy ||
                        !network ||
                        (!draft.trim() && !attachment)
                      }
                    >
                      {sending ? (
                        <span className="sending-dot">•••</span>
                      ) : (
                        <Send size={19} />
                      )}
                    </button>
                  </form>
                  <div className="composer-caption">
                    <Shield size={10} />
                    Private to this conversation.
                    <span>Encrypted in transit · not end-to-end encrypted</span>
                  </div>
                </>
              )}
            </div>
          </>
        )}
      </main>
      {details && current && (
        <aside className="details">
          <button
            className="icon-button close-details"
            onClick={() => setDetails(false)}
            aria-label="Close details"
          >
            <X size={20} />
          </button>
          <Avatar profile={peer} />
          <h2>{peer.display_name}</h2>
          <p>@{peer.username || "deleted"}</p>
          <div className="about">
            <span className="eyebrow">ABOUT</span>
            <p>{peer.about || "A little closer, wherever you are."}</p>
          </div>
          {peer.id && (
            <>
              <button
                className="detail-action"
                onClick={() => setModal("block")}
              >
                <Ban size={18} />
                {isBlocked ? "Unblock user" : "Block user"}
              </button>
              <button
                className="detail-action danger-text"
                onClick={() => {
                  setForm({ reason: "spam", details: "" });
                  setModal("report");
                }}
              >
                <Flag size={18} />
                Report user
              </button>
            </>
          )}
          <div className="about">
            <span className="eyebrow">SHARED PHOTOS</span>
            <div className="shared-photos">
              {messages
                .filter((m) => m.image)
                .map((m) => (
                  <button
                    key={m.id}
                    onClick={() => setModal({ image: m.image })}
                  >
                    <img src={m.image} alt="Shared photo" />
                  </button>
                ))}
            </div>
          </div>
        </aside>
      )}
      {(modal || mustProfile) && (
        <div
          className="modal-backdrop"
          onClick={() => {
            if (!mustProfile && !busy) setModal(null);
          }}
        >
          <section
            className={`modal ${modal?.image ? "image-modal" : ""}`}
            role="dialog"
            aria-modal="true"
            aria-label={
              mustProfile
                ? "Complete your profile"
                : typeof modal === "string"
                  ? modal
                  : "Shared photo"
            }
            onClick={(e) => e.stopPropagation()}
          >
            {!mustProfile && (
              <button
                className="icon-button modal-close"
                disabled={busy}
                onClick={() => setModal(null)}
                aria-label="Close dialog"
              >
                <X />
              </button>
            )}
            {mustProfile || modal === "profile" ? (
              <>
                <span className="eyebrow">MAKE YOURSELF AT HOME</span>
                <h2>
                  {mustProfile ? "Your corner of Loop." : "Your profile."}
                </h2>
                <p>People find you by username. Your email stays private.</p>
                <form
                  className="stack-form"
                  onSubmit={(e) => {
                    if (mustProfile && !form.name)
                      setForm((f) => ({ ...f, name: profile.display_name }));
                    saveProfile(e);
                  }}
                >
                  <label>
                    Name
                    <input
                      required
                      maxLength={60}
                      value={form.name ?? profile?.display_name ?? ""}
                      onChange={(e) =>
                        setForm({ ...form, name: e.target.value })
                      }
                    />
                  </label>
                  <label>
                    Username
                    <input
                      aria-label="Username"
                      required
                      pattern="[a-z0-9_]{3,24}"
                      minLength={3}
                      maxLength={24}
                      autoCapitalize="none"
                      autoCorrect="off"
                      value={form.username ?? profile?.username ?? ""}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          name: form.name ?? profile.display_name,
                          username: e.target.value.toLowerCase(),
                        })
                      }
                    />
                    <small>
                      3–24 lowercase letters, numbers, or underscores.
                    </small>
                  </label>
                  <label>
                    About you
                    <input
                      maxLength={160}
                      value={form.about ?? profile?.about ?? ""}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          name: form.name ?? profile.display_name,
                          about: e.target.value,
                        })
                      }
                    />
                  </label>
                  <button className="primary-button" disabled={busy}>
                    {busy ? "Saving…" : "Save profile"}
                    <Check size={18} />
                  </button>
                </form>
              </>
            ) : modal?.image ? (
              <img src={modal.image} alt="Shared photo enlarged" />
            ) : modal === "new" ? (
              <>
                <span className="eyebrow">MAKE A CONNECTION</span>
                <h2>Find your people.</h2>
                <p>Enter at least 3 characters of their username.</p>
                <form className="people-search" onSubmit={find}>
                  <input
                    aria-label="Find by username"
                    value={search}
                    required
                    minLength={3}
                    maxLength={25}
                    placeholder="@username"
                    autoCapitalize="none"
                    onChange={(e) => {
                      setSearch(e.target.value);
                      setResults([]);
                    }}
                  />
                  <button
                    className="primary-button"
                    disabled={finding || busy}
                    aria-label="Search users"
                  >
                    <Search size={18} />
                  </button>
                </form>
                {results.map((p) => (
                  <button
                    className="chat-row"
                    disabled={busy}
                    key={p.id}
                    onClick={() => start(p)}
                  >
                    <Avatar profile={p} />
                    <div>
                      <strong>{p.display_name}</strong>
                      <p className="username">@{p.username}</p>
                    </div>
                    <ArrowUpRight size={18} />
                  </button>
                ))}
                {!results.length && search && (
                  <p>No results yet. Search a username to find a match.</p>
                )}
              </>
            ) : modal === "settings" ? (
              <>
                <span className="eyebrow">YOUR LITTLE SPACE</span>
                <h2>Settings.</h2>
                <button className="detail-action" onClick={editProfile}>
                  <User size={18} />
                  Edit profile
                </button>
                <button
                  className="detail-action"
                  disabled={busy}
                  onClick={() =>
                    run(async () => {
                      await enablePush((data) => {
                        if (data.error) setError(data.error);
                        else if (data.conversation_id) {
                          refreshInbox()
                            .then(() => select(data.conversation_id))
                            .catch((e) => setError(e.message));
                        }
                      });
                      toast(
                        "Notification permission granted; registering this device…",
                      );
                    })
                  }
                >
                  <Bell size={18} />
                  Enable notifications
                </button>
                <p className="settings-note">
                  Notifications show a generic alert, never message text.
                  Background delivery requires this release’s push service to be
                  configured.
                </p>
                <div className="setting-row">
                  <span>Signed in as</span>
                  <strong>{user.email}</strong>
                </div>
                <div className="legal-links">
                  <a
                    href="/legal/privacy.html"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Privacy
                  </a>
                  <a href="/legal/terms.html" target="_blank" rel="noreferrer">
                    Terms & safety
                  </a>
                  {legal.support && (
                    <a href={`mailto:${legal.support}`}>Contact support</a>
                  )}
                </div>
                <button
                  className="detail-action"
                  disabled={busy}
                  onClick={signOut}
                >
                  <LogOut size={18} />
                  Sign out of this device
                </button>
                <button
                  className="detail-action danger-text"
                  onClick={() => {
                    setForm({ password: "", confirm: "" });
                    setModal("delete");
                  }}
                >
                  <Trash2 size={18} />
                  Delete account
                </button>
              </>
            ) : modal === "block" ? (
              <>
                <Ban size={30} />
                <h2>
                  {isBlocked ? "Unblock" : "Block"} {peer?.display_name}?
                </h2>
                <p>
                  {isBlocked
                    ? "You’ll be able to send each other messages again."
                    : "Neither of you can send new messages to the other. Existing messages remain visible. You can unblock them later."}
                </p>
                <button
                  className="primary-button"
                  onClick={toggleBlock}
                  disabled={busy}
                >
                  {busy ? "Saving…" : isBlocked ? "Unblock user" : "Block user"}
                </button>
              </>
            ) : modal === "report" ? (
              <>
                <Flag size={30} />
                <h2>Keep Loop kind.</h2>
                <p>
                  Reports are sent to the app’s moderation team. If someone is
                  in immediate danger, contact local emergency services.
                </p>
                <form className="stack-form" onSubmit={report}>
                  <label>
                    Reason
                    <select
                      value={form.reason || "spam"}
                      onChange={(e) =>
                        setForm({ ...form, reason: e.target.value })
                      }
                    >
                      <option value="spam">Spam or scam</option>
                      <option value="harassment">Harassment or threats</option>
                      <option value="sexual_content">
                        Sexual or inappropriate content
                      </option>
                      <option value="child_safety">Child safety concern</option>
                      <option value="other">Something else</option>
                    </select>
                  </label>
                  <label>
                    What happened?
                    <textarea
                      maxLength={2000}
                      value={form.details || ""}
                      onChange={(e) =>
                        setForm({ ...form, details: e.target.value })
                      }
                    />
                  </label>
                  <button className="primary-button" disabled={busy}>
                    {busy ? "Submitting…" : "Submit report"}
                  </button>
                </form>
              </>
            ) : modal === "message" ? (
              <>
                <h2>Message options.</h2>
                {form.message?.sender_id === user.id ? (
                  <>
                    <p>
                      Delete this message for everyone. This can’t be undone.
                    </p>
                    <button
                      className="detail-action danger-text"
                      disabled={busy}
                      onClick={() =>
                        run(async () => {
                          await deleteMessage(form.message);
                          await refreshAll();
                          setModal(null);
                          toast("Message deleted.");
                        })
                      }
                    >
                      <Trash2 size={18} />
                      Delete for everyone
                    </button>
                  </>
                ) : (
                  <button
                    className="detail-action danger-text"
                    onClick={() => setModal("report")}
                  >
                    <Flag size={18} />
                    Report this message
                  </button>
                )}
              </>
            ) : modal === "delete" ? (
              <>
                <Trash2 size={30} />
                <h2>Leave without a trace.</h2>
                <p>
                  Delete your account, profile, sent messages, uploaded photos,
                  and notification tokens. Received messages belong to their
                  senders. Other people may have saved copies. This cannot be
                  undone.
                </p>
                <form className="stack-form" onSubmit={removeAccount}>
                  <label>
                    Confirm your password
                    <input
                      type="password"
                      required
                      autoComplete="current-password"
                      value={form.password || ""}
                      onChange={(e) =>
                        setForm({ ...form, password: e.target.value })
                      }
                    />
                  </label>
                  <label>
                    Type DELETE
                    <input
                      required
                      pattern="DELETE"
                      value={form.confirm || ""}
                      onChange={(e) =>
                        setForm({ ...form, confirm: e.target.value })
                      }
                    />
                  </label>
                  <button
                    className="primary-button destructive"
                    disabled={busy}
                  >
                    {busy ? "Deleting…" : "Permanently delete account"}
                  </button>
                </form>
              </>
            ) : null}
            {error && (
              <p role="alert" className="form-error">
                {error}
              </p>
            )}
          </section>
        </div>
      )}
      {error && !modal && !mustProfile && (
        <div className="error-banner" role="alert">
          <span>{error}</span>
          <button onClick={() => setError("")} aria-label="Dismiss error">
            <X size={17} />
          </button>
          <button onClick={() => run(refreshAll)}>Retry</button>
        </div>
      )}
      {notice && (
        <div className="toast" role="status">
          {notice}
        </div>
      )}
    </div>
  );
}
