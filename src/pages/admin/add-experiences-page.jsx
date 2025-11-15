// Temporary page to add 15 experience listings for the specified host
// Access this page at /admin/add-experiences

import React, { useState, useEffect } from "react";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { database } from "../../config/firebase";
import { auth } from "../../config/firebase";
import { onAuthStateChanged } from "firebase/auth";

const HOST_UID = "GjPNiHmSP3URUvonqmWjc7hBGSw2";

const experiences = [
  {
    title: "Manila City Walking Tour",
    description: "Explore the historic streets of Manila with a knowledgeable local guide. Visit Intramuros, Rizal Park, and other iconic landmarks while learning about the rich history and culture of the Philippines.",
    location: "Manila, Metro Manila",
    listingType: "Walking Tours",
    duration: "3 hours",
    maxParticipants: 15,
    ageRestriction: { min: 8, max: 100 },
    experienceType: "in-person",
    languages: ["English", "Tagalog"],
    schedule: [],
    price: 1500,
    discountType: "none",
    discountValue: 0,
    amenities: ["Guide", "Water", "Map"],
    photos: [],
    category: "Experiences",
    hostRequirements: "Comfortable walking shoes, hat, sunscreen",
    cancellationPolicy: "Free cancellation up to 24 hours before the experience.",
    status: "published",
    uid: HOST_UID,
    hostId: HOST_UID,
    ownerId: HOST_UID,
  },
  {
    title: "Cooking Class: Filipino Cuisine",
    description: "Learn to cook authentic Filipino dishes in a hands-on cooking class. Master recipes for adobo, sinigang, and lechon kawali. Includes all ingredients, recipes, and a delicious meal to enjoy.",
    location: "Makati City, Metro Manila",
    listingType: "Cooking Classes",
    duration: "4 hours",
    maxParticipants: 10,
    ageRestriction: { min: 12, max: 100 },
    experienceType: "in-person",
    languages: ["English", "Tagalog"],
    schedule: [],
    price: 2500,
    discountType: "none",
    discountValue: 0,
    amenities: ["Ingredients", "Recipes", "Meal", "Apron"],
    photos: [],
    category: "Experiences",
    hostRequirements: "None, all materials provided",
    cancellationPolicy: "Free cancellation up to 48 hours before the experience.",
    status: "published",
    uid: HOST_UID,
    hostId: HOST_UID,
    ownerId: HOST_UID,
  },
  {
    title: "Sunset Cruise in Manila Bay",
    description: "Enjoy a romantic sunset cruise along Manila Bay. Watch the beautiful sunset while sipping drinks and enjoying light snacks. Perfect for couples or small groups.",
    location: "Manila Bay, Metro Manila",
    listingType: "Water Activities",
    duration: "2 hours",
    maxParticipants: 20,
    ageRestriction: { min: 5, max: 100 },
    experienceType: "in-person",
    languages: ["English", "Tagalog"],
    schedule: [],
    price: 2000,
    discountType: "none",
    discountValue: 0,
    amenities: ["Boat", "Drinks", "Snacks", "Life jackets"],
    photos: [],
    category: "Experiences",
    hostRequirements: "Comfortable clothing, camera",
    cancellationPolicy: "Free cancellation up to 24 hours before the experience.",
    status: "published",
    uid: HOST_UID,
    hostId: HOST_UID,
    ownerId: HOST_UID,
  },
  {
    title: "Photography Workshop: Street Photography",
    description: "Learn street photography techniques from a professional photographer. Explore vibrant neighborhoods, practice composition, and get feedback on your shots. Suitable for all skill levels.",
    location: "Quezon City, Metro Manila",
    listingType: "Workshops",
    duration: "5 hours",
    maxParticipants: 8,
    ageRestriction: { min: 16, max: 100 },
    experienceType: "in-person",
    languages: ["English"],
    schedule: [],
    price: 3000,
    discountType: "none",
    discountValue: 0,
    amenities: ["Guide", "Tips sheet", "Photo review"],
    photos: [],
    category: "Experiences",
    hostRequirements: "Camera (DSLR or smartphone), comfortable shoes",
    cancellationPolicy: "Free cancellation up to 48 hours before the experience.",
    status: "published",
    uid: HOST_UID,
    hostId: HOST_UID,
    ownerId: HOST_UID,
  },
  {
    title: "Traditional Filipino Dance Class",
    description: "Learn traditional Filipino dances like Tinikling and Singkil. Experience the rich cultural heritage of the Philippines through dance. All skill levels welcome.",
    location: "Pasig City, Metro Manila",
    listingType: "Dance Classes",
    duration: "2 hours",
    maxParticipants: 12,
    ageRestriction: { min: 10, max: 100 },
    experienceType: "in-person",
    languages: ["English", "Tagalog"],
    schedule: [],
    price: 1200,
    discountType: "none",
    discountValue: 0,
    amenities: ["Instructor", "Music", "Traditional props"],
    photos: [],
    category: "Experiences",
    hostRequirements: "Comfortable clothing, water bottle",
    cancellationPolicy: "Free cancellation up to 24 hours before the experience.",
    status: "published",
    uid: HOST_UID,
    hostId: HOST_UID,
    ownerId: HOST_UID,
  },
  {
    title: "Market Tour & Food Tasting",
    description: "Explore local markets and taste authentic Filipino street food. Visit traditional markets, learn about local ingredients, and sample delicious treats. A foodie's paradise!",
    location: "Manila, Metro Manila",
    listingType: "Food Tours",
    duration: "3.5 hours",
    maxParticipants: 12,
    ageRestriction: { min: 8, max: 100 },
    experienceType: "in-person",
    languages: ["English", "Tagalog"],
    schedule: [],
    price: 1800,
    discountType: "none",
    discountValue: 0,
    amenities: ["Guide", "Food samples", "Water"],
    photos: [],
    category: "Experiences",
    hostRequirements: "Comfortable walking shoes, empty stomach",
    cancellationPolicy: "Free cancellation up to 24 hours before the experience.",
    status: "published",
    uid: HOST_UID,
    hostId: HOST_UID,
    ownerId: HOST_UID,
  },
  {
    title: "Yoga Session at Rizal Park",
    description: "Start your day with a peaceful yoga session in the beautiful Rizal Park. Suitable for all levels, from beginners to advanced practitioners. Includes yoga mats and props.",
    location: "Rizal Park, Manila",
    listingType: "Wellness Activities",
    duration: "1.5 hours",
    maxParticipants: 20,
    ageRestriction: { min: 12, max: 100 },
    experienceType: "in-person",
    languages: ["English", "Tagalog"],
    schedule: [],
    price: 800,
    discountType: "none",
    discountValue: 0,
    amenities: ["Yoga mats", "Props", "Instructor"],
    photos: [],
    category: "Experiences",
    hostRequirements: "Comfortable clothing, water bottle",
    cancellationPolicy: "Free cancellation up to 12 hours before the experience.",
    status: "published",
    uid: HOST_UID,
    hostId: HOST_UID,
    ownerId: HOST_UID,
  },
  {
    title: "Artisan Pottery Workshop",
    description: "Create your own ceramic masterpiece in this hands-on pottery workshop. Learn basic techniques, shape your own piece, and take it home after firing. Perfect for beginners.",
    location: "Marikina City, Metro Manila",
    listingType: "Art Classes",
    duration: "3 hours",
    maxParticipants: 10,
    ageRestriction: { min: 10, max: 100 },
    experienceType: "in-person",
    languages: ["English", "Tagalog"],
    schedule: [],
    price: 2200,
    discountType: "none",
    discountValue: 0,
    amenities: ["Clay", "Tools", "Glazing", "Firing"],
    photos: [],
    category: "Experiences",
    hostRequirements: "Apron or old clothes (clay can be messy)",
    cancellationPolicy: "Free cancellation up to 48 hours before the experience.",
    status: "published",
    uid: HOST_UID,
    hostId: HOST_UID,
    ownerId: HOST_UID,
  },
  {
    title: "Historical Intramuros Tour",
    description: "Step back in time with a guided tour of Intramuros, the historic walled city of Manila. Visit Fort Santiago, San Agustin Church, and learn about Spanish colonial history.",
    location: "Intramuros, Manila",
    listingType: "Historical Tours",
    duration: "4 hours",
    maxParticipants: 15,
    ageRestriction: { min: 8, max: 100 },
    experienceType: "in-person",
    languages: ["English", "Tagalog", "Spanish"],
    schedule: [],
    price: 1600,
    discountType: "none",
    discountValue: 0,
    amenities: ["Guide", "Entrance fees", "Map"],
    photos: [],
    category: "Experiences",
    hostRequirements: "Comfortable walking shoes, hat, camera",
    cancellationPolicy: "Free cancellation up to 24 hours before the experience.",
    status: "published",
    uid: HOST_UID,
    hostId: HOST_UID,
    ownerId: HOST_UID,
  },
  {
    title: "Karaoke Night Experience",
    description: "Experience the Filipino love for karaoke! Sing your heart out in a private karaoke room with friends. Includes snacks, drinks, and unlimited songs for 3 hours.",
    location: "Makati City, Metro Manila",
    listingType: "Entertainment",
    duration: "3 hours",
    maxParticipants: 8,
    ageRestriction: { min: 18, max: 100 },
    experienceType: "in-person",
    languages: ["English", "Tagalog"],
    schedule: [],
    price: 2500,
    discountType: "none",
    discountValue: 0,
    amenities: ["Private room", "Snacks", "Drinks", "Microphones"],
    photos: [],
    category: "Experiences",
    hostRequirements: "Valid ID for age verification",
    cancellationPolicy: "Free cancellation up to 24 hours before the experience.",
    status: "published",
    uid: HOST_UID,
    hostId: HOST_UID,
    ownerId: HOST_UID,
  },
  {
    title: "Bike Tour: Hidden Gems of Manila",
    description: "Discover hidden gems and local neighborhoods on a guided bike tour. Explore off-the-beaten-path locations, meet locals, and see a different side of Manila.",
    location: "Manila, Metro Manila",
    listingType: "Bike Tours",
    duration: "4 hours",
    maxParticipants: 12,
    ageRestriction: { min: 12, max: 100 },
    experienceType: "in-person",
    languages: ["English", "Tagalog"],
    schedule: [],
    price: 2000,
    discountType: "none",
    discountValue: 0,
    amenities: ["Bike rental", "Helmet", "Guide", "Water"],
    photos: [],
    category: "Experiences",
    hostRequirements: "Comfortable clothing, basic bike riding skills",
    cancellationPolicy: "Free cancellation up to 24 hours before the experience.",
    status: "published",
    uid: HOST_UID,
    hostId: HOST_UID,
    ownerId: HOST_UID,
  },
  {
    title: "Traditional Weaving Workshop",
    description: "Learn the ancient art of Filipino weaving. Create your own woven piece using traditional techniques and materials. A unique cultural experience you'll never forget.",
    location: "Quezon City, Metro Manila",
    listingType: "Craft Workshops",
    duration: "4 hours",
    maxParticipants: 8,
    ageRestriction: { min: 14, max: 100 },
    experienceType: "in-person",
    languages: ["English", "Tagalog"],
    schedule: [],
    price: 2800,
    discountType: "none",
    discountValue: 0,
    amenities: ["Materials", "Tools", "Instructor", "Take-home piece"],
    photos: [],
    category: "Experiences",
    hostRequirements: "None, all materials provided",
    cancellationPolicy: "Free cancellation up to 48 hours before the experience.",
    status: "published",
    uid: HOST_UID,
    hostId: HOST_UID,
    ownerId: HOST_UID,
  },
  {
    title: "Sunrise Hiking at Mount Pinatubo",
    description: "Embark on an early morning hike to witness a breathtaking sunrise at Mount Pinatubo. Includes transportation, guide, and breakfast. Moderate difficulty level.",
    location: "Tarlac (meeting point in Manila)",
    listingType: "Adventure Tours",
    duration: "12 hours",
    maxParticipants: 15,
    ageRestriction: { min: 16, max: 65 },
    experienceType: "in-person",
    languages: ["English", "Tagalog"],
    schedule: [],
    price: 4500,
    discountType: "none",
    discountValue: 0,
    amenities: ["Transportation", "Guide", "Breakfast", "Safety equipment"],
    photos: [],
    category: "Experiences",
    hostRequirements: "Hiking boots, water bottle, camera, good physical condition",
    cancellationPolicy: "Free cancellation up to 7 days before the experience.",
    status: "published",
    uid: HOST_UID,
    hostId: HOST_UID,
    ownerId: HOST_UID,
  },
  {
    title: "Virtual Filipino Language Class",
    description: "Learn basic Tagalog phrases and expressions in an interactive online class. Perfect for travelers or anyone interested in Filipino culture. Small group setting for personalized attention.",
    location: "Online",
    listingType: "Language Classes",
    duration: "1.5 hours",
    maxParticipants: 10,
    ageRestriction: { min: 12, max: 100 },
    experienceType: "online",
    languages: ["English"],
    schedule: [],
    price: 1000,
    discountType: "none",
    discountValue: 0,
    amenities: ["Materials", "Certificate", "Recording"],
    photos: [],
    category: "Experiences",
    hostRequirements: "Stable internet connection, webcam, microphone",
    cancellationPolicy: "Free cancellation up to 24 hours before the experience.",
    status: "published",
    uid: HOST_UID,
    hostId: HOST_UID,
    ownerId: HOST_UID,
  },
  {
    title: "Jeepney Ride & Cultural Experience",
    description: "Experience riding a traditional Filipino jeepney while learning about its history and cultural significance. Visit local communities and enjoy authentic Filipino hospitality.",
    location: "Manila, Metro Manila",
    listingType: "Cultural Tours",
    duration: "3 hours",
    maxParticipants: 12,
    ageRestriction: { min: 8, max: 100 },
    experienceType: "in-person",
    languages: ["English", "Tagalog"],
    schedule: [],
    price: 1400,
    discountType: "none",
    discountValue: 0,
    amenities: ["Jeepney ride", "Guide", "Cultural insights"],
    photos: [],
    category: "Experiences",
    hostRequirements: "Comfortable clothing, camera",
    cancellationPolicy: "Free cancellation up to 24 hours before the experience.",
    status: "published",
    uid: HOST_UID,
    hostId: HOST_UID,
    ownerId: HOST_UID,
  },
];

