import React, { useState, useEffect } from "react";
import { database, auth } from '../../../config/firebase';
import { collection, doc, getDocs, updateDoc, deleteDoc } from 'firebase/firestore';
import DeleteConfirmationModal from './delete-confirmation-modal.jsx';
import HostCategModal from '../../../components/host-categ-modal';
import EditHomeModal from "./EditHomeListing.jsx";
import EditExperienceModal from "./EditExperienceListing.jsx";
import ConfirmStatusModal from "./confirm-status-modal.jsx";
import { EditServiceModal } from "./EditServiceListing.jsx";
import { ArrowLeft, ArrowRight, Plus, Check, Edit3, Trash2 } from "lucide-react";

function Listings(props) {
  const [homesList, setHomesList] = useState([]);
  const [showDrafts, setShowDrafts] = useState(props.showDrafts || false);

  const [loading, setLoading] = useState(true);      // ← fetch loading
  const [uiLoading, setUiLoading] = useState(false); // ← quick skeleton on filter change

  const [isCategModalOpen, setIsCategModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedListing, setSelectedListing] = useState(null);

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedToDelete, setSelectedToDelete] = useState(null);

  const [isExperienceEditModalOpen, setIsExperienceEditModalOpen] = useState(false);
  const [isServiceEditModalOpen, setIsServiceEditModalOpen] = useState(false);

  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [statusTarget, setStatusTarget] = useState(null);
  const [statusNewValue, setStatusNewValue] = useState(""); // "draft" | "published"

  const homesCollectionRef = collection(database, 'listings');

  const getHomesList = async () => {
    setLoading(true); // ← start fetch loader
    try {
      const data = await getDocs(homesCollectionRef);
      const filteredData = data.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setHomesList(filteredData);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false); // ← end fetch loader
    }
  };

  useEffect(() => {
    getHomesList();
  }, []);

  const handleDeleteClick = (home) => {
    setSelectedToDelete(home);
    setIsDeleteModalOpen(true);
  };

  const handleEditClick = (listing) => {
    setSelectedListing(listing);

    if (listing.category === "Homes") {
      setIsEditModalOpen(true);
    } else if (listing.category === "Experiences") {
      setIsExperienceEditModalOpen(true);
    } else if (listing.category === "Services") {
      setIsServiceEditModalOpen(true);
    } else {
      alert("Editing is only available for Homes, Experiences, and Services right now.");
    }
  };

  const handleDeleteConfirm = async () => {
    try {
      await deleteDoc(doc(database, "listings", selectedToDelete.id));
      await getHomesList(); // refresh with loader
      setIsDeleteModalOpen(false);
    } catch (err) {
      console.error(err);
      alert("Failed to delete");
    }
  };

  const handleStatusChange = async (item, newStatus) => {
    try {
      const listingRef = doc(database, "listings", item.id);
      await updateDoc(listingRef, { status: newStatus, updatedAt: new Date() });
      await getHomesList(); // refresh with loader
      alert(`Listing ${newStatus === "draft" ? "saved as draft" : "published"} successfully!`);
    } catch (err) {
      console.error(err);
      alert("Failed to update listing status.");
    }
  };

  const handleConfirmStatusChange = async () => {
    if (!statusTarget) return;
    try {
      const listingRef = doc(database, "listings", statusTarget.id);
      await updateDoc(listingRef, { status: statusNewValue, updatedAt: new Date() });
      await getHomesList(); // refresh with loader
      alert(`Listing ${statusNewValue === "draft" ? "saved as draft" : "published"} successfully!`);
    } catch (err) {
      console.error(err);
      alert("Failed to update listing status.");
    } finally {
      setStatusModalOpen(false);
      setStatusTarget(null);
      setStatusNewValue("");
    }
  };

  // Carousel indices per listing id
  const [carouselIndices, setCarouselIndices] = useState({});
  const handlePrevImage = (id) =>
    setCarouselIndices((p) => ({ ...p, [id]: Math.max(0, (p[id] || 0) - 1) }));
  const handleNextImage = (id, n) =>
    setCarouselIndices((p) => ({ ...p, [id]: Math.min(n - 1, (p[id] || 0) + 1) }));

  // Quick skeleton when switching filter pills (All / Published / Drafts)
  useEffect(() => {
    setUiLoading(true);
    const t = setTimeout(() => setUiLoading(false), 350); // subtle shimmer
    return () => clearTimeout(t);
  }, [showDrafts]);

  const filtered = homesList
    .filter((it) => it.uid === auth.currentUser?.uid)
    .filter((it) => {
      if (showDrafts === "draft") return it.status === "draft";
      if (showDrafts === "published") return it.status === "published";
      return true;
    });

  const openCategModal = () => setIsCategModalOpen(true);
  const closeCategModal = () => setIsCategModalOpen(false);

  const showSkeletons = loading || uiLoading;

  return (
    <div className="w-full">
      {/* Header */}
      <div className="max-w-7xl mx-auto mb-8">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div>
            <h2 className="text-3xl font-bold text-foreground">Your Listings</h2>
            <p className="text-muted-foreground mt-1">
              Manage and view all your property, experience, and service listings.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              className={`px-4 h-10 rounded-full border transition ${
                !showDrafts
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-white text-gray-800 border-gray-200 hover:bg-gray-50"
              }`}
              onClick={() => setShowDrafts(false)}
            >
              All Listings
            </button>

            <button
              className={`px-4 h-10 rounded-full border transition ${
                showDrafts === "published"
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-white text-gray-800 border-gray-200 hover:bg-gray-50"
              }`}
              onClick={() => setShowDrafts("published")}
            >
              Published
            </button>

            <button
              className={`px-4 h-10 rounded-full border transition ${
                showDrafts === "draft"
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-white text-gray-800 border-gray-200 hover:bg-gray-50"
              }`}
              onClick={() => setShowDrafts("draft")}
            >
              Drafts
            </button>

            <button
              className="inline-flex items-center gap-2 px-4 h-10 rounded-full bg-blue-600 hover:bg-blue-700 text-white border border-blue-600 shadow"
              onClick={openCategModal}
            >
              <Plus size={18} /> Add New
            </button>
          </div>
        </div>
      </div>

      {/* Loading skeletons */}
      {showSkeletons && (
        <div className="max-w-7xl mx-auto space-y-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="rounded-3xl bg-white/80 border border-white/40 shadow overflow-hidden animate-pulse"
            >
              <div className="grid grid-cols-1 lg:grid-cols-2">
                {/* Left skeleton */}
                <div className="p-6 bg-gray-50/70 border-r border-gray-200/70">
                  <div className="h-6 w-2/3 bg-gray-200 rounded mb-4" />
                  <div className="space-y-2">
                    <div className="h-3 w-3/4 bg-gray-200 rounded" />
                    <div className="h-3 w-2/3 bg-gray-200 rounded" />
                    <div className="h-3 w-1/2 bg-gray-200 rounded" />
                    <div className="h-3 w-5/6 bg-gray-200 rounded" />
                    <div className="h-3 w-2/5 bg-gray-200 rounded" />
                  </div>
                  <div className="mt-6 flex gap-2">
                    <div className="h-9 w-24 bg-gray-200 rounded-xl" />
                    <div className="h-9 w-20 bg-gray-200 rounded-xl" />
                    <div className="h-9 w-28 bg-gray-200 rounded-xl" />
                  </div>
                </div>
                {/* Right skeleton (image) */}
                <div className="h-[220px] sm:h-[280px] md:h-[320px] lg:h-full bg-gray-200/80" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Listings */}
      {!showSkeletons && (
        <div className="max-w-7xl mx-auto space-y-6">
          {filtered.map((item) => {
            const idx = carouselIndices[item.id] || 0;
            const total = item.photos?.length || 0;

            return (
              <div
                key={item.id}
                className="glass rounded-3xl overflow-hidden bg-white/80 border border-white/40 shadow-lg hover:shadow-xl transition"
              >
                <div className="grid grid-cols-1 lg:grid-cols-2">
                  {/* Details */}
                  <div className="p-6 bg-gray-50/70 border-r border-gray-200/70">
                    <div className="flex items-start justify-between gap-4">
                      <h3 className="text-xl font-semibold text-foreground">
                        {item.title || "Untitled Listing"}
                      </h3>
                      <span
                        className={`text-xs px-2 py-1 rounded-full ${
                          item.status === "published"
                            ? "bg-green-100 text-green-700 border border-green-200"
                            : "bg-amber-100 text-amber-700 border border-amber-200"
                        }`}
                      >
                        {item.status || "draft"}
                      </span>
                    </div>

                    <div className="my-3 h-px bg-gray-200" />

                    {/* Category specific details */}
                    <div className="space-y-2 text-sm text-gray-700">
                      {item.category === "Homes" && (
                        <>
                          <p><b>Category:</b> {item.category || "N/A"}</p>
                          <p><b>Listing Type:</b> {item.listingType || "N/A"}</p>
                          <p><b>Property Type:</b> {item.propertyType || "N/A"}</p>
                          <p><b>Description:</b> {item.description || "N/A"}</p>
                          <p>
                            <b>Address:</b>{" "}
                            {[
                              item.street,
                              item.barangay?.name,
                              item.municipality?.name,
                              item.province?.name,
                              item.region?.name,
                            ]
                              .filter(Boolean)
                              .join(", ") || "N/A"}
                          </p>
                          <p>
                            <b>Guests:</b> {item.guests || 0} &nbsp;|&nbsp;
                            <b>Bedrooms:</b> {item.bedrooms || 0} &nbsp;|&nbsp;
                            <b>Beds:</b> {item.beds || 0} &nbsp;|&nbsp;
                            <b>Bathrooms:</b> {item.bathrooms || 0}
                          </p>
                          <p>
                            <b>Amenities:</b>{" "}
                            {item.amenities?.length ? item.amenities.join(", ") : "None"}
                          </p>
                          <p>
                            <b>Price:</b> ₱{item.price || "N/A"} &nbsp;|&nbsp;
                            <b>Cleaning Fee:</b> ₱{item.cleaningFee || "N/A"}
                          </p>
                          <p>
                            <b>Discount:</b>{" "}
                            {item.discountType ? `${item.discountType} (${item.discountValue || 0}%)` : "N/A"}
                          </p>
                          <p>
                            <b>Availability:</b>{" "}
                            {item.availability
                              ? `${item.availability.start} to ${item.availability.end}`
                              : "Not specified"}
                          </p>
                        </>
                      )}

                      {item.category === "Experiences" && (
                        <>
                          <p><b>Title:</b> {item.title || "N/A"}</p>
                          <p><b>Experience Type:</b> {item.experienceType || "N/A"}</p>
                          <p>
                            <b>Location:</b>{" "}
                            {[
                              item.street,
                              item.barangay?.name,
                              item.municipality?.name,
                              item.province?.name,
                              item.region?.name,
                            ]
                              .filter(Boolean)
                              .join(", ") || "N/A"}
                          </p>
                          <p><b>Duration:</b> {item.duration || "N/A"}</p>
                          <p><b>Max Participants:</b> {item.maxParticipants || "N/A"}</p>
                          <p>
                            <b>Age Restriction:</b>{" "}
                            {item.ageRestriction
                              ? `${item.ageRestriction.min} - ${item.ageRestriction.max}`
                              : "None"}
                          </p>
                          <p>
                            <b>Schedule:</b>{" "}
                            {item.schedule?.length
                              ? item.schedule.map((s) => `${s.date} ${s.time}`).join(", ")
                              : "N/A"}
                          </p>
                          <p>
                            <b>Languages:</b>{" "}
                            {item.languages?.length ? item.languages.join(", ") : "None"}
                          </p>
                          <p><b>Price per Participant:</b> ₱{item.price || "N/A"}</p>
                          <p><b>Description:</b> {item.description || "N/A"}</p>
                          <p><b>Host Requirements:</b> {item.hostRequirements || "N/A"}</p>
                          <p><b>Cancellation Policy:</b> {item.cancellationPolicy || "N/A"}</p>
                        </>
                      )}

                      {item.category === "Services" && (
                        <>
                          <p><b>Title:</b> {item.title || "N/A"}</p>
                          <p><b>Service Type:</b> {item.serviceType || "N/A"}</p>
                          <p><b>Target Audience:</b> {item.targetAudience || "N/A"}</p>
                          <p><b>Duration:</b> {item.duration || "N/A"}</p>
                          <p><b>Recurrence:</b> {item.recurrence || "N/A"}</p>
                          <p><b>Max Participants:</b> {item.maxParticipants || "N/A"}</p>
                          {item.schedule?.length > 0 && (
                            <p>
                              <b>Schedule:</b>{" "}
                              {item.schedule.map((s) => `${s.date} at ${s.time}`).join(", ")}
                            </p>
                          )}
                          <p>
                            <b>Age Restriction:</b>{" "}
                            {item.ageRestriction
                              ? `${item.ageRestriction.min} - ${item.ageRestriction.max}`
                              : "None"}
                          </p>
                          <p>
                            <b>Languages:</b>{" "}
                            {item.languages?.length
                              ? item.languages
                                  .map((lang) => (typeof lang === "string" ? lang : lang.name))
                                  .join(", ")
                              : "None"}
                          </p>
                          <p><b>Description:</b> {item.description || "N/A"}</p>
                          <p><b>Includes:</b> {item.includes || "N/A"}</p>
                          <p><b>Qualifications:</b> {item.qualifications || "N/A"}</p>
                          <p><b>Client Requirements:</b> {item.clientRequirements || "N/A"}</p>
                          <p><b>Cancellation Policy:</b> {item.cancellationPolicy || "N/A"}</p>
                          <p>
                            <b>Location:</b>{" "}
                            {item.locationType === "online" ? "Online" : item.address || "N/A"}
                          </p>
                          <p>
                            <b>Price:</b>{" "}
                            {item.price ? `${item.price} (${item.pricingType || "N/A"})` : "N/A"}
                          </p>
                        </>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      <button
                        className="inline-flex items-center gap-2 h-9 px-3 rounded-xl border border-gray-300 bg-white hover:bg-gray-50 text-gray-800"
                        onClick={() => handleEditClick(item)}
                      >
                        <Edit3 size={16} /> Edit
                      </button>

                      <button
                        className="inline-flex items-center gap-2 h-9 px-3 rounded-xl border border-red-200 bg-white text-red-600 hover:bg-red-50"
                        onClick={() => handleDeleteClick(item)}
                      >
                        <Trash2 size={16} /> Delete
                      </button>

                      {item.status === "published" && (
                        <button
                          className="inline-flex items-center gap-2 h-9 px-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-white"
                          onClick={() => {
                            setStatusTarget(item);
                            setStatusNewValue("draft");
                            setStatusModalOpen(true);
                          }}
                        >
                          Save as Draft
                        </button>
                      )}
                      {item.status === "draft" && (
                        <button
                          className="inline-flex items-center gap-2 h-9 px-3 rounded-xl bg-green-600 hover:bg-green-700 text-white"
                          onClick={() => {
                            setStatusTarget(item);
                            setStatusNewValue("published");
                            setStatusModalOpen(true);
                          }}
                        >
                          <Check size={16} /> Publish
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Media */}
                  <div className="relative bg-gray-100">
                    {total > 0 ? (
                      <div className="relative h-[280px] sm:h-[360px] md:h-[420px] lg:h-full">
                        {/* image */}
                        <img
                          src={item.photos[idx]}
                          alt={`Photo ${idx + 1}`}
                          className="absolute inset-0 w-full h-full object-cover"
                        />

                        {/* controls */}
                        {total > 1 && (
                          <>
                            <button
                              onClick={() => handlePrevImage(item.id)}
                              disabled={idx === 0}
                              className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-white/90 border border-gray-200 shadow p-2 disabled:opacity-50"
                            >
                              <ArrowLeft size={18} />
                            </button>
                            <button
                              onClick={() => handleNextImage(item.id, total)}
                              disabled={idx === total - 1}
                              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-white/90 border border-gray-200 shadow p-2 disabled:opacity-50"
                            >
                              <ArrowRight size={18} />
                            </button>
                            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 text-xs px-2 py-1 rounded-full bg-black/60 text-white">
                              {idx + 1} / {total}
                            </div>
                          </>
                        )}
                      </div>
                    ) : (
                      <div className="h-[220px] sm:h-[280px] md:h-[320px] lg:h-full w-full grid place-items-center text-sm text-muted-foreground">
                        No photos available
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Empty state */}
      {!showSkeletons && filtered.length === 0 && (
        <p className="text-center text-muted-foreground mt-6">
          {showDrafts === "draft"
            ? "No draft listings available."
            : showDrafts === "published"
            ? "No published listings available."
            : "No listings available."}
        </p>
      )}

      {/* Modals (unchanged functionality) */}
      {isEditModalOpen && selectedListing && (
        <EditHomeModal
          open={isEditModalOpen}
          listing={selectedListing}
          onClose={() => setIsEditModalOpen(false)}
          refreshList={getHomesList}
          onSave={async (updatedData) => {
            try {
              const listingRef = doc(database, "listings", selectedListing.id);
              await updateDoc(listingRef, { ...updatedData, updatedAt: new Date() });
              await getHomesList();
              setIsEditModalOpen(false);
              alert("Listing updated successfully!");
            } catch (error) {
              console.error("Error updating listing:", error);
              alert("Failed to update listing.");
            }
          }}
        />
      )}

      {isExperienceEditModalOpen && selectedListing && (
        <EditExperienceModal
          listingId={selectedListing.id}
          onClose={() => setIsExperienceEditModalOpen(false)}
          refreshList={getHomesList}
        />
      )}

      {isServiceEditModalOpen && selectedListing && (
        <EditServiceModal
          open={isServiceEditModalOpen}
          listingData={selectedListing}
          onClose={() => setIsServiceEditModalOpen(false)}
          refreshList={getHomesList} // modal will call this after upload/save
        />
      )}

      <ConfirmStatusModal
        open={statusModalOpen}
        onClose={() => setStatusModalOpen(false)}
        onConfirm={handleConfirmStatusChange}
        newStatus={statusNewValue}
        listingTitle={statusTarget?.title}
      />

      <DeleteConfirmationModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onDelete={handleDeleteConfirm}
        itemName={selectedToDelete?.title}
      />

      {isCategModalOpen && (
        <HostCategModal
          onClose={closeCategModal}
          onSelectCategory={(category) => {
            closeCategModal();
            if (category === "Homes") {
              window.location.href = "/host-set-up";
            } else if (category === "Experiences") {
              window.location.href = "/host-set-up-2";
            } else if (category === "Services") {
              window.location.href = "/host-set-up-3";
            }
          }}
        />
      )}
    </div>
  );
}

export default Listings;
