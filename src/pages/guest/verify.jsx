// src/pages/verify.jsx
import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  doc,
  getDoc,
  collection,
  query,
  where,
  getDocs,
  limit,
  writeBatch,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { database } from "../../config/firebase";

const toMillis = (v) => {
  if (!v) return 0;
  if (typeof v === "number") return v;
  if (v.toDate) {
    const d = v.toDate();
    return d?.getTime?.() ?? 0;
  }
  const d = new Date(v);
  return d?.getTime?.() ?? 0;
};

export const VerifyPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState("loading"); // loading | success | already | expired | invalid | no_user | error

  useEffect(() => {
    const run = async () => {
      const tokenParam = searchParams.get("token");
      if (!tokenParam) {
        setStatus("invalid");
        return;
      }

      try {
        // --- 1) Try by doc ID (new scheme) ---
        let tokenRef = doc(database, "email_verifications", tokenParam);
        let tokenSnap = await getDoc(tokenRef);

        // --- 2) Legacy fallback: query by 'token' field (old addDoc scheme) ---
        if (!tokenSnap.exists()) {
          const qLegacy = query(
            collection(database, "email_verifications"),
            where("token", "==", tokenParam),
            limit(1)
          );
          const legacySnap = await getDocs(qLegacy);

          if (legacySnap.empty) {
            setStatus("invalid");
            return;
          }

          const legacyDoc = legacySnap.docs[0];
          const legacyData = legacyDoc.data();

          // Optional migrate-on-read: copy legacy -> {tokenParam} id, delete old
          try {
            await setDoc(doc(database, "email_verifications", tokenParam), legacyData);
            const batchMigrate = writeBatch(database);
            batchMigrate.delete(legacyDoc.ref);
            await batchMigrate.commit();

            tokenRef = doc(database, "email_verifications", tokenParam);
            tokenSnap = await getDoc(tokenRef);
          } catch {
            // If migration fails, just use the legacy ref as-is
            tokenRef = legacyDoc.ref;
            tokenSnap = legacyDoc;
          }
        }

        const tData = tokenSnap.data();

        // --- 3) Checks ---
        if (tData.consumed) {
          setStatus("already");
          return;
        }
        const expMs = toMillis(tData.expiresAt);
        if (expMs && Date.now() > expMs) {
          setStatus("expired");
          return;
        }

        // --- 4) Target user (doc id must be the UID) ---
        const uRef = doc(database, "users", tData.uid);
        const uSnap = await getDoc(uRef);
        if (!uSnap.exists()) {
          setStatus("no_user");
          return;
        }

        // --- 5) Atomic update: verify user + consume token ---
        // NOTE: pass _verifyToken = tokenRef.id so rules can validate against the actual token doc id.
        const batch = writeBatch(database);
        batch.update(uRef, {
          verified: true,
          verifiedAt: serverTimestamp(),
          _verifyToken: tokenRef.id,
        });
        batch.update(tokenRef, {
          consumed: true,
          consumedAt: serverTimestamp(),
        });
        await batch.commit();

        setStatus("success");
        setTimeout(() => navigate("/"), 2000);
      } catch (err) {
        console.error("Verify error:", err);
        setStatus("error");
      }
    };

    run();
  }, [searchParams, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
      {status === "loading"  && <p>Verifying your email…</p>}
      {status === "success"  && <p className="text-green-600 font-semibold">✅ Email verified! Redirecting…</p>}
      {status === "already"  && <p className="text-yellow-600 font-semibold">ℹ️ Link already used.</p>}
      {status === "expired"  && <p className="text-red-600 font-semibold">❌ Link expired. Please request a new one.</p>}
      {status === "invalid"  && <p className="text-red-600 font-semibold">❌ Invalid link.</p>}
      {status === "no_user"  && <p className="text-red-600 font-semibold">❌ User record not found.</p>}
      {status === "error"    && <p className="text-red-600 font-semibold">❌ Verification failed. Please try again.</p>}
    </div>
  );
};
