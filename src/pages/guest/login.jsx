import { useState } from "react";
import { auth, database, googleProvider } from "../../config/firebase";
import { signInWithEmailAndPassword, signInWithPopup } from "firebase/auth";
import { collection, addDoc, getDocs, query, where } from "firebase/firestore";
import { useNavigate } from "react-router-dom";

export const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const usersCollectionRef = collection(database, "users");
  const [showPassword, setShowPassword] = useState(false);

  const navigate = useNavigate();

  const handleLogin = async () => {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      if (!user.emailVerified) {
        alert("Please verify your email before logging in!");
        await auth.signOut();
        return;
      }

      await ensureUserInFirestore(user);
      alert(`Welcome Back ${user.displayName || user.email.split("@")[0]}!`);
      navigate("/home");
    } catch (err) {
      console.error("Login error:", err.message);
      alert(err.message);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;

      await ensureUserInFirestore(user);
      alert(`Welcome Back ${user.displayName || user.email.split("@")[0]}!`);
      navigate("/home");
    } catch (err) {
      console.error("Google login error:", err.message);
      alert(err.message);
    }
  };

  const ensureUserInFirestore = async (user) => {
    const q = query(usersCollectionRef, where("uid", "==", user.uid));
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      const nameParts = user.displayName ? user.displayName.split(" ") : ["", ""];
      const firstName = nameParts[0];
      const lastName = nameParts.slice(1).join(" ");

      await addDoc(usersCollectionRef, {
        uid: user.uid,
        email: user.email,
        firstName,
        lastName,
        type: "guest",
        verified: user.emailVerified || false,
      });
    }
  };

  const StarLogo = () => (
    <div className="inline-flex items-center justify-center w-9 h-9 rounded-md bg-gray-900">
      <svg viewBox="0 0 24 24" className="w-5 h-5 text-white" fill="currentColor">
        <path d="m12 17.27 5.18 3.11-1.64-5.88L20.9 10l-6.1-.26L12 4 9.2 9.74 3.1 10l5.36 4.5L6.82 20.4 12 17.27z" />
      </svg>
    </div>
  );

  const MailIcon = () => (
    <svg className="w-5 h-5 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 7.5 12 13l9-5.5M4.5 6h15A1.5 1.5 0 0 1 21 7.5v9A1.5 1.5 0 0 1 19.5 18h-15A1.5 1.5 0 0 1 3 16.5v-9A1.5 1.5 0 0 1 4.5 6z"/>
    </svg>
  );

  const EyeIcon = () => (
    <svg className="w-5 h-5 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path strokeLinecap="round" strokeLinejoin="round" d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );

  const AppleIcon = () => (
    <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor">
      <path d="M16.365 12.87c.012 2.585 2.27 3.441 2.284 3.448-.019.059-.357 1.225-1.179 2.426-.711 1.06-1.453 2.12-2.62 2.138-1.148.02-1.52-.69-2.839-.69-1.32 0-1.744.667-2.843.71-1.144.043-2.017-1.146-2.735-2.202-1.49-2.174-2.627-6.145-1.095-8.83.756-1.316 2.108-2.154 3.58-2.176 1.12-.021 2.178.75 2.84.75.662 0 1.96-.928 3.307-.79.563.023 2.149.227 3.162 1.707-.082.051-1.889 1.103-1.862 3.209zM13.9 4.46c.58-.704.98-1.69.872-2.67-.842.034-1.86.56-2.46 1.263-.54.625-.998 1.622-.873 2.58.924.072 1.88-.47 2.46-1.173z"/>
    </svg>
  );

  const GoogleG = () => (
    <svg className="w-5 h-5" viewBox="0 0 48 48">
      <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303C33.94 31.91 29.358 35 24 35c-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.964 3.036l5.657-5.657C34.884 5.05 29.727 3 24 3 12.955 3 4 11.955 4 23s8.955 20 20 20c10.994 0 19.5-8.439 19.5-20 0-1.341-.138-2.651-.389-3.917z"/>
      <path fill="#FF3D00" d="M6.306 14.691l6.571 4.817C14.45 16.05 18.85 13 24 13c3.059 0 5.842 1.154 7.964 3.036l5.657-5.657C34.884 5.05 29.727 3 24 3 15.317 3 7.984 8.059 6.306 14.691z"/>
      <path fill="#4CAF50" d="M24 43c5.274 0 10.067-2.016 13.67-5.308l-6.3-5.315C29.337 33.273 26.826 34 24 34c-5.334 0-9.905-3.617-11.524-8.532l-6.5 5.01C8.62 37.942 15.724 43 24 43z"/>
      <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303a11.996 11.996 0 01-4.095 5.381l-.003-.003 6.3 5.315C35.066 40.985 40 36.5 40 28c0-2.667-.389-4.583-1.111-7.917z"/>
    </svg>
  );

  return (
    <div className="relative min-h-screen w-full flex items-center justify-center p-4 sm:p-6 overflow-hidden">
      {/* Background Video */}
      <video
        className="absolute inset-0 w-full h-full object-cover"
        src="https://www.pexels.com/download/video/2169879/"
        autoPlay
        muted
        loop
        playsInline
      />
      {/* Blur + Dark overlay */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-[4px]" />

      {/* Foreground content */}
      <div className="relative w-full max-w-6xl grid grid-cols-1 md:grid-cols-2 rounded-[28px] overflow-hidden shadow-2xl bg-white/90 backdrop-blur-sm">
        {/* LEFT SIDE (Form) */}
        <div className="bg-white/90 px-6 sm:px-10 lg:px-14 py-8 sm:py-10 lg:py-12 flex flex-col backdrop-blur-sm">
          <div className="flex items-center space-x-3 mb-6">
            <StarLogo />
            <span className="text-lg font-bold text-gray-800">Bookify</span>
          </div>

          <div className="mb-6">
            <h2 className="text-2xl font-semibold text-gray-800">Welcome!</h2>
            <p className="text-gray-500 text-sm">Come and book with us!</p>
          </div>

          <div className="w-full max-w-xs mb-6">
            <div className="flex items-center bg-gray-100 rounded-full p-1">
              <button className="flex-1 py-2 text-sm font-medium rounded-full bg-blue-600 text-white shadow">
                Log In
              </button>
              <button
                type="button"
                onClick={() => navigate("/signup")}
                className="flex-1 py-2 text-sm font-medium rounded-full text-gray-500 hover:text-gray-700"
              >
                Sign Up
              </button>
            </div>
          </div>

          <div className="w-full mb-4 relative">
            <input
              type="email"
              placeholder="Enter your email"
              className="w-full pl-4 pr-12 py-3 rounded-full border border-gray-300 text-[15px] placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-400"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <span className="absolute inset-y-0 right-4 flex items-center pointer-events-none">
              <MailIcon />
            </span>
          </div>

          <div className="w-full mb-3 relative">
            <input
              type={showPassword ? "text" : "password"}
              placeholder="Enter your password"
              className="w-full pl-4 pr-12 py-3 rounded-full border border-gray-300 text-[15px] placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-400"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />

            {/* Toggle visibility button */}
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              className="absolute inset-y-0 right-4 flex items-center focus:outline-none"
            >
              {showPassword ? (
                // 👁️ Eye Open (showing password)
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="w-5 h-5 text-gray-500"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.8}
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M2.458 12C3.732 7.943 7.523 5 12 5c4.477 0 8.268 2.943 9.542 7-1.274 4.057-5.065 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                  />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              ) : (
                // 🙈 Eye Off (hiding password)
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="w-5 h-5 text-gray-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.8}
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M3 3l18 18M10.477 10.477A3 3 0 0112 9c1.657 0 3 1.343 3 3 0 .513-.13.994-.36 1.414M9.88 9.88A3 3 0 0015 12m-3 7c4.477 0 8.268-2.943 9.542-7a9.973 9.973 0 00-1.689-3.044M6.18 6.18A9.974 9.974 0 002.458 12c1.274 4.057 5.065 7 9.542 7 1.8 0 3.487-.478 4.943-1.318"
                  />
                </svg>
              )}
            </button>
          </div>

          <button
            onClick={handleLogin}
            className="w-full py-3 rounded-full bg-blue-600 text-white font-semibold hover:bg-blue-700 transition"
          >
            Login
          </button>

          <div className="flex items-center my-6">
            <div className="flex-grow border-t border-gray-200"></div>
            <span className="mx-3 text-gray-400 text-xs">OR</span>
            <div className="flex-grow border-t border-gray-200"></div>
          </div>

          <button
            onClick={handleGoogleLogin}
            className="w-full py-3 rounded-full border border-gray-300 text-gray-700 bg-white hover:bg-gray-50 font-medium flex items-center justify-center space-x-2"
          >
            <GoogleG />
            <span>Log in with Google</span>
          </button>
        </div>

        {/* RIGHT SIDE (Video preview with overlay notice) */}
        <div className="relative hidden md:block backdrop-blur-sm">
          <video
            className="absolute inset-0 w-full h-full object-cover opacity-70"
            src="https://www.pexels.com/download/video/2169879/"
            autoPlay
            muted
            loop
            playsInline
          />
          <div className="absolute inset-0 backdrop-blur-[0px]" />
          <div className="absolute bottom-6 left-6 right-6">
            <div className="backdrop-blur-sm bg-white/10 border border-white/20 text-white/80 text-[10px] leading-snug rounded-xl px-4 py-2">
              <p>
                © 2025 Bookify. All rights reserved. Unauthorized use or reproduction of any content or materials
                from this site is prohibited. For more information, visit our Terms of Service and Privacy Policy.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
