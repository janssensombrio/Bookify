import { useState } from 'react';
import { auth, googleProvider } from './firebase';
import { createUserWithEmailAndPassword,
         signInWithPopup,
         signOut } from 'firebase/auth';

export const Auth = () => {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");

    console.log(auth?.currentUser?.email);

    const login = async () => {
        try {
            await createUserWithEmailAndPassword(auth, email, password);
        }
        catch(err) {
            console.error(err);
        }
    };

    const loginWithGoogle = async () => {
        try {
            await signInWithPopup(auth, googleProvider);
            console.log("User:", auth.currentUser);
        }
        catch(err) {
            console.error("Google login error:", err.code, err.message);
        }
    };

    const logout = async () => {
        try {
            await signOut(auth);
        }
        catch(err) {
            console.error(err);
        }
    };

    return (
        <div>
            <input
            placeholder="Email..."
            onChange={(e) => setEmail(e.target.value)}
            />
            <input
            placeholder="Password..."
            type="password"
            onChange={(e) => setPassword(e.target.value)}
            />

            <button onClick={login}>Login</button>
            <button onClick={loginWithGoogle}>Login with Google</button>
            <button onClick={logout}>Logout</button>
        </div>
    );
};
