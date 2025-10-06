import { useState } from "react";
import { auth, database, googleProvider } from "../../config/firebase";
import { signInWithEmailAndPassword, signInWithPopup } from "firebase/auth";
import { collection, addDoc, getDocs, query, where } from "firebase/firestore";
import { useNavigate } from "react-router-dom";

export const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const usersCollectionRef = collection(database, "users");
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

  // Function to ensure user exists in Firestore
  const ensureUserInFirestore = async (user) => {
    const q = query(usersCollectionRef, where("uid", "==", user.uid));
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      // Split displayName into first and last name
      const nameParts = user.displayName ? user.displayName.split(" ") : ["", ""];
      const firstName = nameParts[0];
      const lastName = nameParts.slice(1).join(" "); // handle middle names

      await addDoc(usersCollectionRef, {
        email: user.email,
        firstName,
        lastName,
        type: "guest",
        uid: user.uid,       // matches the rule
        verified: user.emailVerified || false, // mark Google users as verified if email verified
      });

      console.log("User added to Firestore:", user.email);
    }
  };


  return (
    <div className="login-page-wrapper">
      <h1>Bookify</h1>

      <div className="login-form">
        <input
          placeholder="Email..."
          type="email"
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          placeholder="Password..."
          type="password"
          onChange={(e) => setPassword(e.target.value)}
        />

        <button onClick={handleLogin}>Login</button>
        <button onClick={handleGoogleLogin}>Login with Google</button>

        <p>
          Don’t have an account?{" "}
          <span
            onClick={() => navigate("/signup")}
            style={{ color: "blue", cursor: "pointer" }}
          >
            Sign Up
          </span>
        </p>
      </div>
    </div>
  );
};