export default function AddExperiencesPage() {
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

  const handleAddExperiences = async () => {
    if (!user) {
      setError("You must be logged in to add experiences. Please log in first.");
      alert("You must be logged in to add experiences.");
      return;
    }

    setLoading(true);
    setError(null);
    setResults([]);

    try {
      const added = [];
      
      for (let i = 0; i < experiences.length; i++) {
        // Use current user's UID for the 'uid' field (to pass security rules)
        // But set hostId and ownerId to the target host UID
        const experience = {
          ...experiences[i],
          uid: user.uid, // Current logged-in user's UID (required by security rules)
          hostId: HOST_UID, // Target host UID
          ownerId: HOST_UID, // Target host UID
          publishedAt: serverTimestamp(),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };
        
        const docRef = await addDoc(collection(database, "listings"), experience);
        added.push({ id: docRef.id, title: experience.title, index: i + 1 });
        setResults([...added]);
      }
      
      console.log("✅ Successfully added all 15 experiences!");
      alert(`Successfully added ${added.length} experiences!`);
    } catch (err) {
      console.error("Error adding experiences:", err);
      setError(err.message || "Failed to add experiences");
      alert(`Error: ${err.message || "Failed to add experiences"}`);
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
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Add 15 Experience Listings</h1>
          <p className="text-slate-600 mb-4">
            This will add 15 experience listings with host/owner UID: <code className="bg-slate-100 px-2 py-1 rounded">{HOST_UID}</code>
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
              <strong>⚠️ Not logged in:</strong> You must be logged in to add experiences. Please log in first.
            </div>
          )}

          <button
            onClick={handleAddExperiences}
            disabled={loading || !user}
            className="px-6 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 text-white font-semibold shadow-md hover:shadow-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Adding Experiences..." : "Add 15 Experiences"}
          </button>

          {error && (
            <div className="mt-4 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700">
              <strong>Error:</strong> {error}
            </div>
          )}

          {results.length > 0 && (
            <div className="mt-6">
              <h2 className="text-xl font-semibold text-slate-900 mb-3">
                Added Experiences ({results.length}/15)
              </h2>
              <div className="space-y-2 max-h-96 overflow-y-auto">
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

