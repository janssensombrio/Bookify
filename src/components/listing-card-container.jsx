import React, { useState, useEffect } from "react";
// import ListingDetailsModal from "./listing-details-modal";
import { Card, CardMedia, CardContent, Typography, Box, IconButton } from "@mui/material";
import FavoriteIcon from "@mui/icons-material/Favorite";
import { auth, database } from "../config/firebase";
import { doc, setDoc, deleteDoc, getDocs, collection, query, where } from "firebase/firestore";
import HomeDetailsModal from "./HomeDetailsModal"; 
import ExperienceDetailsModal from "./ExperienceDetailsModal";
import ServiceDetailsModal from "./ServiceDetailsModal";

const ListingCardContainer = ({ category, items }) => {
  const [selectedListingId, setSelectedListingId] = useState(null);
  const [favorites, setFavorites] = useState([]);
  const publishedItems = items?.filter(i => i.status === "published") || [];

  const user = auth.currentUser;

  // Load user's favorites
  useEffect(() => {
    if (!user) return;
    const fetchFavorites = async () => {
      const favRef = collection(database, "favorites");
      const q = query(favRef, where("userId", "==", user.uid));
      const snapshot = await getDocs(q);
      const favIds = snapshot.docs.map(doc => doc.data().listingId);
      setFavorites(favIds);
    };
    fetchFavorites();
  }, [user]);

  const toggleFavorite = async (listingId) => {
    if (!user) return;

    const favRef = doc(database, "favorites", `${user.uid}_${listingId}`);

    if (favorites.includes(listingId)) {
      await deleteDoc(favRef);
      setFavorites(favs => favs.filter(id => id !== listingId));
    } else {
      await setDoc(favRef, {
        uid: user.uid,
        userId: user.uid,
        listingId: listingId,
        createdAt: new Date(),
      });
      setFavorites(favs => [...favs, listingId]);
    }
  };

  return (
    <Box sx={{ p: 6}}>
      <Typography variant="h4" sx={{ mb: 3, fontWeight: "bold", color: "primary.main" }}>
        {category}
      </Typography>

      {publishedItems.length > 0 ? (
        <Box
          sx={{
            display: "grid",
            gap: 3,
            gridTemplateColumns: {
              xs: "repeat(1, 1fr)",
              sm: "repeat(2, 1fr)",
              md: "repeat(3, 1fr)",
              lg: "repeat(6, 1fr)",
            },
          }}
        >
          {publishedItems.map(item => (
            <Card
              key={item.id}
              onClick={() => setSelectedListingId(item.id)} // open modal
              sx={{
                borderRadius: 6,
                cursor: "pointer",
                display: "flex",
                flexDirection: "column",
                height: "100%",
                position: "relative",
                transition: "transform 0.3s, box-shadow 0.8s",
                "&:hover": { transform: "translateY(-6px)", boxShadow: 8 },
              }}
            >
              {/* Heart button */}
              <IconButton
                onClick={(e) => {
                  e.stopPropagation(); // prevent modal open
                  toggleFavorite(item.id);
                }}
                sx={{
                  position: "absolute",
                  top: 8,
                  right: 8,
                  color: favorites.includes(item.id) ? "red" : "white",
                  backgroundColor: "rgba(0,0,0,0.3)",
                  "&:hover": { backgroundColor: "rgba(0,0,0,0.5)" },
                }}
              >
                <FavoriteIcon />
              </IconButton>

              <CardMedia
                component="img"
                image={item.photos?.[0] || item.photos?.[1]}
                alt={item.title}
                sx={{ height: 140, objectFit: "cover" }}
              />

              <CardContent sx={{ display: "flex", flexDirection: "column", flexGrow: 1 }}>
                <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                  {item.title}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {item.description}
                </Typography>

                {item.price && (
                  <Typography
                    variant="subtitle1"
                    color="primary"
                    fontWeight="bold"
                    sx={{ mt: "auto" }} // pushes price to bottom
                  >
                    ₱{item.price}
                  </Typography>
                )}
              </CardContent>
            </Card>
          ))}
        </Box>
      ) : (
        <Typography>No published {category.toLowerCase()} available.</Typography>
      )}

      {/* {selectedListingId && (
        <ListingDetailsModal
          listingId={selectedListingId}
          onClose={() => setSelectedListingId(null)}
        />
      )} */}

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
