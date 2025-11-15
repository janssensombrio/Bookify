// Temporary page to add 10 home listings for the specified host
// Access this page at /admin/add-listings (add route in App.js if needed)

import React, { useState, useEffect } from "react";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { database } from "../../config/firebase";
import { auth } from "../../config/firebase";
import { onAuthStateChanged } from "firebase/auth";

const HOST_UID = "GjPNiHmSP3URUvonqmWjc7hBGSw2";

const listings = [
  {
    title: "Modern Studio Apartment in Makati",
    description: "A cozy and modern studio apartment located in the heart of Makati. Perfect for solo travelers or couples. Features a fully equipped kitchen, high-speed Wi-Fi, and access to building amenities including gym and pool.",
    location: "Makati City, Metro Manila",
    propertyType: "Apartment",
    listingType: "Entire place",
    price: 2500,
    cleaningFee: 500,
    bedrooms: 0,
    beds: 1,
    bathrooms: 1,
    guests: { adults: 2, children: 0, infants: 0, total: 2 },
    amenities: ["Wi-Fi", "Air conditioning", "Kitchen", "TV", "Coffee maker"],
    photos: [],
    category: "Homes",
    discountType: "none",
    discountValue: 0,
    availability: { start: "", end: "" },
    cancellationPolicy: "Free cancellation up to 24 hours before check-in.",
    status: "published",
    uid: HOST_UID,
    hostId: HOST_UID,
    ownerId: HOST_UID,
  },
  {
    title: "Spacious 3BR House with Garden",
    description: "Beautiful family-friendly house with 3 bedrooms, 2 bathrooms, and a lovely garden. Located in a quiet neighborhood in Quezon City. Perfect for families or groups. Includes parking space and outdoor dining area.",
    location: "Quezon City, Metro Manila",
    propertyType: "House",
    listingType: "Entire place",
    price: 4500,
    cleaningFee: 800,
    bedrooms: 3,
    beds: 4,
    bathrooms: 2,
    guests: { adults: 6, children: 2, infants: 1, total: 9 },
    amenities: ["Wi-Fi", "Air conditioning", "Kitchen", "Free parking", "Garden", "TV", "Washing machine"],
    photos: [],
    category: "Homes",
    discountType: "none",
    discountValue: 0,
    availability: { start: "", end: "" },
    cancellationPolicy: "Free cancellation up to 7 days before check-in.",
    status: "published",
    uid: HOST_UID,
    hostId: HOST_UID,
    ownerId: HOST_UID,
  },
  {
    title: "Luxury 2BR Condo with City View",
    description: "Stunning 2-bedroom condominium with panoramic city views. Modern furnishings, fully equipped kitchen, and premium amenities. Located in BGC with easy access to shopping, dining, and entertainment.",
    location: "Bonifacio Global City, Taguig",
    propertyType: "Apartment",
    listingType: "Entire place",
    price: 6000,
    cleaningFee: 1000,
    bedrooms: 2,
    beds: 3,
    bathrooms: 2,
    guests: { adults: 4, children: 1, infants: 0, total: 5 },
    amenities: ["Wi-Fi", "Air conditioning", "Kitchen", "Gym", "Pool", "TV", "Coffee maker", "Free parking"],
    photos: [],
    category: "Homes",
    discountType: "none",
    discountValue: 0,
    availability: { start: "", end: "" },
    cancellationPolicy: "Free cancellation up to 48 hours before check-in.",
    status: "published",
    uid: HOST_UID,
    hostId: HOST_UID,
    ownerId: HOST_UID,
  },
  {
    title: "Cozy 1BR Apartment near Airport",
    description: "Conveniently located 1-bedroom apartment just 10 minutes from NAIA. Perfect for transit travelers or short stays. Clean, comfortable, and fully furnished with all essentials.",
    location: "Pasay City, Metro Manila",
    propertyType: "Apartment",
    listingType: "Entire place",
    price: 2000,
    cleaningFee: 400,
    bedrooms: 1,
    beds: 2,
    bathrooms: 1,
    guests: { adults: 2, children: 0, infants: 0, total: 2 },
    amenities: ["Wi-Fi", "Air conditioning", "Kitchen", "TV", "Coffee maker"],
    photos: [],
    category: "Homes",
    discountType: "none",
    discountValue: 0,
    availability: { start: "", end: "" },
    cancellationPolicy: "Free cancellation up to 24 hours before check-in.",
    status: "published",
    uid: HOST_UID,
    hostId: HOST_UID,
    ownerId: HOST_UID,
  },
  {
    title: "Beachfront Villa in Batangas",
    description: "Stunning beachfront villa with direct access to the beach. 4 bedrooms, 3 bathrooms, and a private pool. Perfect for large groups or families looking for a beach getaway. Includes full kitchen and outdoor BBQ area.",
    location: "Batangas",
    propertyType: "Villa",
    listingType: "Entire place",
    price: 12000,
    cleaningFee: 1500,
    bedrooms: 4,
    beds: 6,
    bathrooms: 3,
    guests: { adults: 8, children: 2, infants: 1, total: 11 },
    amenities: ["Wi-Fi", "Air conditioning", "Kitchen", "Pool", "Beach access", "TV", "Free parking", "BBQ grill"],
    photos: [],
    category: "Homes",
    discountType: "none",
    discountValue: 0,
    availability: { start: "", end: "" },
    cancellationPolicy: "Free cancellation up to 14 days before check-in.",
    status: "published",
    uid: HOST_UID,
    hostId: HOST_UID,
    ownerId: HOST_UID,
  },
  {
    title: "Charming Cottage in Tagaytay",
    description: "Quaint cottage with beautiful mountain views in Tagaytay. 2 bedrooms, 1 bathroom, with a cozy fireplace and outdoor deck. Perfect for a romantic getaway or small family retreat.",
    location: "Tagaytay City, Cavite",
    propertyType: "Cottage",
    listingType: "Entire place",
    price: 3500,
    cleaningFee: 600,
    bedrooms: 2,
    beds: 3,
    bathrooms: 1,
    guests: { adults: 4, children: 1, infants: 0, total: 5 },
    amenities: ["Wi-Fi", "Heating", "Kitchen", "Fireplace", "TV", "Coffee maker", "Mountain view"],
    photos: [],
    category: "Homes",
    discountType: "none",
    discountValue: 0,
    availability: { start: "", end: "" },
    cancellationPolicy: "Free cancellation up to 7 days before check-in.",
    status: "published",
    uid: HOST_UID,
    hostId: HOST_UID,
    ownerId: HOST_UID,
  },
  {
    title: "Modern 2BR Loft in Ortigas",
    description: "Stylish 2-bedroom loft apartment in Ortigas business district. High ceilings, modern design, and premium finishes. Walking distance to malls, restaurants, and offices.",
    location: "Ortigas, Pasig City",
    propertyType: "Apartment",
    listingType: "Entire place",
    price: 4000,
    cleaningFee: 700,
    bedrooms: 2,
    beds: 3,
    bathrooms: 2,
    guests: { adults: 4, children: 1, infants: 0, total: 5 },
    amenities: ["Wi-Fi", "Air conditioning", "Kitchen", "Gym", "TV", "Coffee maker", "Free parking"],
    photos: [],
    category: "Homes",
    discountType: "none",
    discountValue: 0,
    availability: { start: "", end: "" },
    cancellationPolicy: "Free cancellation up to 48 hours before check-in.",
    status: "published",
    uid: HOST_UID,
    hostId: HOST_UID,
    ownerId: HOST_UID,
  },
  {
    title: "Rustic Cabin in Baguio",
    description: "Cozy mountain cabin in Baguio with pine tree views. 1 bedroom, 1 bathroom, with a warm fireplace and outdoor seating area. Perfect for couples or solo travelers seeking peace and quiet.",
    location: "Baguio City, Benguet",
    propertyType: "Cabin",
    listingType: "Entire place",
    price: 2800,
    cleaningFee: 500,
    bedrooms: 1,
    beds: 2,
    bathrooms: 1,
    guests: { adults: 2, children: 0, infants: 0, total: 2 },
    amenities: ["Wi-Fi", "Heating", "Kitchen", "Fireplace", "TV", "Coffee maker", "Mountain view"],
    photos: [],
    category: "Homes",
    discountType: "none",
    discountValue: 0,
    availability: { start: "", end: "" },
    cancellationPolicy: "Free cancellation up to 7 days before check-in.",
    status: "published",
    uid: HOST_UID,
    hostId: HOST_UID,
    ownerId: HOST_UID,
  },
  {
    title: "Family-Friendly 4BR House in Alabang",
    description: "Spacious 4-bedroom house perfect for large families. Located in a secure subdivision in Alabang. Features a large living area, modern kitchen, and private garden. Includes 2-car garage.",
    location: "Alabang, Muntinlupa",
    propertyType: "House",
    listingType: "Entire place",
    price: 5500,
    cleaningFee: 900,
    bedrooms: 4,
    beds: 6,
    bathrooms: 3,
    guests: { adults: 8, children: 3, infants: 1, total: 12 },
    amenities: ["Wi-Fi", "Air conditioning", "Kitchen", "Garden", "TV", "Washing machine", "Free parking", "Pet-friendly"],
    photos: [],
    category: "Homes",
    discountType: "none",
    discountValue: 0,
    availability: { start: "", end: "" },
    cancellationPolicy: "Free cancellation up to 7 days before check-in.",
    status: "published",
    uid: HOST_UID,
    hostId: HOST_UID,
    ownerId: HOST_UID,
  },
  {
    title: "Elegant 1BR Studio in Eastwood",
    description: "Beautifully designed studio apartment in Eastwood City. Modern amenities, fully furnished, and walking distance to restaurants, cafes, and shopping. Perfect for business travelers or short stays.",
    location: "Eastwood City, Quezon City",
    propertyType: "Apartment",
    listingType: "Entire place",
    price: 3200,
    cleaningFee: 550,
    bedrooms: 0,
    beds: 1,
    bathrooms: 1,
    guests: { adults: 2, children: 0, infants: 0, total: 2 },
    amenities: ["Wi-Fi", "Air conditioning", "Kitchen", "Gym", "TV", "Coffee maker", "Free parking"],
    photos: [],
    category: "Homes",
    discountType: "none",
    discountValue: 0,
    availability: { start: "", end: "" },
    cancellationPolicy: "Free cancellation up to 24 hours before check-in.",
    status: "published",
    uid: HOST_UID,
    hostId: HOST_UID,
    ownerId: HOST_UID,
  },
];

