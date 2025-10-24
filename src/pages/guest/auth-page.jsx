import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  signInWithEmailAndPassword,
  signInWithPopup,
  createUserWithEmailAndPassword,
  sendEmailVerification,
  updateProfile,
} from "firebase/auth";
import { auth, database, googleProvider } from "../../config/firebase";
import {
  collection,
  addDoc,
  getDocs,
  query,
  where,
  updateDoc,
  doc,
} from "firebase/firestore";

import BookifyIcon from "../../media/favorite.png";
import FormBg from "../../media/beach.mp4";
import { useNavigate } from "react-router-dom";


export const AuthPage = () => {
  const navigate = useNavigate();

  const [mode, setMode] = useState("login"); // "login" or "signup"
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

  // Shared field handler
  const handleChange = (e) =>
    setForm({ ...form, [e.target.name]: e.target.value });

  // Firebase Login
  const handleLogin = async () => {
    try {
      const userCredential = await signInWithEmailAndPassword(
        auth,
        form.email,
        form.password
      );
      const user = userCredential.user;

      if (!user.emailVerified) {
        alert("Please verify your email before logging in!");
        await auth.signOut();
        return;
      }

      await ensureUserInFirestore(user);
      alert(`Welcome Back ${user.displayName || user.email.split("@")[0]}!`);
      navigate("/dashboard"); // ✅ go to Home page
    } catch (err) {
      alert(err.message);
    }
  };

  // Firebase Signup
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
        displayName: `${form.firstName} ${form.lastName}`,
      });
      await sendEmailVerification(user);
      alert("Verification email sent! Please check your inbox.");

      await addDoc(usersCollectionRef, {
        firstName: form.firstName,
        lastName: form.lastName,
        email: user.email,
        type: "guest",
        userId: user.uid,
        verified: false,
      });
      
      alert(`Welcome ${user.displayName || user.email.split("@")[0]}!`);
      navigate("/dashboard"); // ✅ go to Home page

    } catch (err) {
      alert(err.message);
    }
  };

  const ensureUserInFirestore = async (user) => {
    const q = query(usersCollectionRef, where("uid", "==", user.uid));
    const snapshot = await getDocs(q);
    if (snapshot.empty) {
      await addDoc(usersCollectionRef, {
        uid: user.uid,
        email: user.email,
        type: "guest",
        verified: user.emailVerified,
      });
    }
  };

  const handleGoogleAuth = async () => {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;
      await ensureUserInFirestore(user);
    alert(`Welcome ${user.displayName || user.email.split("@")[0]}!`);
    navigate("/dashboard"); // ✅ redirect after Google login/signup
    } catch (err) {
      alert(err.message);
    }
  };

  const StarLogo = () => (
    <img
    src={BookifyIcon}
    alt="Bookify logo"
    className="w-9 h-9 rounded-md"
    />
  );

  const GoogleG = () => (
    <svg className="w-5 h-5" viewBox="0 0 48 48">
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
  
  const handleGoogleClick = () => {
    if (mode === "login") {
        handleGoogleAuth(); // Direct login
    } else {
        // Signup mode: show Terms first
        setPendingGoogleAuth(true);
        setShowTerms(true);
    }
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
        {/* LEFT PANEL */}
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

          {/* Toggle Buttons */}
          <div className="w-full max-w-xs mb-6">
            <div className="flex items-center bg-gray-100 rounded-full p-1">
              <button
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

          {/* Animated Form Section */}
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
                  placeholder="Email"
                  className="w-full px-4 py-3 border border-gray-300 rounded-full focus:ring-2 focus:ring-blue-400 focus:outline-none"
                  value={form.email}
                  onChange={handleChange}
                />
                <div className="relative">
                  <input
                    name="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Password"
                    className="w-full px-4 pr-12 py-3 border border-gray-300 rounded-full focus:ring-2 focus:ring-blue-400 focus:outline-none"
                    value={form.password}
                    onChange={handleChange}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute right-4 inset-y-0 flex items-center text-gray-400"
                  >
                    {showPassword ? <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-6">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
                    <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                    </svg>
                    : 
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="size-6">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88" />
                    </svg>

                    }
                  </button>
                </div>
                <button
                  onClick={handleLogin}
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
                    placeholder="First Name"
                    className="w-full px-4 py-3 border border-gray-300 rounded-full focus:ring-2 focus:ring-blue-400 focus:outline-none"
                    value={form.firstName}
                    onChange={handleChange}
                  />
                  <input
                    name="lastName"
                    placeholder="Last Name"
                    className="w-full px-4 py-3 border border-gray-300 rounded-full focus:ring-2 focus:ring-blue-400 focus:outline-none"
                    value={form.lastName}
                    onChange={handleChange}
                  />
                </div>
                <input
                  name="email"
                  type="email"
                  placeholder="Email"
                  className="w-full px-4 py-3 border border-gray-300 rounded-full focus:ring-2 focus:ring-blue-400 focus:outline-none"
                  value={form.email}
                  onChange={handleChange}
                />
                {/* PASSWORD FIELD */}
                <div className="relative">
                <input
                    name="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Password"
                    className="w-full px-4 pr-12 py-3 border border-gray-300 rounded-full focus:ring-2 focus:ring-blue-400 focus:outline-none"
                    value={form.password}
                    onChange={handleChange}
                />
                <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute right-4 inset-y-0 flex items-center text-gray-400"
                >
                    {showPassword ? (
                    // 👁️ Visible Icon
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth="1.5"
                        stroke="currentColor"
                        className="w-5 h-5"
                    >
                        <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 
                        4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 
                        .639C20.577 16.49 16.64 19.5 12 
                        19.5c-4.638 0-8.573-3.007-9.963-7.178Z"
                        />
                        <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"
                        />
                    </svg>
                    ) : (
                    // 🙈 Hidden Icon
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth={1.5}
                        stroke="currentColor"
                        className="w-5 h-5"
                    >
                        <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M3.98 8.223A10.477 10.477 0 0 0 
                        1.934 12C3.226 16.338 7.244 19.5 
                        12 19.5c.993 0 1.953-.138 2.863-.395M6.228 
                        6.228A10.451 10.451 0 0 1 12 
                        4.5c4.756 0 8.773 3.162 10.065 
                        7.498a10.522 10.522 0 0 1-4.293 
                        5.774M6.228 6.228 3 3m3.228 3.228 
                        3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 
                        0a3 3 0 1 0-4.243-4.243m4.242 
                        4.242L9.88 9.88"
                        />
                    </svg>
                    )}
                </button>
                </div>

                {/* CONFIRM PASSWORD FIELD */}
                <div className="relative">
                <input
                    name="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder="Confirm Password"
                    className="w-full px-4 pr-12 py-3 border border-gray-300 rounded-full focus:ring-2 focus:ring-blue-400 focus:outline-none"
                    value={form.confirmPassword}
                    onChange={handleChange}
                />
                <button
                    type="button"
                    onClick={() => setShowConfirmPassword((prev) => !prev)}
                    className="absolute right-4 inset-y-0 flex items-center text-gray-400"
                >
                    {showConfirmPassword ? (
                    // 👁️ Visible Icon
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth="1.5"
                        stroke="currentColor"
                        className="w-5 h-5"
                    >
                        <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 
                        4.5 12 4.5c4.638 0 8.573 3.007 9.963 
                        7.178.07.207.07.431 0 
                        .639C20.577 16.49 16.64 19.5 12 
                        19.5c-4.638 0-8.573-3.007-9.963-7.178Z"
                        />
                        <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"
                        />
                    </svg>
                    ) : (
                    // 🙈 Hidden Icon
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth={1.5}
                        stroke="currentColor"
                        className="w-5 h-5"
                    >
                        <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M3.98 8.223A10.477 10.477 0 0 0 
                        1.934 12C3.226 16.338 7.244 19.5 
                        12 19.5c.993 0 1.953-.138 2.863-.395M6.228 
                        6.228A10.451 10.451 0 0 1 12 
                        4.5c4.756 0 8.773 3.162 10.065 
                        7.498a10.522 10.522 0 0 1-4.293 
                        5.774M6.228 6.228 3 3m3.228 3.228 
                        3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 
                        0a3 3 0 1 0-4.243-4.243m4.242 
                        4.242L9.88 9.88"
                        />
                    </svg>
                    )}
                </button>
                </div>

                {/* Terms and Conditions Checkbox */}
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

                {/* Sign Up Button */}
                <button
                onClick={handleSignup}
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

          <div className="flex items-center my-6">
            <div className="flex-grow border-t border-gray-200"></div>
            <span className="mx-3 text-gray-400 text-xs">OR</span>
            <div className="flex-grow border-t border-gray-200"></div>
          </div>

          <button
            onClick={handleGoogleClick}
            className="w-full py-3 border border-gray-300 rounded-full bg-white text-gray-700 hover:bg-gray-50 font-medium flex items-center justify-center space-x-2 transition"
        >
            <GoogleG />
            <span>{mode === "login" ? "Log In" : "Sign Up"} with Google</span>
        </button>
        </div>

        {/* RIGHT PANEL (Video Side) */}
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
            <div className="bg-white rounded-2xl w-full max-w-lg sm:max-w-md md:max-w-lg p-4 sm:p-6 relative shadow-lg max-h-[90vh] flex flex-col">
            <h3 className="text-lg sm:text-xl font-semibold mb-3 sm:mb-4 text-gray-800 text-center sm:text-left">
                Terms and Conditions
            </h3>

            {/* Scrollable Text */}
            <div className="flex-1 overflow-y-auto text-sm text-gray-600 space-y-3 pr-1 sm:pr-2">
                <p>
                Welcome to <strong>Bookify</strong>! By creating an account, you agree to comply with and be bound by these Terms and Conditions.
                </p>
                <p>
                <strong>1. Use of Service:</strong> You may use Bookify only for lawful purposes and in accordance with all applicable laws and regulations.
                </p>
                <p>
                <strong>2. Account Responsibility:</strong> You are responsible for maintaining the confidentiality of your login credentials and for all activities that occur under your account.
                </p>
                <p>
                <strong>3. Prohibited Activities:</strong> You agree not to misuse the platform, including but not limited to unauthorized access, scraping, or distributing harmful content.
                </p>
                <p>
                <strong>4. Intellectual Property:</strong> All materials provided through Bookify are owned or licensed by Bookify and are protected by intellectual property laws.
                </p>
                <p>
                <strong>5. Termination:</strong> We reserve the right to suspend or terminate your account at any time for violations of these terms.
                </p>
                <p>
                <strong>6. Privacy:</strong> Please review our Privacy Policy to understand how we handle your data and protect your privacy.
                </p>
                <p>
                By continuing, you acknowledge that you have read, understood, and agreed to these terms.
                </p>
            </div>

            {/* Modal Actions */}
            <div className="mt-4 sm:mt-6 flex flex-col sm:flex-row sm:justify-end sm:space-x-3 space-y-3 sm:space-y-0">
                <button
                onClick={() => {
                    setShowTerms(false);
                    setPendingGoogleAuth(false); // reset flag
                }}
                className="w-full sm:w-auto px-4 py-2 text-gray-700 bg-gray-200 rounded-full hover:bg-gray-300 transition"
                >
                Close
                </button>

                <button
                    onClick={() => {
                        setShowTerms(false);
                        setAgreed(true);
                        if (pendingGoogleAuth) {
                        handleGoogleAuth(); // ✅ Trigger Google popup after agreeing
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
