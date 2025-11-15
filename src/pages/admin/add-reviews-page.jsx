// Page to add fake reviews to all listings
// Access this page at /admin/add-reviews

import React, { useState, useEffect } from "react";
import { collection, query, getDocs, doc, writeBatch, Timestamp } from "firebase/firestore";
import { database } from "../../config/firebase";
import { auth } from "../../config/firebase";
import { onAuthStateChanged } from "firebase/auth";

// Fake user data for reviews
const FAKE_USERS = [
  { uid: "fake_user_001", name: "Sarah Johnson", email: "sarah.j@example.com" },
  { uid: "fake_user_002", name: "Michael Chen", email: "michael.c@example.com" },
  { uid: "fake_user_003", name: "Emily Rodriguez", email: "emily.r@example.com" },
  { uid: "fake_user_004", name: "David Kim", email: "david.k@example.com" },
  { uid: "fake_user_005", name: "Jessica Martinez", email: "jessica.m@example.com" },
  { uid: "fake_user_006", name: "James Wilson", email: "james.w@example.com" },
  { uid: "fake_user_007", name: "Maria Garcia", email: "maria.g@example.com" },
  { uid: "fake_user_008", name: "Robert Taylor", email: "robert.t@example.com" },
  { uid: "fake_user_009", name: "Lisa Anderson", email: "lisa.a@example.com" },
  { uid: "fake_user_010", name: "Christopher Lee", email: "chris.l@example.com" },
];

// Fake review comments by category
const REVIEW_COMMENTS = {
  Homes: [
    "Amazing stay! The place was clean, cozy, and exactly as described. The host was very responsive and helpful. Would definitely book again!",
    "Beautiful home with great amenities. The location was perfect and the neighborhood was quiet. Highly recommend!",
    "Had a wonderful time here. The place was spacious and well-maintained. The host provided excellent recommendations for local restaurants.",
    "Great value for money! The home was clean and comfortable. Perfect for a family vacation. Will come back!",
    "Lovely place with a nice view. The host was accommodating and check-in was smooth. Everything we needed was provided.",
    "The home exceeded our expectations! Very clean, modern, and in a great location. The host was friendly and responsive.",
    "Perfect stay! The place was exactly as shown in photos. Comfortable beds and all amenities worked well. Highly satisfied!",
    "Nice place but could use some improvements. Overall decent experience, though some areas need better maintenance.",
    "The location was good but the place was smaller than expected. Clean and functional, but not as spacious as advertised.",
    "Average experience. The place was okay but nothing special. Host was responsive though.",
  ],
  Experiences: [
    "Incredible experience! The guide was knowledgeable and friendly. Learned so much about the local culture. Highly recommend!",
    "Amazing tour! Well-organized and informative. The guide made the experience memorable. Worth every peso!",
    "Fantastic experience from start to finish. The host was engaging and the activity was well-planned. Would do it again!",
    "Great way to explore the city! The experience was unique and enjoyable. The guide was professional and helpful.",
    "Wonderful experience! Everything was well-coordinated and the host was passionate about what they do. Highly recommended!",
    "Enjoyed every moment! The experience was educational and fun. The guide was excellent at explaining everything.",
    "Good experience overall. The activity was interesting but could have been longer. Guide was friendly and knowledgeable.",
    "Decent experience. The guide was okay but the activity felt a bit rushed. Still had a good time though.",
    "The experience was okay but didn't meet all expectations. Some parts were interesting, others were less engaging.",
    "Average experience. It was fine but nothing extraordinary. The guide was professional but the activity was basic.",
  ],
  Services: [
    "Excellent service! Professional, punctual, and delivered exactly what was promised. Highly satisfied with the quality!",
    "Outstanding service provider! Very skilled and attentive to details. Would definitely hire again for future needs.",
    "Great service! The provider was professional and completed the work efficiently. Quality exceeded expectations!",
    "Very satisfied with the service! The provider was knowledgeable and delivered great results. Highly recommend!",
    "Professional service with excellent results. The provider was responsive and easy to work with. Worth the investment!",
    "Good service overall. The provider was competent and completed the task as expected. Would consider using again.",
    "Decent service. The provider was okay but the work quality could have been better. Still acceptable though.",
    "The service was adequate but not exceptional. Provider was professional but results were average.",
    "Service was okay but didn't fully meet expectations. Some aspects were good, others needed improvement.",
    "Average service. The provider was professional but the results were just okay. Nothing special.",
  ],
};

