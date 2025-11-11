// src/pages/profile/ProfilePage.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  collection,
  getDocs,
  getDoc,
  onSnapshot,
  doc,
  query,
  where,
  orderBy,
  limit,
  setDoc,
  serverTimestamp,
  runTransaction,
} from "firebase/firestore";
import { auth, database } from "../../config/firebase";

// ======= Shared layout/components =======
import Sidebar from "./components/sidebar.jsx";
import { useSidebar } from "../../context/SidebarContext";
import BookifyLogo from "../../components/bookify-logo.jsx";
import HostCategModal from "../../components/host-categ-modal.jsx";
import HostPoliciesModal from "./components/HostPoliciesModal.jsx";

// (optional) listing detail modals if triggered from wishlist/recent sections
import HomeDetailsModal from "../../components/HomeDetailsModal";
import ExperienceDetailsModal from "../../components/ExperienceDetailsModal";
import ServiceDetailsModal from "../../components/ServiceDetailsModal";

import {
  User,
  Edit3,
  Mail,
  CalendarDays,
  Clock,
  Image as ImageIcon,
  Save,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Shield,
  ShieldCheck,
  Key,
  Phone,
  Heart,
  BedDouble,
  MapPin,
  Settings,
  X,
  Check,
  Plus,
  Tag,
  Sparkles,
  Building2,
  Handshake,
  Wifi,
  Sun,
  Volume2,
  StickyNote,
  Layers,
  Users,
  Mic,
  Camera,
  Timer,
  CloudSun,
  Tags,
  Leaf,
  PawPrint,
  BadgeCheck,
  CalendarClock,
  Wrench,
  Gift,
  Utensils,
  Menu,
  Compass,
  UploadCloud,
  Coins,
  Wallet,
} from "lucide-react";

/* ======================= Small helpers ======================= */
const peso = (v) => {
  const n = Number(v || 0);
  return Number.isFinite(n) ? `₱${n.toLocaleString("en-PH", { maximumFractionDigits: 2 })}` : "—";
};
// 20 pts = 10 pesos -> 1 pt = ₱0.5
const ptsToPHP = (pts) => Number((Number(pts || 0) * 0.5).toFixed(2));

const createdAtText = (u) =>
  u?.metadata?.creationTime ? new Date(u.metadata.creationTime).toLocaleDateString() : "—";
const lastLoginText = (u) =>
  u?.metadata?.lastSignInTime ? new Date(u.metadata.lastSignInTime).toLocaleString() : "—";
const PLACEHOLDER_IMG = "/placeholder.jpg";

/* ======================= Cloudinary (avatars) ======================= */
const CLOUD_NAME = "dijmlbysr";
const UPLOAD_PRESET = "listing-uploads";

async function uploadToCloudinary(file) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", UPLOAD_PRESET);

  const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, {
    method: "POST",
    body: formData,
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`Upload failed (${res.status}). ${t}`);
  }
  const data = await res.json();
  if (!data?.secure_url) throw new Error("No secure_url returned by Cloudinary.");
  return data.secure_url;
}

/* ======================= UI primitives ======================= */
const Line = ({ w = "100%" }) => (
  <div className="h-4 rounded bg-slate-200/80 animate-pulse" style={{ width: w }} />
);

const CardSkeleton = () => (
  <div className="rounded-2xl border border-slate-200 bg-white/70 shadow p-4">
    <div className="h-40 w-full rounded-xl bg-slate-200/80 animate-pulse mb-3" />
    <div className="space-y-2">
      <Line w="70%" />
      <Line w="40%" />
      <Line w="55%" />
    </div>
  </div>
);

const ChipToggle = ({ selected, onClick, children }) => (
  <button
    type="button"
    onClick={onClick}
    className={`inline-flex items-center gap-2 px-3 sm:px-4 py-2 rounded-full text-sm border transition min-h-10 select-none focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-100 ${
      selected
        ? "bg-blue-600 text-white border-blue-600 shadow"
        : "bg-white/80 text-slate-700 border-slate-200 hover:bg-white"
    }`}
  >
    {selected ? <Check size={16} className="shrink-0" /> : null}
    {children}
  </button>
);

const RemovableTag = ({ label, onRemove }) => (
  <span className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs sm:text-sm bg-slate-100 border border-slate-200">
    {label}
    <button
      type="button"
      onClick={onRemove}
      className="p-0.5 rounded hover:bg-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-200"
      aria-label={`Remove ${label}`}
      title={`Remove ${label}`}
    >
      <X size={14} className="shrink-0" />
    </button>
  </span>
);

/* Mobile-safe TagInput */
function TagInput({ placeholder = "Add item and press Enter", onAdd }) {
  const [value, setValue] = useState("");
  return (
    <div className="mt-2 flex flex-col sm:flex-row sm:items-center gap-2">
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && value.trim()) {
            onAdd?.(value.trim());
            setValue("");
          }
        }}
        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 focus:ring-4 focus:ring-blue-100 outline-none"
        placeholder={placeholder}
      />
      <button
        type="button"
        onClick={() => {
          if (value.trim()) {
            onAdd?.(value.trim());
            setValue("");
          }
        }}
        className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-3 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 min-h-10"
      >
        <Plus size={18} className="shrink-0" />
        <span className="text-sm">Add</span>
      </button>
    </div>
  );
}

/* ======================= Defaults ======================= */
const defaultHomePrefs = {
  privacyLevel: "entire-place",
  cleanlinessTier: "hotel",
  scentPreference: "unscented",
  linens: { threadCount: 300, towels: "plush", pillowFirmness: "medium", duvetWarmth: "medium" },
  hypoallergenic: false,
  mattressFirmness: "medium",
  noiseTolerance: "quiet",
  quietHours: "22:00–07:00",
  airPurifier: false,
  hotWater: true,
  lighting: "warm",
  workspace: { wifiMinMbps: 25, desk: true, ergoChair: false, backupWifi: false },
  kitchenMust: [],
  welcomeStocking: [],
  accessibility: [],
  safetyRequests: [],
  hostInteraction: "as-needed",
  rulesFlexibility: "standard",
  amenitiesMust: [],
  amenitiesNice: [],
  locations: [],
  notes: "",
};

const defaultExpPrefs = {
  pace: "balanced",
  depth: "story-rich",
  personalization: "some",
  groupType: "small-group",
  guideStyle: "friendly",
  crowdTolerance: "low",
  comfortAccessibility: [],
  languageLevel: "conversational",
  audioSupport: false,
  photoConsent: "yes",
  photosPriority: false,
  durationFlexibility: "small-adjustments",
  weatherPlan: "reschedule-or-indoors",
  dietRestrictions: [],
  allergies: [],
  themes: [],
  locations: [],
  notes: "",
};

const defaultSrvPrefs = {
  thoroughness: "deep",
  timePrecision: "window-1h",
  proofOfWork: ["before/after photos"],
  immediateDamageReport: true,
  focusChecklist: [],
  ecoSupplies: true,
  unscented: false,
  linensHandling: "wash-and-return",
  professionalism: ["ID on arrival"],
  petSafety: true,
  entryMethod: "smart-lock",
  supervision: "absent",
  scheduleDays: ["Mon", "Wed", "Fri"],
  scheduleWindow: "09:00–12:00",
  quietHours: "after 21:00",
  languages: [],
  serviceTypes: [],
  locations: [],
  notes: "",
};

/* ======================= Settings alert ======================= */
function SettingsAlert({ kind = "info", children }) {
  const styles =
    kind === "success"
      ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
      : kind === "error"
      ? "bg-rose-50 text-rose-700 border border-rose-200"
      : "bg-blue-50 text-blue-700 border border-blue-200";
  const Icon = kind === "success" ? CheckCircle2 : kind === "error" ? AlertCircle : Shield;
  return (
    <div className={`mt-3 inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm ${styles}`}>
      <Icon size={16} className="shrink-0" /> {children}
    </div>
  );
}

