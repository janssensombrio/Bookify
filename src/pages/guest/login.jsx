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

      // Check if user exists in Firestore
      const q = query(usersCollectionRef, where("userId", "==", user.uid));
      const snapshot = await getDocs(q);

      // Add to Firestore if not yet there
      if (snapshot.empty) {
        await addDoc(usersCollectionRef, {
          email: user.email,
          userId: user.uid,
          type: "guest",
        });
        console.log("User added to Firestore:", user.email);
      }

      console.log("Logged in:", user.email);
      navigate("/home");
    } catch (err) {
      console.error("Login error:", err.message);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;

      // Check Firestore for Google user
      const q = query(usersCollectionRef, where("userId", "==", user.uid));
      const snapshot = await getDocs(q);

      if (snapshot.empty) {
        await addDoc(usersCollectionRef, {
          email: user.email,
          userId: user.uid,
          type: "guest",
        });
        console.log("Google user added to Firestore:", user.email);
      }

      console.log("Google login success:", user.email);
      navigate("/home");
    } catch (err) {
      console.error("Google login error:", err.message);
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
