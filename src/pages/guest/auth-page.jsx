// src/pages/auth/AuthPage.jsx
import { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  createUserWithEmailAndPassword,
  updateProfile,
  signOut,
  getAdditionalUserInfo,
  GoogleAuthProvider,
} from "firebase/auth";
import { auth, database } from "../../config/firebase";
import {
  collection,
  getDoc,
  getDocs,
  query,
  where,
  doc,
  setDoc,
  serverTimestamp,
  updateDoc,
  increment,
} from "firebase/firestore";

import BookifyIcon from "../../media/favorite.png";
import FormBg from "../../media/beach.mp4";
import { useNavigate } from "react-router-dom";
import emailjs from "@emailjs/browser";

/* ---------------- EmailJS config ---------------- */
const EMAILJS_SERVICE_ID =
  process.env.REACT_APP_EMAILJS_SERVICE_ID || "service_x9dtjt6";
const EMAILJS_VERIFY_TEMPLATE_ID =
  process.env.REACT_APP_EMAILJS_VERIFY_TEMPLATE_ID || "template_ar7mmgn";
const EMAILJS_PUBLIC_KEY =
  process.env.REACT_APP_EMAILJS_PUBLIC_KEY || "hHgssQum5iOFlnJRD";
const VERIFY_PAGE_PATH = "/verify";

/* ---------------- Signup bonus ---------------- */
const SIGNUP_BONUS_POINTS = 150;

/* ---------------- Google flow key ---------------- */
const GOOGLE_FLOW_KEY = "bookify_google_flow"; // "login" | "signup"

/* ---------------- Admin config ---------------- */
const ADMIN_EMAIL = "janssendelatorre23@gmail.com";
const isAdminEmail = (email = "") =>
  (email || "").trim().toLowerCase() === ADMIN_EMAIL.toLowerCase();

/* ---------------- Points helpers ---------------- */
const awardSignupPointsIfNeeded = async (db, uid, bonus = SIGNUP_BONUS_POINTS) => {
  try {
    const pRef = doc(db, "points", uid);
    const snap = await getDoc(pRef);

    if (!snap.exists()) {
      await setDoc(pRef, {
        uid,
        balance: bonus,
        updatedAt: serverTimestamp(),
        signupBonusAt: serverTimestamp(),
        awarded: { signup150: true },
      });
      return true;
    }

    const data = snap.data() || {};
    const already = !!data?.awarded?.signup150;

    if (!already) {
      await updateDoc(pRef, {
        uid,
        balance: increment(bonus),
        updatedAt: serverTimestamp(),
        signupBonusAt: serverTimestamp(),
        "awarded.signup150": true,
      });
      return true;
    }
  } catch (e) {
    console.error("Signup bonus points failed:", e);
  }
  return false;
};

/* ---------------- utils ---------------- */
const genToken = () =>
  (typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID().replace(/-/g, "")
    : Math.random().toString(36).slice(2) + Date.now().toString(36));

const TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

const mapFirebaseCodeToMessage = (code) => {
  switch (code) {
    case "auth/email-already-in-use":
      return "That email is already registered. Try logging in or use Forgot Password.";
    case "auth/invalid-email":
      return "Please enter a valid email address.";
    case "auth/weak-password":
      return "Password should be at least 6 characters.";
    case "auth/operation-not-allowed":
      return "Email/Password sign-in is disabled for this project.";
    case "auth/missing-recaptcha-token":
    case "auth/invalid-recaptcha-token":
    case "auth/captcha-check-failed":
      return "Verification failed (reCAPTCHA). Check Authorized Domains or reCAPTCHA config.";
    case "auth/too-many-requests":
      return "Too many attempts. Please try again later.";
    case "auth/missing-or-invalid-nonce":
      return "That sign-in was started twice. Please try again once (don’t double-click).";
    case "auth/account-exists-with-different-credential":
      return "An account exists with a different sign-in method. Try email/password or reset password.";
    default:
      return "Something went wrong. See console for details.";
  }
};