export default function AddListingsPage() {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState([]);
  const [error, setError] = useState(null);
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleAddListings = async () => {
    if (!user) {
      setError("You must be logged in to add listings. Please log in first.");
      alert("You must be logged in to add listings.");
      return;
    }

    setLoading(true);
    setError(null);
    setResults([]);

    try {
      const added = [];
      
      for (let i = 0; i < listings.length; i++) {
        // Use current user's UID for the 'uid' field (to pass security rules)
        // But set hostId and ownerId to the target host UID
        const listing = {
          ...listings[i],
          uid: user.uid, // Current logged-in user's UID (required by security rules)
          hostId: HOST_UID, // Target host UID
          ownerId: HOST_UID, // Target host UID
          publishedAt: serverTimestamp(),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };
        
        const docRef = await addDoc(collection(database, "listings"), listing);
        added.push({ id: docRef.id, title: listing.title, index: i + 1 });
        setResults([...added]);
      }
      
      console.log("✅ Successfully added all 10 listings!");
      alert(`Successfully added ${added.length} listings!`);
    } catch (err) {
      console.error("Error adding listings:", err);
      setError(err.message || "Failed to add listings");
      alert(`Error: ${err.message || "Failed to add listings"}`);
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
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Add 10 Home Listings</h1>
          <p className="text-slate-600 mb-4">
            This will add 10 home listings with host/owner UID: <code className="bg-slate-100 px-2 py-1 rounded">{HOST_UID}</code>
          </p>
          {user && (
            <>
              <p className="text-sm text-slate-500 mb-2">
                Logged in as: <code className="bg-slate-100 px-2 py-1 rounded">{user.uid}</code> {user.email}
              </p>
              {user.uid !== HOST_UID && (
                <div className="mb-6 p-4 rounded-xl bg-blue-50 border border-blue-200 text-blue-700">
                  <strong>ℹ️ Note:</strong> You're logged in as a different user. The listings will use your UID for the <code>uid</code> field (required by security rules), but <code>hostId</code> and <code>ownerId</code> will be set to the target host UID ({HOST_UID}). For full ownership, please log in as that host user.
                </div>
              )}
              {user.uid === HOST_UID && (
                <div className="mb-6 p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700">
                  <strong>✓ Perfect!</strong> You're logged in as the target host. The listings will be fully owned by this account.
                </div>
              )}
            </>
          )}
          {!user && (
            <div className="mb-6 p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-700">
              <strong>⚠️ Not logged in:</strong> You must be logged in to add listings. Please log in first.
            </div>
          )}

          <button
            onClick={handleAddListings}
            disabled={loading || !user}
            className="px-6 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 text-white font-semibold shadow-md hover:shadow-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Adding Listings..." : "Add 10 Listings"}
          </button>

          {error && (
            <div className="mt-4 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700">
              <strong>Error:</strong> {error}
            </div>
          )}

          {results.length > 0 && (
            <div className="mt-6">
              <h2 className="text-xl font-semibold text-slate-900 mb-3">
                Added Listings ({results.length}/10)
              </h2>
              <div className="space-y-2">
                {results.map((result) => (
                  <div
                    key={result.id}
                    className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-sm"
                  >
                    <strong>{result.index}.</strong> {result.title}
                    <br />
                    <code className="text-xs text-slate-600">ID: {result.id}</code>
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

