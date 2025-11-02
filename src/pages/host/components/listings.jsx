import React, { useState, useEffect } from "react";
import { database, auth } from '../../../config/firebase';
import { collection, doc, getDocs, updateDoc, deleteDoc } from 'firebase/firestore';
import DeleteConfirmationModal from './delete-confirmation-modal.jsx';
import HostCategModal from '../../../components/host-categ-modal';
import EditHomeModal from "./EditHomeListing.jsx";
import EditExperienceModal from "./EditExperienceListing.jsx";
import ConfirmStatusModal from "./confirm-status-modal.jsx";
import { EditServiceModal } from "./EditServiceListing.jsx";
import { ArrowLeft, ArrowRight, Plus, Check, Edit3, Trash2, Archive, ChevronDown, MapPin, Banknote, Video } from "lucide-react";

/**
 * Separate Archive modal to avoid reusing the Publish/Draft confirmation copy.
 * Keeps UX explicit: Archive has its own wording and confirm button label.
 */
function ArchiveConfirmationModal({ open, onClose, onConfirm, listingTitle }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" onClick={onClose} />

      {/* Card */}
      <div className="relative z-10 w-full sm:w-[520px]">
        <div className="mx-3 sm:mx-0 rounded-2xl bg-gradient-to-b from-white to-slate-50 border border-slate-200/70 shadow-[0_10px_30px_rgba(2,6,23,0.12),inset_0_1px_0_rgba(255,255,255,0.6)] p-6">
          {/* Header */}
          <div className="flex items-start gap-4">
            <div className="shrink-0 grid place-items-center w-12 h-12 rounded-2xl bg-gradient-to-b from-slate-600 to-slate-800 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.2),0_8px_20px_rgba(2,6,23,0.35)] ring-1 ring-white/10">
              <Archive size={20} className="text-white" />
            </div>
            <div className="flex-1">
              <h3 className="text-xl font-semibold tracking-tight text-slate-900">Archive listing?</h3>
              <p className="text-sm text-slate-600 mt-1">
                Are you sure you want to archive <b className="text-slate-900">{listingTitle || 'this listing'}</b>? You can find it under <b className="text-slate-900">Archived</b> and publish it again anytime.
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="mt-6 flex items-center justify-end gap-3">
            <button
              onClick={onClose}
              className="group relative h-10 px-4 rounded-xl border border-slate-200 bg-white text-slate-700 shadow-[inset_0_-2px_0_rgba(2,6,23,0.05),0_4px_10px_rgba(2,6,23,0.06)] hover:shadow-[inset_0_-2px_0_rgba(2,6,23,0.05),0_6px_16px_rgba(2,6,23,0.1)] hover:bg-slate-50 active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400/50 transition"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              className="group relative h-10 px-4 rounded-xl text-white bg-gradient-to-b from-slate-700 to-slate-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.2),0_8px_16px_rgba(2,6,23,0.35)] hover:from-slate-600 hover:to-slate-800 active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400/60 transition inline-flex items-center gap-2"
            >
              <Archive size={16} className="opacity-90" />
              Archive
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Listings(props) {
  const [homesList, setHomesList] = useState([]);
  const [showDrafts, setShowDrafts] = useState(props.showDrafts || false); // false | "published" | "draft" | "archived"

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

  // NEW: dedicated archive modal state
  const [archiveModalOpen, setArchiveModalOpen] = useState(false);
  const [archiveTarget, setArchiveTarget] = useState(null);

  const [filterOpen, setFilterOpen] = useState(false); // mobile dropdown

  const homesCollectionRef = collection(database, 'listings');

  // ...
  const isOnline = (it) =>
    String(it.serviceType || it.experienceType || "").trim().toLowerCase() === "online";

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

  // Keep for programmatic calls; generalized messaging for publish/draft
  const handleStatusChange = async (item, newStatus) => {
    try {
      const listingRef = doc(database, "listings", item.id);
      await updateDoc(listingRef, { status: newStatus, updatedAt: new Date() });
      await getHomesList(); // refresh with loader
      alert(
        newStatus === "published"
          ? "Listing published successfully!"
          : newStatus === "draft"
          ? "Listing saved as draft successfully!"
          : newStatus === "archived"
          ? "Listing archived successfully!"
          : "Listing status updated."
      );
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
      alert(
        statusNewValue === "published"
          ? "Listing published successfully!"
          : statusNewValue === "draft"
          ? "Listing saved as draft successfully!"
          : statusNewValue === "archived"
          ? "Listing archived successfully!"
          : "Listing status updated."
      );
    } catch (err) {
      console.error(err);
      alert("Failed to update listing status.");
    } finally {
      setStatusModalOpen(false);
      setStatusTarget(null);
      setStatusNewValue("");
    }
  };

  // NEW: dedicated archive handler
  const handleConfirmArchive = async () => {
    if (!archiveTarget) return;
    try {
      const listingRef = doc(database, "listings", archiveTarget.id);
      await updateDoc(listingRef, { status: "archived", updatedAt: new Date() });
      await getHomesList();
      alert("Listing archived successfully!");
    } catch (err) {
      console.error(err);
      alert("Failed to archive listing.");
    } finally {
      setArchiveModalOpen(false);
      setArchiveTarget(null);
    }
  };

  // Carousel indices per listing id
  const [carouselIndices, setCarouselIndices] = useState({});
  const handlePrevImage = (id) =>
    setCarouselIndices((p) => ({ ...p, [id]: Math.max(0, (p[id] || 0) - 1) }));
  const handleNextImage = (id, n) =>
    setCarouselIndices((p) => ({ ...p, [id]: Math.min(n - 1, (p[id] || 0) + 1) }));

  // Quick skeleton when switching filter pills (All / Published / Drafts / Archived)
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
      if (showDrafts === "archived") return it.status === "archived";
      return true; // All
    });

  const openCategModal = () => setIsCategModalOpen(true);
  const closeCategModal = () => setIsCategModalOpen(false);

  const showSkeletons = loading || uiLoading;

  const statusLabel = showDrafts === false ? 'All' :
    showDrafts === 'published' ? 'Published' :
    showDrafts === 'draft' ? 'Drafts' : 'Archived';

  // Helpers for card footer subtitle
  const getSubtitle = (item) => {
    const serviceType = String(item.serviceType || "").trim().toLowerCase();
    const experienceType = String(item.experienceType || "").trim().toLowerCase();

    // If this listing is online (via serviceType or experienceType), show the service type label
    if (serviceType === "online" || experienceType === "online") {
      // Prefer the exact casing provided by your data
      return item.serviceType || item.experienceType || "Online";
    }

    // Existing Services behavior (non-online)
    if (item.category === "Services") {
      return item.serviceType || "Service";
    }

    // Default: show location (with your existing fallbacks)
    const loc = (item.location || "").trim();
    return loc || item.municipality?.name || item.province?.name || "Location";
  };

  const formatPeso = (v) => {
    const n = Number(v || 0);
    if (!n) return null;
    return `₱${n.toLocaleString()}`;
  };

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
            {/* Pills on md+ */}
            <div className="hidden md:flex items-center gap-3">
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
                className={`px-4 h-10 rounded-full border transition ${
                  showDrafts === "archived"
                    ? "bg-blue-600 text-white border-blue-600"
                    : "bg-white text-gray-800 border-gray-200 hover:bg-gray-50"
                }`}
                onClick={() => setShowDrafts("archived")}
              >
                Archived
              </button>
            </div>

            {/* Mobile dropdown */}
            <div className="relative md:hidden">
              <button
                className="inline-flex items-center gap-2 px-4 h-10 rounded-full border border-gray-200 bg-white hover:bg-gray-50 text-gray-800 shadow-sm"
                onClick={() => setFilterOpen((v) => !v)}
              >
                Status: {statusLabel} <ChevronDown size={16} />
              </button>
              {filterOpen && (
                <div className="fixed inset-0 z-50" aria-modal>
                  {/* Backdrop */}
                  <div
                    className="absolute inset-0 bg-black/40"
                    onClick={() => setFilterOpen(false)}
                  />
                  {/* Bottom sheet */}
                  <div className="fixed bottom-4 left-4 right-4 rounded-2xl border border-gray-200 bg-white shadow-xl">
                    <div className="p-1">
                      {[
                        { label: 'All', value: false },
                        { label: 'Published', value: 'published' },
                        { label: 'Drafts', value: 'draft' },
                        { label: 'Archived', value: 'archived' },
                      ].map((opt) => (
                        <button
                          key={String(opt.value)}
                          className={`w-full text-left px-4 py-3 rounded-xl text-sm hover:bg-gray-50 ${
                            showDrafts === opt.value ? 'bg-gray-50' : ''
                          }`}
                          onClick={() => { setShowDrafts(opt.value); setFilterOpen(false); }}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

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
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-64 rounded-3xl bg-white/80 border border-white/40 shadow overflow-hidden animate-pulse"
            />
          ))}
        </div>
      )}

      {/* Listings — redesigned as responsive 3D cards */}
      {!showSkeletons && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          {filtered.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-3 gap-4 sm:gap-6">
              {filtered.map((item) => {
                const idx = carouselIndices[item.id] || 0;
                const total = item.photos?.length || 0;
                const img = total > 0 ? item.photos[idx] : null;
                const subtitle = getSubtitle(item);
                const priceText = formatPeso(item.price);

                return (
                  <div key={item.id} className="group">
                    {/* Card */}
                    <div className="relative rounded-[28px] overflow-hidden bg-gradient-to-b from-white to-slate-50 border border-slate-200 shadow-[0_12px_28px_rgba(2,6,23,0.10),inset_0_1px_0_rgba(255,255,255,0.6)] transition-all duration-300 hover:-translate-y-1.5 hover:shadow-[0_24px_48px_rgba(2,6,23,0.18)]">
                      {/* Image */}
                      <div className="relative h-48 sm:h-56 md:h-60 overflow-hidden">
                        {img ? (
                          <img
                            src={img}
                            alt={item.title || 'Listing image'}
                            className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 will-change-transform group-hover:scale-[1.06]"
                          />
                        ) : (
                          <div className="absolute inset-0 grid place-items-center text-sm text-slate-500 bg-slate-100">No photo</div>
                        )}
                        {/* Status badge */}
                        <div className="absolute top-3 left-3 text-[11px] px-2 py-1 rounded-full backdrop-blur bg-white/70 border border-white/80 shadow">
                          <span className={
                            item.status === 'published'
                              ? 'text-green-700'
                              : item.status === 'archived'
                              ? 'text-slate-700'
                              : 'text-amber-700'
                          }>
                            {item.status || 'draft'}
                          </span>
                        </div>

                        {/* Carousel controls */}
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

                        {/* sheen */}
                        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-transparent" />
                      </div>

                      {/* Content */}
                      <div className="p-5 pt-6 flex flex-col min-h-[160px] sm:min-h-[180px] md:min-h-[190px]">
                        <h3 className="font-semibold text-base sm:text-lg text-slate-900 truncate">
                          {item.title || 'Untitled Listing'}
                        </h3>
                        <p className="text-sm text-slate-600 line-clamp-2 mt-1">
                          {item.description || 'No description available.'}
                        </p>

                        {/* Footer info */}
                        <div className="mt-auto pt-3 flex items-end justify-between gap-3">
                          <div className="min-w-0 flex items-center gap-2">
                            <span className="shrink-0 rounded-xl p-2 bg-slate-100 text-slate-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.6)]">
                              {isOnline(item) ? <Video size={16} /> : <MapPin size={16} />}
                            </span>
                            <p className="text-sm font-medium text-slate-800 truncate" title={subtitle}>{subtitle}</p>
                          </div>

                          {priceText && (
                            <div className="flex items-center gap-2">
                              <span className="shrink-0 rounded-xl p-2 bg-blue-50 text-blue-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.6)]">
                                <Banknote size={16} />
                              </span>
                              <p className="text-base font-bold bg-gradient-to-b from-blue-600 to-indigo-700 bg-clip-text text-transparent drop-shadow-[0_1px_0_rgba(255,255,255,0.3)]">
                                {priceText}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Actions (kept below the card) */}
                    <div className="mt-3 grid grid-cols-2 sm:flex sm:flex-wrap lg:flex-nowrap sm:items-center gap-2">
                      <button
                        className="inline-flex items-center justify-center gap-2 h-10 px-4 rounded-xl border border-gray-300 bg-white hover:bg-gray-50 text-gray-800 shadow-sm w-full sm:w-auto"
                        onClick={() => handleEditClick(item)}
                      >
                        <Edit3 size={16} /> Edit
                      </button>

                      <button
                        className="inline-flex items-center justify-center gap-2 h-10 px-4 rounded-xl border border-red-200 bg-white text-red-600 hover:bg-red-50 shadow-sm w-full sm:w-auto"
                        onClick={() => handleDeleteClick(item)}
                      >
                        <Trash2 size={16} /> Delete
                      </button>

                      {item.status === 'published' && (
                        <button
                          className="inline-flex items-center justify-center gap-2 h-10 px-4 rounded-xl bg-slate-600 hover:bg-slate-700 text-white shadow-sm w-full sm:w-auto"
                          onClick={() => {
                            setArchiveTarget(item);
                            setArchiveModalOpen(true);
                          }}
                        >
                          <Archive size={16} /> Archive
                        </button>
                      )}

                      {item.status === 'draft' && (
                        <button
                          className="inline-flex items-center justify-center gap-2 h-10 px-4 rounded-xl bg-green-600 hover:bg-green-700 text-white shadow-sm w-full sm:w-auto"
                          onClick={() => {
                            setStatusTarget(item);
                            setStatusNewValue('published');
                            setStatusModalOpen(true);
                          }}
                        >
                          <Check size={16} /> Publish
                        </button>
                      )}

                      {item.status === 'archived' && (
                        <button
                          className="inline-flex items-center justify-center gap-2 h-10 px-4 rounded-xl bg-green-600 hover:bg-green-700 text-white shadow-sm w-full sm:w-auto"
                          onClick={() => {
                            setStatusTarget(item);
                            setStatusNewValue('published');
                            setStatusModalOpen(true);
                          }}
                        >
                          <Check size={16} /> Publish
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-center text-muted-foreground mt-6">No listings available.</p>
          )}
        </div>
      )}

      {/* Empty state (kept for explicit filtered views) */}
      {!showSkeletons && filtered.length === 0 && (
        <p className="text-center text-muted-foreground mt-6">
          {showDrafts === "draft"
            ? "No draft listings available."
            : showDrafts === "published"
            ? "No published listings available."
            : showDrafts === "archived"
            ? "No archived listings available."
            : "No listings available."}
        </p>
      )}

      {/* Modals */}
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

      {selectedListing && (
        <EditExperienceModal
          open={isExperienceEditModalOpen}
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
          refreshList={getHomesList} 
        />
      )}

      {/* Existing status modal for Publish/Draft */}
      <ConfirmStatusModal
        open={statusModalOpen}
        onClose={() => setStatusModalOpen(false)}
        onConfirm={handleConfirmStatusChange}
        newStatus={statusNewValue}
        listingTitle={statusTarget?.title}
      />

      {/* New, dedicated Archive modal */}
      <ArchiveConfirmationModal
        open={archiveModalOpen}
        onClose={() => setArchiveModalOpen(false)}
        onConfirm={handleConfirmArchive}
        listingTitle={archiveTarget?.title}
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