const reportAuthError = (err) => {
  const code = err?.code || err?.error?.message || "unknown";
  const msg = mapFirebaseCodeToMessage(code);
  console.error("Signup/Login error →", { code, message: err?.message, err });
  alert(`${msg}\n\n(dev: ${code})`);
};

/* ---------------- Name helpers (Google) ---------------- */
const deriveNamesFromGoogle = (user, result) => {
  const info = getAdditionalUserInfo(result);
  const prof = (info && info.profile) || {};
  const dn = user.displayName || prof.name || "";

  let firstName = prof.given_name || "";
  let lastName = prof.family_name || "";

  if (!firstName && dn) {
    const parts = dn.trim().split(/\s+/);
    firstName = parts[0] || "";
    lastName = parts.slice(1).join(" ");
  }

  if (!firstName) {
    const handle = (user.email || "").split("@")[0] || "";
    firstName = handle;
  }

  const displayName = dn || `${firstName} ${lastName}`.trim();
  return { displayName, firstName, lastName };
};

/* ---------------- Upserts ---------------- */
const requiredShapeFromUser = (user, extras = {}) => ({
  uid: user.uid,
  email: (user.email || "").toLowerCase(),
  displayName: extras.displayName ?? (user.displayName || (user.email || "").split("@")[0] || ""),
  firstName: extras.firstName ?? "",
  lastName: extras.lastName ?? "",
  photoURL: user.photoURL || "",
  updatedAt: serverTimestamp(),
  ...extras.mergeFields,
});

// Only used for SIGNUP flow (Google). DO NOT call this for LOGIN flow.
const upsertGoogleUser = async (db, user, result) => {
  const { displayName, firstName, lastName } = deriveNamesFromGoogle(user, result);
  const info = getAdditionalUserInfo(result);
  const isNew = !!info?.isNewUser;

  const base = requiredShapeFromUser(user, {
    displayName,
    firstName,
    lastName,
    mergeFields: user.emailVerified
      ? { verified: true, verifiedAt: serverTimestamp() }
      : {},
  });

  const uRef = doc(db, "users", user.uid);
  const snap = await getDoc(uRef);

  if (snap.exists()) {
    await setDoc(uRef, base, { merge: true });
  } else {
    await setDoc(uRef, { ...base, createdAt: serverTimestamp() }, { merge: true });
  }

  if (isNew) {
    await awardSignupPointsIfNeeded(db, user.uid, SIGNUP_BONUS_POINTS);
  }
};

