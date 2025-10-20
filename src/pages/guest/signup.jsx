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
import { Container, Box, TextField, Button, Typography, Divider } from "@mui/material";

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
        firstName,
        lastName,
        email: user.email,
        type: "guest",
        userId: user.uid,
        verified: false,
      });

      // Check verification periodically
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
    <Container maxWidth="xs">
      <Box
        display="flex"
        flexDirection="column"
        alignItems="center"
        justifyContent="center"
        minHeight="100vh"
        gap={2}
      >
        <Typography variant="h4" fontWeight="bold">
          Create an Account
        </Typography>

        <TextField
          fullWidth
          label="First Name"
          variant="outlined"
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
        />
        <TextField
          fullWidth
          label="Last Name"
          variant="outlined"
          value={lastName}
          onChange={(e) => setLastName(e.target.value)}
        />
        <TextField
          fullWidth
          label="Email"
          type="email"
          variant="outlined"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <TextField
          fullWidth
          label="Password"
          type="password"
          variant="outlined"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <TextField
          fullWidth
          label="Confirm Password"
          type="password"
          variant="outlined"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
        />

        <Button fullWidth variant="contained" color="primary" onClick={handleSignup}>
          Sign Up
        </Button>

        <Divider sx={{ width: "100%", my: 1 }}>OR</Divider>

        <Button fullWidth variant="outlined" color="secondary" onClick={handleGoogleSignup}>
          Sign Up with Google
        </Button>

        <Typography variant="body2">
          Already have an account?{" "}
          <span
            onClick={() => navigate("/login")}
            style={{ color: "#1976d2", cursor: "pointer" }}
          >
            Log In
          </span>
        </Typography>
      </Box>
    </Container>
  );
};