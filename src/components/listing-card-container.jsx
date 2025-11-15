import React, { useEffect, useState } from "react";
import { Heart, MapPin, Banknote, Video, Percent, Star } from "lucide-react";
import { auth, database } from "../config/firebase";
import { useNavigate } from "react-router-dom";
import {
  doc,
  setDoc,
  deleteDoc,
  getDocs,
  collection,
  query,
  where,
} from "firebase/firestore";

/**
 * ListingCardContainer — now all categories navigate to pages
 * - Homes:        /homes/:listingId
 * - Experiences:  /experiences/:listingId
 * - Services:     /services/:listingId
 */

// Stars component for ratings
const Stars = ({ value = 0, size = 14 }) => {
  const v = Math.max(0, Math.min(5, Number(value) || 0));
  return (
    <span className="inline-flex items-center" aria-label={`${v.toFixed(1)} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          width={size}
          height={size}
          className={i <= v ? "text-amber-500 fill-amber-500" : "text-slate-300"}
          stroke="currentColor"
          fill={i <= v ? "currentColor" : "none"}
        />
      ))}
    </span>
  );
};

const ListingCardContainer = ({ category, items, hideTitle = false }) => {
  const navigate = useNavigate();

  const [favorites, setFavorites] = useState([]);
  const [activePromos, setActivePromos] = useState([]);
  const [listingRatings, setListingRatings] = useState({}); // { listingId: { avg, count } }
  const publishedItems = items?.filter((i) => i.status === "published") || [];

  const user = auth.currentUser;

  useEffect(() => {
    if (!user) return;
    const fetchFavorites = async () => {
      const favRef = collection(database, "favorites");
      const q = query(favRef, where("userId", "==", user.uid));
      const snapshot = await getDocs(q);
      const favIds = snapshot.docs.map((doc) => doc.data().listingId);
      setFavorites(favIds);
    };
    fetchFavorites();
  }, [user]);

  // Fetch active promos
  useEffect(() => {
    let cancelled = false;
    async function fetchPromos() {
      try {
        const today = new Date().toISOString().slice(0, 10);
        const promosRef = collection(database, "promos");
        const q = query(promosRef, where("status", "==", "active"));
        const snapshot = await getDocs(q);
        const promos = snapshot.docs
          .map((doc) => ({ id: doc.id, ...doc.data() }))
          .filter((p) => {
            const startsAt = p.startsAt || "";
            const endsAt = p.endsAt || "";
            return (!startsAt || startsAt <= today) && (!endsAt || endsAt >= today);
          });
        if (!cancelled) setActivePromos(promos);
      } catch (e) {
        console.warn("Failed to load promos:", e);
        if (!cancelled) setActivePromos([]);
      }
    }
    fetchPromos();
    return () => {
      cancelled = true;
    };
  }, []);

  // Fetch ratings for all listings
  useEffect(() => {
    let cancelled = false;
    async function fetchRatings() {
      if (!publishedItems.length) {
        if (!cancelled) setListingRatings({});
        return;
      }
      try {
        const ratingsMap = {};
        // Try to fetch from main reviews collection first
        const listingIds = publishedItems.map((item) => item.id).filter(Boolean);
        if (listingIds.length > 0) {
          // Firestore 'in' query limit is 10, so we need to batch
          const batches = [];
          for (let i = 0; i < listingIds.length; i += 10) {
            batches.push(listingIds.slice(i, i + 10));
          }
          for (const batch of batches) {
            const q = query(collection(database, "reviews"), where("listingId", "in", batch));
            const snapshot = await getDocs(q);
            snapshot.forEach((doc) => {
              const data = doc.data();
              const lid = data?.listingId;
              const rating = Number(data?.rating) || 0;
              if (lid && rating > 0) {
                if (!ratingsMap[lid]) {
                  ratingsMap[lid] = { sum: 0, count: 0 };
                }
                ratingsMap[lid].sum += rating;
                ratingsMap[lid].count += 1;
              }
            });
          }
        }
        // Also try subcollection pattern (listings/{id}/reviews)
        await Promise.all(
          publishedItems.map(async (item) => {
            if (ratingsMap[item.id]) return; // Already have data
            try {
              const subRef = collection(database, "listings", item.id, "reviews");
              const subSnap = await getDocs(subRef);
              if (!subSnap.empty) {
                let sum = 0;
                let count = 0;
                subSnap.forEach((doc) => {
                  const rating = Number(doc.data()?.rating) || 0;
                  if (rating > 0) {
                    sum += rating;
                    count += 1;
                  }
                });
                if (count > 0) {
                  ratingsMap[item.id] = { sum, count };
                }
              }
            } catch (e) {
              // Subcollection might not exist, that's okay
            }
          })
        );
        // Convert to final format
        const finalRatings = {};
        Object.keys(ratingsMap).forEach((lid) => {
          const { sum, count } = ratingsMap[lid];
          finalRatings[lid] = {
            avg: count > 0 ? sum / count : 0,
            count,
          };
        });
        // Also check if listings have rating/reviewCount fields
        publishedItems.forEach((item) => {
          if (!finalRatings[item.id]) {
            const rating = Number(item.rating) || 0;
            const reviewCount = Number(item.reviewCount) || 0;
            if (rating > 0 && reviewCount > 0) {
              finalRatings[item.id] = { avg: rating, count: reviewCount };
            }
          }
        });
        if (!cancelled) setListingRatings(finalRatings);
      } catch (e) {
        console.warn("Failed to load ratings:", e);
        if (!cancelled) setListingRatings({});
      }
    }
    fetchRatings();
    return () => {
      cancelled = true;
    };
  }, [publishedItems]);

  const toggleFavorite = async (listingId) => {
    if (!user) return;

    const favRef = doc(database, "favorites", `${user.uid}_${listingId}`);

    if (favorites.includes(listingId)) {
      await deleteDoc(favRef);
      setFavorites((favs) => favs.filter((id) => id !== listingId));
    } else {
      await setDoc(favRef, {
        uid: user.uid,
        userId: user.uid,
        listingId: listingId,
        createdAt: new Date(),
      });
      setFavorites((favs) => [...favs, listingId]);
    }
  };

  const getSubtitle = (item) => {
    const serviceType = String(item.serviceType || "").trim().toLowerCase();
    const experienceType = String(item.experienceType || "").trim().toLowerCase();
    if (serviceType === "online" || experienceType === "online") {
      return item.serviceType || item.experienceType || "Online";
    }
    if (item.category === "Services") {
      return item.locationType || "Service";
    }
    const loc = (item.location || "").trim();
    return loc || item.municipality?.name || item.province?.name || "Location";
  };

  const formatPeso = (v) => {
    const n = Number(v || 0);
    if (!n) return null;
    return `₱${n.toLocaleString()}`;
  };

  const hasDiscount = (item) => {
    const discountType = String(item.discountType || "").toLowerCase();
    const discountValue = Number(item.discountValue || 0);
    return (discountType === "percentage" || discountType === "fixed") && discountValue > 0;
  };

  const getDiscountLabel = (item) => {
    const discountType = String(item.discountType || "").toLowerCase();
    const discountValue = Number(item.discountValue || 0);
    if (discountType === "percentage") {
      return `${Math.min(100, Math.max(0, discountValue))}% OFF`;
    } else if (discountType === "fixed") {
      return `₱${discountValue.toLocaleString()} OFF`;
    }
    return "On Sale";
  };

  const getPromoForListing = (item) => {
    const listingId = String(item.id || "");
    const applicablePromos = activePromos.filter((p) => {
      const appliesTo = String(p.appliesTo || "").toLowerCase();
      if (appliesTo === "all") return true;
      if (appliesTo === "listings" || appliesTo === "selected") {
        const listingIds = Array.isArray(p.listingIds) ? p.listingIds.map(String) : [];
        return listingIds.includes(listingId);
      }
      return false;
    });
    // Return the best promo (highest value)
    if (applicablePromos.length === 0) return null;
    return applicablePromos.reduce((best, current) => {
      const bestValue = Number(best.discountValue || best.value || 0);
      const currentValue = Number(current.discountValue || current.value || 0);
      return currentValue > bestValue ? current : best;
    });
  };

  const getPromoLabel = (promo) => {
    if (!promo) return null;
    const type = String(promo.discountType || promo.type || "").toLowerCase();
    const value = Number(promo.discountValue || promo.value || 0);
    if (type === "percentage") {
      return `${Math.min(100, Math.max(0, value))}% OFF`;
    } else if (type === "fixed") {
      return `₱${value.toLocaleString()} OFF`;
    }
    return promo.title || "Promo";
  };

  const getCombinedDiscount = (item) => {
    const promo = getPromoForListing(item);
    const hasListingDiscount = hasDiscount(item);
    
    if (!promo && !hasListingDiscount) return null;
    
    const promoType = promo ? String(promo.discountType || promo.type || "").toLowerCase() : null;
    const promoValue = promo ? Number(promo.discountValue || promo.value || 0) : 0;
    const listingDiscountType = hasListingDiscount ? String(item.discountType || "").toLowerCase() : null;
    const listingDiscountValue = hasListingDiscount ? Number(item.discountValue || 0) : 0;
    
    // If both are percentage, add them (capped at 100%)
    if (promoType === "percentage" && listingDiscountType === "percentage") {
      const combined = Math.min(100, promoValue + listingDiscountValue);
      return `${combined}% OFF`;
    }
    
    // If both are fixed, add them
    if (promoType === "fixed" && listingDiscountType === "fixed") {
      return `₱${(promoValue + listingDiscountValue).toLocaleString()} OFF`;
    }
    
    // If one is percentage and one is fixed, show both
    if (promo && hasListingDiscount) {
      const promoLabel = getPromoLabel(promo);
      const discountLabel = getDiscountLabel(item);
      // Show both labels combined
      if (promoType === "percentage" && listingDiscountType === "fixed") {
        return `${promoLabel} + ${discountLabel}`;
      } else if (promoType === "fixed" && listingDiscountType === "percentage") {
        return `${discountLabel} + ${promoLabel}`;
      }
    }
    
    // If only one exists, return its label
    if (promo) return getPromoLabel(promo);
    if (hasListingDiscount) return getDiscountLabel(item);
    
    return null;
  };

  const isOnline = (it) =>
    String(it.locationType || it.experienceType || "").trim().toLowerCase() === "online";

  // Navigate to the correct page for the current section
  const onCardClick = (item) => {
    const pathMap = { Homes: "homes", Experiences: "experiences", Services: "services" };
    const base = pathMap[category];
    if (base) navigate(`/${base}/${item.id}`);
  };

  return (
    <div className={hideTitle ? "" : "px-4 sm:px-6 lg:px-8 pt-8"}>
      {!hideTitle && (
        <div className="text-left mb-6">
          <h2 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-blue-500 to-indigo-600 bg-clip-text text-transparent drop-shadow-sm">
            {category}
          </h2>
          <p className="text-muted-foreground text-sm mt-1">
            Discover our curated {category.toLowerCase()} just for you.
          </p>
        </div>
      )}

      {publishedItems.length > 0 ? (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
          {publishedItems.map((item) => {
            const img = item.photos?.[0] || item.photos?.[1] || "/placeholder.jpg";
            const priceText = formatPeso(item.price);
            const subtitle = getSubtitle(item);

            return (
              <div
                key={item.id}
                onClick={() => onCardClick(item)}
                className="relative cursor-pointer rounded-3xl overflow-hidden bg-gradient-to-b from-white to-slate-50 border border-slate-200 shadow-[0_10px_30px_rgba(2,6,23,0.08),inset_0_1px_0_rgba(255,255,255,0.6)] transition-all duration-300 hover:-translate-y-1.5 hover:shadow-[0_22px_45px_rgba(2,6,23,0.15)] group transform-gpu"
                style={{ isolation: "isolate" }}
              >
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleFavorite(item.id);
                  }}
                  aria-label="Toggle favorite"
                  className="absolute top-3 right-3 z-20 grid place-items-center w-9 h-9 rounded-full backdrop-blur bg-black/30 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.2),0_6px_16px_rgba(0,0,0,0.25)] hover:bg-black/45 active:scale-95 transition"
                >
                  <Heart
                    size={18}
                    className={`transition-transform duration-200 ${
                      favorites.includes(item.id)
                        ? "fill-red-500 text-red-500 scale-110"
                        : "text-white"
                    }`}
                  />
                </button>

                <div className="relative h-52 w-full overflow-hidden">
                  <img
                    src={img}
                    alt={item.title || "Listing image"}
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.07] will-change-transform"
                  />
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
                  
                  {/* Combined Promo + Discount badge */}
                  {(() => {
                    const combinedLabel = getCombinedDiscount(item);
                    if (combinedLabel) {
                      return (
                        <div className="absolute top-3 left-3 inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-blue-600 to-emerald-600 text-white px-3 py-1 text-xs font-bold shadow-lg z-10">
                          <Percent className="w-3.5 h-3.5" />
                          {combinedLabel}
                        </div>
                      );
                    }
                    return null;
                  })()}
                </div>

                <div className="p-5 pt-6 flex flex-col min-h-[190px] rounded-[24px] bg-white/70 shadow-[inset_0_1px_0_rgba(255,255,255,0.6)]">
                  <h3 className="font-semibold text-lg text-slate-900 truncate">
                    {item.title || "Untitled Listing"}
                  </h3>
                  <p className="text-sm text-slate-600 line-clamp-2 mt-1">
                    {item.description || "No description available."}
                  </p>

                  {/* Ratings summary */}
                  {(() => {
                    const rating = listingRatings[item.id];
                    if (rating && rating.count > 0) {
                      return (
                        <div className="mt-3 flex items-center gap-2">
                          <Stars value={rating.avg} size={14} />
                          <span className="text-xs sm:text-sm font-medium text-slate-700">
                            <span className="font-semibold">{rating.avg.toFixed(1)}</span>
                            <span className="text-slate-500 ml-1">
                              ({rating.count} {rating.count === 1 ? "review" : "reviews"})
                            </span>
                          </span>
                        </div>
                      );
                    }
                    return null;
                  })()}

                  <div className="mt-auto pt-3 flex items-end justify-between gap-3">
                    <div className="min-w-0 flex items-center gap-2">
                      <span className="shrink-0 rounded-xl p-2 bg-slate-100 text-slate-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.6)]">
                        {isOnline(item) ? <Video size={16} /> : <MapPin size={16} />}
                      </span>
                      <p className="text-sm font-medium text-slate-800 truncate" title={subtitle}>
                        {subtitle}
                      </p>
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

                <div className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="absolute -top-20 -left-20 h-40 w-40 rotate-12 bg-white/30 blur-2xl rounded-full" />
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-16 rounded-3xl border border-slate-200 bg-white/60">
          <p className="text-muted-foreground text-lg">
            No published {category.toLowerCase()} available.
          </p>
        </div>
      )}
    </div>
  );
};

export default ListingCardContainer;