/* ======================= Account Settings Card ======================= */
function AccountSettingsCard({ user, onProfilePatched, showResetPassword = true }) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saveMsg, setSaveMsg] = useState(null);

  const [displayName, setDisplayName] = useState("");
  const [photoURL, setPhotoURL] = useState("");
  const [emailVerified, setEmailVerified] = useState(!!user?.emailVerified);

  const [phoneNumber, setPhoneNumber] = useState(user?.phoneNumber || "");
  const [verificationId, setVerificationId] = useState(null);
  const [smsCode, setSmsCode] = useState("");
  const [verifyingPhone, setVerifyingPhone] = useState(false);
  const recaptchaRef = useRef(null);

  // Avatar upload state
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    let alive = true;
    const run = async () => {
      try {
        if (!user) return;
        setDisplayName(user.displayName || "");
        setPhotoURL(user.photoURL || "");
        setEmailVerified(!!user.emailVerified);

        const uref = doc(database, "users", user.uid);
        const usnap = await getDoc(uref);
        if (!alive) return;
        if (usnap.exists()) {
          const d = usnap.data();
          setPhoneNumber(d?.phoneNumber || user.phoneNumber || "");
        }
      } catch (e) {
        console.error(e);
      } finally {
        if (alive) setLoading(false);
      }
    };
    run();
    return () => {
      alive = false;
    };
  }, [user]);

  const resetProfile = () => {
    if (!user) return;
    setDisplayName(user.displayName || "");
    setPhotoURL(user.photoURL || "");
  };

  const saveProfile = async () => {
    if (!user) return;
    setSaveMsg(null);
    try {
      const { updateProfile } = await import("firebase/auth");
      await updateProfile(auth.currentUser, {
        displayName: displayName || null,
        photoURL: photoURL || null,
      });
      await auth.currentUser.reload();

      const uref = doc(database, "users", user.uid);
      await setDoc(
        uref,
        {
          uid: user.uid,
          email: user.email || "",
          phoneNumber: phoneNumber || "",
          displayName: displayName || "",
          photoURL: photoURL || "",
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      onProfilePatched?.({ displayName: displayName || "", photoURL: photoURL || "" });

      setSaveMsg({ type: "success", text: "Profile updated successfully." });
    } catch (e) {
      console.error(e);
      setSaveMsg({ type: "error", text: e?.message || "Failed to update profile." });
    }
  };

  const sendVerifyEmail = async () => {
    if (!user) return;
    setSaveMsg(null);
    try {
      await (await import("firebase/auth")).sendEmailVerification(user);
      setSaveMsg({ type: "success", text: "Verification email sent." });
    } catch (e) {
      setSaveMsg({ type: "error", text: e?.message || "Failed to send verification email." });
    }
  };

  const ensureRecaptcha = () => {
    if (recaptchaRef.current) return recaptchaRef.current;
    const { RecaptchaVerifier } = require("firebase/auth");
    const verifier = new RecaptchaVerifier(auth, "recaptcha-container", { size: "invisible" });
    recaptchaRef.current = verifier;
    return verifier;
  };

  const startPhoneVerification = async () => {
    if (!user) return;
    if (!phoneNumber || phoneNumber.length < 8) {
      return setSaveMsg({ type: "error", text: "Enter a valid phone number with country code, e.g. +63…" });
    }
    setSaveMsg(null);
    setVerifyingPhone(true);
    try {
      const { linkWithPhoneNumber, PhoneAuthProvider } = require("firebase/auth");
      const appVerifier = ensureRecaptcha();
      try {
        const confirmation = await linkWithPhoneNumber(user, phoneNumber, appVerifier);
        setVerificationId(confirmation.verificationId);
        setSaveMsg({ type: "success", text: "SMS sent. Enter the 6-digit code to verify." });
      } catch (err) {
        if (err?.code === "auth/provider-already-linked" || err?.code === "auth/credential-already-in-use") {
          const provider = new PhoneAuthProvider(auth);
          const vid = await provider.verifyPhoneNumber(phoneNumber, appVerifier);
          setVerificationId(vid);
          setSaveMsg({ type: "success", text: "SMS sent. Enter the 6-digit code to verify." });
        } else {
          throw err;
        }
      }
    } catch (e) {
      console.error(e);
      setSaveMsg({ type: "error", text: e?.message || "Failed to start phone verification." });
    } finally {
      setVerifyingPhone(false);
    }
  };

  const confirmPhoneCode = async () => {
    const { updatePhoneNumber, PhoneAuthProvider } = require("firebase/auth");
    if (!auth.currentUser || !verificationId || !smsCode) return;
    setSaveMsg(null);
    setVerifyingPhone(true);
    try {
      const cred = PhoneAuthProvider.credential(verificationId, smsCode);
      await updatePhoneNumber(auth.currentUser, cred);
      await setDoc(
        doc(database, "users", auth.currentUser.uid),
        { uid: auth.currentUser.uid, phoneNumber, phoneVerifiedAt: serverTimestamp() },
        { merge: true }
      );
      setSaveMsg({ type: "success", text: "Phone number verified." });
      setVerificationId(null);
      setSmsCode("");
    } catch (e) {
      console.error(e);
      setSaveMsg({ type: "error", text: e?.message || "Invalid code or expired. Try again." });
    } finally {
      setVerifyingPhone(false);
    }
  };

  const resetPassword = async () => {
    if (!auth.currentUser?.email) return setSaveMsg({ type: "error", text: "No email associated with this account." });
    setSaveMsg(null);
    try {
      await (await import("firebase/auth")).sendPasswordResetEmail(auth, auth.currentUser.email);
      setSaveMsg({ type: "success", text: "Password reset email sent." });
    } catch (e) {
      console.error(e);
      setSaveMsg({ type: "error", text: e?.message || "Failed to send reset email." });
    }
  };

  const onPickAvatar = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!/^image\//.test(file.type)) {
      setSaveMsg({ type: "error", text: "Please select an image file." });
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setSaveMsg({ type: "error", text: "Image too large (max 10MB)." });
      return;
    }
    setSaveMsg(null);
    setUploadingAvatar(true);
    try {
      const url = await uploadToCloudinary(file);
      setPhotoURL(url);
      setSaveMsg({ type: "success", text: "Photo uploaded. Click ‘Save changes’ to update your profile." });
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (err) {
      console.error(err);
      setSaveMsg({ type: "error", text: err?.message || "Failed to upload photo." });
    } finally {
      setUploadingAvatar(false);
    }
  };

  if (!user) return <div className="text-sm text-slate-600">Signing out…</div>;
  if (loading) return <div className="text-sm text-slate-600">Loading settings…</div>;

  // CHANGED LAYOUT: full-width stack (no Security column)
  return (
    <div className="space-y-6">
      {/* Profile */}
      <div>
        <h4 className="font-semibold mb-4 flex items-center gap-2">
          <Shield size={18} className="shrink-0" /> Account Settings — Profile
        </h4>
        <div className="space-y-4">
          {/* Display name */}
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Display name</span>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 outline-none focus:ring-4 focus:ring-blue-100"
              placeholder="Your name"
            />
          </label>

          {/* Profile photo — Cloudinary upload */}
          <div className="block">
            <span className="text-sm font-medium text-slate-700">Profile photo</span>
            <div className="mt-2 flex items-center gap-3">
              <div className="h-16 w-16 rounded-full bg-slate-200 overflow-hidden ring-2 ring-white shadow">
                {photoURL ? (
                  <img src={photoURL} alt="Avatar preview" className="h-full w-full object-cover" />
                ) : (
                  <div className="h-full w-full grid place-items-center">
                    <ImageIcon className="text-slate-500" />
                  </div>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <input
                  ref={fileInputRef}
                  id="avatar-upload"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={onPickAvatar}
                />
                <label
                  htmlFor="avatar-upload"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-white bg-blue-600 hover:bg-blue-700 shadow cursor-pointer disabled:opacity-60"
                >
                  {uploadingAvatar ? (
                    <Loader2 size={16} className="animate-spin shrink-0" />
                  ) : (
                    <UploadCloud size={16} className="shrink-0" />
                  )}
                  {uploadingAvatar ? "Uploading…" : "Upload new photo"}
                </label>

                {photoURL && (
                  <button
                    type="button"
                    onClick={() => setPhotoURL("")}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50"
                  >
                    <X size={16} className="shrink-0" /> Remove
                  </button>
                )}
              </div>
            </div>
            <p className="mt-1 text-xs text-slate-500">JPEG/PNG • up to 10MB • Stored via Cloudinary</p>
          </div>

          {/* Primary email + verify */}
          <div>
            <span className="text-sm font-medium text-slate-700">Primary email</span>
            <div className="mt-1 flex items-center gap-2">
              <input
                disabled
                value={auth.currentUser?.email || ""}
                className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-slate-700"
              />
              <button
                onClick={sendVerifyEmail}
                disabled={emailVerified}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-60"
              >
                <Mail size={16} className="shrink-0" /> {emailVerified ? "Verified" : "Send verification"}
              </button>
            </div>
          </div>

          {/* Phone + verify */}
          <div>
            <span className="text-sm font-medium text-slate-700">Phone (verify)</span>
            <div className="mt-1 flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1 min-w-0">
                <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                  <Phone size={16} />
                </div>
                <input
                  type="tel"
                  inputMode="tel"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  className="pl-9 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 outline-none focus:ring-4 focus:ring-blue-100"
                  placeholder="e.g. +63 912 345 6789"
                />
              </div>
              {!verificationId ? (
                <button
                  onClick={startPhoneVerification}
                  disabled={verifyingPhone || !phoneNumber}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-white bg-blue-600 hover:bg-blue-700 shadow disabled:opacity-60"
                >
                  {verifyingPhone ? <Loader2 size={16} className="animate-spin shrink-0" /> : <Shield size={16} className="shrink-0" />}
                  Verify phone
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    inputMode="numeric"
                    value={smsCode}
                    onChange={(e) => setSmsCode(e.target.value)}
                    className="w-40 rounded-xl border border-slate-300 bg-white px-3 py-2 outline-none focus:ring-4 focus:ring-blue-100"
                    placeholder="6-digit code"
                    aria-label="SMS verification code"
                  />
                  <button
                    onClick={confirmPhoneCode}
                    disabled={verifyingPhone || !smsCode}
                    className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-white bg-blue-600 hover:bg-blue-700 shadow disabled:opacity-60"
                  >
                    {verifyingPhone ? (
                      <Loader2 size={16} className="animate-spin shrink-0" />
                    ) : (
                      <CheckCircle2 size={16} className="shrink-0" />
                    )}
                    Confirm
                  </button>
                </div>
              )}
            </div>
            <div id="recaptcha-container" />
          </div>

          {/* Actions */}
          <div className="flex flex-wrap gap-3 pt-2">
            <button
              onClick={saveProfile}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-white bg-blue-600 hover:bg-blue-700 shadow"
            >
              <Save size={16} className="shrink-0" /> Save changes
            </button>
            <button
              onClick={resetProfile}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50"
            >
              <RotateCcw size={16} className="shrink-0" /> Reset
            </button>
            {showResetPassword && (
              <button
                onClick={resetPassword}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-white bg-blue-600 hover:bg-blue-700 shadow"
              >
                <Key size={16} className="shrink-0" /> Reset Password
              </button>
            )}
            {/* Logout button removed as requested */}
          </div>

          {saveMsg && (
            <SettingsAlert kind={saveMsg.type === "success" ? "success" : "error"}>{saveMsg.text}</SettingsAlert>
          )}
        </div>
      </div>

      {/* Security column removed */}
    </div>
  );
}

/* ======================= Tiny Listing Card (used in Recent) ======================= */
function TinyListingCard({ item, kind, onClick }) {
  const img = item?.photos?.[0] || item?.photos?.[1] || item?.cover || PLACEHOLDER_IMG;
  const title = item?.title || item?.name || "Untitled";
  const where = item?.location || item?.municipality?.name || item?.province?.name || item?.city || item?.area || "—";
  const nightly = item?.price ?? item?.cost ?? item?.rate ?? item?.pricePerNight;

  return (
    <button
      onClick={onClick}
      className="relative text-left group rounded-2xl border border-slate-200 bg-white/70 hover:bg-white transition shadow-sm overflow-hidden focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-100"
    >
      <div className="relative h-40 sm:h-44 w-full overflow-hidden">
        <img
          src={img}
          alt={title}
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.05]"
          loading="lazy"
        />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent" />
        <span className="absolute top-2 left-2 rounded-full text-xs px-2 py-1 bg-white/90 border border-slate-200 text-slate-700">
          {kind === "home" ? "Home" : kind === "experience" ? "Experience" : "Service"}
        </span>
      </div>
      <div className="p-4">
        <p className="font-semibold text-slate-900 truncate">{title}</p>
        <div className="mt-1 flex items-center gap-2 text-sm text-slate-600">
          <MapPin size={16} className="shrink-0 text-slate-500" />
          <span className="truncate">{where}</span>
        </div>
        <div className="mt-2 flex items-center gap-2 text-slate-700">
          <Tag size={16} className="shrink-0" />
          <span className="font-semibold">{nightly != null ? peso(nightly) : "—"}</span>
          <span className="text-xs text-slate-500">/ night</span>
        </div>
      </div>
    </button>
  );
}

/* ======================= Preferences UI helpers ======================= */
function SectionTitle({ icon: Icon, children }) {
  return (
    <h4 className="font-semibold text-slate-900 flex items-center gap-2">
      <Icon size={18} className="shrink-0" /> {children}
    </h4>
  );
}

function Labeled({ label, children }) {
  return (
    <label className="block min-w-0">
      <span className="block text-sm font-medium text-slate-700 mb-1">{label}</span>
      {children}
    </label>
  );
}

/* ======================= Summary helpers (Homes split) ======================= */
function summarizeHomes(p) {
  const wifi = p?.workspace?.wifiMinMbps ?? 0;

  const lines = [
    `Privacy: ${p.privacyLevel}`,
    `Cleanliness: ${p.cleanlinessTier}`,
    `Scent: ${p.scentPreference}`,
    p?.linens?.threadCount != null ? `Sheets (thread count): ${p.linens.threadCount} tc` : null,
    p?.linens?.towels ? `Towels: ${p.linens.towels}` : null,
    p?.linens?.pillowFirmness ? `Pillow firmness: ${p.linens.pillowFirmness}` : null,
    p?.linens?.duvetWarmth ? `Duvet warmth: ${p.linens.duvetWarmth}` : null,
    `Mattress: ${p.mattressFirmness}`,
    `Noise: ${p.noiseTolerance}`,
    `Quiet hours: ${p.quietHours}`,
    `Lighting: ${p.lighting}`,
    `Wi-Fi minimum: ${wifi} Mbps`,
    `Desk: ${p?.workspace?.desk ? "Yes" : "No"}`,
    `Ergonomic chair: ${p?.workspace?.ergoChair ? "Yes" : "No"}`,
    `Backup Wi-Fi: ${p?.workspace?.backupWifi ? "Yes" : "No"}`,
    `Hypoallergenic: ${p.hypoallergenic ? "Yes" : "No"}`,
    `Air purifier: ${p.airPurifier ? "Yes" : "No"}`,
    `Hot water: ${p.hotWater ? "Yes" : "No"}`,
    p.kitchenMust?.length ? `Kitchen: ${p.kitchenMust.join(", ")}` : null,
    p.welcomeStocking?.length ? `Welcome: ${p.welcomeStocking.join(", ")}` : null,
    p.accessibility?.length ? `Accessibility: ${p.accessibility.join(", ")}` : null,
    p.safetyRequests?.length ? `Safety: ${p.safetyRequests.join(", ")}` : null,
    p.amenitiesMust?.length ? `Must: ${p.amenitiesMust.join(", ")}` : null,
    p.amenitiesNice?.length ? `Nice: ${p.amenitiesNice.join(", ")}` : null,
    p.locations?.length ? `Locations: ${p.locations.join(", ")}` : null,
  ];

  return lines.filter(Boolean);
}

function summarizeExperiences(p) {
  const lines = [
    `Pace: ${p.pace}`,
    `Depth: ${p.depth}`,
    `Personalization: ${p.personalization}`,
    `Group: ${p.groupType}`,
    `Guide style: ${p.guideStyle}`,
    `Crowd tolerance: ${p.crowdTolerance}`,
    `Language level: ${p.languageLevel}`,
    `Audio support: ${p.audioSupport ? "Yes" : "No"}`,
    `Photo consent: ${p.photoConsent}`,
    `Photos priority: ${p.photosPriority ? "Yes" : "No"}`,
    `Duration flexibility: ${p.durationFlexibility}`,
    `Weather plan: ${p.weatherPlan}`,
    p.comfortAccessibility?.length ? `Comfort/Access: ${p.comfortAccessibility.join(", ")}` : null,
    p.dietRestrictions?.length ? `Diet: ${p.dietRestrictions.join(", ")}` : null,
    p.allergies?.length ? `Allergies: ${p.allergies.join(", ")}` : null,
    p.themes?.length ? `Themes: ${p.themes.join(", ")}` : null,
    p.locations?.length ? `Locations: ${p.locations.join(", ")}` : null,
  ];
  return lines.filter(Boolean);
}

function summarizeServices(p) {
  const lines = [
    `Thoroughness: ${p.thoroughness}`,
    `Time precision: ${p.timePrecision}`,
    `Proof of work: ${(p.proofOfWork || []).join(", ") || "—"}`,
    `Damage report: ${p.immediateDamageReport ? "Immediate" : "Non-immediate"}`,
    `Eco supplies: ${p.ecoSupplies ? "Yes" : "No"}`,
    `Unscented: ${p.unscented ? "Yes" : "No"}`,
    `Linens: ${p.linensHandling}`,
    `Professionalism: ${(p.professionalism || []).join(", ") || "—"}`,
    `Pet safety: ${p.petSafety ? "Yes" : "No"}`,
    `Entry: ${p.entryMethod}`,
    `Supervision: ${p.supervision}`,
    `Schedule window: ${p.scheduleWindow}`,
    p.scheduleDays?.length ? `Days: ${p.scheduleDays.join(", ")}` : null,
    p.focusChecklist?.length ? `Focus: ${p.focusChecklist.join(", ")}` : null,
    p.serviceTypes?.length ? `Types: ${p.serviceTypes.join(", ")}` : null,
    p.languages?.length ? `Languages: ${p.languages.join(", ")}` : null,
    p.locations?.length ? `Locations: ${p.locations.join(", ")}` : null,
  ];
  return lines.filter(Boolean);
}

/* ===== Fallback lucide aliases used in labelIcon ===== */
function Wand2Icon(props) {
  return <Sparkles {...props} />;
}
function ListChecks(props) {
  return <BadgeCheck {...props} />;
}
function Wheelchair(props) {
  return <AccessibilityFallback {...props} />;
}
function AccessibilityFallback(props) {
  return <Users {...props} />;
}
function Eye(props) {
  return <Users {...props} />;
}

/* ======================= Icon mapping for wishlist ======================= */
const labelIcon = (label) => {
  const L = (label || "").toLowerCase();

  if (L.includes("privacy")) return Shield;
  if (L.includes("cleanliness")) return Sparkles;
  if (L.includes("scent")) return CloudSun;
  if (L.includes("sheets") || L.includes("thread")) return BedDouble;
  if (L.includes("towels")) return BedDouble;
  if (L.includes("pillow")) return BedDouble;
  if (L.includes("duvet")) return BedDouble;
  if (L.includes("mattress")) return BedDouble;
  if (L.includes("noise")) return Volume2;
  if (L.includes("quiet hours")) return Clock;
  if (L.includes("lighting")) return Sun;
  if (L.includes("wi-fi") || L.includes("wifi")) return Wifi;
  if (L.startsWith("desk")) return Wrench;
  if (L.includes("ergonomic") || L.includes("ergo")) return BadgeCheck;
  if (L.includes("backup wi")) return Wifi;
  if (L.includes("workspace")) return Wifi;
  if (L.includes("hypoallergenic")) return ShieldCheck;
  if (L.includes("air purifier")) return CloudSun;
  if (L.includes("hot water")) return Sun;
  if (L.includes("kitchen")) return Utensils;
  if (L.includes("welcome")) return Gift;
  if (L.includes("accessibility")) return Wheelchair;
  if (L.includes("safety")) return Shield;
  if (L.startsWith("must")) return CheckCircle2;
  if (L.startsWith("nice")) return Sparkles;
  if (L.includes("pace")) return Timer;
  if (L.includes("depth")) return Layers;
  if (L.includes("personalization")) return Wand2Icon;
  if (L.includes("group")) return Users;
  if (L.includes("guide style")) return BadgeCheck;
  if (L.includes("crowd")) return Users;
  if (L.includes("language")) return Tags;
  if (L.includes("audio")) return Mic;
  if (L.includes("photo")) return Camera;
  if (L.includes("duration")) return Timer;
  if (L.includes("weather")) return CloudSun;
  if (L.includes("diet")) return Utensils;
  if (L.includes("allergies")) return Leaf;
  if (L.includes("themes")) return Tags;
  if (L.includes("thoroughness")) return ListChecks;
  if (L.includes("time precision")) return CalendarClock;
  if (L.includes("proof")) return BadgeCheck;
  if (L.includes("damage")) return AlertCircle;
  if (L.includes("eco")) return Leaf;
  if (L.includes("unscented")) return CloudSun;
  if (L.includes("professionalism")) return BadgeCheck;
  if (L.includes("pet")) return PawPrint;
  if (L.includes("entry")) return Key;
  if (L.includes("supervision")) return Eye;
  if (L.includes("schedule")) return CalendarClock;
  if (L.includes("focus")) return Wrench;
  if (L.includes("types")) return Wrench;
  if (L.includes("locations")) return MapPin;

  return Tag;
};

function PrefSummaryCard({ title, icon: TitleIcon, lines = [], notes = "", onEdit }) {
  const entries = lines
    .map((line) => {
      const idx = line.indexOf(":");
      if (idx === -1) return { label: line.trim(), value: "", Icon: Tag };
      const label = line.slice(0, idx).trim();
      const value = line.slice(idx + 1).trim();
      return { label, value, Icon: labelIcon(label) };
    })
    .filter((e) => e.label || e.value);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:shadow-md">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 grid place-items-center text-white shadow shrink-0">
            <TitleIcon size={18} />
          </div>
          <h5 className="text-sm font-semibold text-slate-900 truncate">{title}</h5>
        </div>
        <button
          onClick={onEdit}
          className="text-xs px-2 py-1 rounded-full border border-slate-300 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-200"
        >
          Edit
        </button>
      </div>

      <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
        {entries.length ? (
          entries.map(({ label, value, Icon }, i) => (
            <div
              key={`${label}-${i}`}
              className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50/60 p-3"
            >
              <div className="h-8 w-8 rounded-lg bg-white grid place-items-center border border-slate-200 shrink-0">
                <Icon size={16} className="text-slate-700" />
              </div>
              <div className="min-w-0">
                <div className="text-[12px] uppercase tracking-wide text-slate-500">{label}</div>
                <div className="text-sm text-slate-800 break-words whitespace-pre-wrap">{value || "—"}</div>
              </div>
            </div>
          ))
        ) : (
          <p className="text-sm text-slate-500">Not set</p>
        )}
      </div>

      {notes?.trim() ? (
        <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50/70 p-3">
          <div className="flex items-start gap-2">
            <StickyNote size={16} className="text-amber-700 mt-0.5 shrink-0" />
            <div className="min-w-0">
              <div className="text-[12px] uppercase tracking-wide text-amber-700 font-semibold">Additional notes</div>
              <div className="text-sm text-amber-900 whitespace-pre-wrap break-words">{notes}</div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/* ======================= Points Modal ======================= */
function PointsModal({ open, onClose, points = 0, onWithdraw, busy }) {
  const [value, setValue] = useState("");

  const maxPts = Math.max(0, Number(points || 0) | 0);
  const pts = Number(value || 0) | 0;
  const php = ptsToPHP(pts);
  const can = pts > 0 && pts <= maxPts && !busy;

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[70] grid place-items-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={busy ? undefined : onClose} />
      <div className="relative w-full max-w-md rounded-2xl bg-white border border-slate-200 shadow-xl p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-amber-400 to-yellow-500 grid place-items-center text-white shadow">
              <Coins size={18} />
            </div>
            <h3 className="text-lg font-semibold">My Points</h3>
          </div>
          <button className="p-1 rounded hover:bg-slate-100" onClick={busy ? undefined : onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="space-y-3">
          <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
            <div className="text-sm text-slate-600">Available points</div>
            <div className="mt-1 text-2xl font-bold text-slate-900">
              {maxPts.toLocaleString()} pts{" "}
              <span className="text-base font-medium text-slate-500">({peso(ptsToPHP(maxPts))})</span>
            </div>
            <div className="mt-1 text-xs text-slate-500">Rate: 20 pts = ₱10.00</div>
          </div>

          <label className="block">
            <span className="text-sm text-slate-700">Withdraw points</span>
            <div className="mt-1 flex items-center gap-2">
              <input
                type="number"
                min={0}
                step={1}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                className="flex-1 rounded-xl border border-slate-300 bg-white px-3 py-2"
                placeholder="0"
              />
              <button
                type="button"
                className="px-3 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-sm"
                onClick={() => setValue(String(maxPts))}
                disabled={busy || maxPts === 0}
              >
                Max
              </button>
            </div>
          </label>

          <div className="text-sm text-slate-600">
            You’ll receive: <span className="font-semibold">{peso(php)}</span> in your E-Wallet.
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button
              onClick={onClose}
              disabled={busy}
              className="px-4 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-sm"
            >
              Cancel
            </button>
            <button
              onClick={() => onWithdraw(pts)}
              disabled={!can}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-white bg-blue-600 hover:bg-blue-700 shadow disabled:opacity-60 text-sm"
            >
              {busy ? <Loader2 size={16} className="animate-spin" /> : <Wallet size={16} />}
              {busy ? "Processing…" : "Withdraw to E-Wallet"}
            </button>
          </div>

          <div className="text-xs text-slate-500">
            This converts points to pesos and creates a wallet transaction labeled <em>points_redeem</em>.
          </div>
        </div>
      </div>
    </div>
  );
}

/* ======================= Helpers for bookings fix ======================= */
const toMs = (v) => (v?.toMillis?.() ? v.toMillis() : Number.isFinite(+v) ? +v : Date.parse(v) || 0);
const isDocRef = (v) => v && typeof v === "object" && typeof v.path === "string" && typeof v.id === "string";

// NEW: robust category → kind mapping (singular keys for UI)
const categoryToKind = (c = "") => {
  const s = String(c).toLowerCase();
  if (s.startsWith("home")) return "home";
  if (s.startsWith("exp")) return "experience";
  if (s.startsWith("serv")) return "service";
  return null;
};

// Try multiple collections until we find the doc. Accepts string ID or DocumentReference.
async function getListingLike(database, idOrRef) {
  // If it’s already a DocumentReference, just read it.
  if (isDocRef(idOrRef)) {
    try {
      const snap = await getDoc(idOrRef);
      return snap.exists() ? { col: idOrRef.parent?.id || "", snap } : null;
    } catch {
      return null;
    }
  }

  const id = String(idOrRef);
  // Prefer specific collections first to avoid defaulting to "home"
  const candidates = ["experiences", "services", "homes", "properties", "listings"]; // <= reordered

  for (const col of candidates) {
    try {
      const snap = await getDoc(doc(database, col, id));
      if (snap.exists()) return { col, snap };
    } catch {
      // ignore and try next
    }
  }
  return null;
}

/* ======================= Main Page ======================= */
export default function ProfilePage() {
  const navigate = useNavigate();
  const { sidebarOpen, setSidebarOpen } = useSidebar();

  // Host state mirrored from Favorites/Explore
  const [isHost, setIsHost] = useState(
    typeof window !== "undefined" && localStorage.getItem("isHost") === "true"
  );
  const [showHostModal, setShowHostModal] = useState(false);
  const [showPoliciesModal, setShowPoliciesModal] = useState(false);

  useEffect(() => {
    const checkIfHost = async () => {
      const u = auth.currentUser;
      if (!u) return;
      try {
        const hostsRef = collection(database, "hosts");
        const qh = query(hostsRef, where("uid", "==", u.uid));
        const snapshot = await getDocs(qh);
        const hostStatus = !snapshot.empty;
        setIsHost(hostStatus);
        localStorage.setItem("isHost", hostStatus ? "true" : "false");
      } catch (e) {
        console.error("Host check failed:", e);
      }
    };
    checkIfHost();
  }, []);

  const handleHostClick = () => {
    if (isHost) {
      navigate("/hostpage");
    } else {
      setShowPoliciesModal(true);
    }
  };
  const handleCloseHostModal = () => setShowHostModal(false);
  const handleClosePoliciesModal = () => setShowPoliciesModal(false);
  const handleAgreePolicies = () => {
    setShowPoliciesModal(false);
    setShowHostModal(true);
  };

  // Points state
  const [showPoints, setShowPoints] = useState(false);
  const [points, setPoints] = useState(0);
  const [withdrawingPts, setWithdrawingPts] = useState(false);

  // Auth state
  const [user, setUser] = useState(undefined); // undefined = not resolved
  const [authReady, setAuthReady] = useState(false);
  const [showResetPassword, setShowResetPassword] = useState(false);

  // A lightweight view model for the left summary, so we can patch it after saves
  const [profileView, setProfileView] = useState(null);

  // Ref to preferences section (inside settings)
  const prefSectionRef = useRef(null);

  useEffect(() => {
    const { onAuthStateChanged } = require("firebase/auth");
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthReady(true);
    });
    return unsub;
  }, []);

  // Keep summary view synced with current user whenever firebase user changes
  useEffect(() => {
    if (user) {
      setProfileView({
        displayName: user.displayName || "",
        email: user.email || "",
        photoURL: user.photoURL || "",
        metadata: user.metadata,
      });
    } else {
      setProfileView(null);
    }
  }, [user]);

  // Decide whether to show the Reset Password button (email/password only, no Google linked)
  useEffect(() => {
    if (!user) {
      setShowResetPassword(false);
      return;
    }
    const providers = (user.providerData || []).map((p) => p.providerId);
    const hasGoogle = providers.includes("google.com");
    const hasPassword = providers.includes("password");
    setShowResetPassword(hasPassword && !hasGoogle);
  }, [user]);

  useEffect(() => {
    if (authReady && user === null) navigate("/");
  }, [authReady, user, navigate]);

  // Favorites & bookings
  const [favLoading, setFavLoading] = useState(true);
  const [favorites, setFavorites] = useState([]);
  const [bookLoading, setBookLoading] = useState(true);
  const [bookings, setBookings] = useState([]);

  const [modal, setModal] = useState(null); // {type:'home'|'experience'|'service', id}
  const [tab, setTab] = useState("wishlist"); // wishlist | recent | settings
  const tabs = useMemo(
    () => [
      { key: "wishlist", label: "Wishlist", icon: Heart },
      { key: "recent", label: "Recently Booked", icon: BedDouble },
      { key: "settings", label: "Account Settings", icon: Settings },
    ],
    []
  );

  // Preference state
  const [homePrefs, setHomePrefs] = useState(defaultHomePrefs);
  const [expPrefs, setExpPrefs] = useState(defaultExpPrefs);
  const [srvPrefs, setSrvPrefs] = useState(defaultSrvPrefs);

  const [homeMsg, setHomeMsg] = useState(null);
  const [expMsg, setExpMsg] = useState(null);
  const [srvMsg, setSrvMsg] = useState(null);
  const [savingHome, setSavingHome] = useState(false);
  const [savingExp, setSavingExp] = useState(false);
  const [savingSrv, setSavingSrv] = useState(false);

  const [prefCategory, setPrefCategory] = useState("homes");

  // --- Load wishlist favorites (IDs) ---
  useEffect(() => {
    const runFavs = async () => {
      if (!auth.currentUser) {
        setFavLoading(false);
        return;
      }
      setFavLoading(true);
      try {
        const favRef = collection(database, "favorites");
        const qFav = query(favRef, where("userId", "==", auth.currentUser.uid));
        const snap = await getDocs(qFav);
        const ids = snap.docs.map((d) => d.data()?.listingId).filter(Boolean);
        setFavorites(Array.from(new Set(ids)));
      } catch (e) {
        console.error("Wish list fetch failed:", e);
        setFavorites([]);
      } finally {
        setFavLoading(false);
      }
    };
    runFavs();
  }, []);

  // --- Load bookings (robust: supports experiences/services by probing collections) ---
  useEffect(() => {
    let alive = true;
    (async () => {
      if (!authReady) return;
      const u = auth.currentUser;
      if (!u) {
        if (alive) {
          setBookings([]);
          setBookLoading(false);
        }
        return;
      }
      setBookLoading(true);
      try {
        const bRef = collection(database, "bookings");

        // Fetch both “uid” and “userId” (merged, unique)
        const [byUid, byUserId] = await Promise.allSettled([
          getDocs(query(bRef, where("uid", "==", u.uid))),
          getDocs(query(bRef, where("userId", "==", u.uid))),
        ]);

        const docs = new Map();
        const addAll = (res) => res?.value?.docs?.forEach((d) => docs.set(d.id, d));
        if (byUid.status === "fulfilled") addAll(byUid);
        if (byUserId.status === "fulfilled") addAll(byUserId);

        // Prefer ordered query if index exists (grabs ALL when possible)
        try {
          const ordered = await getDocs(
            query(bRef, where("uid", "==", u.uid), orderBy("checkIn", "desc"))
          );
          ordered.docs.forEach((d) => docs.set(d.id, d));
        } catch {
          // ignore: missing composite index
        }

        const all = Array.from(docs.values());

        const rows = await Promise.all(
          all.map(async (d) => {
            const booking = { id: d.id, ...d.data() };

            // Prefer booking's own category hint
            const kindFromBooking = categoryToKind(booking.listingCategory);

            const key =
              booking.listingId || booking.listingID || booking.itemId || booking.itemID || booking.targetId || booking.target;
            if (!key) return null;

            const found = await getListingLike(database, key);
            if (!found) {
              console.warn("Booking target not found in any collection:", { bookingId: booking.id, key });
              return null;
            }

            const data = found.snap.data() || {};

            // Secondary hints if booking is missing/incorrect
            const kindFromDoc =
              categoryToKind(data.category || data.type || data.kind) ||
              ((found.col || "").toLowerCase().startsWith("exp")
                ? "experience"
                : (found.col || "").toLowerCase().startsWith("serv")
                ? "service"
                : (found.col || "").toLowerCase().startsWith("home")
                ? "home"
                : null);

            const kind = kindFromBooking || kindFromDoc || "home"; // final fallback

            return {
              booking,
              listing: { id: found.snap.id, ...data },
              kind,
            };
          })
        );

        const result = rows
          .filter(Boolean)
          .sort((a, b) => {
            // derive a best-effort schedule time for experiences/services
            const schedA = a.booking?.schedule?.date
              ? Date.parse(`${a.booking.schedule.date}T${a.booking?.schedule?.time || "00:00"}`)
              : 0;
            const schedB = b.booking?.schedule?.date
              ? Date.parse(`${b.booking.schedule.date}T${b.booking?.schedule?.time || "00:00"}`)
              : 0;

            const A =
              toMs(a.booking.checkIn) ||
              toMs(a.booking.startTime) ||
              schedA ||
              toMs(a.booking.date) ||
              toMs(a.booking.scheduledAt) ||
              toMs(a.booking.createdAt);
            const B =
              toMs(b.booking.checkIn) ||
              toMs(b.booking.startTime) ||
              schedB ||
              toMs(b.booking.date) ||
              toMs(b.booking.scheduledAt) ||
              toMs(b.booking.createdAt);
            return B - A;
          });

        if (alive) setBookings(result);
      } catch (e) {
        console.error("Bookings fetch failed:", e);
        if (alive) setBookings([]);
      } finally {
        if (alive) setBookLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [authReady, user?.uid]);

  // --- Load preferences ---
  useEffect(() => {
    const run = async () => {
      if (!auth.currentUser) return;
      try {
        const prefRef = doc(database, "preferences", auth.currentUser.uid);
        const snap = await getDoc(prefRef);
        if (snap.exists()) {
          const d = snap.data() || {};
          setHomePrefs({ ...defaultHomePrefs, ...(d.homes || {}) });
          setExpPrefs({ ...defaultExpPrefs, ...(d.experiences || {}) });
          setSrvPrefs({ ...defaultSrvPrefs, ...(d.services || {}) });
        }
      } catch (e) {
        console.error("Load preferences failed:", e);
      }
    };
    run();
  }, []);

  // --- Live read of Points balance ---
  useEffect(() => {
    if (!authReady || !auth.currentUser) return;
    const pref = doc(database, "points", auth.currentUser.uid);
    const unsub = onSnapshot(pref, (s) => {
      const bal = Number(s.data()?.balance || 0);
      setPoints(Number.isFinite(bal) ? bal : 0);
    });
    return unsub;
  }, [authReady]);

  // --- Withdraw Points -> Wallet (atomic) ---
  const handleWithdrawPoints = async (pts) => {
    const u = auth.currentUser;
    if (!u) return;

    const want = Number(pts || 0) | 0;
    if (want <= 0) return;
    if (want > points) return;

    const php = ptsToPHP(want);

    setWithdrawingPts(true);
    try {
      const pointsRef = doc(database, "points", u.uid);
      const walletRef = doc(database, "wallets", u.uid);
      const txRef = doc(collection(database, "wallets", u.uid, "transactions"));

      await runTransaction(database, async (tx) => {
        // read points
        const pSnap = await tx.get(pointsRef);
        const curPts = Number(pSnap.data()?.balance || 0);
        if (want > curPts) throw new Error("Not enough points.");

        // read wallet
        const wSnap = await tx.get(walletRef);
        const curBal = Number(wSnap.data()?.balance || 0);
        const newBal = curBal + php;

        // write points
        tx.set(pointsRef, { uid: u.uid, balance: curPts - want, updatedAt: serverTimestamp() }, { merge: true });

        // ensure wallet + write
        tx.set(walletRef, { uid: u.uid, balance: newBal, currency: "PHP", updatedAt: serverTimestamp() }, { merge: true });

        // add wallet transaction
        tx.set(txRef, {
          uid: u.uid,
          type: "points_redeem",
          delta: +php,
          amount: php,
          status: "completed",
          method: "rewards",
          note: `Redeemed ${want} pts`,
          balanceAfter: newBal,
          timestamp: serverTimestamp(),
        });
      });

      setShowPoints(false);
    } catch (e) {
      console.error("Withdraw points failed:", e?.message || e);
      alert(e?.message || "Withdraw failed.");
    } finally {
      setWithdrawingPts(false);
    }
  };

  /* ---------- Early return while auth resolves ---------- */
  if (!authReady) {
    return (
      <div className="min-h-screen grid place-items-center bg-gradient-to-br from-blue-50 via-white to-indigo-50">
        <div className="inline-flex items-center gap-2 text-slate-600 text-sm">
          <Loader2 className="animate-spin" size={16} /> Checking your session…
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 overflow-hidden">
      {/* ===== Sidebar (shared responsive behavior) ===== */}
      <Sidebar onHostClick={handleHostClick} isHost={isHost} />

      {/* ===== Top Navbar (same as Favorites/Explore) ===== */}
      <header
        className={`
          fixed top-0 right-0 z-30
          bg-white text-gray-800 border-b border-gray-200 shadow-sm
          transition-all duration-300
          left-0 ${sidebarOpen ? "md:left-72" : "md:left-20"}
        `}
      >
        <div className="max-w-7xl mx-auto flex items-center justify-between px-4 md:px-8 py-3">
          {/* Left: Hamburger (mobile) + Logo */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              aria-label="Open menu"
              aria-controls="app-sidebar"
              aria-expanded={sidebarOpen}
              onClick={() => setSidebarOpen(true)}
              className={`md:hidden rounded-lg bg-white border border-gray-200 p-2 shadow-sm ${
                sidebarOpen ? "hidden" : ""
              }`}
            >
              <Menu size={20} />
            </button>

            <div
              className="flex items-center gap-2 cursor-pointer select-none"
              onClick={() => navigate("/dashboard")}
            >
              <BookifyLogo />
              <span className="hidden sm:inline font-semibold text-gray-800">Profile</span>
            </div>
          </div>

          {/* Right: Host action (desktop only) */}
          <button
            onClick={handleHostClick}
            className="hidden md:inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 shadow-md transition-all"
          >
            <Compass size={18} />
            {isHost ? "Switch to Hosting" : "Become a Host"}
          </button>
        </div>
      </header>

      {/* Spacer under fixed header */}
      <div className="h-[56px] md:h-[56px]" />

      {/* ===== Main (pushed when sidebar expands) ===== */}
      <main
        className={`
          transition-[margin] duration-300 ml-0
          ${sidebarOpen ? "md:ml-72" : "md:ml-20"}
          px-4 sm:px-6 lg:px-12 py-6
        `}
      >
        <div className="max-w-7xl mx-auto">
          {/* Page header */}
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-foreground">Your Profile</h1>
            <p className="text-muted-foreground">Manage your account, wishlist, preferences, and bookings.</p>
          </div>

          {/* Page tabs */}
          <div className="-mx-1 mb-6 overflow-x-auto">
            <div className="flex items-center gap-2 px-1">
              {tabs.map(({ key, label, icon: Icon }) => {
                const active = tab === key;
                return (
                  <button
                    key={key}
                    onClick={() => setTab(key)}
                    className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium border transition whitespace-nowrap focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-100 ${
                      active
                        ? "bg-blue-600 text-white border-blue-600 shadow"
                        : "bg-white/80 text-slate-700 border-slate-200 hover:bg-white"
                    }`}
                    aria-current={active ? "page" : undefined}
                  >
                    <Icon size={16} className="shrink-0" />
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Main grid: Profile summary + content panels */}
          <section className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
            {/* Left: Profile summary */}
            <div className="lg:col-span-1 rounded-3xl border border-slate-200 bg-white/80 shadow p-6 self-start">
              <div className="flex flex-col items-center text-center">
                {profileView?.photoURL ? (
                  <img
                    src={profileView.photoURL}
                    alt="Avatar"
                    className="w-24 h-24 rounded-full object-cover shadow-md"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-24 h-24 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center shadow-md">
                    <User className="text-white w-10 h-10" />
                  </div>
                )}

                <h3 className="mt-4 text-lg font-semibold text-slate-900">
                  {profileView?.displayName || "Guest User"}
                </h3>
                <div className="mt-1 flex items-center gap-2 text-slate-600">
                  <Mail size={16} />
                  <span className="text-sm break-words">{profileView?.email || "—"}</span>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3 w-full text-left">
                  <div className="rounded-2xl border border-slate-200 bg-white/70 p-3 min-w-0">
                    <div className="flex items-center gap-2 text-slate-700">
                      <CalendarDays size={16} className="shrink-0" />
                      <span className="text-xs uppercase tracking-wide text-slate-500">Joined</span>
                    </div>
                    <p className="mt-1 font-medium">{createdAtText(profileView)}</p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-white/70 p-3 min-w-0">
                    <div className="flex items-center gap-2 text-slate-700">
                      <Clock size={16} className="shrink-0" />
                      <span className="text-xs uppercase tracking-wide text-slate-500">Last Login</span>
                    </div>
                    <p className="mt-1 font-medium">{lastLoginText(profileView)}</p>
                  </div>
                </div>

                <div className="mt-4 flex gap-2 flex-wrap justify-center">
                  <button
                    onClick={() => setTab("settings")}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-white bg-blue-600 hover:bg-blue-700 shadow transition"
                  >
                    <Edit3 size={16} className="shrink-0" />
                    Edit Account
                  </button>
                  {/* NEW: Points Button */}
                  <button
                    onClick={() => setShowPoints(true)}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-amber-700 bg-amber-50 border border-amber-200 hover:bg-white transition"
                  >
                    <Coins size={16} className="shrink-0" />
                    Points • {points.toLocaleString()} pts
                  </button>
                </div>
              </div>
            </div>

            {/* Right: Tab panels */}
            <div className="lg:col-span-2">
              <div className="rounded-3xl border border-slate-200 bg-white/80 shadow p-6">
                {/* WISHLIST */}
                {tab === "wishlist" && (
                  <div className="space-y-4">
                    <SectionTitle icon={Heart}>Wishlist</SectionTitle>

                    <div className="flex flex-col gap-4">
                      <PrefSummaryCard
                        title="Homes"
                        icon={Building2}
                        lines={summarizeHomes(homePrefs)}
                        notes={homePrefs.notes}
                        onEdit={() => {
                          setTab("settings");
                          setPrefCategory("homes");
                          setTimeout(() => prefSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
                        }}
                      />

                      <PrefSummaryCard
                        title="Experiences"
                        icon={Sparkles}
                        lines={summarizeExperiences(expPrefs)}
                        notes={expPrefs.notes}
                        onEdit={() => {
                          setTab("settings");
                          setPrefCategory("experiences");
                          setTimeout(() => prefSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
                        }}
                      />

                      <PrefSummaryCard
                        title="Services"
                        icon={Handshake}
                        lines={summarizeServices(srvPrefs)}
                        notes={srvPrefs.notes}
                        onEdit={() => {
                          setTab("settings");
                          setPrefCategory("services");
                          setTimeout(() => prefSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
                        }}
                      />
                    </div>
                  </div>
                )}

                {/* RECENT */}
                {tab === "recent" && (
                  <>
                    <h4 className="font-semibold mb-4 flex items-center gap-2">
                      <BedDouble size={18} className="text-emerald-600" /> Recently Booked
                    </h4>
                    {bookLoading ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {Array.from({ length: 6 }).map((_, i) => (
                          <CardSkeleton key={i} />
                        ))}
                      </div>
                    ) : bookings.length ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {bookings.map(({ booking, listing, kind }) => (
                          <TinyListingCard
                            key={booking.id}
                            item={listing}
                            kind={kind}
                            onClick={() => setModal({ type: kind, id: listing.id })}
                          />
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-slate-600">No recent bookings yet.</p>
                    )}
                  </>
                )}

                {/* SETTINGS (Account + Preferences inside) */}
                {tab === "settings" && (
                  <>
                    <AccountSettingsCard
                      user={user}
                      showResetPassword={showResetPassword}
                      onProfilePatched={(patch) => {
                        setProfileView((pv) => (pv ? { ...pv, ...patch } : patch));
                      }}
                    />
                    {/* Preferences moved into its own card under Account Settings — Profile */}
                    <div
                      id="settings-prefs"
                      ref={prefSectionRef}
                      className="mt-6 rounded-3xl border border-slate-200 bg-white/80 shadow p-6"
                    >
                      <div className="space-y-6">
                        <SectionTitle icon={Settings}>Preferences</SectionTitle>

                        {/* Category chooser */}
                        <div className="flex flex-wrap gap-2 -mx-1">
                          <div className="px-1">
                            <ChipToggle selected={prefCategory === "homes"} onClick={() => setPrefCategory("homes")}>
                              <Building2 size={16} className="shrink-0" /> Homes
                            </ChipToggle>
                          </div>
                          <div className="px-1">
                            <ChipToggle
                              selected={prefCategory === "experiences"}
                              onClick={() => setPrefCategory("experiences")}
                            >
                              <Sparkles size={16} className="shrink-0" /> Experiences
                            </ChipToggle>
                          </div>
                          <div className="px-1">
                            <ChipToggle selected={prefCategory === "services"} onClick={() => setPrefCategory("services")}>
                              <Handshake size={16} className="shrink-0" /> Services
                            </ChipToggle>
                          </div>
                        </div>

                        {/* HOMES */}
                        {prefCategory === "homes" && (
                          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm space-y-5">
                            <SectionTitle icon={Building2}>Home Preferences (quality &amp; expectations)</SectionTitle>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <Labeled label="Privacy level">
                                <select
                                  value={homePrefs.privacyLevel}
                                  onChange={(e) => setHomePrefs((p) => ({ ...p, privacyLevel: e.target.value }))}
                                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2"
                                >
                                  <option value="entire-place">Entire place</option>
                                  <option value="private-room">Private room</option>
                                  <option value="shared">Shared</option>
                                </select>
                              </Labeled>
                              <Labeled label="Cleanliness tier">
                                <select
                                  value={homePrefs.cleanlinessTier}
                                  onChange={(e) => setHomePrefs((p) => ({ ...p, cleanlinessTier: e.target.value }))}
                                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2"
                                >
                                  <option value="basic">Basic</option>
                                  <option value="regular">Regular</option>
                                  <option value="hotel">Hotel-level</option>
                                </select>
                              </Labeled>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                              <Labeled label="Scent preference">
                                <select
                                  value={homePrefs.scentPreference}
                                  onChange={(e) => setHomePrefs((p) => ({ ...p, scentPreference: e.target.value }))}
                                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2"
                                >
                                  <option value="unscented">Unscented</option>
                                  <option value="light">Light fragrance</option>
                                  <option value="any">Any</option>
                                </select>
                              </Labeled>
                              <Labeled label="Pillow firmness">
                                <select
                                  value={homePrefs.linens.pillowFirmness}
                                  onChange={(e) =>
                                    setHomePrefs((p) => ({ ...p, linens: { ...p.linens, pillowFirmness: e.target.value } }))
                                  }
                                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2"
                                >
                                  <option value="soft">Soft</option>
                                  <option value="medium">Medium</option>
                                  <option value="firm">Firm</option>
                                </select>
                              </Labeled>
                              <Labeled label="Mattress firmness">
                                <select
                                  value={homePrefs.mattressFirmness}
                                  onChange={(e) => setHomePrefs((p) => ({ ...p, mattressFirmness: e.target.value }))}
                                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2"
                                >
                                  <option value="soft">Soft</option>
                                  <option value="medium">Medium</option>
                                  <option value="firm">Firm</option>
                                </select>
                              </Labeled>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                              <Labeled label="Duvet warmth">
                                <select
                                  value={homePrefs.linens.duvetWarmth}
                                  onChange={(e) =>
                                    setHomePrefs((p) => ({ ...p, linens: { ...p.linens, duvetWarmth: e.target.value } }))
                                  }
                                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2"
                                >
                                  <option value="light">Light</option>
                                  <option value="medium">Medium</option>
                                  <option value="warm">Warm</option>
                                </select>
                              </Labeled>
                              <Labeled label="Towels">
                                <select
                                  value={homePrefs.linens.towels}
                                  onChange={(e) =>
                                    setHomePrefs((p) => ({ ...p, linens: { ...p.linens, towels: e.target.value } }))
                                  }
                                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2"
                                >
                                  <option value="standard">Standard</option>
                                  <option value="plush">Plush</option>
                                </select>
                              </Labeled>
                              <Labeled label="Thread count (sheets)">
                                <input
                                  type="number"
                                  min={150}
                                  value={homePrefs.linens.threadCount}
                                  onChange={(e) =>
                                    setHomePrefs((p) => ({
                                      ...p,
                                      linens: { ...p.linens, threadCount: Number(e.target.value || 0) },
                                    }))
                                  }
                                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2"
                                />
                              </Labeled>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                              <Labeled label="Wi-Fi minimum (Mbps)">
                                <input
                                  type="number"
                                  min={1}
                                  value={homePrefs.workspace.wifiMinMbps}
                                  onChange={(e) =>
                                    setHomePrefs((p) => ({
                                      ...p,
                                      workspace: { ...p.workspace, wifiMinMbps: Number(e.target.value || 0) },
                                    }))
                                  }
                                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2"
                                />
                              </Labeled>
                              <Labeled label="Desk">
                                <input
                                  type="checkbox"
                                  checked={!!homePrefs.workspace.desk}
                                  onChange={(e) =>
                                    setHomePrefs((p) => ({ ...p, workspace: { ...p.workspace, desk: e.target.checked } }))
                                  }
                                  className="w-5 h-5"
                                />
                              </Labeled>
                              <Labeled label="Ergonomic chair">
                                <input
                                  type="checkbox"
                                  checked={!!homePrefs.workspace.ergoChair}
                                  onChange={(e) =>
                                    setHomePrefs((p) => ({
                                      ...p,
                                      workspace: { ...p.workspace, ergoChair: e.target.checked },
                                    }))
                                  }
                                  className="w-5 h-5"
                                />
                              </Labeled>
                              <Labeled label="Backup Wi-Fi">
                                <input
                                  type="checkbox"
                                  checked={!!homePrefs.workspace.backupWifi}
                                  onChange={(e) =>
                                    setHomePrefs((p) => ({
                                      ...p,
                                      workspace: { ...p.workspace, backupWifi: e.target.checked },
                                    }))
                                  }
                                  className="w-5 h-5"
                                />
                              </Labeled>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <Labeled label="Kitchen must-haves">
                                <div className="flex flex-wrap items-center gap-2">
                                  {homePrefs.kitchenMust.map((L, i) => (
                                    <RemovableTag
                                      key={`${L}-${i}`}
                                      label={L}
                                      onRemove={() =>
                                        setHomePrefs((p) => ({
                                          ...p,
                                          kitchenMust: p.kitchenMust.filter((x, idx) => !(idx === i && x === L)),
                                        }))
                                      }
                                    />
                                  ))}
                                </div>
                                <TagInput
                                  placeholder="e.g., sharp knives, espresso machine"
                                  onAdd={(t) => setHomePrefs((p) => ({ ...p, kitchenMust: [...p.kitchenMust, t] }))}
                                />
                              </Labeled>
                              <Labeled label="Welcome stocking (on arrival)">
                                <div className="flex flex-wrap items-center gap-2">
                                  {homePrefs.welcomeStocking.map((L, i) => (
                                    <RemovableTag
                                      key={`${L}-${i}`}
                                      label={L}
                                      onRemove={() =>
                                        setHomePrefs((p) => ({
                                          ...p,
                                          welcomeStocking: p.welcomeStocking.filter((x, idx) => !(idx === i && x === L)),
                                        }))
                                      }
                                    />
                                  ))}
                                </div>
                                <TagInput
                                  placeholder="e.g., water, fruits, oat milk"
                                  onAdd={(t) => setHomePrefs((p) => ({ ...p, welcomeStocking: [...p.welcomeStocking, t] }))}
                                />
                              </Labeled>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <Labeled label="Accessibility">
                                <div className="flex flex-wrap items-center gap-2">
                                  {homePrefs.accessibility.map((L, i) => (
                                    <RemovableTag
                                      key={`${L}-${i}`}
                                      label={L}
                                      onRemove={() =>
                                        setHomePrefs((p) => ({
                                          ...p,
                                          accessibility: p.accessibility.filter((x, idx) => !(idx === i && x === L)),
                                        }))
                                      }
                                    />
                                  ))}
                                </div>
                                <TagInput
                                  placeholder="e.g., step-free, grab bars, elevator"
                                  onAdd={(t) => setHomePrefs((p) => ({ ...p, accessibility: [...p.accessibility, t] }))}
                                />
                              </Labeled>
                              <Labeled label="Safety requests">
                                <div className="flex flex-wrap items-center gap-2">
                                  {homePrefs.safetyRequests.map((L, i) => (
                                    <RemovableTag
                                      key={`${L}-${i}`}
                                      label={L}
                                      onRemove={() =>
                                        setHomePrefs((p) => ({
                                          ...p,
                                          safetyRequests: p.safetyRequests.filter((x, idx) => !(idx === i && x === L)),
                                        }))
                                      }
                                    />
                                  ))}
                                </div>
                                <TagInput
                                  placeholder="e.g., childproofing, outlet covers"
                                  onAdd={(t) => setHomePrefs((p) => ({ ...p, safetyRequests: [...p.safetyRequests, t] }))}
                                />
                              </Labeled>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <Labeled label="Must-have amenities">
                                <div className="flex flex-wrap items-center gap-2">
                                  {homePrefs.amenitiesMust.map((L, i) => (
                                    <RemovableTag
                                      key={`${L}-${i}`}
                                      label={L}
                                      onRemove={() =>
                                        setHomePrefs((p) => ({
                                          ...p,
                                          amenitiesMust: p.amenitiesMust.filter((x, idx) => !(idx === i && x === L)),
                                        }))
                                      }
                                    />
                                  ))}
                                </div>
                                <TagInput
                                  placeholder="e.g., washer, parking, pool"
                                  onAdd={(t) => setHomePrefs((p) => ({ ...p, amenitiesMust: [...p.amenitiesMust, t] }))}
                                />
                              </Labeled>
                              <Labeled label="Nice-to-have amenities">
                                <div className="flex flex-wrap items-center gap-2">
                                  {homePrefs.amenitiesNice.map((L, i) => (
                                    <RemovableTag
                                      key={`${L}-${i}`}
                                      label={L}
                                      onRemove={() =>
                                        setHomePrefs((p) => ({
                                          ...p,
                                          amenitiesNice: p.amenitiesNice.filter((x, idx) => !(idx === i && x === L)),
                                        }))
                                      }
                                    />
                                  ))}
                                </div>
                                <TagInput
                                  placeholder="e.g., balcony, gym"
                                  onAdd={(t) => setHomePrefs((p) => ({ ...p, amenitiesNice: [...p.amenitiesNice, t] }))}
                                />
                              </Labeled>
                            </div>

                            <Labeled label="Preferred locations">
                              <div className="flex flex-wrap items-center gap-2">
                                {homePrefs.locations.map((L, i) => (
                                  <RemovableTag
                                    key={`${L}-${i}`}
                                    label={L}
                                    onRemove={() =>
                                      setHomePrefs((p) => ({
                                        ...p,
                                        locations: p.locations.filter((x, idx) => !(idx === i && x === L)),
                                      }))
                                    }
                                  />
                                ))}
                              </div>
                              <TagInput
                                placeholder="Add a city/area then Enter"
                                onAdd={(t) => setHomePrefs((p) => ({ ...p, locations: [...p.locations, t] }))}
                              />
                            </Labeled>

                            <Labeled label="Additional notes">
                              <textarea
                                rows={3}
                                value={homePrefs.notes}
                                onChange={(e) => setHomePrefs((p) => ({ ...p, notes: e.target.value }))}
                                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 whitespace-pre-wrap"
                                placeholder="Anything else the host should know?"
                              />
                            </Labeled>

                            <div className="flex flex-wrap gap-3">
                              <button
                                onClick={() => {
                                  setSavingHome(true);
                                  setHomeMsg(null);
                                  const run = async () => {
                                    try {
                                      const prefRef = doc(database, "preferences", auth.currentUser.uid);
                                      await setDoc(
                                        prefRef,
                                        { uid: auth.currentUser.uid, homes: { ...homePrefs }, updatedAt: serverTimestamp() },
                                        { merge: true }
                                      );
                                      setHomeMsg({ type: "success", text: "Home preferences saved." });
                                    } catch (e) {
                                      setHomeMsg({ type: "error", text: e?.message || "Failed to save." });
                                    } finally {
                                      setSavingHome(false);
                                    }
                                  };
                                  run();
                                }}
                                disabled={savingHome}
                                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-white bg-blue-600 hover:bg-blue-700 shadow disabled:opacity-60"
                              >
                                {savingHome ? <Loader2 size={16} className="animate-spin shrink-0" /> : <Save size={16} className="shrink-0" />}
                                Save
                              </button>
                              <button
                                onClick={() => setHomePrefs(defaultHomePrefs)}
                                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50"
                              >
                                <RotateCcw size={16} className="shrink-0" /> Reset
                              </button>
                            </div>

                            {homeMsg && (
                              <div
                                className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm ${
                                  homeMsg.type === "success"
                                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                    : "bg-rose-50 text-rose-700 border border-rose-200"
                                }`}
                              >
                                {homeMsg.type === "success" ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                                {homeMsg.text}
                              </div>
                            )}
                          </div>
                        )}

                        {/* EXPERIENCES */}
                        {prefCategory === "experiences" && (
                          <div className="Rounded-3xl border border-slate-200 bg-white p-5 shadow-sm space-y-5 rounded-3xl">
                            <SectionTitle icon={Sparkles}>Experience Preferences (quality &amp; expectations)</SectionTitle>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                              <Labeled label="Pace">
                                <select
                                  value={expPrefs.pace}
                                  onChange={(e) => setExpPrefs((p) => ({ ...p, pace: e.target.value }))}
                                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2"
                                >
                                  <option value="relaxed">Relaxed</option>
                                  <option value="balanced">Balanced</option>
                                  <option value="fast">Fast</option>
                                </select>
                              </Labeled>
                              <Labeled label="Depth">
                                <select
                                  value={expPrefs.depth}
                                  onChange={(e) => setExpPrefs((p) => ({ ...p, depth: e.target.value }))}
                                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2"
                                >
                                  <option value="highlights">Highlights</option>
                                  <option value="story-rich">Story-rich</option>
                                  <option value="expert-level">Expert-level</option>
                                </select>
                              </Labeled>
                              <Labeled label="Personalization">
                                <select
                                  value={expPrefs.personalization}
                                  onChange={(e) => setExpPrefs((p) => ({ ...p, personalization: e.target.value }))}
                                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2"
                                >
                                  <option value="none">None</option>
                                  <option value="some">Some</option>
                                  <option value="high">High</option>
                                </select>
                              </Labeled>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                              <Labeled label="Group type">
                                <select
                                  value={expPrefs.groupType}
                                  onChange={(e) => setExpPrefs((p) => ({ ...p, groupType: e.target.value }))}
                                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2"
                                >
                                  <option value="private">Private</option>
                                  <option value="small-group">Small group</option>
                                  <option value="open-group">Open group</option>
                                </select>
                              </Labeled>
                              <Labeled label="Guide style">
                                <select
                                  value={expPrefs.guideStyle}
                                  onChange={(e) => setExpPrefs((p) => ({ ...p, guideStyle: e.target.value }))}
                                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2"
                                >
                                  <option value="friendly">Friendly</option>
                                  <option value="formal">Formal</option>
                                  <option value="academic">Academic</option>
                                </select>
                              </Labeled>
                              <Labeled label="Crowd tolerance">
                                <select
                                  value={expPrefs.crowdTolerance}
                                  onChange={(e) => setExpPrefs((p) => ({ ...p, crowdTolerance: e.target.value }))}
                                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2"
                                >
                                  <option value="low">Low</option>
                                  <option value="medium">Medium</option>
                                  <option value="high">High</option>
                                </select>
                              </Labeled>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                              <Labeled label="Language level">
                                <select
                                  value={expPrefs.languageLevel}
                                  onChange={(e) => setExpPrefs((p) => ({ ...p, languageLevel: e.target.value }))}
                                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2"
                                >
                                  <option value="basic">Basic</option>
                                  <option value="conversational">Conversational</option>
                                  <option value="fluent">Fluent</option>
                                  <option value="native">Native</option>
                                </select>
                              </Labeled>
                              <Labeled label="Audio support (mic/PA)">
                                <input
                                  type="checkbox"
                                  checked={!!expPrefs.audioSupport}
                                  onChange={(e) => setExpPrefs((p) => ({ ...p, audioSupport: e.target.checked }))}
                                  className="W-5 h-5 w-5"
                                />
                              </Labeled>
                              <Labeled label="Photo consent">
                                <select
                                  value={expPrefs.photoConsent}
                                  onChange={(e) => setExpPrefs((p) => ({ ...p, photoConsent: e.target.value }))}
                                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2"
                                >
                                  <option value="yes">Yes</option>
                                  <option value="no">No</option>
                                  <option value="private-only">Private-only</option>
                                </select>
                              </Labeled>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <Labeled label="Comfort / Accessibility">
                                <div className="flex flex-wrap items-center gap-2">
                                  {expPrefs.comfortAccessibility.map((L, i) => (
                                    <RemovableTag
                                      key={`${L}-${i}`}
                                      label={L}
                                      onRemove={() =>
                                        setExpPrefs((p) => ({
                                          ...p,
                                          comfortAccessibility: p.comfortAccessibility.filter(
                                            (x, idx) => !(idx === i && x === L)
                                          ),
                                        }))
                                      }
                                    />
                                  ))}
                                </div>
                                <TagInput
                                  placeholder="e.g., shade breaks, seating, step-free"
                                  onAdd={(t) => setExpPrefs((p) => ({ ...p, comfortAccessibility: [...p.comfortAccessibility, t] }))}
                                />
                              </Labeled>
                              <Labeled label="Diet restrictions">
                                <div className="flex flex-wrap items-center gap-2">
                                  {expPrefs.dietRestrictions.map((L, i) => (
                                    <RemovableTag
                                      key={`${L}-${i}`}
                                      label={L}
                                      onRemove={() =>
                                        setExpPrefs((p) => ({
                                          ...p,
                                          dietRestrictions: p.dietRestrictions.filter((x, idx) => !(idx === i && x === L)),
                                        }))
                                      }
                                    />
                                  ))}
                                </div>
                                <TagInput
                                  placeholder="e.g., vegetarian, halal, keto"
                                  onAdd={(t) => setExpPrefs((p) => ({ ...p, dietRestrictions: [...p.dietRestrictions, t] }))}
                                />
                              </Labeled>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <Labeled label="Allergies">
                                <div className="flex flex-wrap items-center gap-2">
                                  {expPrefs.allergies.map((L, i) => (
                                    <RemovableTag
                                      key={`${L}-${i}`}
                                      label={L}
                                      onRemove={() =>
                                        setExpPrefs((p) => ({
                                          ...p,
                                          allergies: p.allergies.filter((x, idx) => !(idx === i && x === L)),
                                        }))
                                      }
                                    />
                                  ))}
                                </div>
                                <TagInput
                                  placeholder="e.g., nuts, shellfish, pollen"
                                  onAdd={(t) => setExpPrefs((p) => ({ ...p, allergies: [...p.allergies, t] }))}
                                />
                              </Labeled>
                              <Labeled label="Themes / Interests">
                                <div className="flex flex-wrap items-center gap-2">
                                  {expPrefs.themes.map((L, i) => (
                                    <RemovableTag
                                      key={`${L}-${i}`}
                                      label={L}
                                      onRemove={() =>
                                        setExpPrefs((p) => ({
                                          ...p,
                                          themes: p.themes.filter((x, idx) => !(idx === i && x === L)),
                                        }))
                                      }
                                    />
                                  ))}
                                </div>
                                <TagInput
                                  placeholder="e.g., street food, history, photography"
                                  onAdd={(t) => setExpPrefs((p) => ({ ...p, themes: [...p.themes, t] }))}
                                />
                              </Labeled>
                            </div>

                            <Labeled label="Preferred locations">
                              <div className="flex flex-wrap items-center gap-2">
                                {expPrefs.locations.map((L, i) => (
                                  <RemovableTag
                                    key={`${L}-${i}`}
                                    label={L}
                                    onRemove={() =>
                                      setExpPrefs((p) => ({
                                        ...p,
                                        locations: p.locations.filter((x, idx) => !(idx === i && x === L)),
                                      }))
                                    }
                                  />
                                ))}
                              </div>
                              <TagInput
                                placeholder="Add a city/area then Enter"
                                onAdd={(t) => setExpPrefs((p) => ({ ...p, locations: [...p.locations, t] }))}
                              />
                            </Labeled>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <Labeled label="Duration flexibility">
                                <select
                                  value={expPrefs.durationFlexibility}
                                  onChange={(e) => setExpPrefs((p) => ({ ...p, durationFlexibility: e.target.value }))}
                                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2"
                                >
                                  <option value="fixed">Fixed</option>
                                  <option value="small-adjustments">Small adjustments</option>
                                  <option value="flexible">Flexible</option>
                                </select>
                              </Labeled>
                              <Labeled label="Weather plan">
                                <select
                                  value={expPrefs.weatherPlan}
                                  onChange={(e) => setExpPrefs((p) => ({ ...p, weatherPlan: e.target.value }))}
                                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2"
                                >
                                  <option value="run-as-planned">Run as planned</option>
                                  <option value="reschedule-or-indoors">Reschedule or indoors</option>
                                </select>
                              </Labeled>
                            </div>

                            <Labeled label="Additional notes">
                              <textarea
                                rows={3}
                                value={expPrefs.notes}
                                onChange={(e) => setExpPrefs((p) => ({ ...p, notes: e.target.value }))}
                                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 whitespace-pre-wrap"
                                placeholder="Anything else the guide/operator should know?"
                              />
                            </Labeled>

                            <div className="flex flex-wrap gap-3">
                              <button
                                onClick={() => {
                                  setSavingExp(true);
                                  setExpMsg(null);
                                  const run = async () => {
                                    try {
                                      const prefRef = doc(database, "preferences", auth.currentUser.uid);
                                      await setDoc(
                                        prefRef,
                                        { uid: auth.currentUser.uid, experiences: { ...expPrefs }, updatedAt: serverTimestamp() },
                                        { merge: true }
                                      );
                                      setExpMsg({ type: "success", text: "Experience preferences saved." });
                                    } catch (e) {
                                      setExpMsg({ type: "error", text: e?.message || "Failed to save." });
                                    } finally {
                                      setSavingExp(false);
                                    }
                                  };
                                  run();
                                }}
                                disabled={savingExp}
                                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-white bg-blue-600 hover:bg-blue-700 shadow disabled:opacity-60"
                              >
                                {savingExp ? <Loader2 size={16} className="animate-spin shrink-0" /> : <Save size={16} className="shrink-0" />}
                                Save
                              </button>
                              <button
                                onClick={() => setExpPrefs(defaultExpPrefs)}
                                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50"
                              >
                                <RotateCcw size={16} className="shrink-0" /> Reset
                              </button>
                            </div>

                            {expMsg && (
                              <div
                                className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm ${
                                  expMsg.type === "success"
                                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                    : "bg-rose-50 text-rose-700 border border-rose-200"
                                }`}
                              >
                                {expMsg.type === "success" ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                                {expMsg.text}
                              </div>
                            )}
                          </div>
                        )}

                        {/* SERVICES */}
                        {prefCategory === "services" && (
                          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm space-y-5">
                            <SectionTitle icon={Handshake}>Service Preferences (quality &amp; expectations)</SectionTitle>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                              <Labeled label="Thoroughness">
                                <select
                                  value={srvPrefs.thoroughness}
                                  onChange={(e) => setSrvPrefs((p) => ({ ...p, thoroughness: e.target.value }))}
                                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2"
                                >
                                  <option value="quick">Quick</option>
                                  <option value="standard">Standard</option>
                                  <option value="deep">Deep</option>
                                </select>
                              </Labeled>
                              <Labeled label="Time precision">
                                <select
                                  value={srvPrefs.timePrecision}
                                  onChange={(e) => setSrvPrefs((p) => ({ ...p, timePrecision: e.target.value }))}
                                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2"
                                >
                                  <option value="exact">Exact time</option>
                                  <option value="window-30m">Window ±30m</option>
                                  <option value="window-1h">Window ±1h</option>
                                  <option value="window-2h">Window ±2h</option>
                                </select>
                              </Labeled>
                              <Labeled label="Proof of work">
                                <div className="flex flex-wrap gap-2">
                                  {["before/after photos", "notes"].map((opt) => (
                                    <ChipToggle
                                      key={opt}
                                      selected={srvPrefs.proofOfWork.includes(opt)}
                                      onClick={() =>
                                        setSrvPrefs((p) => ({
                                          ...p,
                                          proofOfWork: p.proofOfWork.includes(opt)
                                            ? p.proofOfWork.filter((x) => x !== opt)
                                            : [...p.proofOfWork, opt],
                                        }))
                                      }
                                    >
                                      {opt}
                                    </ChipToggle>
                                  ))}
                                </div>
                              </Labeled>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                              <Labeled label="Immediate damage report">
                                <input
                                  type="checkbox"
                                  checked={!!srvPrefs.immediateDamageReport}
                                  onChange={(e) => setSrvPrefs((p) => ({ ...p, immediateDamageReport: e.target.checked }))}
                                  className="w-5 h-5"
                                />
                              </Labeled>
                              <Labeled label="Eco supplies">
                                <input
                                  type="checkbox"
                                  checked={!!srvPrefs.ecoSupplies}
                                  onChange={(e) => setSrvPrefs((p) => ({ ...p, ecoSupplies: e.target.checked }))}
                                  className="w-5 h-5"
                                />
                              </Labeled>
                              <Labeled label="Unscented products">
                                <input
                                  type="checkbox"
                                  checked={!!srvPrefs.unscented}
                                  onChange={(e) => setSrvPrefs((p) => ({ ...p, unscented: e.target.checked }))}
                                  className="w-5 h-5"
                                />
                              </Labeled>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                              <Labeled label="Linens handling">
                                <select
                                  value={srvPrefs.linensHandling}
                                  onChange={(e) => setSrvPrefs((p) => ({ ...p, linensHandling: e.target.value }))}
                                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2"
                                >
                                  <option value="host-provide">Host provide</option>
                                  <option value="wash-and-return">Wash &amp; return</option>
                                  <option value="replace-if-needed">Replace if needed</option>
                                </select>
                              </Labeled>
                              <Labeled label="Professionalism">
                                <div className="flex flex-wrap gap-2">
                                  {["Uniform", "ID on arrival"].map((opt) => (
                                    <ChipToggle
                                      key={opt}
                                      selected={srvPrefs.professionalism.includes(opt)}
                                      onClick={() =>
                                        setSrvPrefs((p) => ({
                                          ...p,
                                          professionalism: p.professionalism.includes(opt)
                                            ? p.professionalism.filter((x) => x !== opt)
                                            : [...p.professionalism, opt],
                                        }))
                                      }
                                    >
                                      {opt}
                                    </ChipToggle>
                                  ))}
                                </div>
                              </Labeled>
                              <Labeled label="Pet safety discipline">
                                <input
                                  type="checkbox"
                                  checked={!!srvPrefs.petSafety}
                                  onChange={(e) => setSrvPrefs((p) => ({ ...p, petSafety: e.target.checked }))}
                                  className="w-5 h-5"
                                />
                              </Labeled>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                              <Labeled label="Entry method">
                                <select
                                  value={srvPrefs.entryMethod}
                                  onChange={(e) => setSrvPrefs((p) => ({ ...p, entryMethod: e.target.value }))}
                                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2"
                                >
                                  <option value="in-person">In-person</option>
                                  <option value="lockbox">Lockbox</option>
                                  <option value="smart-lock">Smart-lock</option>
                                </select>
                              </Labeled>
                              <Labeled label="Supervision">
                                <select
                                  value={srvPrefs.supervision}
                                  onChange={(e) => setSrvPrefs((p) => ({ ...p, supervision: e.target.value }))}
                                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2"
                                >
                                  <option value="present">Present</option>
                                  <option value="absent">Absent</option>
                                </select>
                              </Labeled>
                              <Labeled label="Schedule window">
                                <input
                                  type="text"
                                  value={srvPrefs.scheduleWindow}
                                  onChange={(e) => setSrvPrefs((p) => ({ ...p, scheduleWindow: e.target.value }))}
                                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2"
                                  placeholder="e.g., 09:00–12:00"
                                />
                              </Labeled>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <Labeled label="Focus checklist">
                                <div className="flex flex-wrap items-center gap-2">
                                  {srvPrefs.focusChecklist.map((L, i) => (
                                    <RemovableTag
                                      key={`${L}-${i}`}
                                      label={L}
                                      onRemove={() =>
                                        setSrvPrefs((p) => ({
                                          ...p,
                                          focusChecklist: p.focusChecklist.filter((x, idx) => !(idx === i && x === L)),
                                        }))
                                      }
                                    />
                                  ))}
                                </div>
                                <TagInput
                                  placeholder="e.g., fridge inside, oven, windows"
                                  onAdd={(t) => setSrvPrefs((p) => ({ ...p, focusChecklist: [...p.focusChecklist, t] }))}
                                />
                              </Labeled>
                              <Labeled label="Service types">
                                <div className="flex flex-wrap items-center gap-2">
                                  {srvPrefs.serviceTypes.map((L, i) => (
                                    <RemovableTag
                                      key={`${L}-${i}`}
                                      label={L}
                                      onRemove={() =>
                                        setSrvPrefs((p) => ({
                                          ...p,
                                          serviceTypes: p.serviceTypes.filter((x, idx) => !(idx === i && x === L)),
                                        }))
                                      }
                                    />
                                  ))}
                                </div>
                                <TagInput
                                  placeholder="e.g., cleaning, laundry, maintenance"
                                  onAdd={(t) => setSrvPrefs((p) => ({ ...p, serviceTypes: [...p.serviceTypes, t] }))}
                                />
                              </Labeled>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <Labeled label="Languages">
                                <div className="flex flex-wrap items-center gap-2">
                                  {srvPrefs.languages.map((L, i) => (
                                    <RemovableTag
                                      key={`${L}-${i}`}
                                      label={L}
                                      onRemove={() =>
                                        setSrvPrefs((p) => ({
                                          ...p,
                                          languages: p.languages.filter((x, idx) => !(idx === i && x === L)),
                                        }))
                                      }
                                    />
                                  ))}
                                </div>
                                <TagInput
                                  placeholder="e.g., English, Filipino"
                                  onAdd={(t) => setSrvPrefs((p) => ({ ...p, languages: [...p.languages, t] }))}
                                />
                              </Labeled>
                              <Labeled label="Preferred locations">
                                <div className="flex flex-wrap items-center gap-2">
                                  {srvPrefs.locations.map((L, i) => (
                                    <RemovableTag
                                      key={`${L}-${i}`}
                                      label={L}
                                      onRemove={() =>
                                        setSrvPrefs((p) => ({
                                          ...p,
                                          locations: p.locations.filter((x, idx) => !(idx === i && x === L)),
                                        }))
                                      }
                                    />
                                  ))}
                                </div>
                                <TagInput
                                  placeholder="Add a city/area then Enter"
                                  onAdd={(t) => setSrvPrefs((p) => ({ ...p, locations: [...p.locations, t] }))}
                                />
                              </Labeled>
                            </div>

                            <Labeled label="Additional notes">
                              <textarea
                                rows={3}
                                value={srvPrefs.notes}
                                onChange={(e) => setSrvPrefs((p) => ({ ...p, notes: e.target.value }))}
                                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 whitespace-pre-wrap"
                                placeholder="Anything else the service provider should know?"
                              />
                            </Labeled>

                            <div className="flex flex-wrap gap-3">
                              <button
                                onClick={() => {
                                  setSavingSrv(true);
                                  setSrvMsg(null);
                                  const run = async () => {
                                    try {
                                      const prefRef = doc(database, "preferences", auth.currentUser.uid);
                                      await setDoc(
                                        prefRef,
                                        { uid: auth.currentUser.uid, services: { ...srvPrefs }, updatedAt: serverTimestamp() },
                                        { merge: true }
                                      );
                                      setSrvMsg({ type: "success", text: "Service preferences saved." });
                                    } catch (e) {
                                      setSrvMsg({ type: "error", text: e?.message || "Failed to save." });
                                    } finally {
                                      setSavingSrv(false);
                                    }
                                  };
                                  run();
                                }}
                                disabled={savingSrv}
                                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-white bg-blue-600 hover:bg-blue-700 shadow disabled:opacity-60"
                              >
                                {savingSrv ? <Loader2 size={16} className="animate-spin shrink-0" /> : <Save size={16} className="shrink-0" />}
                                Save
                              </button>
                              <button
                                onClick={() => setSrvPrefs(defaultSrvPrefs)}
                                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50"
                              >
                                <RotateCcw size={16} className="shrink-0" /> Reset
                              </button>
                            </div>

                            {srvMsg && (
                              <div
                                className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm ${
                                  srvMsg.type === "success"
                                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                    : "bg-rose-50 text-rose-700 border border-rose-200"
                                }`}
                              >
                                {srvMsg.type === "success" ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                                {srvMsg.text}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>

            
          </section>
        </div>
      </main>

      {/* Details Modals (optional) */}
      {modal?.type && (
        <div className="fixed inset-0">
          {modal.type === "home" && (
            <HomeDetailsModal listingId={modal.id} onClose={() => setModal(null)} />
          )}
          {modal.type === "experience" && (
            <ExperienceDetailsModal listingId={modal.id} onClose={() => setModal(null)} />
          )}
          {modal.type === "service" && (
            <ServiceDetailsModal listingId={modal.id} onClose={() => setModal(null)} />
          )}
        </div>
      )}

      {/* NEW: Points Modal */}
      <PointsModal
        open={showPoints}
        onClose={() => (!withdrawingPts && setShowPoints(false))}
        points={points}
        busy={withdrawingPts}
        onWithdraw={handleWithdrawPoints}
      />

      {/* Hosting Policies + Category Modals */}
      {showPoliciesModal && (
        <HostPoliciesModal onClose={handleClosePoliciesModal} onAgree={handleAgreePolicies} />
      )}
      {showHostModal && (
        <HostCategModal
          onClose={handleCloseHostModal}
          onSelectCategory={(category) => {
            setShowHostModal(false);
            if (category === "Homes") {
              navigate("/host-set-up", { state: { category } });
            } else if (category === "Experiences") {
              navigate("/host-set-up-2", { state: { category } });
            } else if (category === "Services") {
              navigate("/host-set-up-3", { state: { category } });
            }
          }}
        />
      )}
    </div>
  );
}