// Generate a random review comment based on category
const getRandomComment = (category, rating) => {
  const categoryKey = category === "Experiences" ? "Experiences" : category === "Services" ? "Services" : "Homes";
  const comments = REVIEW_COMMENTS[categoryKey] || REVIEW_COMMENTS.Homes;
  
  // For lower ratings, use comments from the end of the array (more negative)
  if (rating <= 2) {
    return comments[comments.length - 1] || comments[Math.floor(Math.random() * comments.length)];
  } else if (rating === 3) {
    return comments[Math.floor(comments.length * 0.7)] || comments[Math.floor(Math.random() * comments.length)];
  } else {
    return comments[Math.floor(Math.random() * (comments.length - 3))] || comments[0];
  }
};

// Generate a random rating (weighted towards positive ratings)
const getRandomRating = () => {
  const rand = Math.random();
  if (rand < 0.6) return 5; // 60% chance of 5 stars
  if (rand < 0.8) return 4; // 20% chance of 4 stars
  if (rand < 0.9) return 3; // 10% chance of 3 stars
  if (rand < 0.95) return 2; // 5% chance of 2 stars
  return 1; // 5% chance of 1 star
};

// Generate a random date within the last 6 months
const getRandomDate = () => {
  const now = new Date();
  const sixMonthsAgo = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
  const randomTime = sixMonthsAgo.getTime() + Math.random() * (now.getTime() - sixMonthsAgo.getTime());
  return new Date(randomTime);
};

