import { useState } from "react";
import { auth, database, googleProvider } from "../../config/firebase";
import {
  createUserWithEmailAndPassword,
  signInWithPopup,
  sendEmailVerification,
  updateProfile,
} from "firebase/auth";
import { collection, addDoc, query, where, getDocs, updateDoc, doc } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import BookifyIcon from "../../media/favorite.png";
import FormBg from "../../media/beach.mp4";


export const Signup = () => {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const usersCollectionRef = collection(database, "users");
  const navigate = useNavigate();

  const handleSignup = async () => {
    if (password !== confirmPassword) {
      alert("Passwords do not match!");
      return;
    }

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      await updateProfile(user, { displayName: `${firstName} ${lastName}` });
      await sendEmailVerification(user);
      alert("Verification email sent! Please check your inbox.");

      await addDoc(usersCollectionRef, {
        uid: user.id,
        firstName,
        lastName,
        email: user.email,
        type: "guest",
        userId: user.uid,
        verified: false,
      });

      const checkVerification = setInterval(async () => {
        await user.reload();
        if (user.emailVerified) {
          clearInterval(checkVerification);

          const q = query(usersCollectionRef, where("userId", "==", user.uid));
          const snapshot = await getDocs(q);
          if (!snapshot.empty) {
            const userDocId = snapshot.docs[0].id;
            await updateDoc(doc(database, "users", userDocId), { verified: true });
          }

          alert("Email verified! Redirecting...");
          navigate("/home");
        }
      }, 3000);
    } catch (err) {
      console.error("Signup error:", err.message);
      alert(
        err.message === "Firebase: Error (auth/email-already-in-use)."
          ? "Google account already exists!"
          : err.message
      );
    }
  };

  const handleGoogleSignup = async () => {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;

      const nameParts = user.displayName ? user.displayName.split(" ") : ["", ""];
      const firstName = nameParts[0];
      const lastName = nameParts.slice(1).join(" ");

      await addDoc(usersCollectionRef, {
        uid: user.uid,
        email: user.email,
        firstName,
        lastName,
        type: "guest",
        userId: user.uid,
        verified: true,
      });

      navigate("/home");
    } catch (err) {
      console.error("Google signup error:", err.message);
      alert(err.message);
    }
  };

  // ---- small inline icons ----
  const StarLogo = () => (
    <BookifyIcon />
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
        src={FormBg}
        autoPlay
        muted
        loop
        playsInline
      />
      <div className="absolute inset-0 bg-black/50 backdrop-blur-[3px]" />

      {/* Foreground Card */}
      <div className="relative w-full max-w-6xl grid grid-cols-1 md:grid-cols-2 rounded-[28px] overflow-hidden shadow-2xl bg-white/90 backdrop-blur-sm">
        {/* LEFT (Form) */}
        <div className="bg-white/90 px-6 sm:px-10 lg:px-14 py-8 sm:py-10 lg:py-12 flex flex-col">
          {/* Logo */}
          <div className="flex items-center space-x-3 mb-6">
            
            <span className="text-lg font-semibold text-gray-800">Bookify</span>
          </div>

          {/* Headline */}
          <div className="mb-6">
            <h2 className="text-2xl font-semibold text-gray-800">Create Your Account</h2>
            <p className="text-gray-500 text-sm">Join us and explore the world of Bookify</p>
          </div>

          {/* Segmented buttons */}
          <div className="w-full max-w-xs mb-6">
            <div className="flex items-center bg-gray-100 rounded-full p-1">
              <button
                type="button"
                onClick={() => navigate("/login")}
                className="flex-1 py-2 text-sm font-medium rounded-full text-gray-500 hover:text-gray-700"
              >
                Sign In
              </button>
              <button
                type="button"
                className="flex-1 py-2 text-sm font-medium rounded-full bg-blue-600 text-white shadow"
              >
                Sign Up
              </button>
            </div>
          </div>

          {/* Input Fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
            <input
              type="text"
              placeholder="First Name"
              className="w-full px-4 py-3 rounded-full border border-gray-300 text-[15px] placeholder-gray-400 focus:ring-2 focus:ring-blue-400 focus:outline-none"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
            />
            <input
              type="text"
              placeholder="Last Name"
              className="w-full px-4 py-3 rounded-full border border-gray-300 text-[15px] placeholder-gray-400 focus:ring-2 focus:ring-blue-400 focus:outline-none"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
            />
          </div>

          <input
            type="email"
            placeholder="Email"
            className="w-full px-4 py-3 mb-3 rounded-full border border-gray-300 text-[15px] placeholder-gray-400 focus:ring-2 focus:ring-blue-400 focus:outline-none"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <input
            type="password"
            placeholder="Password"
            className="w-full px-4 py-3 mb-3 rounded-full border border-gray-300 text-[15px] placeholder-gray-400 focus:ring-2 focus:ring-blue-400 focus:outline-none"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <input
            type="password"
            placeholder="Confirm Password"
            className="w-full px-4 py-3 mb-6 rounded-full border border-gray-300 text-[15px] placeholder-gray-400 focus:ring-2 focus:ring-blue-400 focus:outline-none"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />

          {/* Sign Up Button */}
          <button
            onClick={handleSignup}
            className="w-full py-3 rounded-full bg-blue-600 text-white font-semibold hover:bg-blue-700 transition"
          >
            Sign Up
          </button>

          {/* Divider */}
          <div className="flex items-center my-6">
            <div className="flex-grow border-t border-gray-200"></div>
            <span className="mx-3 text-gray-400 text-xs">OR</span>
            <div className="flex-grow border-t border-gray-200"></div>
          </div>

          {/* Google Sign Up */}
          <button
            onClick={handleGoogleSignup}
            className="w-full py-3 rounded-full border border-gray-300 text-gray-700 bg-white hover:bg-gray-50 font-medium flex items-center justify-center space-x-2"
          >
            <GoogleG />
            <span>Sign Up with Google</span>
          </button>

          {/* Already have account */}
          <p className="text-center text-gray-600 text-sm mt-6">
            Already have an account?{" "}
            <button
              onClick={() => navigate("/login")}
              className="text-blue-600 font-semibold hover:underline"
            >
              Log In
            </button>
          </p>
        </div>

        {/* RIGHT (Video Panel) */}
        <div className="relative hidden md:block">
          <video
            className="absolute inset-0 w-full h-full object-cover"
            src={FormBg}
            autoPlay
            muted
            loop
            playsInline
          />
          <div className="absolute inset-0" />
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