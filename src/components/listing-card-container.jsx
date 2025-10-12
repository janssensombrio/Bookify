import React, { useState } from "react";
import "./styles/listing-card-container.css";
import ListingDetailsModal from "./listing-details-modal";

const ListingCardContainer = ({ category, items }) => {
  const [selectedListingId, setSelectedListingId] = useState(null);

  return (
    <div className="listing-container">
      <h2 className="listing-title">{category}</h2>
      <div className="listing-grid">
        {items && items.filter((item) => item.status === "published").length > 0 ? (
          items
            .filter((item) => item.status === "published")
            .map((item) => (
              <div className="listing-card" 
              key={item.id}
              onClick={() => setSelectedListingId(item.id)} // 👈 open modal
              >
                <img
                  src={item.photos?.[0] || item.photos?.[1]}
                  alt={item.title}
                  className="listing-image"
                />
                <div className="listing-details">
                  <h1>{item.title}</h1>
                  <p>{item.description}</p>
                  {item.price && <span className="price">₱{item.price}</span>}
                </div>
              </div>
            ))
        ) : (
          <p className="no-items">No published {category.toLowerCase()} available.</p>
        )}
      </div>

      {selectedListingId && (
        <ListingDetailsModal
          listingId={selectedListingId}
          onClose={() => setSelectedListingId(null)}
        />
      )}
    </div>
  );
};

export default ListingCardContainer;
