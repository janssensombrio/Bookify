// Page to add availability dates to existing home listings
// Access this page at /admin/add-availability

import React, { useState, useEffect } from "react";
import { collection, query, where, getDocs, updateDoc, doc, serverTimestamp } from "firebase/firestore";
import { database } from "../../config/firebase";
import { auth } from "../../config/firebase";
import { onAuthStateChanged } from "firebase/auth";

// Helper function to format date as YYYY-MM-DD
const formatYMD = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

// Generate availability dates (start: today, end: 3-6 months from today)
const generateAvailability = () => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  // End date: 3-6 months from today (random between 90-180 days)
  const daysToAdd = 90 + Math.floor(Math.random() * 90); // 90-180 days
  const endDate = new Date(today);
  endDate.setDate(endDate.getDate() + daysToAdd);
  
  return {
    start: formatYMD(today),
    end: formatYMD(endDate),
  };
};

export default function AddAvailabilityPage() {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState([]);
  const [error, setError] = useState(null);
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [listings, setListings] = useState([]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Fetch existing home listings
  useEffect(() => {
    if (!user) return;

    const fetchListings = async () => {
      try {
        const listingsRef = collection(database, "listings");
        
        // Query by multiple fields to find all listings
        const queries = [
          query(listingsRef, where("category", "==", "Homes")),
        ];

        const snapshots = await Promise.all(queries.map((q) => getDocs(q)));
        const allDocs = new Map();

        snapshots.forEach((snapshot) => {
          snapshot.docs.forEach((doc) => {
            if (!allDocs.has(doc.id)) {
              allDocs.set(doc.id, { id: doc.id, ...doc.data() });
            }
          });
        });

        const listingsData = Array.from(allDocs.values());

        // Filter for published homes only
        const filtered = listingsData.filter(
          (item) => item.category === "Homes" && item.status === "published"
        );

        setListings(filtered);
      } catch (err) {
        console.error("Error fetching listings:", err);
        setError(err.message || "Failed to fetch listings");
      }
    };

    fetchListings();
  }, [user]);

  const handleAddAvailability = async () => {
    if (!user) {
      setError("You must be logged in to add availability. Please log in first.");
      alert("You must be logged in to add availability.");
      return;
    }

    if (listings.length === 0) {
      setError("No home listings found to update.");
      alert("No listings found. Please add home listings first.");
      return;
    }

    setLoading(true);
    setError(null);
    setResults([]);

    try {
      const updated = [];

      for (const listing of listings) {
        // Skip if already has availability
        if (listing.availability?.start && listing.availability?.end) {
          console.log(`Skipping ${listing.title} - already has availability`);
          continue;
        }

        // Generate availability dates
        const availability = generateAvailability();

        // Update the listing
        const listingRef = doc(database, "listings", listing.id);
        await updateDoc(listingRef, {
          availability: availability,
          updatedAt: serverTimestamp(),
        });

        updated.push({
          id: listing.id,
          title: listing.title,
          availability: availability,
        });

        setResults([...updated]);
      }

      console.log(`✅ Successfully updated ${updated.length} listings with availability!`);
      alert(`Successfully added availability to ${updated.length} listings!`);
    } catch (err) {
      console.error("Error adding availability:", err);
      setError(err.message || "Failed to add availability");
      alert(`Error: ${err.message || "Failed to add availability"}`);
    } finally {
      setLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/50 p-8 flex items-center justify-center">
        <div className="text-slate-600">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/50 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="rounded-3xl border border-white/40 bg-white/80 backdrop-blur-sm shadow-lg p-8">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Add Availability to Home Listings</h1>
          <p className="text-slate-600 mb-4">
            This will add availability dates (start and end) to existing home listings that don't have availability set.
          </p>
          {user && (
            <>
              <p className="text-sm text-slate-500 mb-2">
                Logged in as: <code className="bg-slate-100 px-2 py-1 rounded">{user.uid}</code> {user.email}
              </p>
              <p className="text-sm text-slate-600 mb-4">
                Found <strong>{listings.length}</strong> home listings.
                {listings.filter(l => l.availability?.start && l.availability?.end).length > 0 && (
                  <span className="ml-2 text-slate-500">
                    ({listings.filter(l => l.availability?.start && l.availability?.end).length} already have availability)
                  </span>
                )}
              </p>
            </>
          )}
          {!user && (
            <div className="mb-6 p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-700">
              <strong>⚠️ Not logged in:</strong> You must be logged in to add availability. Please log in first.
            </div>
          )}

          <button
            onClick={handleAddAvailability}
            disabled={loading || !user || listings.length === 0}
            className="px-6 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 text-white font-semibold shadow-md hover:shadow-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading
              ? `Adding Availability... (${results.length} updated)`
              : `Add Availability to ${listings.filter(l => !l.availability?.start || !l.availability?.end).length} Listings`}
          </button>

          {error && (
            <div className="mt-4 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700">
              <strong>Error:</strong> {error}
            </div>
          )}

          {results.length > 0 && (
            <div className="mt-6">
              <h2 className="text-xl font-semibold text-slate-900 mb-3">
                Updated Listings ({results.length})
              </h2>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {results.map((result) => (
                  <div
                    key={result.id}
                    className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-sm"
                  >
                    <strong>{result.title}</strong>
                    <br />
                    <span className="text-xs text-slate-600">
                      Availability: {result.availability.start} to {result.availability.end}
                    </span>
                    <br />
                    <code className="text-xs text-slate-500">ID: {result.id}</code>
                  </div>
                ))}
              </div>
            </div>
          )}

          {listings.length > 0 && results.length === 0 && (
            <div className="mt-6">
              <h2 className="text-lg font-semibold text-slate-900 mb-3">
                Listings Found ({listings.length})
              </h2>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {listings.slice(0, 10).map((listing) => (
                  <div
                    key={listing.id}
                    className="p-2 rounded-lg bg-slate-50 border border-slate-200 text-sm"
                  >
                    <strong>{listing.title || "Untitled"}</strong>
                    {listing.availability?.start && listing.availability?.end ? (
                      <span className="ml-2 text-xs text-emerald-600">
                        • Has availability: {listing.availability.start} to {listing.availability.end}
                      </span>
                    ) : (
                      <span className="ml-2 text-xs text-amber-600">• No availability set</span>
                    )}
                  </div>
                ))}
                {listings.length > 10 && (
                  <p className="text-xs text-slate-500 text-center">
                    ... and {listings.length - 10} more listings
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