// Ensure any user has a reasonable /users doc (email/password paths)
const ensureUserInFirestore = async (db, user) => {
  const uRef = doc(db, "users", user.uid);
  const snap = await getDoc(uRef);

  if (!snap.exists()) {
    await setDoc(uRef, {
      uid: user.uid,
      email: (user.email || "").toLowerCase(),
      displayName: user.displayName || (user.email || "").split("@")[0] || "",
      firstName:
        (user.displayName || "").split(" ")[0] ||
        (user.email || "").split("@")[0] ||
        "",
      lastName: (user.displayName || "").split(" ").slice(1).join(" "),
      photoURL: user.photoURL || "",
      verified: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } else {
    const existing = snap.data() || {};
    const patch = {};
    const wantKeys = ["uid", "email", "displayName", "firstName", "lastName", "photoURL"];
    const fallback = {
      uid: user.uid,
      email: (user.email || "").toLowerCase(),
      displayName:
        existing.displayName ||
        user.displayName ||
        (user.email || "").split("@")[0] ||
        "",
      firstName:
        existing.firstName ||
        (user.displayName || "").split(" ")[0] ||
        (user.email || "").split("@")[0] ||
        "",
      lastName:
        existing.lastName || (user.displayName || "").split(" ").slice(1).join(" "),
      photoURL: existing.photoURL || user.photoURL || "",
    };

    for (const k of wantKeys) {
      if (existing[k] == null || existing[k] === "") patch[k] = fallback[k];
    }
    patch.updatedAt = serverTimestamp();

    if (Object.keys(patch).length) await setDoc(uRef, patch, { merge: true });
  }
};

// Ensure the admin has a user doc, mark role/admin + verified
const upsertAdminIfNeeded = async (db, user) => {
  const uRef = doc(db, "users", user.uid);
  const snap = await getDoc(uRef);

  const base = {
    uid: user.uid,
    email: (user.email || "").toLowerCase(),
    displayName: user.displayName || (user.email || "").split("@")[0] || "",
    firstName: (user.displayName || "").split(" ")[0] || (user.email || "").split("@")[0] || "",
    lastName: (user.displayName || "").split(" ").slice(1).join(" "),
    photoURL: user.photoURL || "",
    role: "admin",
    verified: true,
    verifiedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  if (!snap.exists()) {
    await setDoc(uRef, { ...base, createdAt: serverTimestamp() }, { merge: true });
  } else {
    await setDoc(uRef, base, { merge: true });
  }
};

// Check if a /users doc exists for email (non-admins must exist before Google login)
const userExistsByEmail = async (db, email) => {
  const safe = (email || "").trim().toLowerCase();
  if (!safe) return false;
  const col = collection(db, "users");
  const qUsers = query(col, where("email", "==", safe));
  const snap = await getDocs(qUsers);
  return !snap.empty;
};

/* ============================== Component ============================== */

export const AuthPage = () => {
  const navigate = useNavigate();

  const [mode, setMode] = useState("login"); // "login" | "signup"
  const [agreed, setAgreed] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [form, setForm] = useState({
    email: "",
    password: "",
    confirmPassword: "",
    firstName: "",
    lastName: "",
  });
  const usersCollectionRef = collection(database, "users");

  const [pendingGoogleAuth, setPendingGoogleAuth] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [banner, setBanner] = useState(null); // { kind: 'warning'|'error'|'success'|'info', text: string }

  // Refs to avoid double-handling
  const handledRedirectRef = useRef(false);
  const googleBusyRef = useRef(false);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  /* ------------- Post-login router (admin vs dashboard) ------------- */
  const goToPostLogin = (email) => {
    const e = (email || "").toLowerCase();
    if (isAdminEmail(e)) {
      navigate("/admin-dashboard");
    } else {
      navigate("/dashboard");
    }
  };

  /* ------------- Handle Google Redirect Results ------------- */
  useEffect(() => {
    (async () => {
      try {
        if (handledRedirectRef.current) return;
        handledRedirectRef.current = true;

        const result = await getRedirectResult(auth);
        if (result && result.user) {
          const flow = sessionStorage.getItem(GOOGLE_FLOW_KEY) || "login";
          sessionStorage.removeItem(GOOGLE_FLOW_KEY);

          if (flow === "signup") {
            await upsertGoogleUser(database, result.user, result);
            await awardSignupPointsIfNeeded(database, result.user.uid, SIGNUP_BONUS_POINTS);
            alert(
              `Welcome ${result.user.displayName || (result.user.email || "").split("@")[0]}!`
            );
            goToPostLogin(result.user.email);
          } else {
            // LOGIN flow
            const email = (result.user.email || "").toLowerCase();

            if (isAdminEmail(email)) {
              // Admin bypass
              await upsertAdminIfNeeded(database, result.user);
              alert(`Welcome Admin ${result.user.displayName || email.split("@")[0]}!`);
              goToPostLogin(email);
              return;
            }

            // Everyone else must already exist in /users
            const exists = await userExistsByEmail(database, email);
            if (!exists) {
              setBanner({
                kind: "warning",
                text:
                  "That Google account isn’t registered on Bookify. Please use ‘Sign Up with Google’.",
              });
              await signOut(auth);
              return;
            }

            alert(
              `Welcome ${result.user.displayName || (result.user.email || "").split("@")[0]}!`
            );
            goToPostLogin(email);
          }
        }
      } catch (err) {
        reportAuthError(err);
      }
    })();
  }, [navigate]);

  /* ---------------- Email/Password: Login ---------------- */
  const handleLogin = async () => {
    try {
      const userCredential = await signInWithEmailAndPassword(
        auth,
        form.email,
        form.password
      );
      const user = userCredential.user;

      await ensureUserInFirestore(database, user);

      // If admin, force admin role + skip verify; then route to admin dashboard
      if (isAdminEmail(user.email)) {
        await upsertAdminIfNeeded(database, user);
        alert(`Welcome Admin ${user.displayName || user.email.split("@")[0]}!`);
        goToPostLogin(user.email);
        return;
      }

      // Non-admin: must be verified
      const uq = query(usersCollectionRef, where("uid", "==", user.uid));
      const usnap = await getDocs(uq);

      if (usnap.empty) {
        alert("Account record not found. Please contact support.");
        await signOut(auth);
        return;
      }

      const userDoc = usnap.docs[0].data();
      if (!userDoc.verified) {
        alert("Please verify your email first. Check your inbox for the verification link.");
        await signOut(auth);
        return;
      }

      alert(`Welcome Back ${user.displayName || user.email.split("@")[0]}!`);
      goToPostLogin(user.email);
    } catch (err) {
      reportAuthError(err);
    }
  };

  /* ---------------- Email/Password: Signup ---------------- */
  const handleSignup = async () => {
    if (form.password !== form.confirmPassword) {
      alert("Passwords do not match!");
      return;
    }
    try {
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        form.email,
        form.password
      );
      const user = userCredential.user;

      await updateProfile(user, {
        displayName: `${form.firstName} ${form.lastName}`.trim(),
      });

      // Create /users doc
      await setDoc(doc(database, "users", user.uid), {
        uid: user.uid,
        email: (user.email || "").toLowerCase(),
        displayName: `${form.firstName} ${form.lastName}`.trim(),
        firstName: form.firstName,
        lastName: form.lastName,
        photoURL: "",
        verified: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      // Award signup bonus
      await awardSignupPointsIfNeeded(database, user.uid, SIGNUP_BONUS_POINTS);

      // Email verification token flow
      const token = genToken();
      await setDoc(doc(database, "email_verifications", token), {
        uid: user.uid,
        email: user.email,
        token,
        createdAt: serverTimestamp(),
        expiresAt: new Date(Date.now() + TOKEN_TTL_MS),
        consumed: false,
      });

      const verifyLink = `${window.location.origin}${VERIFY_PAGE_PATH}?token=${encodeURIComponent(
        token
      )}`;

      await emailjs.send(
        EMAILJS_SERVICE_ID,
        EMAILJS_VERIFY_TEMPLATE_ID,
        {
          to_email: user.email,
          to_name: `${form.firstName} ${form.lastName}`.trim(),
          verify_link: verifyLink,
        },
        EMAILJS_PUBLIC_KEY
      );

      alert(`We sent you a verification link. Also credited ${SIGNUP_BONUS_POINTS} points 🎉`);
    } catch (err) {
      reportAuthError(err);
    }
  };

  /* ---------------- Google: Login/Signup with guards ---------------- */
  const handleGoogleAuth = async (flow = "login") => {
    if (googleBusyRef.current) return; // block re-entrancy
    googleBusyRef.current = true;
    setGoogleBusy(true);
    setBanner(null);

    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });

    try {
      const result = await signInWithPopup(auth, provider);
      const user = result.user;

      if (flow === "signup") {
        await upsertGoogleUser(database, user, result);
        await awardSignupPointsIfNeeded(database, user.uid, SIGNUP_BONUS_POINTS);
        alert(`Welcome ${user.displayName || (user.email || "").split("@")[0]}!`);
        goToPostLogin(user.email);
        return;
      }

      // LOGIN flow
      const email = (user.email || "").toLowerCase();

      if (isAdminEmail(email)) {
        await upsertAdminIfNeeded(database, user);
        alert(`Welcome Admin ${user.displayName || email.split("@")[0]}!`);
        goToPostLogin(email);
        return;
      }

      // Non-admins must exist already
      const exists = await userExistsByEmail(database, email);
      if (!exists) {
        setBanner({
          kind: "warning",
          text: "That Google account isn’t registered on Bookify. Please use ‘Sign Up with Google’.",
        });
        await signOut(auth);
        return;
      }

      alert(`Welcome ${user.displayName || email.split("@")[0]}!`);
      goToPostLogin(email);
    } catch (err) {
      const popupErrors = [
        "auth/popup-closed-by-user",
        "auth/popup-blocked",
        "auth/cancelled-popup-request",
      ];
      if (popupErrors.includes(err?.code)) {
        // Fall back to redirect; persist flow so we can enforce after redirect
        sessionStorage.setItem(GOOGLE_FLOW_KEY, flow);
        const provider = new GoogleAuthProvider();
        provider.setCustomParameters({ prompt: "select_account" });
        await signInWithRedirect(auth, provider);
        return;
      }
      if (
        err?.code === "auth/missing-or-invalid-nonce" ||
        /Duplicate credential/i.test(err?.message || "")
      ) {
        alert("Sign-in restarted. Please try again once (don’t double-click).");
      } else {
        reportAuthError(err);
      }
    } finally {
      googleBusyRef.current = false;
      setGoogleBusy(false);
    }
  };

  /* ---------------- UI bits ---------------- */
  const StarLogo = () => (
    <img src={BookifyIcon} alt="Bookify logo" className="w-9 h-9 rounded-md" />
  );

  const GoogleG = () => (
    <svg className="w-5 h-5" viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#000000ff"
        d="M43.611 20.083H42V20H24v8h11.303C33.94 31.91 29.358 35 24 35c-6.627 
        0-12-5.373-12-12s5.373-12 12-12c3.059 
        0 5.842 1.154 7.964 3.036l5.657-5.657C34.884 
        5.05 29.727 3 24 3 12.955 3 4 11.955 4 
        23s8.955 20 20 20c10.994 0 19.5-8.439 
        19.5-20 0-1.341-.138-2.651-.389-3.917z"
      />
    </svg>
  );

  const InlineBanner = ({ kind = "info", children, onClose }) => {
    const styles =
      kind === "success"
        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
        : kind === "warning"
        ? "bg-amber-50 text-amber-800 border-amber-300"
        : kind === "error"
        ? "bg-rose-50 text-rose-700 border-rose-200"
        : "bg-blue-50 text-blue-700 border-blue-200";
    return (
      <div className={`w-full rounded-xl border px-3 py-2 text-sm flex items-start gap-2 ${styles}`}>
        <span className="mt-0.5">{children}</span>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="ml-auto text-inherit/70 hover:text-inherit"
            aria-label="Dismiss"
          >
            ×
          </button>
        )}
      </div>
    );
  };

  const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);

  const handleGoogleClick = () => {
    setBanner(null);
    if (mode === "login") {
      if (isSafari || isIOS) {
        sessionStorage.setItem(GOOGLE_FLOW_KEY, "login");
        const provider = new GoogleAuthProvider();
        provider.setCustomParameters({ prompt: "select_account" });
        signInWithRedirect(auth, provider);
      } else {
        handleGoogleAuth("login");
      }
      return;
    }

    // signup → show terms first, then continue
    setPendingGoogleAuth(true);
    setShowTerms(true);
  };

  return (
    <div className="relative min-h-screen w-full flex items-center justify-center p-4 sm:p-6 overflow-hidden">
      {/* Background Video */}
      <video
        className="absolute inset-0 w-full h-full object-cover"
        src={FormBg}
        autoPlay
        muted
        loop
        playsInline
      />
      <div className="absolute inset-0 backdrop-blur-[4px]" />

      <div className="relative w-full max-w-6xl grid grid-cols-1 md:grid-cols-2 rounded-[28px] overflow-hidden shadow-2xl bg-white backdrop-blur-sm">
        {/* LEFT */}
        <div className="px-6 sm:px-10 lg:px-14 py-8 sm:py-10 lg:py-12 flex flex-col">
          <div className="flex items-center space-x-3 mb-6">
            <StarLogo />
            <span className="text-lg font-bold text-gray-800">Bookify</span>
          </div>

          <div className="mb-6">
            <h2 className="text-2xl font-semibold text-gray-800">
              {mode === "login" ? "Welcome Back!" : "Create Your Account"}
            </h2>
            <p className="text-gray-500 text-sm">
              {mode === "login"
                ? "We’re happy to see you again."
                : "Join us and explore the world of Bookify."}
            </p>
          </div>

          {/* Toggle */}
          <div className="w-full max-w-xs mb-6">
            <div className="flex items-center bg-gray-100 rounded-full p-1">
              <button
                type="button"
                className={`flex-1 py-2 text-sm font-medium rounded-full transition-all ${
                  mode === "login"
                    ? "bg-blue-600 text-white shadow"
                    : "text-gray-500 hover:text-gray-700"
                }`}
                onClick={() => setMode("login")}
              >
                Log In
              </button>
              <button
                type="button"
                className={`flex-1 py-2 text-sm font-medium rounded-full transition-all ${
                  mode === "signup"
                    ? "bg-blue-600 text-white shadow"
                    : "text-gray-500 hover:text-gray-700"
                }`}
                onClick={() => setMode("signup")}
              >
                Sign Up
              </button>
            </div>
          </div>

          {/* Form (wraps both login & signup variants) */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (mode === "login") handleLogin();
              else handleSignup();
            }}
            autoComplete="on"
            noValidate
          >
            <AnimatePresence mode="wait">
              {mode === "login" ? (
                <motion.div
                  key="login"
                  initial={{ opacity: 0, x: 30 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -30 }}
                  transition={{ duration: 0.4 }}
                  className="space-y-4"
                >
                  <input
                    name="email"
                    type="email"
                    autoComplete="email"
                    placeholder="Email"
                    className="w-full px-4 py-3 border border-gray-300 rounded-full focus:ring-2 focus:ring-blue-400 focus:outline-none"
                    value={form.email}
                    onChange={handleChange}
                  />
                  <div className="relative">
                    <input
                      name="password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="current-password"
                      placeholder="Password"
                      className="w-full px-4 pr-12 py-3 border border-gray-300 rounded-full focus:ring-2 focus:ring-blue-400 focus:outline-none"
                      value={form.password}
                      onChange={handleChange}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((p) => !p)}
                      className="absolute right-4 inset-y-0 flex items-center text-gray-400"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
                        strokeWidth="1.5" stroke="currentColor" className="size-6">
                        <path strokeLinecap="round" strokeLinejoin="round"
                          d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
                        <path strokeLinecap="round" strokeLinejoin="round"
                          d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                      </svg>
                    </button>
                  </div>
                  <button
                    type="submit"
                    className="w-full py-3 bg-blue-600 text-white font-semibold rounded-full hover:bg-blue-700 transition"
                  >
                    Log In
                  </button>
                </motion.div>
              ) : (
                <motion.div
                  key="signup"
                  initial={{ opacity: 0, x: -30 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 30 }}
                  transition={{ duration: 0.4 }}
                  className="space-y-4"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <input
                      name="firstName"
                      autoComplete="given-name"
                      placeholder="First Name"
                      className="w-full px-4 py-3 border border-gray-300 rounded-full focus:ring-2 focus:ring-blue-400 focus:outline-none"
                      value={form.firstName}
                      onChange={handleChange}
                    />
                    <input
                      name="lastName"
                      autoComplete="family-name"
                      placeholder="Last Name"
                      className="w-full px-4 py-3 border border-gray-300 rounded-full focus:ring-2 focus:ring-blue-400 focus:outline-none"
                      value={form.lastName}
                      onChange={handleChange}
                    />
                  </div>
                  <input
                    name="email"
                    type="email"
                    autoComplete="email"
                    placeholder="Email"
                    className="w-full px-4 py-3 border border-gray-300 rounded-full focus:ring-2 focus:ring-blue-400 focus:outline-none"
                    value={form.email}
                    onChange={handleChange}
                  />

                  {/* Password */}
                  <div className="relative">
                    <input
                      name="password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="new-password"
                      placeholder="Password"
                      className="w-full px-4 pr-12 py-3 border border-gray-300 rounded-full focus:ring-2 focus:ring-blue-400 focus:outline-none"
                      value={form.password}
                      onChange={handleChange}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((p) => !p)}
                      className="absolute right-4 inset-y-0 flex items-center text-gray-400"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
                        strokeWidth="1.5" stroke="currentColor" className="w-5 h-5">
                        <path strokeLinecap="round" strokeLinejoin="round"
                          d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 
                          4.5 12 4.5c4.638 0 8.573 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774" />
                        <path strokeLinecap="round" strokeLinejoin="round"
                          d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                      </svg>
                    </button>
                  </div>

                  {/* Confirm */}
                  <div className="relative">
                    <input
                      name="confirmPassword"
                      type={showConfirmPassword ? "text" : "password"}
                      autoComplete="new-password"
                      placeholder="Confirm Password"
                      className="w-full px-4 pr-12 py-3 border border-gray-300 rounded-full focus:ring-2 focus:ring-blue-400 focus:outline-none"
                      value={form.confirmPassword}
                      onChange={handleChange}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword((p) => !p)}
                      className="absolute right-4 inset-y-0 flex items-center text-gray-400"
                      aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none"
                        viewBox="0 0 24 24" strokeWidth="1.5"
                        stroke="currentColor" className="w-5 h-5">
                        <path strokeLinecap="round" strokeLinejoin="round"
                          d="M3.98 8.223A10.477 10.477 0 0 0 
                          1.934 12C3.226 16.338 7.244 19.5 
                          12 19.5c.993 0 1.953-.138 2.863-.395M6.228 
                          6.228A10.451 10.451 0 0 1 12 
                          4.5c4.756 0 8.773 3.162 10.065 
                          7.498a10.522 10.522 0 0 1-4.293 
                          5.774M6.228 6.228 3 3m3.228 3.228 
                          3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 
                          0a3 3 0 1 0-4.243-4.243m4.242 
                          4.242L9.88 9.88" />
                      </svg>
                    </button>
                  </div>

                  {/* Terms */}
                  <div className="flex items-center mb-4">
                    <input
                      id="terms"
                      type="checkbox"
                      checked={agreed}
                      onChange={(e) => setAgreed(e.target.checked)}
                      className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <label htmlFor="terms" className="ml-2 text-sm text-gray-700 select-none">
                      I agree to the{" "}
                      <button
                        type="button"
                        onClick={() => setShowTerms(true)}
                        className="text-blue-600 hover:underline"
                      >
                        Terms and Conditions
                      </button>
                    </label>
                  </div>

                  <button
                    type="submit"
                    disabled={!agreed}
                    className={`w-full py-3 font-semibold rounded-full transition ${
                      agreed
                        ? "bg-blue-600 text-white hover:bg-blue-700"
                        : "bg-gray-300 text-gray-500 cursor-not-allowed"
                    }`}
                  >
                    Sign Up
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </form>

          <div className="flex items-center my-6">
            <div className="flex-grow border-t border-gray-200"></div>
            <span className="mx-3 text-gray-400 text-xs">OR</span>
            <div className="flex-grow border-t border-gray-200"></div>
          </div>

          {/* Small banner for Google login rule */}
          {banner && (
            <div className="mb-3">
              <InlineBanner kind={banner.kind} onClose={() => setBanner(null)}>
                {banner.text}
              </InlineBanner>
            </div>
          )}

          <button
            type="button"
            onClick={handleGoogleClick}
            disabled={googleBusy}
            className={`w-full py-3 border border-gray-300 rounded-full ${
              googleBusy ? "bg-gray-100 text-gray-400 cursor-wait" : "bg-white text-gray-700 hover:bg-gray-50"
            } font-medium flex items-center justify-center space-x-2 transition`}
          >
            <GoogleG />
            <span>{mode === "login" ? "Log In" : "Sign Up"} with Google</span>
          </button>
        </div>

        {/* RIGHT (Video side) */}
        <div className="relative hidden md:block">
          <video
            className="absolute inset-0 w-full h-full object-cover"
            src={FormBg}
            autoPlay
            muted
            loop
            playsInline
          />
          <div className="absolute inset-0 backdrop-blur-[2px]" />
          <div className="absolute bottom-6 left-6 right-6 text-white/80 text-[10px] leading-snug bg-white/10 border border-white/20 backdrop-blur-sm rounded-xl px-4 py-2">
            © 2025 Bookify. All rights reserved. Unauthorized reproduction
            prohibited.
          </div>
        </div>
      </div>

      {/* Terms & Conditions Modal */}
      {showTerms && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 px-4 sm:px-0">
          <div className="bg-white rounded-2xl w-full max-w-lg sm:max-w-md md:max-w-lg p-4 sm:p-6 relative shadow-lg max-h[90vh] flex flex-col">
            <h3 className="text-lg sm:text-xl font-semibold mb-3 sm:mb-4 text-gray-800 text-center sm:text-left">
              Terms and Conditions
            </h3>

            <div className="flex-1 overflow-y-auto text-sm text-gray-600 space-y-3 pr-1 sm:pr-2">
              <p>
                Welcome to <strong>Bookify</strong>! By creating an account, you agree to comply with and be bound by these Terms and Conditions.
              </p>
              <p><strong>1. Use of Service:</strong> Use Bookify only for lawful purposes.</p>
              <p><strong>2. Account Responsibility:</strong> Keep your credentials safe.</p>
              <p><strong>3. Prohibited Activities:</strong> No abuse, scraping, or harmful content.</p>
              <p><strong>4. Intellectual Property:</strong> Materials are owned/licensed by Bookify.</p>
              <p><strong>5. Termination:</strong> We may suspend/terminate for violations.</p>
              <p><strong>6. Privacy:</strong> See our Privacy Policy for data handling.</p>
              <p>By continuing, you acknowledge you have read and agree to these terms.</p>
            </div>

            <div className="mt-4 sm:mt-6 flex flex-col sm:flex-row sm:justify-end sm:space-x-3 space-y-3 sm:space-y-0">
              <button
                type="button"
                onClick={() => {
                  setShowTerms(false);
                  setPendingGoogleAuth(false);
                }}
                className="w-full sm:w-auto px-4 py-2 text-gray-700 bg-gray-200 rounded-full hover:bg-gray-300 transition"
              >
                Close
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowTerms(false);
                  setAgreed(true);
                  if (pendingGoogleAuth) {
                    if (!googleBusyRef.current) {
                      if (isSafari || isIOS) {
                        sessionStorage.setItem(GOOGLE_FLOW_KEY, "signup");
                        const provider = new GoogleAuthProvider();
                        provider.setCustomParameters({ prompt: "select_account" });
                        signInWithRedirect(auth, provider);
                      } else {
                        handleGoogleAuth("signup"); // popup with fallback
                      }
                    }
                    setPendingGoogleAuth(false);
                  }
                }}
                className="w-full sm:w-auto px-4 py-2 text-white bg-blue-600 rounded-full hover:bg-blue-700 transition"
              >
                Agree
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AuthPage;
