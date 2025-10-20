import { useState } from "react";
import { auth, database, googleProvider } from "../../config/firebase";
import { signInWithEmailAndPassword, signInWithPopup } from "firebase/auth";
import { collection, addDoc, getDocs, query, where } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import {
  Container,
  Box,
  TextField,
  Button,
  Typography,
  Divider
} from "@mui/material";

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

  const ensureUserInFirestore = async (user) => {
    const q = query(usersCollectionRef, where("uid", "==", user.uid));
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      const nameParts = user.displayName ? user.displayName.split(" ") : ["", ""];
      const firstName = nameParts[0];
      const lastName = nameParts.slice(1).join(" ");

      await addDoc(usersCollectionRef, {
        email: user.email,
        firstName,
        lastName,
        type: "guest",
        uid: user.uid,
        verified: user.emailVerified || false,
      });

      console.log("User added to Firestore:", user.email);
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
        <Typography variant="h4" fontWeight="bold">Bookify</Typography>

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

        <Button
          fullWidth
          variant="contained"
          color="primary"
          onClick={handleLogin}
        >
          Login
        </Button>

        <Divider sx={{ width: "100%", my: 1 }}>OR</Divider>

        <Button
          fullWidth
          variant="outlined"
          color="secondary"
          onClick={handleGoogleLogin}
        >
          Login with Google
        </Button>

        <Typography variant="body2">
          Don’t have an account?{" "}
          <span
            onClick={() => navigate("/signup")}
            style={{ color: "#1976d2", cursor: "pointer" }}
          >
            Sign Up
          </span>
        </Typography>
      </Box>
    </Container>
  );
};