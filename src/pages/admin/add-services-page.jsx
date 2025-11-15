// Temporary page to add 15 service listings for the specified host
// Access this page at /admin/add-services

import React, { useState, useEffect } from "react";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { database } from "../../config/firebase";
import { auth } from "../../config/firebase";
import { onAuthStateChanged } from "firebase/auth";

const HOST_UID = "GjPNiHmSP3URUvonqmWjc7hBGSw2";

const services = [
  {
    title: "Math Tutoring Services",
    description: "Professional one-on-one math tutoring for students of all levels. From basic arithmetic to advanced calculus, I provide personalized lessons tailored to your learning style and pace.",
    serviceType: "Tutoring",
    includes: "Personalized lesson plans, practice materials, progress tracking, homework help",
    targetAudience: "Students (elementary to college level)",
    duration: "1 hour",
    recurrence: "Weekly or bi-weekly sessions available",
    price: 800,
    pricingType: "per session",
    discountType: "none",
    discountValue: 0,
    cancellationPolicy: "Free cancellation up to 24 hours before the session.",
    qualifications: "Bachelor's degree in Mathematics, 5+ years teaching experience",
    clientRequirements: "Basic math materials (calculator, notebook), stable internet for online sessions",
    maxParticipants: 1,
    ageRestriction: { min: 8, max: 100 },
    languages: ["English", "Tagalog"],
    locationType: "online",
    address: "",
    schedule: [],
    photos: [],
    category: "Services",
    status: "published",
    uid: HOST_UID,
    hostId: HOST_UID,
    ownerId: HOST_UID,
  },
  {
    title: "Personal Fitness Training",
    description: "Certified personal trainer offering customized workout plans and one-on-one training sessions. Whether you want to lose weight, build muscle, or improve overall fitness, I'll help you reach your goals.",
    serviceType: "Wellness",
    includes: "Custom workout plan, nutrition guidance, progress tracking, motivation and support",
    targetAudience: "Adults looking to improve fitness and health",
    duration: "1 hour",
    recurrence: "Flexible scheduling, recommended 2-3 times per week",
    price: 1200,
    pricingType: "per session",
    discountType: "none",
    discountValue: 0,
    cancellationPolicy: "Free cancellation up to 12 hours before the session.",
    qualifications: "Certified Personal Trainer (CPT), First Aid certified, 3+ years experience",
    clientRequirements: "Comfortable workout clothes, water bottle, gym access or home equipment",
    maxParticipants: 1,
    ageRestriction: { min: 16, max: 100 },
    languages: ["English", "Tagalog"],
    locationType: "in-person",
    address: "Makati City, Metro Manila",
    schedule: [],
    photos: [],
    category: "Services",
    status: "published",
    uid: HOST_UID,
    hostId: HOST_UID,
    ownerId: HOST_UID,
  },
  {
    title: "Professional Photography Services",
    description: "Experienced photographer specializing in portraits, events, and product photography. High-quality images delivered with professional editing. Perfect for weddings, corporate events, or personal portraits.",
    serviceType: "Photography",
    includes: "Photo shoot, professional editing, high-resolution digital images, online gallery",
    targetAudience: "Individuals, couples, families, businesses",
    duration: "2-4 hours (varies by package)",
    recurrence: "One-time or recurring sessions available",
    price: 5000,
    pricingType: "per session",
    discountType: "none",
    discountValue: 0,
    cancellationPolicy: "Free cancellation up to 48 hours before the shoot.",
    qualifications: "Professional photographer, 7+ years experience, portfolio available",
    clientRequirements: "Location access, preferred outfits/items for shoot",
    maxParticipants: 10,
    ageRestriction: { min: 0, max: 100 },
    languages: ["English", "Tagalog"],
    locationType: "in-person",
    address: "Metro Manila (travel available)",
    schedule: [],
    photos: [],
    category: "Services",
    status: "published",
    uid: HOST_UID,
    hostId: HOST_UID,
    ownerId: HOST_UID,
  },
  {
    title: "Business Consulting Services",
    description: "Strategic business consulting to help your company grow and succeed. Services include business planning, market analysis, financial advice, and operational improvements.",
    serviceType: "Consulting",
    includes: "Initial consultation, detailed analysis report, strategic recommendations, follow-up support",
    targetAudience: "Small to medium businesses, startups, entrepreneurs",
    duration: "2-3 hours per session",
    recurrence: "One-time or ongoing consulting available",
    price: 3000,
    pricingType: "per hour",
    discountType: "none",
    discountValue: 0,
    cancellationPolicy: "Free cancellation up to 48 hours before the consultation.",
    qualifications: "MBA, 10+ years business experience, certified business consultant",
    clientRequirements: "Business documents, financial records, clear objectives",
    maxParticipants: 3,
    ageRestriction: { min: 18, max: 100 },
    languages: ["English", "Tagalog"],
    locationType: "online",
    address: "",
    schedule: [],
    photos: [],
    category: "Services",
    status: "published",
    uid: HOST_UID,
    hostId: HOST_UID,
    ownerId: HOST_UID,
  },
  {
    title: "Computer Repair & Maintenance",
    description: "Expert computer repair services for desktops, laptops, and peripherals. Troubleshooting, hardware repairs, software installation, virus removal, and system optimization.",
    serviceType: "Repair",
    includes: "Diagnosis, repair service, parts replacement (if needed), 30-day warranty on repairs",
    targetAudience: "Home users, small businesses, students",
    duration: "1-3 hours (varies by issue)",
    recurrence: "One-time service or maintenance packages available",
    price: 1500,
    pricingType: "per session",
    discountType: "none",
    discountValue: 0,
    cancellationPolicy: "Free cancellation up to 24 hours before the appointment.",
    qualifications: "Certified IT technician, 8+ years experience, A+ certification",
    clientRequirements: "Computer/device to be repaired, backup of important data",
    maxParticipants: 1,
    ageRestriction: { min: 16, max: 100 },
    languages: ["English", "Tagalog"],
    locationType: "in-person",
    address: "Quezon City, Metro Manila (home service available)",
    schedule: [],
    photos: [],
    category: "Services",
    status: "published",
    uid: HOST_UID,
    hostId: HOST_UID,
    ownerId: HOST_UID,
  },
  {
    title: "Yoga & Meditation Classes",
    description: "Peaceful yoga and meditation sessions for all levels. Improve flexibility, reduce stress, and find inner peace. Classes can be one-on-one or small groups.",
    serviceType: "Wellness",
    includes: "Yoga session, meditation guidance, breathing exercises, relaxation techniques",
    targetAudience: "Anyone looking to improve physical and mental wellness",
    duration: "1 hour",
    recurrence: "Weekly classes or one-time sessions available",
    price: 1000,
    pricingType: "per session",
    discountType: "none",
    discountValue: 0,
    cancellationPolicy: "Free cancellation up to 12 hours before the class.",
    qualifications: "Certified Yoga Instructor (200-hour YTT), 5+ years teaching experience",
    clientRequirements: "Yoga mat (can be provided), comfortable clothing, water bottle",
    maxParticipants: 8,
    ageRestriction: { min: 12, max: 100 },
    languages: ["English", "Tagalog"],
    locationType: "in-person",
    address: "Pasig City, Metro Manila",
    schedule: [],
    photos: [],
    category: "Services",
    status: "published",
    uid: HOST_UID,
    hostId: HOST_UID,
    ownerId: HOST_UID,
  },
  {
    title: "English Language Tutoring",
    description: "Professional English tutoring for all levels - from beginners to advanced. Improve your speaking, writing, reading, and listening skills with personalized lessons.",
    serviceType: "Tutoring",
    includes: "Personalized lesson plans, conversation practice, grammar exercises, progress assessments",
    targetAudience: "Students, professionals, anyone wanting to improve English",
    duration: "1 hour",
    recurrence: "Weekly sessions recommended",
    price: 700,
    pricingType: "per session",
    discountType: "none",
    discountValue: 0,
    cancellationPolicy: "Free cancellation up to 24 hours before the session.",
    qualifications: "TESOL certified, Bachelor's in English, 6+ years teaching experience",
    clientRequirements: "Notebook, pen, stable internet for online sessions",
    maxParticipants: 1,
    ageRestriction: { min: 10, max: 100 },
    languages: ["English", "Tagalog"],
    locationType: "online",
    address: "",
    schedule: [],
    photos: [],
    category: "Services",
    status: "published",
    uid: HOST_UID,
    hostId: HOST_UID,
    ownerId: HOST_UID,
  },
  {
    title: "Graphic Design Services",
    description: "Creative graphic design services for logos, branding, social media graphics, flyers, and more. Professional designs that make your brand stand out.",
    serviceType: "Other",
    includes: "Initial consultation, design concepts, revisions, final files in multiple formats",
    targetAudience: "Businesses, entrepreneurs, individuals, organizations",
    duration: "2-5 days per project (varies by complexity)",
    recurrence: "One-time projects or ongoing design support available",
    price: 4000,
    pricingType: "per package",
    discountType: "none",
    discountValue: 0,
    cancellationPolicy: "Free cancellation up to 48 hours after project start.",
    qualifications: "Bachelor's in Graphic Design, 5+ years experience, portfolio available",
    clientRequirements: "Project brief, brand guidelines (if applicable), reference materials",
    maxParticipants: 1,
    ageRestriction: { min: 18, max: 100 },
    languages: ["English", "Tagalog"],
    locationType: "online",
    address: "",
    schedule: [],
    photos: [],
    category: "Services",
    status: "published",
    uid: HOST_UID,
    hostId: HOST_UID,
    ownerId: HOST_UID,
  },
  {
    title: "Massage Therapy",
    description: "Relaxing and therapeutic massage services to relieve stress, muscle tension, and pain. Swedish, deep tissue, and sports massage available.",
    serviceType: "Wellness",
    includes: "Full body massage, aromatherapy (optional), relaxation music, post-massage consultation",
    targetAudience: "Adults seeking relaxation and pain relief",
    duration: "1 hour",
    recurrence: "One-time or regular sessions available",
    price: 1500,
    pricingType: "per session",
    discountType: "none",
    discountValue: 0,
    cancellationPolicy: "Free cancellation up to 12 hours before the appointment.",
    qualifications: "Licensed Massage Therapist, 4+ years experience, certified in multiple techniques",
    clientRequirements: "Comfortable clothing, medical history (if applicable)",
    maxParticipants: 1,
    ageRestriction: { min: 18, max: 100 },
    languages: ["English", "Tagalog"],
    locationType: "in-person",
    address: "Makati City, Metro Manila",
    schedule: [],
    photos: [],
    category: "Services",
    status: "published",
    uid: HOST_UID,
    hostId: HOST_UID,
    ownerId: HOST_UID,
  },
  {
    title: "Web Development Services",
    description: "Professional web development services for businesses and individuals. Custom websites, e-commerce solutions, and web applications built with modern technologies.",
    serviceType: "Other",
    includes: "Website design, development, testing, deployment, 3 months support",
    targetAudience: "Businesses, entrepreneurs, individuals needing websites",
    duration: "2-4 weeks per project",
    recurrence: "One-time projects or ongoing maintenance available",
    price: 15000,
    pricingType: "per package",
    discountType: "none",
    discountValue: 0,
    cancellationPolicy: "Free cancellation up to 7 days after project start.",
    qualifications: "Full-stack developer, 6+ years experience, portfolio available",
    clientRequirements: "Project requirements, content materials, domain/hosting info",
    maxParticipants: 1,
    ageRestriction: { min: 18, max: 100 },
    languages: ["English", "Tagalog"],
    locationType: "online",
    address: "",
    schedule: [],
    photos: [],
    category: "Services",
    status: "published",
    uid: HOST_UID,
    hostId: HOST_UID,
    ownerId: HOST_UID,
  },
  {
    title: "Music Lessons: Piano",
    description: "Learn to play the piano with personalized lessons for all skill levels. From beginners to advanced players, improve your technique and musicality.",
    serviceType: "Tutoring",
    includes: "One-on-one instruction, music theory, practice exercises, performance tips",
    targetAudience: "Children and adults interested in learning piano",
    duration: "45 minutes",
    recurrence: "Weekly lessons recommended",
    price: 1000,
    pricingType: "per session",
    discountType: "none",
    discountValue: 0,
    cancellationPolicy: "Free cancellation up to 24 hours before the lesson.",
    qualifications: "Bachelor's in Music, 8+ years teaching experience, performance background",
    clientRequirements: "Access to piano/keyboard, music books (can be recommended)",
    maxParticipants: 1,
    ageRestriction: { min: 6, max: 100 },
    languages: ["English", "Tagalog"],
    locationType: "in-person",
    address: "Quezon City, Metro Manila",
    schedule: [],
    photos: [],
    category: "Services",
    status: "published",
    uid: HOST_UID,
    hostId: HOST_UID,
    ownerId: HOST_UID,
  },
  {
    title: "Nutrition Counseling",
    description: "Professional nutrition counseling to help you achieve your health goals. Personalized meal plans, dietary analysis, and ongoing support for a healthier lifestyle.",
    serviceType: "Wellness",
    includes: "Initial assessment, personalized meal plan, nutrition education, follow-up consultations",
    targetAudience: "Individuals seeking to improve their diet and health",
    duration: "1 hour per session",
    recurrence: "Initial consultation + follow-up sessions available",
    price: 2000,
    pricingType: "per session",
    discountType: "none",
    discountValue: 0,
    cancellationPolicy: "Free cancellation up to 24 hours before the appointment.",
    qualifications: "Registered Dietitian, Master's in Nutrition, 5+ years experience",
    clientRequirements: "Medical history, current diet log, health goals",
    maxParticipants: 1,
    ageRestriction: { min: 16, max: 100 },
    languages: ["English", "Tagalog"],
    locationType: "online",
    address: "",
    schedule: [],
    photos: [],
    category: "Services",
    status: "published",
    uid: HOST_UID,
    hostId: HOST_UID,
    ownerId: HOST_UID,
  },
  {
    title: "Home Cleaning Services",
    description: "Professional home cleaning services for regular maintenance or deep cleaning. Thorough, reliable, and eco-friendly cleaning products used.",
    serviceType: "Other",
    includes: "Complete home cleaning, kitchen and bathroom deep clean, dusting, vacuuming, mopping",
    targetAudience: "Homeowners, renters, busy professionals",
    duration: "2-4 hours (varies by home size)",
    recurrence: "One-time or regular weekly/monthly cleaning available",
    price: 2000,
    pricingType: "per session",
    discountType: "none",
    discountValue: 0,
    cancellationPolicy: "Free cancellation up to 24 hours before the appointment.",
    qualifications: "5+ years cleaning experience, insured, background checked",
    clientRequirements: "Access to home, cleaning supplies (can be provided)",
    maxParticipants: 2,
    ageRestriction: { min: 18, max: 100 },
    languages: ["English", "Tagalog"],
    locationType: "in-person",
    address: "Metro Manila (travel available)",
    schedule: [],
    photos: [],
    category: "Services",
    status: "published",
    uid: HOST_UID,
    hostId: HOST_UID,
    ownerId: HOST_UID,
  },
  {
    title: "Legal Consultation Services",
    description: "Professional legal consultation for various matters including contracts, business law, family law, and general legal advice. Confidential and reliable service.",
    serviceType: "Consulting",
    includes: "Initial consultation, legal advice, document review, follow-up support",
    targetAudience: "Individuals, businesses, entrepreneurs needing legal guidance",
    duration: "1-2 hours per session",
    recurrence: "One-time or ongoing consultation available",
    price: 4000,
    pricingType: "per hour",
    discountType: "none",
    discountValue: 0,
    cancellationPolicy: "Free cancellation up to 48 hours before the consultation.",
    qualifications: "Licensed Attorney, 10+ years practice, expertise in multiple areas",
    clientRequirements: "Relevant documents, clear description of legal matter",
    maxParticipants: 2,
    ageRestriction: { min: 18, max: 100 },
    languages: ["English", "Tagalog"],
    locationType: "online",
    address: "",
    schedule: [],
    photos: [],
    category: "Services",
    status: "published",
    uid: HOST_UID,
    hostId: HOST_UID,
    ownerId: HOST_UID,
  },
  {
    title: "Pet Grooming Services",
    description: "Professional pet grooming services for dogs and cats. Includes bathing, haircut, nail trimming, ear cleaning, and styling. Your pet will look and feel great!",
    serviceType: "Other",
    includes: "Bath, haircut/styling, nail trim, ear cleaning, brushing, cologne",
    targetAudience: "Pet owners wanting professional grooming for their pets",
    duration: "1-2 hours (varies by pet size and coat type)",
    recurrence: "One-time or regular monthly grooming available",
    price: 1200,
    pricingType: "per session",
    discountType: "none",
    discountValue: 0,
    cancellationPolicy: "Free cancellation up to 24 hours before the appointment.",
    qualifications: "Certified Pet Groomer, 4+ years experience, trained in handling various breeds",
    clientRequirements: "Pet vaccination records, any special instructions or requirements",
    maxParticipants: 1,
    ageRestriction: { min: 0, max: 100 },
    languages: ["English", "Tagalog"],
    locationType: "in-person",
    address: "Pasig City, Metro Manila",
    schedule: [],
    photos: [],
    category: "Services",
    status: "published",
    uid: HOST_UID,
    hostId: HOST_UID,
    ownerId: HOST_UID,
  },
];