export default function AddReviewsPage() {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState([]);
  const [error, setError] = useState(null);
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [listings, setListings] = useState([]);
  const [reviewsPerListing, setReviewsPerListing] = useState(5);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Fetch all listings
  useEffect(() => {
    if (!user) return;

    const fetchListings = async () => {
      try {
        const listingsRef = collection(database, "listings");
        const snapshot = await getDocs(listingsRef);
        const listingsData = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));

        // Filter for published listings only
        const published = listingsData.filter((item) => item.status === "published");
        setListings(published);
      } catch (err) {
        console.error("Error fetching listings:", err);
        setError(err.message || "Failed to fetch listings");
      }
    };

    fetchListings();
  }, [user]);

  const handleAddReviews = async () => {
    if (!user) {
      setError("You must be logged in to add reviews. Please log in first.");
      alert("You must be logged in to add reviews.");
      return;
    }

    if (listings.length === 0) {
      setError("No listings found to add reviews to.");
      alert("No listings found. Please add listings first.");
      return;
    }

    setLoading(true);
    setError(null);
    setResults([]);

    try {
      const added = [];
      const batchSize = 500; // Firestore batch limit
      let currentBatch = writeBatch(database);
      let batchCount = 0;

      for (const listing of listings) {
        const listingId = listing.id;
        const category = listing.category || "Homes";
        const numReviews = reviewsPerListing;

        for (let i = 0; i < numReviews; i++) {
          const fakeUser = FAKE_USERS[Math.floor(Math.random() * FAKE_USERS.length)];
          const rating = getRandomRating();
          const comment = getRandomComment(category, rating);
          const reviewDate = getRandomDate();
          const fakeBookingId = `fake_booking_${listingId}_${i}_${Date.now()}_${Math.random().toString(36).substring(7)}`;

          // Use logged-in user's UID to satisfy Firestore security rules
          // But use fake user name for display variety
          const reviewData = {
            uid: user.uid, // Must match logged-in user for security rules
            rating: rating,
            text: comment,
            createdAt: Timestamp.fromDate(reviewDate),
            updatedAt: Timestamp.fromDate(reviewDate),
            bookingId: fakeBookingId,
            listingId: listingId,
            guestUid: user.uid, // Also use logged-in user's UID
            guestName: fakeUser.name, // Use fake name for display variety
            category: category,
          };

          // Create review in listings subcollection
          const reviewRef = doc(database, "listings", listingId, "reviews", fakeBookingId);
          currentBatch.set(reviewRef, reviewData);

          // Create review in global reviews collection
          const globalRef = doc(database, "reviews", `${listingId}_${fakeBookingId}_${user.uid}`);
          currentBatch.set(globalRef, { ...reviewData, id: globalRef.id });

          batchCount += 2;

          // Commit batch if it reaches the limit
          if (batchCount >= batchSize) {
            await currentBatch.commit();
            currentBatch = writeBatch(database);
            batchCount = 0;
          }
        }

        added.push({
          listingId: listingId,
          title: listing.title || "Untitled",
          category: category,
          reviewsAdded: numReviews,
        });

        setResults([...added]);
      }

      // Commit remaining batch
      if (batchCount > 0) {
        await currentBatch.commit();
      }

      const totalReviews = added.reduce((sum, item) => sum + item.reviewsAdded, 0);
      console.log(`✅ Successfully added ${totalReviews} reviews to ${added.length} listings!`);
      alert(`Successfully added ${totalReviews} reviews to ${added.length} listings!`);
    } catch (err) {
      console.error("Error adding reviews:", err);
      setError(err.message || "Failed to add reviews");
      alert(`Error: ${err.message || "Failed to add reviews"}`);
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
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Add Fake Reviews to Listings</h1>
          <p className="text-slate-600 mb-4">
            This will add fake reviews with ratings and comments to all published listings.
          </p>
          {user && (
            <>
              <p className="text-sm text-slate-500 mb-2">
                Logged in as: <code className="bg-slate-100 px-2 py-1 rounded">{user.uid}</code> {user.email}
              </p>
              <p className="text-sm text-slate-600 mb-4">
                Found <strong>{listings.length}</strong> published listings.
              </p>
            </>
          )}
          {!user && (
            <div className="mb-6 p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-700">
              <strong>⚠️ Not logged in:</strong> You must be logged in to add reviews. Please log in first.
            </div>
          )}

          <div className="mb-6">
            <label className="block text-sm font-semibold text-slate-900 mb-2">
              Reviews per listing:
            </label>
            <input
              type="number"
              min="1"
              max="20"
              value={reviewsPerListing}
              onChange={(e) => setReviewsPerListing(Math.max(1, Math.min(20, parseInt(e.target.value) || 5)))}
              className="w-32 rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500/50"
            />
            <p className="text-xs text-slate-500 mt-1">
              Number of fake reviews to add to each listing (1-20)
            </p>
          </div>

          <button
            onClick={handleAddReviews}
            disabled={loading || !user || listings.length === 0}
            className="px-6 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 text-white font-semibold shadow-md hover:shadow-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading
              ? `Adding Reviews... (${results.length}/${listings.length} listings)`
              : `Add ${reviewsPerListing} Reviews to ${listings.length} Listings`}
          </button>

          {error && (
            <div className="mt-4 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700">
              <strong>Error:</strong> {error}
            </div>
          )}

          {results.length > 0 && (
            <div className="mt-6">
              <h2 className="text-xl font-semibold text-slate-900 mb-3">
                Reviews Added ({results.length}/{listings.length} listings)
              </h2>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {results.map((result) => (
                  <div
                    key={result.listingId}
                    className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-sm"
                  >
                    <strong>{result.title}</strong> ({result.category})
                    <br />
                    <span className="text-xs text-slate-600">
                      Added {result.reviewsAdded} reviews
                    </span>
                    <br />
                    <code className="text-xs text-slate-500">ID: {result.listingId}</code>
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
                    <strong>{listing.title || "Untitled"}</strong> ({listing.category || "Homes"})
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

