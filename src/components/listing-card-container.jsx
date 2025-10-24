
import { useEffect, useState } from "react";
import {
  Card,
  CardMedia,
  CardContent,
  Typography,
  Box,
  IconButton,
} from "@mui/material";
import FavoriteIcon from "@mui/icons-material/Favorite";
import { auth, database } from "../config/firebase";
import {
  doc,
  setDoc,
  deleteDoc,
  getDocs,
  collection,
  query,
  where,
} from "firebase/firestore";
import HomeDetailsModal from "./HomeDetailsModal";
import ExperienceDetailsModal from "./ExperienceDetailsModal";
import ServiceDetailsModal from "./ServiceDetailsModal";

const ListingCardContainer = ({ category, items }) => {
  const [selectedListingId, setSelectedListingId] = useState(null);
  const [favorites, setFavorites] = useState([]);
  const publishedItems = items?.filter((i) => i.status === "published") || [];

  const user = auth.currentUser;

  // Load user's favorites
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

  return (
    <Box sx={{ p: { xs: 3, sm: 6 } }}>
      {/* Section Title */}
      <div className="text-left mb-4">
        <h2 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-blue-500 to-indigo-600 bg-clip-text text-transparent drop-shadow-sm">
          {category}
        </h2>
        <p className="text-muted-foreground text-sm mt-1">
          Discover our curated {category.toLowerCase()} just for you.
        </p>
      </div>

      {/* Grid of Cards */}
      {publishedItems.length > 0 ? (
        <div className="grid gap-8 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {publishedItems.map((item) => (
            <div
              key={item.id}
              onClick={() => setSelectedListingId(item.id)}
              className="relative cursor-pointer z-10 rounded-3xl overflow-hidden glass transition-all duration-300 hover:-translate-y-2 hover:shadow-[0_20px_40px_rgba(30,64,175,0.3)] group transform-gpu"
              style={{ isolation: "isolate" }}
            >
              {/* Favorite Button */}
              <IconButton
                onClick={(e) => {
                  e.stopPropagation(); // Prevent modal opening
                  toggleFavorite(item.id);
                }}
                className="!absolute !top-3 !right-3 !bg-black/30 hover:!bg-black/50 !text-white z-20"
              >
                <FavoriteIcon
                  className={`transition-transform duration-200 ${
                    favorites.includes(item.id)
                      ? "!text-red-500 scale-110"
                      : "!text-white"
                  }`}
                />
              </IconButton>

              {/* Image */}
              <div className="relative h-48 w-full overflow-hidden">
                <img
                  src={item.photos?.[0] || item.photos?.[1] || "/placeholder.jpg"}
                  alt={item.title}
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
                {/* Gradient overlay fixed with pointer-events-none */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent pointer-events-none"></div>
              </div>

              {/* Card Content */}
              <div className="p-4 flex flex-col h-full">
                <h3 className="font-semibold text-lg text-foreground truncate">
                  {item.title || "Untitled Listing"}
                </h3>
                <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                  {item.description || "No description available."}
                </p>

                {item.price && (
                  <div className="mt-auto pt-2">
                    <p className="text-base font-bold text-blue-600">
                      ₱{item.price}
                    </p>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-16 glass-dark rounded-3xl">
          <p className="text-muted-foreground text-lg">
            No published {category.toLowerCase()} available.
          </p>
        </div>
      )}

      {/* Modals (logic unchanged) */}
      {selectedListingId && (
        <>
          {category === "Homes" && (
            <HomeDetailsModal
              listingId={selectedListingId}
              onClose={() => setSelectedListingId(null)}
            />
          )}

          {category === "Experiences" && (
            <ExperienceDetailsModal
              listingId={selectedListingId}
              onClose={() => setSelectedListingId(null)}
            />
          )}

          {category === "Services" && (
            <ServiceDetailsModal
              listingId={selectedListingId}
              onClose={() => setSelectedListingId(null)}
            />
          )}
        </>
      )}
    </Box>
  );
};

export default ListingCardContainer;
