import { useState } from "react";
import { auth, database, googleProvider } from "../../config/firebase";
import {
  createUserWithEmailAndPassword,
  signInWithPopup,
} from "firebase/auth";
import { collection, addDoc } from "firebase/firestore";
import { useNavigate } from "react-router-dom";

export const Signup = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const usersCollectionRef = collection(database, "users");
  const navigate = useNavigate();

  // Sign up with email and password
  const handleSignup = async () => {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      await addDoc(usersCollectionRef, {
        email: user.email,
        type: "guest",
        userId: user.uid,
      });

      console.log("Account created:", user.email);
      navigate("/home");
    } catch (err) {
      console.error("Signup error:", err.message);
    }
  };

  // Sign up with Google
  const handleGoogleSignup = async () => {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;

      await addDoc(usersCollectionRef, {
        email: user.email,
        type: "guest",
        userId: user.uid,
      });

      console.log("Google signup success:", user.email);
      navigate("/home");
    } catch (err) {
      console.error("Google signup error:", err.message);
    }
  };

  return (
    <div className="signup-page-wrapper">
      <h1>Create an Account</h1>

      <div className="signup-form">
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

        <button onClick={handleSignup}>Sign Up</button>
        <button onClick={handleGoogleSignup}>Sign Up with Google</button>

        <p>
          Already have an account?{" "}
          <span
            onClick={() => navigate("/login")}
            style={{ color: "blue", cursor: "pointer" }}
          >
            Log In
          </span>
        </p>
      </div>
    </div>
  );
};
