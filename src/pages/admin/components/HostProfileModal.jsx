import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X, Briefcase, GraduationCap, MapPin, User, Star, Home, Calendar, Shield } from "lucide-react";
import { database } from "../../../config/firebase";
import { collection, query, where, getDocs, doc, getDoc } from "firebase/firestore";

export default function HostProfileModal({ open, onClose, hostId, hostData }) {
  const [loading, setLoading] = useState(true);
  const [hostDetails, setHostDetails] = useState(null);
  const [stats, setStats] = useState({
    listings: 0,
    averageRating: 0,
    reviews: 0,
    startedHosting: null,
  });

  useEffect(() => {
    if (!open || !hostId) return;

    let cancelled = false;

    const toJsDate = (ts) => (typeof ts?.toDate === "function" ? ts.toDate() : ts ? new Date(ts) : null);
    const calcAge = (birth) => {
      const d = toJsDate(birth);
      if (!d || isNaN(d.getTime())) return null;
      const now = new Date();
      let a = now.getFullYear() - d.getFullYear();
      const m = now.getMonth() - d.getMonth();
      if (m < 0 || (m === 0 && now.getDate() < d.getDate())) a--;
      return a;
    };
    const toArray = (v) =>
      Array.isArray(v) ? v : typeof v === "string" ? v.split(",").map((s) => s.trim()).filter(Boolean) : [];

    const fetchHostDetails = async () => {
      setLoading(true);
      try {
        // First, get the host document by ID
        const hostRef = doc(database, "hosts", hostId);
        const hostSnap = await getDoc(hostRef);
        let hostDoc = hostSnap.exists() ? { id: hostSnap.id, ...hostSnap.data() } : null;

        // Get hostUid - could be uid field or the document ID itself
        const hostUid = hostDoc?.uid || hostId;

        // If host not found by ID, try to find by uid in hosts collection
        if (!hostDoc) {
          const hostsQuery = query(collection(database, "hosts"), where("uid", "==", hostId));
          const hostsSnap = await getDocs(hostsQuery);
          if (!hostsSnap.empty) {
            hostDoc = { id: hostsSnap.docs[0].id, ...hostsSnap.docs[0].data() };
          }
        }

        // Fallback to users collection if still not found
        if (!hostDoc) {
          const usersQuery = query(collection(database, "users"), where("uid", "==", hostUid));
          const usersSnap = await getDocs(usersQuery);
          if (!usersSnap.empty) {
            hostDoc = { id: usersSnap.docs[0].id, ...usersSnap.docs[0].data() };
          }
        }

        if (!hostDoc || cancelled) {
          if (!cancelled) {
            setHostDetails(null);
            setLoading(false);
          }
          return;
        }

        // Normalize host data
        const first = hostDoc.firstName || hostDoc.givenName || hostDoc.first_name || "";
        const last = hostDoc.lastName || hostDoc.familyName || hostDoc.last_name || "";
        const displayName = hostDoc.displayName || hostDoc.name || [first, last].filter(Boolean).join(" ") || "Unknown Host";
        const photoURL = hostDoc.photoURL || hostDoc.photoUrl || hostDoc.avatarURL || hostDoc.photo || hostDoc.avatar || hostDoc.profileImageUrl || null;
        
        // Calculate age if birthdate is provided
        const age = hostDoc.age || (hostDoc.birthdate ? calcAge(hostDoc.birthdate) : null);
        
        // Normalize languages
        const languages = toArray(hostDoc.languages);

        const normalizedHost = {
          ...hostDoc,
          displayName,
          photoURL,
          age,
          languages,
          firstName: first,
          lastName: last,
        };

        // Fetch listings by multiple fields (like HomeDetailsPage does)
        const q1 = query(collection(database, "listings"), where("hostId", "==", hostUid));
        const q2 = query(collection(database, "listings"), where("uid", "==", hostUid));
        const q3 = query(collection(database, "listings"), where("ownerId", "==", hostUid));
        const q4 = query(collection(database, "listings"), where("hostUid", "==", hostUid));

        const [s1, s2, s3, s4] = await Promise.all([
          getDocs(q1).catch(() => ({ docs: [] })),
          getDocs(q2).catch(() => ({ docs: [] })),
          getDocs(q3).catch(() => ({ docs: [] })),
          getDocs(q4).catch(() => ({ docs: [] })),
        ]);

        // Use Map to deduplicate listings
        const listingsMap = new Map();
        for (const s of [s1, s2, s3, s4]) {
          s.docs.forEach((d) => listingsMap.set(d.id, { id: d.id, ...d.data() }));
        }
        const allListings = Array.from(listingsMap.values());
        const listingsCount = allListings.length;

        // Aggregate reviews from subcollections (like HomeDetailsPage does)
        let totalReviews = 0;
        let sumRatings = 0;
        let earliest = null;

        await Promise.all(
          allListings.map(async (l) => {
            const created = toJsDate(l.createdAt) || toJsDate(l.updatedAt);
            if (created && (!earliest || created < earliest)) earliest = created;

            let count = Number(l?.reviewCount) || 0;
            let avg = Number(l?.rating) || 0;

            // Try to get reviews from subcollection
            try {
              const reviewsSub = collection(database, "listings", l.id, "reviews");
              const reviewsSnap = await getDocs(reviewsSub);
              let c = 0;
              let s = 0;
              reviewsSnap.forEach((rd) => {
                const r = rd.data();
                const v = Number(r?.rating) || 0;
                if (v > 0) {
                  c += 1;
                  s += v;
                }
              });
              if (c > 0) {
                count = c;
                avg = s / c;
              }
            } catch {
              // If rules block reviews subcollection, use listing.rating/reviewCount
            }

            if (count > 0 && avg > 0) {
              totalReviews += count;
              sumRatings += avg * count;
            }
          })
        );

        const avgRating = totalReviews > 0 ? (sumRatings / totalReviews).toFixed(2) : "0.00";
        const startedYear = earliest?.getFullYear?.() || (toJsDate(normalizedHost.createdAt)?.getFullYear?.() || null);

        const verified = !!(
          normalizedHost.isVerified ||
          normalizedHost.verified ||
          normalizedHost.verifiedHost ||
          (normalizedHost.verificationStatus || "").toString().toLowerCase() === "verified"
        );

        if (!cancelled) {
          setHostDetails({ ...normalizedHost, isVerified: verified });
          setStats({
            listings: listingsCount,
            averageRating: avgRating,
            reviews: totalReviews,
            startedHosting: startedYear ? new Date(startedYear, 0, 1) : normalizedHost.createdAt,
          });
        }
      } catch (error) {
        console.error("Error fetching host details:", error);
        if (!cancelled) {
          setHostDetails(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchHostDetails();
    return () => { cancelled = true; };
  }, [open, hostId]);

  if (!open) return null;

  const formatDate = (ts) => {
    if (!ts) return "—";
    try {
      const d = ts?.toDate ? ts.toDate() : new Date(ts);
      return isNaN(d.getTime()) ? "—" : d.getFullYear().toString();
    } catch {
      return "—";
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div
        className="relative z-[201] w-full max-w-6xl max-h-[90vh] overflow-y-auto bg-white rounded-3xl shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 w-10 h-10 rounded-full bg-white border border-gray-200 shadow-md hover:bg-gray-50 flex items-center justify-center transition"
          aria-label="Close"
        >
          <X className="w-5 h-5 text-gray-700" />
        </button>

        {loading ? (
          <div className="p-12 text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p className="mt-4 text-gray-600">Loading host profile...</p>
          </div>
        ) : !hostDetails ? (
          <div className="p-12 text-center">
            <p className="text-gray-600">Host not found</p>
          </div>
        ) : (
          <div className="p-6 sm:p-8 space-y-6">
            {/* Top Section - Profile Info, About/Languages, Verified Status */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Profile Information Card */}
              <div className="bg-white rounded-3xl border border-white/40 backdrop-blur-sm shadow-lg p-6">
                <div className="flex flex-col items-center text-center">
                  {/* Profile Picture */}
                  <div className="w-24 h-24 rounded-full overflow-hidden bg-gray-100 mb-4">
                    {hostDetails.photoURL ? (
                      <img
                        src={hostDetails.photoURL}
                        alt={hostDetails.displayName || hostDetails.name || "Host"}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-blue-200 to-indigo-300 flex items-center justify-center text-3xl font-bold text-white">
                        {(hostDetails.displayName || hostDetails.name || "H")[0].toUpperCase()}
                      </div>
                    )}
                  </div>

                  {/* Name and Email */}
                  <h2 className="text-xl font-bold text-gray-900 mb-1">
                    {hostDetails.displayName || hostDetails.name || "Unknown Host"}
                  </h2>
                  <p className="text-sm text-gray-600 mb-6">
                    {hostDetails.email || "—"}
                  </p>

                  {/* Details */}
                  <div className="w-full space-y-3 text-left">
                    {hostDetails.work && (
                      <div className="flex items-center gap-3 text-sm">
                        <Briefcase className="w-4 h-4 text-gray-500 flex-shrink-0" />
                        <span className="text-gray-700">{hostDetails.work}</span>
                      </div>
                    )}
                    {hostDetails.collegeHighSchoolGraduateName && (
                      <div className="flex items-center gap-3 text-sm">
                        <GraduationCap className="w-4 h-4 text-gray-500 flex-shrink-0" />
                        <span className="text-gray-700">{hostDetails.collegeHighSchoolGraduateName}</span>
                      </div>
                    )}
                    {hostDetails.address && (
                      <div className="flex items-center gap-3 text-sm">
                        <MapPin className="w-4 h-4 text-gray-500 flex-shrink-0" />
                        <span className="text-gray-700">{hostDetails.address}</span>
                      </div>
                    )}
                    {hostDetails.age && (
                      <div className="flex items-center gap-3 text-sm">
                        <User className="w-4 h-4 text-gray-500 flex-shrink-0" />
                        <span className="text-gray-700">{hostDetails.age}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* About and Languages Card */}
              <div className="bg-white rounded-3xl border border-white/40 backdrop-blur-sm shadow-lg p-6 space-y-6">
                {/* About Section */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <User className="w-5 h-5 text-gray-600" />
                    <h3 className="text-lg font-semibold text-gray-900">About</h3>
                  </div>
                  <p className="text-sm text-gray-700 leading-relaxed">
                    {hostDetails.about || "No about information available."}
                  </p>
                </div>

                {/* Languages Section */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-lg font-semibold">A</span>
                    <h3 className="text-lg font-semibold text-gray-900">Languages</h3>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {hostDetails.languages && hostDetails.languages.length > 0 ? (
                      hostDetails.languages.map((lang, idx) => (
                        <span
                          key={idx}
                          className="px-3 py-1.5 rounded-full bg-blue-50 text-blue-700 text-sm font-medium border border-blue-200"
                        >
                          {lang}
                        </span>
                      ))
                    ) : (
                      <span className="text-sm text-gray-500">No languages specified</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Verified Host Card */}
              <div className="bg-emerald-50 rounded-3xl border-2 border-emerald-200 backdrop-blur-sm shadow-lg p-6 flex flex-col items-center justify-center text-center">
                <div className="relative w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center mb-4">
                  <Shield className="w-10 h-10 text-emerald-600" />
                  {hostDetails.isVerified && (
                    <div className="absolute w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center -bottom-1 -right-1 border-2 border-white">
                      <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  )}
                </div>
                <h3 className="text-lg font-semibold text-emerald-700 mb-2">
                  {hostDetails.isVerified ? "Verified Host" : "Unverified Host"}
                </h3>
                <p className="text-sm text-gray-600">
                  {hostDetails.isVerified
                    ? "Host's identity and details are verified."
                    : "Host verification pending."}
                </p>
              </div>
            </div>

            {/* Bottom Section - Statistics */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Listings */}
              <div className="bg-white rounded-3xl border border-white/40 backdrop-blur-sm shadow-lg p-5">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
                    <Home className="w-4 h-4 text-blue-600" />
                  </div>
                  <span className="text-sm font-semibold text-gray-700">Listings</span>
                </div>
                <p className="text-3xl font-bold text-gray-900">{stats.listings}</p>
              </div>

              {/* Average Rating */}
              <div className="bg-white rounded-3xl border border-white/40 backdrop-blur-sm shadow-lg p-5">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-lg bg-orange-100 flex items-center justify-center">
                    <Star className="w-4 h-4 text-orange-600" />
                  </div>
                  <span className="text-sm font-semibold text-gray-700">Average Rating</span>
                </div>
                <p className="text-3xl font-bold text-gray-900">{stats.averageRating}</p>
              </div>

              {/* Reviews */}
              <div className="bg-white rounded-3xl border border-white/40 backdrop-blur-sm shadow-lg p-5">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center">
                    <Star className="w-4 h-4 text-purple-600" />
                  </div>
                  <span className="text-sm font-semibold text-gray-700">Reviews</span>
                </div>
                <p className="text-3xl font-bold text-gray-900">{stats.reviews}</p>
              </div>

              {/* Started Hosting */}
              <div className="bg-white rounded-3xl border border-white/40 backdrop-blur-sm shadow-lg p-5">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center">
                    <Calendar className="w-4 h-4 text-emerald-600" />
                  </div>
                  <span className="text-sm font-semibold text-gray-700">Started Hosting</span>
                </div>
                <p className="text-3xl font-bold text-gray-900">{formatDate(stats.startedHosting)}</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}