export default function AddServicesPage() {
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

  const handleAddServices = async () => {
    if (!user) {
      setError("You must be logged in to add services. Please log in first.");
      alert("You must be logged in to add services.");
      return;
    }

    setLoading(true);
    setError(null);
    setResults([]);

    try {
      const added = [];
      
      for (let i = 0; i < services.length; i++) {
        // Use current user's UID for the 'uid' field (to pass security rules)
        // But set hostId and ownerId to the target host UID
        const service = {
          ...services[i],
          uid: user.uid, // Current logged-in user's UID (required by security rules)
          hostId: HOST_UID, // Target host UID
          ownerId: HOST_UID, // Target host UID
          publishedAt: serverTimestamp(),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };
        
        const docRef = await addDoc(collection(database, "listings"), service);
        added.push({ id: docRef.id, title: service.title, index: i + 1 });
        setResults([...added]);
      }
      
      console.log("✅ Successfully added all 15 services!");
      alert(`Successfully added ${added.length} services!`);
    } catch (err) {
      console.error("Error adding services:", err);
      setError(err.message || "Failed to add services");
      alert(`Error: ${err.message || "Failed to add services"}`);
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
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Add 15 Service Listings</h1>
          <p className="text-slate-600 mb-4">
            This will add 15 service listings with host/owner UID: <code className="bg-slate-100 px-2 py-1 rounded">{HOST_UID}</code>
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
              <strong>⚠️ Not logged in:</strong> You must be logged in to add services. Please log in first.
            </div>
          )}

          <button
            onClick={handleAddServices}
            disabled={loading || !user}
            className="px-6 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 text-white font-semibold shadow-md hover:shadow-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Adding Services..." : "Add 15 Services"}
          </button>

          {error && (
            <div className="mt-4 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700">
              <strong>Error:</strong> {error}
            </div>
          )}

          {results.length > 0 && (
            <div className="mt-6">
              <h2 className="text-xl font-semibold text-slate-900 mb-3">
                Added Services ({results.length}/15)
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

