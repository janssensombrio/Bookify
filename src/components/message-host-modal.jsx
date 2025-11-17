import React from "react";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  serverTimestamp,
} from "firebase/firestore";
import { database, auth } from "../config/firebase";
import { X } from "lucide-react";

/* ---------- tiny helpers ---------- */
const pick = (...vals) => {
  for (const v of vals) {
    if (v == null) continue;
    if (typeof v === "string") {
      const t = v.trim();
      if (t) return t;
      continue;
    }
    if (v) return v;
  }
  return null;
};

const normalizeHostSnap = (docSnap, fallbackUid) => {
  const d = docSnap?.data?.() || {};
  const first = pick(d.firstName, d.givenName, d.first_name);
  const last = pick(d.lastName, d.familyName, d.last_name);
  const displayName = pick(d.displayName, d.name, [first, last].filter(Boolean).join(" "));
  const photoURL = pick(d.photoURL, d.photoUrl, d.avatarURL, d.photo, d.avatar, d.profileImageUrl);
  return {
    id: docSnap?.id || null,
    uid: pick(d.uid, fallbackUid),
    email: pick(d.email),
    firstName: first,
    lastName: last,
    displayName,
    photoURL,
  };
};

const deriveName = (h) =>
  ([h?.firstName, h?.lastName].filter(Boolean).join(" ")) ||
  h?.displayName ||
  h?.email ||
  "Host";

/* ---------- avatar ---------- */
function HostAvatar({ host, size = 48, ring = true }) {
  const [imgOk, setImgOk] = React.useState(true);
  const initial = (deriveName(host)[0] || "H").toUpperCase();

  return (
    <div
      className={[
        "relative rounded-full bg-white/70 border border-white/60 overflow-hidden shrink-0 grid place-items-center text-gray-900 font-semibold",
        ring ? "ring-4 ring-white/60" : "",
      ].join(" ")}
      style={{ width: size, height: size }}
    >
      {host?.photoURL && imgOk ? (
        <img
          src={host.photoURL}
          alt={deriveName(host)}
          className="w-full h-full object-cover"
          referrerPolicy="no-referrer"
          loading="lazy"
          onError={() => setImgOk(false)}
        />
      ) : (
        <span className="select-none">{initial}</span>
      )}
    </div>
  );
}

