// Page to add schedules to existing experiences and services
// Access this page at /admin/add-schedules

import React, { useState, useEffect } from "react";
import { collection, query, where, getDocs, updateDoc, doc, serverTimestamp } from "firebase/firestore";
import { database } from "../../config/firebase";
import { auth } from "../../config/firebase";
import { onAuthStateChanged } from "firebase/auth";

const HOST_UID = "GjPNiHmSP3URUvonqmWjc7hBGSw2";

// Helper function to generate schedules for the next 30 days
const generateSchedules = (baseTime, daysOfWeek = [0, 1, 2, 3, 4, 5, 6], count = 10) => {
  const schedules = [];
  const today = new Date();
  let date = new Date(today);
  let added = 0;

  while (added < count && schedules.length < 30) {
    const dayOfWeek = date.getDay();
    if (daysOfWeek.includes(dayOfWeek)) {
      const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD format
      schedules.push({ date: dateStr, time: baseTime });
      added++;
    }
    date.setDate(date.getDate() + 1);
  }

  return schedules;
};

// Schedule configurations for each experience/service type
const scheduleConfigs = {
  // Experiences
  "Manila City Walking Tour": { time: "09:00", days: [0, 1, 2, 3, 4, 5, 6], count: 15 },
  "Cooking Class: Filipino Cuisine": { time: "14:00", days: [1, 3, 5, 6], count: 12 },
  "Sunset Cruise in Manila Bay": { time: "17:00", days: [0, 1, 2, 3, 4, 5, 6], count: 20 },
  "Photography Workshop: Street Photography": { time: "08:00", days: [0, 6], count: 8 },
  "Traditional Filipino Dance Class": { time: "16:00", days: [2, 4, 6], count: 10 },
  "Market Tour & Food Tasting": { time: "10:00", days: [1, 3, 5], count: 12 },
  "Yoga Session at Rizal Park": { time: "07:00", days: [0, 1, 2, 3, 4, 5, 6], count: 20 },
  "Artisan Pottery Workshop": { time: "13:00", days: [0, 3, 6], count: 10 },
  "Historical Intramuros Tour": { time: "09:00", days: [0, 1, 2, 3, 4, 5, 6], count: 15 },
  "Karaoke Night Experience": { time: "19:00", days: [4, 5, 6], count: 8 },
  "Bike Tour: Hidden Gems of Manila": { time: "08:00", days: [0, 6], count: 12 },
  "Traditional Weaving Workshop": { time: "10:00", days: [1, 4], count: 8 },
  "Sunrise Hiking at Mount Pinatubo": { time: "04:00", days: [0, 6], count: 6 },
  "Virtual Filipino Language Class": { time: "18:00", days: [1, 3, 5], count: 10 },
  "Jeepney Ride & Cultural Experience": { time: "11:00", days: [0, 2, 4, 6], count: 12 },

  // Services
  "Math Tutoring Services": { time: "15:00", days: [1, 2, 3, 4, 5], count: 15 },
  "Personal Fitness Training": { time: "07:00", days: [1, 2, 3, 4, 5, 6], count: 18 },
  "Professional Photography Services": { time: "10:00", days: [0, 1, 2, 3, 4, 5, 6], count: 10 },
  "Business Consulting Services": { time: "14:00", days: [1, 2, 3, 4, 5], count: 10 },
  "Computer Repair & Maintenance": { time: "09:00", days: [1, 2, 3, 4, 5, 6], count: 12 },
  "Yoga & Meditation Classes": { time: "08:00", days: [0, 1, 2, 3, 4, 5, 6], count: 20 },
  "English Language Tutoring": { time: "16:00", days: [1, 2, 3, 4, 5], count: 15 },
  "Graphic Design Services": { time: "10:00", days: [1, 2, 3, 4, 5], count: 8 },
  "Massage Therapy": { time: "11:00", days: [0, 1, 2, 3, 4, 5, 6], count: 14 },
  "Web Development Services": { time: "09:00", days: [1, 2, 3, 4, 5], count: 5 },
  "Music Lessons: Piano": { time: "15:00", days: [1, 2, 3, 4, 5, 6], count: 12 },
  "Nutrition Counseling": { time: "13:00", days: [1, 3, 5], count: 10 },
  "Home Cleaning Services": { time: "09:00", days: [1, 2, 3, 4, 5, 6], count: 12 },
  "Legal Consultation Services": { time: "14:00", days: [1, 2, 3, 4, 5], count: 8 },
  "Pet Grooming Services": { time: "10:00", days: [0, 1, 2, 3, 4, 5, 6], count: 14 },
};

