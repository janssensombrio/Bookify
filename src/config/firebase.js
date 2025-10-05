// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyDCs2jVIn2hITvxm6hZ1FDswxG5ylf-zUs",
  authDomain: "it305-a1a77.firebaseapp.com",
  projectId: "it305-a1a77",
  storageBucket: "it305-a1a77.firebasestorage.app",
  messagingSenderId: "212708584965",
  appId: "1:212708584965:web:af324c5cbc462f2d89366c",
  measurementId: "G-RLJ6LCX6FJ"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider =  new GoogleAuthProvider();

export const database = getFirestore(app);