/* ---------- main modal ---------- */
export const MessageHostModal = ({
  open = false,
  onClose = () => {},
  hostId,
  host: hostProp, // optional: pass resolved host for zero re-fetches
}) => {
  const [message, setMessage] = React.useState("");
  const [sending, setSending] = React.useState(false);
  const [sent, setSent] = React.useState(false);
  const [host, setHost] = React.useState(hostProp || null);
  const [loadingHost, setLoadingHost] = React.useState(false);
  const textareaRef = React.useRef(null);

  // Reset & focus when opened
  React.useEffect(() => {
    if (!open) return;
    setMessage("");
    setSending(false);
    setSent(false);
    const t = requestAnimationFrame(() => textareaRef.current?.focus());
    return () => cancelAnimationFrame(t);
  }, [open]);

  // Sync local host from prop
  React.useEffect(() => {
    if (hostProp) setHost(hostProp);
  }, [hostProp]);

  // Optionally fetch host if not provided but hostId exists
  React.useEffect(() => {
    let cancelled = false;
    if (!open) return;
    if (hostProp || !hostId) return;

    const fetchHost = async () => {
      try {
        setLoadingHost(true);
        // hosts first
        const hDoc = await getDoc(doc(database, "hosts", hostId));
        if (hDoc.exists()) {
          if (!cancelled) setHost(normalizeHostSnap(hDoc, hostId));
          return;
        }
        const hQ = await getDocs(query(collection(database, "hosts"), where("uid", "==", hostId)));
        if (!cancelled && !hQ.empty) {
          setHost(normalizeHostSnap(hQ.docs[0], hostId));
          return;
        }
        // fallback to users
        const uDoc = await getDoc(doc(database, "users", hostId));
        if (!cancelled && uDoc.exists()) {
          setHost(normalizeHostSnap(uDoc, hostId));
          return;
        }
        const uQ = await getDocs(query(collection(database, "users"), where("uid", "==", hostId)));
        if (!cancelled && !uQ.empty) {
          setHost(normalizeHostSnap(uQ.docs[0], hostId));
          return;
        }
      } catch (e) {
        console.warn("Failed to load host for messaging:", e);
      } finally {
        if (!cancelled) setLoadingHost(false);
      }
    };

    fetchHost();
    return () => { cancelled = true; };
  }, [open, hostId, hostProp]);

  // ESC to close
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey, { capture: true });
    return () => document.removeEventListener("keydown", onKey, { capture: true });
  }, [open, onClose]);

  const handleSend = async () => {
    const text = message.trim();
    if (!text || sending) return;
    const receiver = host?.uid || hostId;
    if (!receiver) {
      alert("Missing host id.");
      return;
    }
    setSending(true);
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) throw new Error("You must be logged in to send messages");

      await addDoc(collection(database, "messages"), {
        uid: currentUser.uid,
        senderId: currentUser.uid,
        receiverId: receiver,
        message: text,
        timestamp: serverTimestamp(),
      });

      setSent(true);
    } catch (err) {
      console.error(err);
      alert("Failed to send message: " + (err?.message || "Unknown error"));
    } finally {
      setSending(false);
    }
  };

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) onClose();
  };

  if (!open) return null;

  const hostName = deriveName(host);
  const hostEmail = host?.email || "";

  return (
    <div
      className={[
        "fixed inset-0 z-[2147483647]",
        "flex items-end sm:items-center justify-center",
        "p-0 sm:p-4", // mobile bottom-sheet feel
        "bg-black/40",
        "bg-[radial-gradient(ellipse_at_top,rgba(59,130,246,0.12),transparent_55%),radial-gradient(ellipse_at_bottom,rgba(99,102,241,0.12),transparent_55%)]",
        "backdrop-blur-md sm:backdrop-blur-lg supports-[backdrop-filter]:backdrop-blur-xl",
      ].join(" ")}
      role="dialog"
      aria-modal="true"
      aria-labelledby="message-host-title"
      onClick={handleBackdropClick}
    >
      {/* Card: full-width sheet on mobile, glass card on larger screens */}
      <div
        className={[
          // was: "relative w-full sm:w-auto sm:max-w-lg",
          "relative w-full sm:w-full sm:max-w-2xl md:max-w-3xl", // wider on desktop
          "rounded-t-3xl sm:rounded-[2rem] overflow-hidden",
          "bg-gradient-to-br from-blue-50/65 via-white/85 to-indigo-50/60",
          "border border-white/70 backdrop-blur-xl",
          "shadow-[0_12px_30px_rgba(30,58,138,0.12),_0_30px_60px_rgba(30,58,138,0.12)]",
        ].join(" ")}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close */}
        <button
          onClick={onClose}
          aria-label="Close"
          className="hidden sm:inline-flex absolute right-3 top-3 items-center justify-center w-10 h-10 rounded-full bg-white/95 border border-white/70 shadow hover:shadow-md hover:bg-white transition"
        >
          <X className="w-5 h-5 text-gray-700" />
        </button>

        {/* Header: Host identity */}
        <div className="px-5 pt-4 sm:px-6 sm:pt-6">
          <div className="flex items-center gap-3 sm:gap-4">
            <HostAvatar host={host} size={56} />
            <div className="min-w-0">
              <h3
                id="message-host-title"
                className="text-lg sm:text-xl font-bold text-gray-900 tracking-tight truncate"
                title={hostName}
              >
                Message {hostName}
              </h3>
              <p className="text-xs sm:text-sm text-gray-600 truncate" title={hostEmail}>
                {loadingHost ? "Loading host…" : hostEmail}
              </p>
            </div>
            {/* Mobile close button inside header */}
            <button
              onClick={onClose}
              aria-label="Close"
              className="ml-auto inline-flex sm:hidden items-center justify-center w-9 h-9 rounded-full bg-white/95 border border-white/70 shadow hover:shadow-md hover:bg-white transition"
            >
              <X className="w-5 h-5 text-gray-700" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-5 sm:p-6">
          {!sent ? (
            <>
              <div className="rounded-2xl bg-white/80 border border-white/60 shadow-sm">
                <textarea
                  ref={textareaRef}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder={`Say hello to ${hostName}…`}
                  rows={5}
                  maxLength={1000}
                  className={[
                    "w-full resize-none bg-transparent outline-none",
                    "p-4 text-sm sm:text-base text-gray-900 placeholder:text-gray-500",
                  ].join(" ")}
                  onKeyDown={(e) => {
                    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                />
                <div className="flex items-center justify-between px-4 py-2 border-t border-white/60">
                  <span className="text-xs text-gray-500">
                    Press <kbd className="px-1.5 py-0.5 rounded bg-gray-100 border">⌘/Ctrl</kbd>{" "}
                    + <kbd className="px-1.5 py-0.5 rounded bg-gray-100 border">Enter</kbd> to send
                  </span>
                  <span className="text-xs text-gray-500">{message.trim().length}/1000</span>
                </div>
              </div>

              <div className="mt-4 flex flex-col sm:flex-row sm:items-center sm:justify-end gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={sending}
                  className="inline-flex items-center justify-center rounded-full border border-gray-300 bg-white px-5 py-2.5 text-sm font-medium text-gray-800 hover:bg-gray-50 transition disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSend}
                  disabled={sending || !message.trim() || !(host?.uid || hostId)}
                  className={[
                    "inline-flex items-center justify-center rounded-full",
                    "bg-gradient-to-r from-blue-500 to-blue-600 px-6 py-2.5",
                    "text-sm font-semibold text-white shadow-md",
                    "hover:from-blue-600 hover:to-blue-700 active:scale-[0.99] transition",
                    (sending || !message.trim() || !(host?.uid || hostId))
                      ? "opacity-50 pointer-events-none"
                      : "",
                  ].join(" ")}
                >
                  {sending ? "Sending..." : "Send"}
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="rounded-2xl bg-white/80 border border-white/60 shadow-sm p-4 sm:p-5">
                <p className="text-base sm:text-lg font-semibold text-gray-900">
                  Message sent to {hostName}! 🎉
                </p>
                <p className="mt-1 text-sm text-gray-700">
                  We’ll notify you when the host replies.
                </p>
              </div>

              <div className="mt-4 flex flex-col sm:flex-row sm:items-center sm:justify-end gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="inline-flex items-center justify-center rounded-full border border-gray-300 bg-white px-5 py-2.5 text-sm font-medium text-gray-800 hover:bg-gray-50 transition"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={() => window.location.assign("/guest-messages")}
                  className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-blue-500 to-blue-600 px-6 py-2.5 text-sm font-semibold text-white shadow-md hover:from-blue-600 hover:to-blue-700 active:scale-[0.99] transition"
                >
                  Go to Messages
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