export default function AddSchedulesPage() {
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

  // Fetch existing listings
  useEffect(() => {
    if (!user) return;

    const fetchListings = async () => {
      try {
        const listingsRef = collection(database, "listings");
        
        // Query by multiple fields to find all host's listings
        const queries = [
          query(listingsRef, where("hostId", "==", HOST_UID)),
          query(listingsRef, where("uid", "==", HOST_UID)),
          query(listingsRef, where("ownerId", "==", HOST_UID)),
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

        // Filter for experiences and services only
        const filtered = listingsData.filter(
          (item) =>
            (item.category === "Experiences" || item.category === "Services") &&
            item.status === "published"
        );

        setListings(filtered);
      } catch (err) {
        console.error("Error fetching listings:", err);
        setError(err.message || "Failed to fetch listings");
      }
    };

    fetchListings();
  }, [user]);

  const handleAddSchedules = async () => {
    if (!user) {
      setError("You must be logged in to add schedules. Please log in first.");
      alert("You must be logged in to add schedules.");
      return;
    }

    if (listings.length === 0) {
      setError("No experiences or services found to update.");
      alert("No listings found. Please add experiences and services first.");
      return;
    }

    setLoading(true);
    setError(null);
    setResults([]);

    try {
      const updated = [];

      for (const listing of listings) {
        const config = scheduleConfigs[listing.title];
        if (!config) {
          console.warn(`No schedule config found for: ${listing.title}`);
          continue;
        }

        // Generate schedules
        const schedules = generateSchedules(
          config.time,
          config.days,
          config.count
        );

        // Update the listing
        const listingRef = doc(database, "listings", listing.id);
        await updateDoc(listingRef, {
          schedule: schedules,
          updatedAt: serverTimestamp(),
        });

        updated.push({
          id: listing.id,
          title: listing.title,
          category: listing.category,
          scheduleCount: schedules.length,
        });

        setResults([...updated]);
      }

      console.log(`✅ Successfully updated ${updated.length} listings with schedules!`);
      alert(`Successfully added schedules to ${updated.length} listings!`);
    } catch (err) {
      console.error("Error adding schedules:", err);
      setError(err.message || "Failed to add schedules");
      alert(`Error: ${err.message || "Failed to add schedules"}`);
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
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Add Schedules to Listings</h1>
          <p className="text-slate-600 mb-4">
            This will add schedules to existing experiences and services for host UID: <code className="bg-slate-100 px-2 py-1 rounded">{HOST_UID}</code>
          </p>
          {user && (
            <>
              <p className="text-sm text-slate-500 mb-2">
                Logged in as: <code className="bg-slate-100 px-2 py-1 rounded">{user.uid}</code> {user.email}
              </p>
              <p className="text-sm text-slate-600 mb-4">
                Found <strong>{listings.length}</strong> experiences and services to update.
              </p>
            </>
          )}
          {!user && (
            <div className="mb-6 p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-700">
              <strong>⚠️ Not logged in:</strong> You must be logged in to add schedules. Please log in first.
            </div>
          )}

          <button
            onClick={handleAddSchedules}
            disabled={loading || !user || listings.length === 0}
            className="px-6 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 text-white font-semibold shadow-md hover:shadow-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Adding Schedules..." : `Add Schedules to ${listings.length} Listings`}
          </button>

          {error && (
            <div className="mt-4 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700">
              <strong>Error:</strong> {error}
            </div>
          )}

          {results.length > 0 && (
            <div className="mt-6">
              <h2 className="text-xl font-semibold text-slate-900 mb-3">
                Updated Listings ({results.length}/{listings.length})
              </h2>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {results.map((result) => (
                  <div
                    key={result.id}
                    className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-sm"
                  >
                    <strong>{result.title}</strong> ({result.category})
                    <br />
                    <span className="text-xs text-slate-600">
                      Added {result.scheduleCount} schedule slots
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
                {listings.map((listing) => (
                  <div
                    key={listing.id}
                    className="p-2 rounded-lg bg-slate-50 border border-slate-200 text-sm"
                  >
                    <strong>{listing.title}</strong> ({listing.category})
                    {listing.schedule && listing.schedule.length > 0 && (
                      <span className="ml-2 text-xs text-emerald-600">
                        • {listing.schedule.length} schedules already
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

