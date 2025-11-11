import React, { useEffect, useState } from "react";
import { Heart, MapPin, Banknote, Video } from "lucide-react";
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
const ListingCardContainer = ({ category, items }) => {
  const navigate = useNavigate();

  const [favorites, setFavorites] = useState([]);
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

  const isOnline = (it) =>
    String(it.locationType || it.experienceType || "").trim().toLowerCase() === "online";

  // Navigate to the correct page for the current section
  const onCardClick = (item) => {
    const pathMap = { Homes: "homes", Experiences: "experiences", Services: "services" };
    const base = pathMap[category];
    if (base) navigate(`/${base}/${item.id}`);
  };

  return (
    <div className="px-4 sm:px-6 lg:px-8 pt-8">
      <div className="text-left mb-6">
        <h2 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-blue-500 to-indigo-600 bg-clip-text text-transparent drop-shadow-sm">
          {category}
        </h2>
        <p className="text-muted-foreground text-sm mt-1">
          Discover our curated {category.toLowerCase()} just for you.
        </p>
      </div>

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
                </div>

                <div className="p-5 pt-6 flex flex-col min-h-[190px] rounded-[24px] bg-white/70 shadow-[inset_0_1px_0_rgba(255,255,255,0.6)]">
                  <h3 className="font-semibold text-lg text-slate-900 truncate">
                    {item.title || "Untitled Listing"}
                  </h3>
                  <p className="text-sm text-slate-600 line-clamp-2 mt-1">
                    {item.description || "No description available."}
                  </p>

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
