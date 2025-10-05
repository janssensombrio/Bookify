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

export const Signup = () => {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  
  const usersCollectionRef = collection(database, "users");

  const navigate = useNavigate();

  // Sign up with email and password
  const handleSignup = async () => {
    if (password !== confirmPassword) {
      alert("Passwords do not match!");
      return;
    }

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // Set display name
      await updateProfile(user, {
        displayName: `${firstName} ${lastName}`,
      });

      // Send verification email
      await sendEmailVerification(user);
      alert("Verification email sent! Please check your inbox.");

      // Add user data to Firestore
      await addDoc(usersCollectionRef, {
        firstName,
        lastName,
        email: user.email,
        type: "guest",
        userId: user.uid,
        verified: false,
      });

      // Wait until the user verifies their email
      const checkVerification = setInterval(async () => {
        await user.reload(); // Refresh user data
        if (user.emailVerified) {
          clearInterval(checkVerification);

          // Update Firestore 'verified' field
          const q = query(usersCollectionRef, where("userId", "==", user.uid));
          const snapshot = await getDocs(q);
          if (!snapshot.empty) {
            const userDocId = snapshot.docs[0].id;
            await updateDoc(doc(database, "users", userDocId), {
              verified: true,
            });
          }

          alert("Email verified! Redirecting...");
          navigate("/home");
        }
      }, 3000);
    } catch (err) {
      console.error("Signup error:", err.message);
      alert(err.message === 'Firebase: Error (auth/email-already-in-use).' ? 'Google account already exist!' : err.message);
    }
  };

  // Sign up with Google (already verified by Google)
  const handleGoogleSignup = async () => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    const user = result.user;

    // Split displayName into first and last name
    const nameParts = user.displayName ? user.displayName.split(" ") : ["", ""];
        const firstName = nameParts[0];
        const lastName = nameParts.slice(1).join(" "); // handle middle names

        await addDoc(usersCollectionRef, {
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


  return (
    <div className="signup-page-wrapper">
      <h1>Create an Account</h1>

      <div className="signup-form">
        <input
          placeholder="First Name..."
          type="text"
          onChange={(e) => setFirstName(e.target.value)}
        />
        <input
          placeholder="Last Name..."
          type="text"
          onChange={(e) => setLastName(e.target.value)}
        />
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
        <input
          placeholder="Confirm Password..."
          type="password"
          onChange={(e) => setConfirmPassword(e.target.value)}
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
