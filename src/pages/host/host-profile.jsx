// ./src/pages/host/host-profile.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection,
  doc,
  onSnapshot,
  getDocs,
  query,
  where,
  setDoc,
  limit as qLimit,
  serverTimestamp,
} from "firebase/firestore";
import { auth, database } from "../../config/firebase";
import {
  User,
  GraduationCap,
  Briefcase,
  MapPin,
  Languages as LanguagesIcon,
  Calendar as CalendarIcon,
  Star,
  Home,
  Camera,
  X,
  UploadCloud,
  ShieldCheck,
} from "lucide-react";

/** Cloudinary (same as your setup page) */
const CLOUD_NAME = "dijmlbysr";
const UPLOAD_PRESET = "listing-uploads";

/* ----------------------- Helpers ----------------------- */
function tsToDate(ts) {
  if (!ts) return null;
  if (typeof ts?.toDate === "function") return ts.toDate();
  if (typeof ts === "string") {
    const d = new Date(ts);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const ms = (ts.seconds ?? 0) * 1000 + Math.floor((ts.nanoseconds ?? 0) / 1e6);
  const d = new Date(ms);
  return Number.isNaN(d.getTime()) ? null : d;
}
function calcAgeFromBirthdate(birth) {
  if (!birth) return null;
  const d = tsToDate(birth) || new Date(birth);
  if (!d || Number.isNaN(d.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
  return age;
}
function toArray(val) {
  if (!val) return [];
  if (Array.isArray(val)) return val;
  if (typeof val === "string")
    return val
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  return [];
}
async function uploadToCloudinary(file) {
  const fd = new FormData();
  fd.append("file", file);
  fd.append("upload_preset", UPLOAD_PRESET);
  const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, {
    method: "POST",
    body: fd,
  });
  const data = await res.json();
  if (!res.ok || !data?.secure_url) throw new Error(data?.error?.message || "Upload failed");
  return data.secure_url;
}

/* ----------------------- Tiny UI atoms ----------------------- */
function StatCard({ label, value, icon, accent = "from-blue-500 to-indigo-600" }) {
  return (
    <div className="relative rounded-3xl border border-white/60 bg-gradient-to-br from-white to-slate-50 shadow-[0_12px_30px_rgba(2,6,23,0.06)] hover:shadow-[0_18px_50px_rgba(2,6,23,0.12)] transition-transform will-change-transform hover:-translate-y-0.5">
      <div className="absolute -inset-px rounded-3xl bg-gradient-to-br from-white/30 to-white/5" />
      <div className="p-4 sm:p-5 relative">
        <div className={`inline-flex items-center gap-2 rounded-2xl px-2.5 py-1 text-xs font-medium bg-gradient-to-r ${accent} text-white shadow`}>
          {icon}
          <span>{label}</span>
        </div>
        <div className="mt-2 text-2xl font-bold tracking-tight text-slate-900">{value}</div>
      </div>
    </div>
  );
}
function FilledStar({ className = "w-4 h-4 text-amber-500" }) {
  return <Star className={className} fill="currentColor" />;
}

/* ----------------------- Edit Modal ----------------------- */
function EditHostProfileModal({ open, onClose, onSave, defaults = {} }) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    displayName: "",
    education: "",
    work: "",
    age: "",
    address: "",
    languages: [],
    about: "",
  });
  const [langInput, setLangInput] = useState("");

  // Avatar in-modal
  const [avatarURL, setAvatarURL] = useState(defaults.photoURL || "");
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const avatarInputRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setForm({
      displayName: defaults.displayName || "",
      education: defaults.education || defaults.collegeHighSchoolGraduateName || "",
      work: defaults.work || "",
      age: defaults.age ?? "",
      address: defaults.address || "",
      languages: toArray(defaults.languages),
      about: defaults.about || "",
    });
    setAvatarURL(defaults.photoURL || "");
    setLangInput("");
  }, [open, defaults]);

  const addLanguage = (val) => {
    const cleaned = (val || "").trim();
    if (!cleaned) return;
    if (form.languages.includes(cleaned)) return;
    setForm((p) => ({ ...p, languages: [...p.languages, cleaned] }));
    setLangInput("");
  };
  const removeLanguage = (idx) => {
    setForm((p) => ({ ...p, languages: p.languages.filter((_, i) => i !== idx) }));
  };

  const handlePickAvatar = () => avatarInputRef.current?.click();
  const onAvatarFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setUploadingAvatar(true);
      const url = await uploadToCloudinary(file);
      setAvatarURL(url);
    } catch (err) {
      console.error(err);
      alert("Failed to upload photo. Please try again.");
    } finally {
      setUploadingAvatar(false);
      if (avatarInputRef.current) avatarInputRef.current.value = "";
    }
  };

  const submit = async () => {
    setSaving(true);
    try {
      const payload = {
        photoURL: avatarURL || defaults.photoURL || "",
        displayName: form.displayName || defaults.displayName || "",
        collegeHighSchoolGraduateName: form.education || "",
        work: form.work || "",
        age: form.age === "" ? null : Number(form.age),
        address: form.address || "",
        languages: form.languages,
        about: form.about || "",
        updatedAt: serverTimestamp(),
      };
      await onSave(payload);
      onClose();
    } catch (e) {
      console.error(e);
      alert("Failed to save profile. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className={[
        "fixed inset-0 z-[100] transition",
        open ? "opacity-100" : "opacity-0 pointer-events-none",
      ].join(" ")}
      aria-hidden={!open}
      role="dialog"
      aria-modal="true"
    >
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-[101] flex min-h-full items-center justify-center p-3 sm:p-6">
        <div className="relative flex w-full max-w-3xl max-h-[92vh] flex-col overflow-hidden rounded-3xl border border-white/70 bg-gradient-to-br from-blue-50 via-white to-indigo-50 shadow-[0_12px_30px_rgba(30,58,138,0.12),_0_40px_80px_rgba(30,58,138,0.12)]">
          {/* Header */}
          <div className="sticky top-0 z-10 bg-white/85 backdrop-blur-md border-b border-white/60 px-4 sm:px-6 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="grid place-items-center w-9 h-9 rounded-xl bg-gradient-to-br from-blue-100 to-indigo-100 text-blue-700 ring-4 ring-white/60 shadow">
                <UploadCloud className="w-4.5 h-4.5" />
              </span>
              <h2 className="text-lg sm:text-xl font-semibold text-gray-900">Edit Host Profile</h2>
            </div>
            <button
              onClick={onClose}
              className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-white/90 hover:bg-white border border-gray-200 shadow"
              aria-label="Close"
            >
              <X className="w-5 h-5 text-gray-700" />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8 space-y-5">
            {/* Avatar upload row */}
            <div className="flex items-center gap-4">
              <div className="relative">
                <div className="h-16 w-16 rounded-full overflow-hidden bg-gradient-to-br from-indigo-200 to-blue-200 ring-2 ring-white shadow grid place-items-center">
                  {avatarURL ? (
                    <img src={avatarURL} alt="Profile" className="h-full w-full object-cover" />
                  ) : (
                    <User className="opacity-70" />
                  )}
                </div>
                {uploadingAvatar && (
                  <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 text-[10px] text-gray-600">Uploading…</div>
                )}
              </div>
              <div>
                <div className="text-sm font-semibold text-gray-900">Profile Photo</div>
                <p className="text-xs text-gray-600">Upload a clear photo—this is what guests will see.</p>
                <div className="mt-2 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handlePickAvatar}
                    className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-blue-500 to-blue-600 px-4 py-2 text-xs font-semibold text-white shadow hover:from-blue-600 hover:to-blue-700"
                  >
                    <Camera className="w-4 h-4" />
                    {avatarURL ? "Change Photo" : "Upload Photo"}
                  </button>
                  {avatarURL && (
                    <button
                      type="button"
                      onClick={() => setAvatarURL("")}
                      className="rounded-full border border-gray-300 bg-white px-3 py-2 text-xs font-medium text-gray-800 hover:bg-gray-50"
                    >
                      Remove
                    </button>
                  )}
                </div>
                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/*"
                  onChange={onAvatarFile}
                  className="hidden"
                />
              </div>
            </div>

            {/* Display Name */}
            <div className="grid gap-2">
              <label className="text-sm font-semibold text-gray-900">Display Name</label>
              <input
                type="text"
                value={form.displayName}
                onChange={(e) => setForm((p) => ({ ...p, displayName: e.target.value }))}
                placeholder="Your name as guests will see it"
                className="w-full rounded-2xl border border-gray-300 bg-white/90 px-4 py-3 text-gray-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400/40 focus:border-blue-500"
              />
            </div>

            {/* Education */}
            <div className="grid gap-2">
              <label className="text-sm font-semibold text-gray-900">College/High School Graduate Name</label>
              <input
                type="text"
                value={form.education}
                onChange={(e) => setForm((p) => ({ ...p, education: e.target.value }))}
                placeholder="e.g., Ateneo de Manila University"
                className="w-full rounded-2xl border border-gray-300 bg-white/90 px-4 py-3 text-gray-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400/40 focus:border-blue-500"
              />
            </div>

            {/* Work + Age */}
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="grid gap-2">
                <label className="text-sm font-semibold text-gray-900">Work</label>
                <input
                  type="text"
                  value={form.work}
                  onChange={(e) => setForm((p) => ({ ...p, work: e.target.value }))}
                  placeholder="e.g., Software Engineer"
                  className="w-full rounded-2xl border border-gray-300 bg-white/90 px-4 py-3 text-gray-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400/40 focus:border-blue-500"
                />
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-semibold text-gray-900">Age</label>
                <input
                  type="number"
                  min={0}
                  value={form.age}
                  onChange={(e) => setForm((p) => ({ ...p, age: e.target.value }))}
                  placeholder="e.g., 29"
                  className="w-full rounded-2xl border border-gray-300 bg-white/90 px-4 py-3 text-gray-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400/40 focus:border-blue-500"
                />
              </div>
            </div>

            {/* Address */}
            <div className="grid gap-2">
              <label className="text-sm font-semibold text-gray-900">Address</label>
              <input
                type="text"
                value={form.address}
                onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))}
                placeholder="City / Province / Country"
                className="w-full rounded-2xl border border-gray-300 bg-white/90 px-4 py-3 text-gray-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400/40 focus:border-blue-500"
              />
            </div>

            {/* Languages */}
            <div className="grid gap-2">
              <label className="text-sm font-semibold text-gray-900">Languages Spoken</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={langInput}
                  onChange={(e) => setLangInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === ",") {
                      e.preventDefault();
                      addLanguage(langInput);
                    }
                  }}
                  placeholder="Type a language and press Enter"
                  className="flex-1 rounded-2xl border border-gray-300 bg-white/90 px-4 py-3 text-gray-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400/40 focus:border-blue-500"
                />
                <button
                  type="button"
                  onClick={() => addLanguage(langInput)}
                  className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-blue-500 to-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-md hover:from-blue-600 hover:to-blue-700 transition"
                >
                  Add
                </button>
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {form.languages.map((lang, idx) => (
                  <span
                    key={`${lang}-${idx}`}
                    className="inline-flex items-center gap-2 pl-3 pr-2 py-1.5 rounded-full border border-blue-200 bg-blue-50 text-blue-700 text-xs sm:text-sm font-medium shadow-sm"
                  >
                    {lang}
                    <button
                      type="button"
                      onClick={() => removeLanguage(idx)}
                      className="grid place-items-center w-5 h-5 rounded-full hover:bg-blue-100"
                      aria-label={`Remove ${lang}`}
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </span>
                ))}
                {!form.languages.length && <span className="text-sm text-gray-600">No languages added yet.</span>}
              </div>
            </div>

            {/* About */}
            <div className="grid gap-2">
              <label className="text-sm font-semibold text-gray-900">About</label>
              <textarea
                rows={5}
                value={form.about}
                onChange={(e) => setForm((p) => ({ ...p, about: e.target.value }))}
                placeholder="Tell guests a bit about yourself, your hosting style, and your area."
                className="w-full rounded-2xl border border-gray-300 bg-white/90 px-4 py-3 text-gray-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400/40 focus:border-blue-500"
              />
            </div>
          </div>

          {/* Footer */}
          <div className="sticky bottom-0 z-10 bg-white/85 backdrop-blur-md border-t border-white/60 px-4 sm:px-6 py-3 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center justify-center rounded-full border border-gray-300 bg-white px-6 py-2.5 text-sm font-medium text-gray-800 hover:bg-gray-50 transition"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={submit}
              disabled={saving}
              className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-blue-500 to-blue-600 px-7 py-2.5 text-sm font-semibold text-white shadow-md hover:from-blue-600 hover:to-blue-700 transition disabled:opacity-50 disabled:pointer-events-none"
            >
              {saving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ----------------------- Main Profile ----------------------- */
export default function HostProfile() {
  const navigate = useNavigate();

  const [authUser, setAuthUser] = useState(null);
  const [uid, setUid] = useState(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setAuthUser(u || null);
      setUid(u?.uid || null);
    });
    return () => unsub();
  }, []);

  // host doc (by uid field, not doc id)
  const [host, setHost] = useState(null);
  const [hostDocId, setHostDocId] = useState(null);
  const [loadingHost, setLoadingHost] = useState(true);

  useEffect(() => {
    if (!uid) {
      setHost(null);
      setHostDocId(null);
      setLoadingHost(false);
      return;
    }
    setLoadingHost(true);
    const qHosts = query(collection(database, "hosts"), where("uid", "==", uid), qLimit(1));
    const unsub = onSnapshot(
      qHosts,
      (snap) => {
        if (snap.empty) {
          setHost(null);
          setHostDocId(null);
        } else {
          const d = snap.docs[0];
          setHost(d.data());
          setHostDocId(d.id);
        }
        setLoadingHost(false);
      },
      () => setLoadingHost(false)
    );
    return () => unsub();
  }, [uid]);

  // listings (by hostId OR uid OR ownerId)
  const [listings, setListings] = useState([]);
  const [loadingListings, setLoadingListings] = useState(true);

  useEffect(() => {
    if (!uid) {
      setListings([]);
      setLoadingListings(false);
      return;
    }
    setLoadingListings(true);

    // Attach three listeners and merge/dedupe by id
    const qs = [
      query(collection(database, "listings"), where("hostId", "==", uid)),
      query(collection(database, "listings"), where("uid", "==", uid)),
      query(collection(database, "listings"), where("ownerId", "==", uid)),
    ];

    const unsubs = qs.map((qRef) =>
      onSnapshot(
        qRef,
        (snap) => {
          setListings((prev) => {
            const next = new Map(prev.map((x) => [x.id, x]));
            snap.forEach((d) => next.set(d.id, { id: d.id, ...d.data() }));
            return Array.from(next.values());
          });
          setLoadingListings(false);
        },
        () => setLoadingListings(false)
      )
    );
    return () => unsubs.forEach((u) => u());
  }, [uid]);

  // ---------- Aggregate ratings across ALL reviews from ALL this host's listings ----------
  const [reviewsAgg, setReviewsAgg] = useState({ totalReviews: 0, avgRating: 0 });
  const [loadingReviewsAgg, setLoadingReviewsAgg] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function compute() {
      if (!listings?.length) {
        if (!cancelled) {
          setReviewsAgg({ totalReviews: 0, avgRating: 0 });
          setLoadingReviewsAgg(false);
        }
        return;
      }
      setLoadingReviewsAgg(true);

      try {
        let total = 0;
        let sum = 0;

        await Promise.all(
          listings.map(async (l) => {
            try {
              const sub = collection(database, "listings", l.id, "reviews");
              const snap = await getDocs(sub);
              if (!snap.empty) {
                let c = 0;
                let s = 0;
                snap.forEach((d) => {
                  const r = d.data();
                  const v = Number(r?.rating) || 0;
                  if (v > 0) {
                    c += 1;
                    s += v;
                  }
                });
                total += c;
                sum += s;
              } else {
                const count = Number(l?.reviewCount) || 0;
                const rating = Number(l?.rating) || 0;
                if (count > 0 && rating > 0) {
                  total += count;
                  sum += rating * count;
                }
              }
            } catch (e) {
              const count = Number(l?.reviewCount) || 0;
              const rating = Number(l?.rating) || 0;
              if (count > 0 && rating > 0) {
                total += count;
                sum += rating * count;
              }
            }
          })
        );

        const avg = total > 0 ? sum / total : 0;
        if (!cancelled) {
          setReviewsAgg({ totalReviews: total, avgRating: avg });
          setLoadingReviewsAgg(false);
        }
      } catch (e) {
        console.error("Failed to aggregate reviews:", e);
        if (!cancelled) {
          const ratings = listings.map((l) => Number(l?.rating) || 0).filter((v) => v > 0);
          const avg = ratings.length > 0 ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 0;
          setReviewsAgg({ totalReviews: 0, avgRating: avg });
          setLoadingReviewsAgg(false);
        }
      }
    }
    compute();
    return () => {
      cancelled = true;
    };
  }, [listings]);

  // ---------- Per-listing rating (for the cards) ----------
  const [listingRatings, setListingRatings] = useState({});
  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!listings?.length) {
        if (!cancelled) setListingRatings({});
        return;
      }
      const pairs = await Promise.all(
        listings.map(async (l) => {
          let avg = Number(l?.rating) || 0;
          let count = Number(l?.reviewCount) || 0;
          if (!count || !avg) {
            try {
              const sub = collection(database, "listings", l.id, "reviews");
              const snap = await getDocs(sub);
              let s = 0;
              let c = 0;
              snap.forEach((d) => {
                const v = Number(d.data()?.rating) || 0;
                if (v > 0) {
                  s += v;
                  c += 1;
                }
              });
              if (c > 0) {
                avg = s / c;
                count = c;
              }
            } catch {}
          }
          return [l.id, { avg, count }];
        })
      );
      if (!cancelled) setListingRatings(Object.fromEntries(pairs));
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [listings]);

  // Year started hosting = earliest listing createdAt/updatedAt year, fallback to host.createdAt
  const yearStartedHosting = useMemo(() => {
    const years = listings
      .map((l) => tsToDate(l.createdAt) || tsToDate(l.updatedAt))
      .filter(Boolean)
      .map((d) => d.getFullYear());
    if (years.length) return Math.min(...years);
    const h = tsToDate(host?.createdAt);
    return h ? h.getFullYear() : "—";
  }, [listings, host]);

  // UI helpers mapped to your schema
  const displayName =
    host?.displayName ||
    (host?.firstName || host?.lastName
      ? `${host.firstName ?? ""} ${host.lastName ?? ""}`.trim()
      : authUser?.displayName) ||
    "Host";
  const email = host?.email || authUser?.email || "—";
  const photoURL = host?.photoURL || "";
  const address = host?.address || host?.location || "—";
  const work = host?.work || host?.occupation || "—";
  const education = host?.education || host?.collegeHighSchoolGraduateName || "—";
  const languages = toArray(host?.languages);
  const about =
    host?.about ||
    "Tell guests a bit about yourself, your hosting style, and what you love about your area.";
  const age = host?.age ?? calcAgeFromBirthdate(host?.birthdate);
  const isVerified = !!(host?.isVerified ?? host?.verified ?? host?.verifiedHost);

  // Edit modal
  const [openEdit, setOpenEdit] = useState(false);

  const saveProfile = async (payload) => {
    if (!uid) throw new Error("Not signed in");
    const targetId = hostDocId || uid;
    await setDoc(doc(database, "hosts", targetId), { ...payload, uid }, { merge: true });
  };

  const ratingDisplay = loadingReviewsAgg
    ? "—"
    : reviewsAgg.avgRating
    ? reviewsAgg.avgRating.toFixed(2)
    : "No ratings yet";

  return (
    <section className="space-y-8">
      {/* Page header + subheading */}
      <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Host Profile</h1>
          <p className="text-sm text-gray-600">This is what guests see on your public profile. Keep it fresh and welcoming.</p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            className="rounded-xl px-4 py-2 text-sm font-medium shadow-sm border bg-white hover:bg-gray-50"
            onClick={() => setOpenEdit(true)}
          >
            Edit Profile
          </button>
        </div>
      </header>

      {/* Identity + About + Verified (separate badge card) */}
      <div className="grid gap-6 md:grid-cols-6">
        {/* Left: Identity */}
        <div className="col-span-2 rounded-3xl border border-white/60 bg-gradient-to-br from-white to-slate-50 p-6 shadow-[0_12px_30px_rgba(2,6,23,0.06)]">
          <div className="flex items-center gap-4">
            {/* Avatar now opens modal to edit/upload */}
            <button
              type="button"
              onClick={() => setOpenEdit(true)}
              className="group relative h-16 w-16 rounded-full overflow-hidden bg-gradient-to-br from-indigo-200 to-blue-200 grid place-items-center ring-2 ring-white shadow focus:outline-none focus:ring-4 focus:ring-blue-200"
              title="Change profile photo"
            >
              {photoURL ? (
                <img src={photoURL} alt={displayName} className="h-full w-full object-cover" />
              ) : (
                <User className="opacity-70" />
              )}
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition grid place-items-center">
                <Camera className="w-5 h-5 text-white opacity-0 group-hover:opacity-100 transition" />
              </div>
            </button>
            <div className="min-w-0">
              <div className="text-lg font-medium truncate">{loadingHost ? "Loading…" : displayName}</div>
              <div className="text-sm text-gray-500 truncate">{email}</div>
            </div>
          </div>

          {/* Quick facts */}
          <dl className="mt-6 space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <dt className="flex items-center gap-2 text-gray-500">
                <Briefcase size={16} /> Work
              </dt>
              <dd className="font-medium text-right">{work}</dd>
            </div>

            <div className="flex items-center justify-between">
              <dt className="flex items-center gap-2 text-gray-500">
                <GraduationCap size={16} /> College/HS Graduate
              </dt>
              <dd className="font-medium text-right">{education}</dd>
            </div>

            <div className="flex items-center justify-between">
              <dt className="flex items-center gap-2 text-gray-500">
                <MapPin size={16} /> Address
              </dt>
              <dd className="font-medium text-right">{address}</dd>
            </div>

            <div className="flex items-center justify-between">
              <dt className="flex items-center gap-2 text-gray-500">
                <User size={16} /> Age
              </dt>
              <dd className="font-medium text-right">{age ?? "—"}</dd>
            </div>
          </dl>
        </div>

        {/* Center: About (col-span-2) */}
        <div className="col-span-3 rounded-3xl border border-white/60 bg-gradient-to-br from-white to-slate-50 p-6 shadow-[0_12px_30px_rgba(2,6,23,0.06)]">
          <h2 className="text-base font-semibold flex items-center gap-2">
            <User className="w-4 h-4" /> About
          </h2>
          <p className="mt-2 text-sm text-gray-700 leading-relaxed max-w-prose">{about}</p>

          {languages.length > 0 && (
            <>
              <h3 className="mt-5 text-sm font-semibold flex items-center gap-2">
                <LanguagesIcon className="w-4 h-4" /> Languages
              </h3>
              <div className="mt-2 flex flex-wrap gap-2">
                {languages.map((lang) => (
                  <span
                    key={lang}
                    className="inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium text-gray-700 bg-gray-50"
                  >
                    {lang}
                  </span>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Right: Verified badge card */}
        <div className="col-span-1">
  <div
    className={[
      "h-full rounded-3xl border p-6 shadow-[0_12px_30px_rgba(2,6,23,0.06)]",
      isVerified
        ? "border-emerald-200 bg-gradient-to-br from-emerald-50 via-white to-emerald-50/60"
        : "border-gray-200 bg-gradient-to-br from-gray-50 via-white to-gray-50",
    ].join(" ")}
  >
    {/* Center the whole content and give the card some height so it can center vertically */}
    <div className="min-h-[220px] h-full flex flex-col items-center justify-center text-center gap-3">
      {/* Bigger badge icon */}
      <span
        className={[
          "grid place-items-center w-24 h-24 rounded-3xl ring-8",
          isVerified
            ? "bg-emerald-100 text-emerald-700 ring-white/70"
            : "bg-gray-100 text-gray-600 ring-white/70",
        ].join(" ")}
      >
        <ShieldCheck className="w-12 h-12" />
      </span>

      {/* Title + description */}
      <div>
        <div className={`text-base font-semibold ${isVerified ? "text-emerald-800" : "text-gray-800"}`}>
          {isVerified ? "Verified Host" : "Not Verified"}
        </div>
        <p className="mt-1 text-sm text-gray-600 max-w-[16rem] mx-auto">
          {isVerified
            ? "Your identity and details are verified."
            : "Complete verification to boost guest trust."}
        </p>
      </div>

      {/* Action */}
      {!isVerified && (
        <button
          type="button"
          onClick={() => navigate("/settings/verification")}
          className="mt-2 w-full rounded-full border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50"
        >
          Get Verified
        </button>
      )}
    </div>
  </div>
</div>

      </div>

      {/* Modern 3D Stats Row */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Listings"
          value={String(listings.length || 0)}
          icon={<Home className="w-4 h-4" />}
          accent="from-sky-500 to-cyan-600"
        />
        <StatCard
          label="Average Rating"
          value={ratingDisplay}
          icon={<FilledStar className="w-4 h-4 text-amber-500" />}
          accent="from-amber-500 to-orange-600"
        />
        <StatCard
          label="Reviews"
          value={loadingReviewsAgg ? "—" : String(reviewsAgg.totalReviews)}
          icon={<FilledStar className="w-4 h-4 text-amber-500" />}
          accent="from-violet-500 to-fuchsia-600"
        />
        <StatCard
          label="Started Hosting"
          value={String(yearStartedHosting)}
          icon={<CalendarIcon className="w-4 h-4" />}
          accent="from-emerald-500 to-teal-600"
        />
      </section>

      {/* Listings */}
      <section className="space-y-4">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-2xl font-semibold">Your Listings</h2>
            <p className="text-sm text-gray-600">A quick snapshot of your places, experiences, and services.</p>
          </div>
          <button
            onClick={() => navigate("/hostpage", { state: { activePage: "listings" } })}
            className="mt-1 text-sm font-medium text-blue-600 hover:text-blue-700"
          >
            Manage Listings
          </button>
        </div>

        {loadingListings ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="rounded-3xl border border-white/60 bg-white p-4 shadow animate-pulse">
                <div className="h-40 rounded-xl bg-gray-200" />
                <div className="mt-3 h-4 w-2/3 bg-gray-200 rounded" />
                <div className="mt-2 h-4 w-1/2 bg-gray-200 rounded" />
              </div>
            ))}
          </div>
        ) : listings.length === 0 ? (
          <div className="rounded-2xl border bg-white p-6 text-sm text-gray-600">
            You don’t have any listings yet.
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {listings.map((l) => {
              const cover =
                l.coverImageUrl ||
                (Array.isArray(l.images) && l.images[0]) ||
                (Array.isArray(l.photos) && l.photos[0]) ||
                "";
              const title = l.title || "Untitled listing";
              const loc = l.city || l.location || l.address?.city || l.address || "";
              const price = l.pricePerNight ?? l.nightlyPrice ?? l.price ?? null;

              const meta = listingRatings[l.id] || { avg: 0, count: 0 };
              const avg = Number(meta.avg) || 0;
              const count = Number(meta.count) || 0;

              const status = String(l.status || "").toLowerCase(); // published | draft | archived

              return (
                <div
                  key={l.id}
                  className="group rounded-3xl border border-white/60 bg-gradient-to-br from-white to-slate-50 overflow-hidden shadow-[0_12px_30px_rgba(2,6,23,0.06)] hover:shadow-[0_20px_60px_rgba(2,6,23,0.14)] transition"
                >
                  <div
                    className="h-40 w-full bg-gray-100 relative overflow-hidden cursor-pointer"
                    onClick={() => navigate(`/listing/${l.id}`)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        navigate(`/listing/${l.id}`);
                      }
                    }}
                  >
                    {cover ? (
                      <img
                        src={cover}
                        alt={title}
                        className="h-full w-full object-cover group-hover:scale-[1.03] transition"
                      />
                    ) : (
                      <div className="h-full w-full flex items-center justify-center text-gray-400">
                        <Home className="w-8 h-8" />
                      </div>
                    )}

                    {/* Status badge */}
                    {status && (
                      <div className="absolute top-3 left-3 text-[11px] px-2 py-1 rounded-full backdrop-blur bg-white/80 border border-white/80 shadow">
                        <span
                          className={
                            status === "published"
                              ? "text-green-700"
                              : status === "archived"
                              ? "text-slate-700"
                              : "text-amber-700"
                          }
                        >
                          {status}
                        </span>
                      </div>
                    )}

                    {/* Rating badge on image */}
                    <div className="absolute top-3 right-3 inline-flex items-center gap-1 rounded-full bg-black/60 text-white text-xs px-2 py-1">
                      <FilledStar className="w-3.5 h-3.5 text-amber-400" />
                      <span className="font-semibold">{count > 0 ? avg.toFixed(2) : "New"}</span>
                      {count > 0 && <span className="opacity-80">({count})</span>}
                    </div>

                    <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-transparent" />
                  </div>

                  <div className="p-4 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-sm font-semibold line-clamp-1">{title}</h3>
                      <div className="flex items-center gap-1 text-sm text-slate-800">
                        <FilledStar />
                        <span className="font-medium">{count > 0 ? avg.toFixed(2) : "—"}</span>
                        {count > 0 && <span className="text-gray-500">({count})</span>}
                      </div>
                    </div>

                    <div className="text-xs text-gray-600 line-clamp-1">{loc || "—"}</div>

                    {price != null && (
                      <div className="text-sm">
                        <span className="font-medium">₱{Number(price).toLocaleString()}</span>
                        <span className="text-gray-500"> / night</span>
                      </div>
                    )}
                    {/* No "View" button – card itself is clickable */}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Modal */}
      <EditHostProfileModal
        open={openEdit}
        onClose={() => setOpenEdit(false)}
        onSave={saveProfile}
        defaults={{
          displayName,
          education,
          work,
          age: age ?? "",
          address,
          languages,
          about,
          photoURL: photoURL,
        }}
      />
    </section>
  );
}
