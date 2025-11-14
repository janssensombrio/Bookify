import React, { useEffect, useState } from "react";
import { X } from "lucide-react";
import { database } from "../../../config/firebase";
import { doc, getDoc } from "firebase/firestore";

export default function HostPoliciesModal({ onClose, onAgree }) {
  const [policies, setPolicies] = useState([
    "Legal Compliance: You'll comply with all local laws, permits, tax obligations, and HOA/building rules that apply to short-term hosting or experiences/services.",
    "Safety: Maintain a safe environment (e.g., working locks, smoke/CO detectors for homes; appropriate equipment and safety briefings for experiences/services).",
    "Accuracy: Your listing details, photos, amenities, pricing, and accessibility information must be accurate and kept up to date.",
    "Cleanliness & Maintenance: Provide a clean, well-maintained space or service that matches guest expectations.",
    "Guest Conduct & House Rules: Clearly disclose your rules (pets, smoking, noise, parties) and enforce them consistently and fairly.",
    "Cancellations & Refunds: Honor your chosen cancellation policy and communicate promptly if issues arise.",
    "Fair Pricing: All fees must be disclosed. No off-platform payments or hidden charges.",
    "Non-Discrimination: Provide equal access and do not discriminate against guests.",
    "Privacy: No hidden cameras or undisclosed monitoring devices. Respect guest data privacy.",
    "Support: Be reachable during bookings and resolve issues in good faith."
  ]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const settingsRef = doc(database, "settings", "hostPolicies");
        const snap = await getDoc(settingsRef);
        if (snap.exists() && snap.data().policies) {
          setPolicies(snap.data().policies);
        }
      } catch (e) {
        console.error("Failed to load policies:", e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="host-policies-title"
      className="fixed inset-0 z-50 flex items-center justify-center px-4 sm:px-0"
      onKeyDown={(e) => e.key === "Escape" && onClose?.()}
    >
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl w-full max-w-lg sm:max-w-md md:max-w-lg p-4 sm:p-6 shadow-lg max-h-[90vh] flex flex-col">
        <h3
          id="host-policies-title"
          className="text-lg sm:text-xl font-semibold mb-3 sm:mb-4 text-gray-800 text-center sm:text-left"
        >
          Hosting Policies & Rules
        </h3>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto text-sm text-gray-700 space-y-3 pr-1 sm:pr-2">
          <p>
            To host on <strong>Bookify</strong>, you agree to follow these baseline policies. 
            These complement local laws and any additional rules you set for your listing.
          </p>

          {loading ? (
            <div className="text-center text-gray-500 py-4">Loading policies...</div>
          ) : (
            <ol className="list-decimal ml-5 space-y-2">
              {policies.map((policy, idx) => (
                <li key={idx}>{policy}</li>
              ))}
            </ol>
          )}

          <p className="pt-2">
            By selecting <strong>Agree</strong>, you acknowledge you’ve read and will follow these policies.
          </p>
        </div>

        {/* Actions */}
        <div className="mt-4 sm:mt-6 flex flex-col sm:flex-row sm:justify-end sm:space-x-3 space-y-3 sm:space-y-0">
          <button
            onClick={onClose}
            className="w-full sm:w-auto px-4 py-2 text-gray-700 bg-gray-200 rounded-full hover:bg-gray-300 transition"
          >
            Close
          </button>

          <button
            onClick={onAgree}
            className="w-full sm:w-auto px-4 py-2 text-white bg-blue-600 rounded-full hover:bg-blue-700 transition"
          >
            Agree
          </button>
        </div>
      </div>
    </div>
  );
}
