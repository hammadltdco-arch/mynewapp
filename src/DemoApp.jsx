import React, { useState, useRef, useEffect } from "react";
import {
  MessageCircle,
  CircleDashed,
  Users,
  Settings,
  Search,
  SquarePen,
  ChevronDown,
  CheckCheck,
  ArrowUpRight,
  ArrowLeft,
  X,
  Plus,
  Smile,
  Send,
  Image,
  Bell,
  BellOff,
  MoreHorizontal,
  Pin,
  Heart,
  LogOut,
  Paperclip,
  Sparkles,
  Check,
  Info,
} from "lucide-react";
import "@fontsource/dm-sans/400.css";
import "@fontsource/dm-sans/500.css";
import "@fontsource/dm-sans/600.css";
import "@fontsource/manrope/700.css";
import "@fontsource/manrope/800.css";
import "./style.css";
import { initNative } from "./lib/native";
const people = [
  {
    id: "mia",
    name: "Mia Chen",
    photo: "47",
    color: "#e9c4ad",
    last: "That place looks unreal 🌿",
    time: "12:42",
    unread: 2,
    online: true,
    tag: "Friends",
    about: "Collecting little moments. ☀️",
    handle: "@mia.chen",
  },
  {
    id: "studio",
    name: "The creative corner",
    photo: null,
    color: "#ecdcbc",
    last: "Alex: Dropped a few ideas in here",
    time: "12:18",
    unread: 3,
    group: true,
    tag: "Groups",
    about: "Good people. Better ideas.",
    handle: "5 members",
  },
  {
    id: "james",
    name: "James Wilson",
    photo: "12",
    color: "#d0dfe1",
    last: "You: Sounds like a plan!",
    time: "11:56",
    tag: "Friends",
    about: "Probably out on a trail.",
    handle: "@jamesw",
  },
  {
    id: "sofia",
    name: "Sofia Martinez",
    photo: "44",
    color: "#eacbd5",
    last: "Sent you a photo",
    time: "10:30",
    tag: "Friends",
    online: true,
    about: "A little bit of everything.",
    handle: "@sofiam",
  },
  {
    id: "weekend",
    name: "Weekend people",
    photo: null,
    color: "#d9e5c6",
    last: "Nora: Who’s bringing the snacks?",
    time: "Yesterday",
    group: true,
    tag: "Groups",
    about: "Making weekends count.",
    handle: "8 members",
  },
  {
    id: "noah",
    name: "Noah Williams",
    photo: "13",
    color: "#e2d6c4",
    last: "Thanks so much 🙌",
    time: "Yesterday",
    tag: "Friends",
    about: "Coffee, code, repeat.",
    handle: "@noahw",
  },
  {
    id: "ava",
    name: "Ava Thompson",
    photo: "49",
    color: "#d8d9ee",
    last: "Let’s catch up soon",
    time: "Mon",
    tag: "Friends",
    about: "See you outside.",
    handle: "@ava.t",
  },
];
const initial = {
  mia: [
    {
      id: 1,
      text: "Hey! We’re still on for Saturday, right?",
      time: "12:34",
      mine: false,
    },
    {
      id: 2,
      text: "Of course! Been looking forward to it all week ☀️",
      time: "12:35",
      mine: true,
    },
    {
      id: 3,
      text: "I found this little spot. Imagine a coffee here…",
      time: "12:38",
      mine: false,
    },
    {
      id: 4,
      image: "/slow-morning.svg",
      caption: "Our kind of slow morning ☕",
      time: "12:39",
      mine: false,
    },
    {
      id: 5,
      text: "Okay, officially sold. Coffee + zero plans = perfect Saturday.",
      time: "12:40",
      mine: true,
    },
    { id: 6, text: "That place looks unreal 🌿", time: "12:42", mine: false },
  ],
};
function stored(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
}
function Avatar({ person, size = "", status = false }) {
  return (
    <div className={`avatar ${size}`} style={{ background: person.color }}>
      {person.photo ? (
        <img src={`/avatars/${person.photo}.svg`} alt={person.name} />
      ) : (
        <Users size={22} />
      )}
      {status && person.online && <i />}
    </div>
  );
}
export default function DemoApp() {
  const [active, setActive] = useState("mia"),
    [messages, setMessages] = useState(() => stored("loop.messages", initial)),
    [query, setQuery] = useState(""),
    [filter, setFilter] = useState("All"),
    [section, setSection] = useState("Chats"),
    [draft, setDraft] = useState(""),
    [mobileChat, setMobileChat] = useState(false),
    [details, setDetails] = useState(false),
    [modal, setModal] = useState(null),
    [emojis, setEmojis] = useState(false),
    [muted, setMuted] = useState(() => stored("loop.muted", [])),
    [unread, setUnread] = useState(
      people.filter((p) => p.unread).map((p) => p.id),
    ),
    [notice, setNotice] = useState(""),
    [attachment, setAttachment] = useState(null);
  const fileRef = useRef(),
    bottom = useRef();
  const backHandler = useRef(() => false);
  backHandler.current = () => {
    if (modal) {
      setModal(null);
      return true;
    }
    if (details) {
      setDetails(false);
      return true;
    }
    if (emojis) {
      setEmojis(false);
      return true;
    }
    if (mobileChat) {
      setMobileChat(false);
      return true;
    }
    return false;
  };
  useEffect(() => {
    let cleanup,
      alive = true;
    initNative({
      onBack: () => backHandler.current(),
      onError: (message) => setNotice(message),
    })
      .then((fn) => {
        if (alive) cleanup = fn;
        else fn();
      })
      .catch((e) => setNotice(e.message));
    return () => {
      alive = false;
      cleanup?.();
    };
  }, []);
  useEffect(() => {
    if (mobileChat)
      setTimeout(
        () => bottom.current?.scrollIntoView({ behavior: "instant" }),
        30,
      );
  }, [active, mobileChat]);
  const current = people.find((p) => p.id === active);
  const thread = messages[active] || [];
  const toast = (text) => {
    setNotice(text);
    setTimeout(() => setNotice(""), 3200);
  };
  function select(p) {
    setActive(p.id);
    setMobileChat(true);
    setDraft("");
    setAttachment(null);
    setUnread((u) => u.filter((id) => id !== p.id));
    setSection("Chats");
    setModal(null);
  }
  function send(e) {
    e?.preventDefault();
    if (!draft.trim() && !attachment) return;
    const next = {
      ...messages,
      [active]: [
        ...thread,
        {
          id: Date.now(),
          text: draft.trim(),
          image: attachment,
          time: new Date().toLocaleTimeString("en-GB", {
            hour: "2-digit",
            minute: "2-digit",
          }),
          mine: true,
        },
      ],
    };
    try {
      localStorage.setItem("loop.messages", JSON.stringify(next));
      setMessages(next);
      setDraft("");
      setAttachment(null);
      setEmojis(false);
      setTimeout(
        () => bottom.current?.scrollIntoView({ behavior: "smooth" }),
        50,
      );
    } catch {
      toast(
        "This attachment is too large for local storage. Try a smaller image.",
      );
    }
  }
  function attach(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.type.startsWith("image/")) return toast("Choose an image file.");
    if (f.size > 2 * 1024 * 1024)
      return toast("Please choose an image under 2 MB.");
    const reader = new FileReader();
    reader.onload = () => setAttachment(reader.result);
    reader.readAsDataURL(f);
    e.target.value = "";
  }
  function toggleMute() {
    const next = muted.includes(active)
      ? muted.filter((x) => x !== active)
      : [...muted, active];
    setMuted(next);
    localStorage.setItem("loop.muted", JSON.stringify(next));
  }
  const visible = people.filter(
    (p) =>
      p.name.toLowerCase().includes(query.toLowerCase()) &&
      (filter !== "Unread" || unread.includes(p.id)) &&
      (filter !== "Groups" || p.group),
  );
  return (
    <div className={`app ${mobileChat ? "mobile-chat" : ""}`}>
      <aside className="rail">
        <a
          className="brand"
          href="#"
          aria-label="Loop home"
          onClick={(e) => {
            e.preventDefault();
            setSection("Chats");
            setMobileChat(false);
          }}
        >
          <span className="loop-mark">
            l<span>oo</span>p
          </span>
          <span className="brand-dot" />
        </a>
        <div className="rail-nav">
          {[
            [MessageCircle, "Chats"],
            [CircleDashed, "Updates"],
            [Users, "Contacts"],
          ].map(([Icon, name]) => (
            <button
              key={name}
              className={`nav-item ${section === name ? "selected" : ""}`}
              onClick={() => {
                setSection(name);
                setMobileChat(false);
              }}
              title={name}
            >
              <Icon size={23} />
              <span>{name}</span>
              {name === "Chats" && <b>{unread.length}</b>}
            </button>
          ))}
        </div>
        <div className="rail-bottom">
          <button className="nav-item" onClick={() => setModal("settings")}>
            <Settings size={22} />
            <span>Settings</span>
          </button>
          <button
            className="profile-self"
            onClick={() => setModal("profile")}
            aria-label="Your profile"
          >
            <img src="/avatars/32.svg" alt="Your profile" />
            <i />
          </button>
        </div>
      </aside>
      <aside className="inbox">
        <div className="inbox-heading">
          <div>
            <span className="eyebrow">YOUR EVERYDAY, CONNECTED</span>
            <h1>
              {section}
              <span>.</span>
            </h1>
          </div>
          <button
            className="icon-button new-chat"
            aria-label="New chat"
            onClick={() => setModal("new")}
          >
            <SquarePen size={21} />
          </button>
        </div>
        <label className="search">
          <Search size={18} />
          <input
            placeholder="Search conversations"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <kbd>⌘ K</kbd>
        </label>
        {section === "Chats" ? (
          <>
            <div className="filters">
              {["All", "Unread", "Groups"].map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={filter === f ? "active" : ""}
                >
                  {f}
                  {f === "Unread" && <span>{unread.length}</span>}
                </button>
              ))}
            </div>
            <div className="list-label">
              MESSAGES <span>{visible.length}</span>
            </div>
            <div className="chat-list">
              {visible.map((p) => {
                const last = messages[p.id]?.at(-1);
                return (
                  <button
                    className={`chat-row ${active === p.id ? "active" : ""}`}
                    key={p.id}
                    onClick={() => select(p)}
                  >
                    <Avatar person={p} status />
                    <div className="chat-summary">
                      <div>
                        <strong>{p.name}</strong>
                        <time>{last?.mine ? last.time : p.time}</time>
                      </div>
                      <div>
                        <p>
                          {last?.mine && <CheckCheck size={14} />}
                          {last
                            ? (last.mine ? "You: " : "") +
                              (last.text || last.caption || "Photo")
                            : p.last}
                        </p>
                        {unread.includes(p.id) && (
                          <b className="unread">{p.unread}</b>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
              {!visible.length && (
                <p className="empty-small">No conversations found.</p>
              )}
            </div>
            <div className="inbox-footer">
              <span className="small-flower">✳</span>
              <div>
                A little closer.<p>Good conversations start here.</p>
              </div>
              <Heart size={16} />
            </div>
          </>
        ) : section === "Contacts" ? (
          <div className="contacts-list">
            {people
              .filter(
                (p) =>
                  !p.group &&
                  p.name.toLowerCase().includes(query.toLowerCase()),
              )
              .map((p) => (
                <button
                  className="chat-row"
                  key={p.id}
                  onClick={() => select(p)}
                >
                  <Avatar person={p} status />
                  <div>
                    <strong>{p.name}</strong>
                    <p>{p.handle}</p>
                  </div>
                  <MessageCircle size={18} />
                </button>
              ))}
          </div>
        ) : (
          <div className="updates">
            <div className="update-orbit">
              <CircleDashed size={40} />
            </div>
            <h2>Your little life updates</h2>
            <p>
              A space for the moments between messages. Updates are coming in a
              future version.
            </p>
            <span className="pill">COMING SOON</span>
          </div>
        )}
      </aside>
      <main className="conversation">
        <header className="conversation-header">
          <button
            className="icon-button back"
            aria-label="Back to conversations"
            onClick={() => setMobileChat(false)}
          >
            <ArrowLeft />
          </button>
          <Avatar person={current} status />
          <button
            className="contact-heading"
            onClick={() => setDetails(!details)}
          >
            <h2>
              {current.name}
              <ChevronDown size={15} />
            </h2>
            <p>
              <span className={current.online ? "online-dot" : ""} />
              {current.online
                ? "Online now"
                : current.group
                  ? current.handle
                  : "Offline"}
              <span className="status-divider">·</span>
              {current.group
                ? "Your people, together"
                : "A little closer, wherever you are"}
            </p>
          </button>
          <div className="header-actions">
            <button
              className="icon-button"
              aria-label={muted.includes(active) ? "Unmute chat" : "Mute chat"}
              onClick={toggleMute}
            >
              {muted.includes(active) ? (
                <BellOff size={20} />
              ) : (
                <Bell size={20} />
              )}
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
        <div className="conversation-body">
          <div className="friend-banner">
            <span>✦</span> A familiar face. A fresh conversation. <span>✦</span>
          </div>
          <div className="date-divider">
            <span>Today, October 26</span>
          </div>
          {thread.length === 0 && (
            <div className="empty-thread">
              <MessageCircle size={36} />
              <h2>Make the first move.</h2>
              <p>
                Say hello to {current.name}. Messages in this prototype stay on
                this device.
              </p>
            </div>
          )}
          <div className="messages">
            {thread.map((m, i) => (
              <div className={`message-row ${m.mine ? "mine" : ""}`} key={m.id}>
                {!m.mine && <Avatar person={current} size="tiny" />}
                <div className={`bubble ${m.image ? "photo-bubble" : ""}`}>
                  {m.image && (
                    <button
                      className="photo-open"
                      onClick={() => setModal({ image: m.image })}
                    >
                      <img
                        className="message-photo"
                        src={m.image}
                        alt={m.caption || "Shared photo"}
                      />
                      <span>
                        <ArrowUpRight size={16} />
                      </span>
                    </button>
                  )}
                  {(m.text || m.caption) && <p>{m.text || m.caption}</p>}
                  <div className="message-meta">
                    <time>{m.time}</time>
                    {m.mine && (
                      <CheckCheck size={14} aria-label="Saved locally" />
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div ref={bottom} />
        </div>
        <div className="composer-area">
          {attachment && (
            <div className="attachment-preview">
              <img src={attachment} alt="Attachment preview" />
              <span>Ready to send</span>
              <button
                className="icon-button"
                onClick={() => setAttachment(null)}
                aria-label="Remove attachment"
              >
                <X size={17} />
              </button>
            </div>
          )}
          {emojis && (
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
                <button key={e} onClick={() => setDraft((d) => d + e)}>
                  {e}
                </button>
              ))}
            </div>
          )}
          <form className="composer" onSubmit={send}>
            <button
              type="button"
              className="icon-button"
              aria-label="Choose emoji"
              onClick={() => setEmojis(!emojis)}
            >
              <Smile size={23} />
            </button>
            <input
              aria-label="Message"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={`Message ${current.name.split(" ")[0]}…`}
            />
            <button
              type="button"
              className="icon-button attach-button"
              aria-label="Attach photo"
              onClick={() => fileRef.current.click()}
            >
              <Paperclip size={21} />
            </button>
            <input
              type="file"
              accept="image/*"
              ref={fileRef}
              onChange={attach}
              hidden
            />
            <button
              className="send-button"
              disabled={!draft.trim() && !attachment}
              aria-label="Send message"
            >
              <Send size={19} />
            </button>
          </form>
          <div className="composer-caption">
            <span className="local-indicator" /> A little space for your people.
            <span>UI prototype · messages saved on this device</span>
          </div>
        </div>
      </main>
      {details && (
        <aside className="details">
          <button
            className="icon-button close-details"
            aria-label="Close details"
            onClick={() => setDetails(false)}
          >
            <X size={20} />
          </button>
          <Avatar person={current} size="large" />
          <h2>{current.name}</h2>
          <p>{current.handle}</p>
          <div className="about">
            <span className="eyebrow">ABOUT</span>
            <p>{current.about}</p>
          </div>
          <button className="detail-action" onClick={toggleMute}>
            {muted.includes(active) ? (
              <BellOff size={18} />
            ) : (
              <Bell size={18} />
            )}{" "}
            {muted.includes(active)
              ? "Unmute notifications"
              : "Mute notifications"}
          </button>
          <div className="about">
            <span className="eyebrow">SHARED PHOTOS</span>
            <div className="shared-photos">
              {thread
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
            {!thread.some((m) => m.image) && <p>No shared photos yet.</p>}
          </div>
          <p className="privacy-note">
            <Info size={17} />
            This is a local demo. Messages are not sent to other users.
          </p>
        </aside>
      )}
      {modal && (
        <div className="modal-backdrop" onClick={() => setModal(null)}>
          <section
            role="dialog"
            aria-modal="true"
            aria-label={typeof modal === "object" ? "Shared photo" : modal}
            className={`modal ${modal.image ? "image-modal" : ""}`}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="icon-button modal-close"
              aria-label="Close dialog"
              onClick={() => setModal(null)}
            >
              <X />
            </button>
            {modal.image ? (
              <img src={modal.image} alt="Shared photo enlarged" />
            ) : modal === "new" ? (
              <>
                <span className="eyebrow">MAKE A CONNECTION</span>
                <h2>A new conversation.</h2>
                <p>Choose a demo contact to get started.</p>
                {people.map((p) => (
                  <button
                    key={p.id}
                    className="chat-row"
                    onClick={() => select(p)}
                  >
                    <Avatar person={p} />
                    <strong>{p.name}</strong>
                    <ArrowUpRight size={18} />
                  </button>
                ))}
              </>
            ) : modal === "settings" ? (
              <>
                <span className="eyebrow">YOUR LITTLE SPACE</span>
                <h2>Settings.</h2>
                <div className="setting-row">
                  <span>Message storage</span>
                  <strong>This device only</strong>
                </div>
                <div className="setting-row">
                  <span>Muted conversations</span>
                  <strong>{muted.length}</strong>
                </div>
                <div className="setting-row">
                  <span>App version</span>
                  <strong>Loop Chat demo 1.0</strong>
                </div>
                <p>
                  No account is connected. Calls, live delivery, and end-to-end
                  encryption are not implemented in this prototype.
                </p>
              </>
            ) : (
              <>
                <img
                  className="self-large"
                  src="/avatars/32.svg"
                  alt="Demo profile"
                />
                <h2>Hey, Alex.</h2>
                <p>Your demo profile. A little curious, always connected.</p>
                <span className="pill">LOCAL DEMO ACCOUNT</span>
              </>
            )}
          </section>
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
