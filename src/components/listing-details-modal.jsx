import React, { useEffect, useState } from "react";
import { doc, getDoc, addDoc, collection } from "firebase/firestore";
import { database, auth } from "../config/firebase";
import "./styles/listing-details-modal.css";
import AvailabilityCalendar from "./availability-calendar";
import ExperienceCalendar from "./experience-calendar";
import { PayPalButtons } from "@paypal/react-paypal-js";

const ListingDetailsModal = ({ listingId, onClose }) => {
  const [listing, setListing] = useState(null);
  
  const [adults, setAdults] = useState(1);
  const [children, setChildren] = useState(0);
  const [infants, setInfants] = useState(0);

  // State for selected dates
  const [selectedDates, setSelectedDates] = useState({
    checkIn: "",
    checkOut: "",
    selectedTime: ""
  });

  const [includeCleaning, setIncludeCleaning] = useState(true); // default true

  useEffect(() => {
  const fetchListing = async () => {
    try {
      const docRef = doc(database, "listings", listingId);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const data = docSnap.data();
        console.log("Full listing data:", data); // ✅ See all fields
        console.log("Host UID:", data.uid); // ✅ Check if uid exists
        setListing(data);
      } else {
        console.error("Listing not found");
      }
    } catch (error) {
      console.error("Error fetching listing details:", error);
    }
  };

  if (listingId) fetchListing();
}, [listingId]);

  // Callback to receive dates from calendar
  const handleDateChange = (dates) => {
    setSelectedDates(dates);
  };

  // Handle Reserve Now click
  const [showPayPal, setShowPayPal] = useState(false);
  const [totalAmount, setTotalAmount] = useState(0);

  const handleBookNow = async () => {
    if (!selectedDates.checkIn || !selectedDates.checkOut) {
      return alert("Please select check-in and check-out dates.");
    }

    const checkIn = new Date(selectedDates.checkIn);
    const checkOut = new Date(selectedDates.checkOut);
    const nights = Math.ceil((checkOut - checkIn) / (1000 * 60 * 60 * 24));

    if (nights <= 0) return alert("Invalid date range.");

    const pricePerNight = parseFloat(listing.price) || 0;
    const cleaningFee =  includeCleaning ? parseFloat(listing.cleaningFee) || 0 : 0;
    const subtotal = pricePerNight * nights;
    const serviceFee = subtotal * 0.12;
    const total = subtotal + cleaningFee + serviceFee;

    setTotalAmount(total); // store amount for PayPal
    setShowPayPal(true); // show PayPal button next
  };

  const handleBookExperience = async () => {
      try {
        const user = auth.currentUser;
        if (!user) {
          alert("Please log in to book this experience.");
          return;
        }

        const { checkIn: selectedDate, selectedTime } = selectedDates; // from state
        if (!selectedDate || !selectedTime) {
          alert("Please select a date and time for your experience.");
          return;
        }

        const totalParticipants = adults; // only one spinner

        if (totalParticipants > (listing.maxParticipants || 1)) {
          alert(`Maximum participants allowed is ${listing.maxParticipants}.`);
          return;
        }

        const pricePerPerson = parseFloat(listing.price) || 0;
        const subtotal = pricePerPerson * totalParticipants;
        const serviceFee = subtotal * 0.12;
        const totalPrice = subtotal + serviceFee;

        const bookingData = {
          uid: user.uid,
          guestName: user.displayName || "",
          guestEmail: user.email,
          listingId: listingId,
          listingTitle: listing.title || "Untitled Experience",
          listingCategory: "Experiences",
          experienceType: listing.experienceType || "N/A",
          totalParticipants,
          experienceDate: selectedDate,
          experienceTime: selectedTime,
          pricePerPerson,
          subtotal,
          serviceFee,
          totalPrice,
          status: "pending",
          paymentStatus: "pending",
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        if (listing.uid) bookingData.hostId = listing.uid;
        if (listing.region && listing.province && listing.municipality) {
          bookingData.listingAddress = `${listing.region}, ${listing.province}, ${listing.municipality}`;
        }
        if (listing.photos?.length) bookingData.listingPhotos = listing.photos;

        const bookingsRef = collection(database, "bookings");
        const docRef = await addDoc(bookingsRef, bookingData);

        alert(`Experience booked successfully! Booking ID: ${docRef.id}`);
        onClose();

      } catch (error) {
        console.error("Error booking experience:", error);
        alert(`Failed to book experience: ${error.message}`);
      }
    };

    if (!listing) return null;

    const totalGuests = adults + children;
    const maxGuests = listing.guests || 1;

    // Calculate price summary
    const calculatePriceSummary = () => {
      if (!selectedDates.checkIn || !selectedDates.checkOut) return null;
      
      const checkIn = new Date(selectedDates.checkIn);
      const checkOut = new Date(selectedDates.checkOut);
      const nights = Math.ceil((checkOut - checkIn) / (1000 * 60 * 60 * 24));
      
      if (nights <= 0) return null;
      
      const pricePerNight = parseFloat(listing.price) || 0;
      const cleaningFee = includeCleaning ? parseFloat(listing.cleaningFee) || 0 : 0;
      const subtotal = pricePerNight * nights;
      const serviceFee = subtotal * 0.12;
      const total = subtotal + cleaningFee + serviceFee;
      
      return { nights, pricePerNight, subtotal, cleaningFee, serviceFee, total };
    };

  const priceSummary = calculatePriceSummary();
  
  const renderDetails = () => {
    switch (listing.category) {
      case "Homes":
        return (
          <>
            <p><strong>Price:</strong> ₱{listing.price} / night</p>
            <p><strong>Property Type:</strong> {listing.propertyType}</p>
            <p><strong>Bedrooms:</strong> {listing.bedrooms}</p>
            <p><strong>Beds:</strong> {listing.beds}</p>
            <p><strong>Bathrooms:</strong> {listing.bathrooms}</p>
            <p>
              <strong>Location:</strong>{' '}
              {listing.region?.name || listing.region || 'N/A'}, {listing.province?.name || listing.province || 'N/A'}, {listing.municipality?.name || listing.municipality || 'N/A'}, {listing.street || 'N/A'}
            </p>
            <p><strong>Cleaning Fee:</strong> ₱{listing.cleaningFee}</p>
            {listing.discountType && (
              <p>
                <strong>Discount:</strong> {listing.discountValue}% ({listing.discountType})
              </p>
            )}
            
            <br />
            
            {/* Guest Spinners */}
            <div style={{ border: "1px solid #ddd", padding: "15px", borderRadius: "8px", marginBottom: "20px" }}>
              <h4>Guests</h4>
              
              {/* Adults */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "15px" }}>
                <div>
                  <strong>Adults</strong>
                  <div style={{ fontSize: "12px", color: "#666" }}>Age 13+</div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <button
                    onClick={() => setAdults(Math.max(1, adults - 1))}
                    disabled={adults <= 1}
                    style={{
                      width: "32px",
                      height: "32px",
                      borderRadius: "50%",
                      border: "1px solid #ddd",
                      background: adults <= 1 ? "#f0f0f0" : "white",
                      cursor: adults <= 1 ? "not-allowed" : "pointer",
                    }}
                  >
                    −
                  </button>
                  <span style={{ minWidth: "30px", textAlign: "center" }}>{adults}</span>
                  <button
                    onClick={() => setAdults(adults + 1)}
                    disabled={totalGuests >= maxGuests}
                    style={{
                      width: "32px",
                      height: "32px",
                      borderRadius: "50%",
                      border: "1px solid #ddd",
                      background: totalGuests >= maxGuests ? "#f0f0f0" : "white",
                      cursor: totalGuests >= maxGuests ? "not-allowed" : "pointer",
                    }}
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Children */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "15px" }}>
                <div>
                  <strong>Children</strong>
                  <div style={{ fontSize: "12px", color: "#666" }}>Ages 2-12</div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <button
                    onClick={() => setChildren(Math.max(0, children - 1))}
                    disabled={children <= 0}
                    style={{
                      width: "32px",
                      height: "32px",
                      borderRadius: "50%",
                      border: "1px solid #ddd",
                      background: children <= 0 ? "#f0f0f0" : "white",
                      cursor: children <= 0 ? "not-allowed" : "pointer",
                    }}
                  >
                    −
                  </button>
                  <span style={{ minWidth: "30px", textAlign: "center" }}>{children}</span>
                  <button
                    onClick={() => setChildren(children + 1)}
                    disabled={totalGuests >= maxGuests}
                    style={{
                      width: "32px",
                      height: "32px",
                      borderRadius: "50%",
                      border: "1px solid #ddd",
                      background: totalGuests >= maxGuests ? "#f0f0f0" : "white",
                      cursor: totalGuests >= maxGuests ? "not-allowed" : "pointer",
                    }}
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Infants */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <strong>Infants</strong>
                  <div style={{ fontSize: "12px", color: "#666" }}>Under 2</div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <button
                    onClick={() => setInfants(Math.max(0, infants - 1))}
                    disabled={infants <= 0}
                    style={{
                      width: "32px",
                      height: "32px",
                      borderRadius: "50%",
                      border: "1px solid #ddd",
                      background: infants <= 0 ? "#f0f0f0" : "white",
                      cursor: infants <= 0 ? "not-allowed" : "pointer",
                    }}
                  >
                    −
                  </button>
                  <span style={{ minWidth: "30px", textAlign: "center" }}>{infants}</span>
                  <button
                    onClick={() => setInfants(infants + 1)}
                    disabled={infants >= 5}
                    style={{
                      width: "32px",
                      height: "32px",
                      borderRadius: "50%",
                      border: "1px solid #ddd",
                      background: infants >= 5 ? "#f0f0f0" : "white",
                      cursor: infants >= 5 ? "not-allowed" : "pointer",
                    }}
                  >
                    +
                  </button>
                </div>
              </div>

              <div style={{ marginTop: "10px", fontSize: "14px", color: "#666" }}>
                {totalGuests} of {maxGuests} guests
                {infants > 0 && ` (+ ${infants} infant${infants > 1 ? 's' : ''})`}
              </div>
            </div>

            <br />
            <h4>Select Your Dates</h4>
            <AvailabilityCalendar 
              availability={listing.availability}
              onDateChange={handleDateChange}
            />

            <br />

            {/* Selected Dates Display */}
            {selectedDates.checkIn && selectedDates.checkOut && (
              <div style={{ marginBottom: "20px", padding: "15px", background: "#f7f7f7", borderRadius: "8px" }}>
                <h4>Selected Dates</h4>
                <p><strong>Check-in:</strong> {selectedDates.checkIn}</p>
                <p><strong>Check-out:</strong> {selectedDates.checkOut}</p>
              </div>
            )}

            {/* cleaning fee option */}
            <div style={{ marginBottom: "15px" }}>
              <label style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <input 
                  type="checkbox" 
                  checked={includeCleaning} 
                  onChange={(e) => setIncludeCleaning(e.target.checked)} 
                />
                Include Cleaning Service (₱{listing.cleaningFee})
              </label>
            </div>

            {/* Price Summary */}
            {priceSummary && (
              <div style={{ marginBottom: "20px", padding: "15px", border: "1px solid #ddd", borderRadius: "8px" }}>
                <h4>Price Summary</h4>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                  <span>₱{priceSummary.pricePerNight} × {priceSummary.nights} night(s)</span>
                  <span>₱{priceSummary.subtotal.toFixed(2)}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                  <span>Cleaning fee</span>
                  <span>₱{(includeCleaning ? priceSummary.cleaningFee : 0).toFixed(2)}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                  <span>Service fee (12%)</span>
                  <span>₱{priceSummary.serviceFee.toFixed(2)}</span>
                </div>
                <hr style={{ margin: "10px 0" }} />
                <div style={{ display: "flex", justifyContent: "space-between", fontWeight: "bold", fontSize: "18px" }}>
                  <span>Total</span>
                  <span>₱{priceSummary.total.toFixed(2)}</span>
                </div>
              </div>
            )}

            <div className="modal-actions">
              <button className="share-btn">Share</button>
              <button className="favorite-btn">Add to Favorites</button>
              {showPayPal ? (
              <div style={{ marginTop: "20px" }}>
                <PayPalButtons
                  style={{ layout: "vertical" }}
                  createOrder={(data, actions) => {
                    return actions.order.create({
                      purchase_units: [
                        {
                          amount: {
                            value: totalAmount.toFixed(2), // use computed total
                          },
                        },
                      ],
                    });
                  }}
                  onApprove={async (data, actions) => {
                    const details = await actions.order.capture();
                    const user = auth.currentUser;

                    // Save booking in Firestore after successful payment
                    try {
                        // use the user captured above
                      
                        if (!user) {
                          alert("Please log in to make a reservation.");
                          return;
                        }

                      if (!selectedDates.checkIn || !selectedDates.checkOut) {
                        alert("Please select check-in and check-out dates from the calendar.");
                        return;
                      }

                      const checkIn = new Date(selectedDates.checkIn);
                      const checkOut = new Date(selectedDates.checkOut);
                      const nights = Math.ceil((checkOut - checkIn) / (1000 * 60 * 60 * 24));

                      if (nights <= 0) {
                        alert("Check-out date must be after check-in date.");
                        return;
                      }

                      const pricePerNight = parseFloat(listing.price) || 0;
                      const cleaningFee = includeCleaning ? parseFloat(listing.cleaningFee) || 0 : 0;
                      const subtotal = pricePerNight * nights;
                      const serviceFee = subtotal * 0.12;
                      const totalPrice = subtotal + cleaningFee + serviceFee;

                      // ✅ Build booking data without undefined fields
                      const bookingData = {
                        uid: user.uid,
                        checkIn: selectedDates.checkIn,
                        checkOut: selectedDates.checkOut,
                        nights: nights,
                        numberOfGuests: adults + children,
                        adults: adults,
                        children: children,
                        infants: infants,
                        guestEmail: user.email,
                        pricePerNight: pricePerNight,
                        subtotal: subtotal,
                        cleaningFee: cleaningFee,
                        serviceFee: serviceFee,
                        totalPrice: totalPrice,
                        listingTitle: listing.title || "Untitled",
                        listingCategory: listing.category || "Homes",
                        status: "pending",
                        paymentStatus: "paid",
                        createdAt: new Date(),
                        updatedAt: new Date(),
                      };

                      // ✅ Only add optional fields if they exist
                      if (listing.uid) {
                        bookingData.hostId = listing.uid;
                      }

                      if (user.displayName) {
                        bookingData.guestName = user.displayName;
                      }

                      if (listing.region && listing.province && listing.municipality) {
                        bookingData.listingAddress = `${listing.region}, ${listing.province}, ${listing.municipality}`;
                      }

                      if (listing.photos && listing.photos.length > 0) {
                        bookingData.listingPhotos = listing.photos;
                      }

                      console.log("Booking data to save:", bookingData); // ✅ Debug log

                      const bookingsRef = collection(database, "bookings");
                      const docRef = await addDoc(bookingsRef, bookingData);

                      alert("Booking successful and payout sent!");
                      onClose();

                    } catch (error) {
                      console.error("Error creating reservation:", error);
                      alert(`Failed to create reservation: ${error.message}`);
                    }
                  }}
                  onCancel={() => {
                    // alert("Payment canceled.");
                    setShowPayPal(false);
                  }}
                />
              </div>
            ) : (
              <button className="reserve-btn" onClick={handleBookNow}>
                Book Now
              </button>
            )}
            </div>
          </>
        );

  case "Experiences": {
  // 👇 Compute price summary for experiences
  const experiencePriceSummary = () => {
        if (!selectedDates.checkIn || !selectedDates.selectedTime) return null;
        
        const totalParticipants = adults;
        const pricePerPerson = parseFloat(listing.price) || 0;
        const subtotal = pricePerPerson * totalParticipants;
        const serviceFee = subtotal * 0.12;
        const total = subtotal + serviceFee;

        return { totalParticipants, pricePerPerson, subtotal, serviceFee, total };
      };

      const expSummary = experiencePriceSummary();

      return (
        <>
          <p><strong>Price:</strong> ₱{listing.price} per participant</p>
          <p><strong>Duration:</strong> {listing.duration}</p>
          <p><strong>Max Participants:</strong> {listing.maxParticipants}</p>
          <p><strong>Experience Type:</strong> {listing.experienceType}</p>
          <p>
            <strong>Location:</strong>{" "}
            {listing.region?.name || listing.region || "N/A"},{" "}
            {listing.province?.name || listing.province || "N/A"},{" "}
            {listing.municipality?.name || listing.municipality || "N/A"}
          </p>
          <p>
            <strong>Languages:</strong>{" "}
            {Array.isArray(listing.languages)
              ? listing.languages.join(", ")
              : listing.languages || "N/A"}
          </p>
          <p><strong>Cancellation Policy:</strong> {listing.cancellationPolicy}</p>

          {/* 👇 Participants Spinner */}
          <div style={{ border: "1px solid #ddd", padding: "15px", borderRadius: "8px", marginBottom: "20px" }}>
            <h4>Number of Participants</h4>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <button onClick={() => setAdults(Math.max(1, adults - 1))} disabled={adults <= 1}>−</button>
              <span>{adults}</span>
              <button onClick={() => setAdults(adults + 1)} disabled={adults >= (listing.maxParticipants || 10)}>+</button>
            </div>
          </div>

          {/* 👇 Calendar */}
          <h4>Select Available Date</h4>
          <ExperienceCalendar
            availability={listing.schedule}
            onDateChange={(data) => setSelectedDates({
              checkIn: data.selectedDate,
              selectedTime: data.selectedTime
            })}
            disableOutsideDates={true}
          />

          {/* 👇 Price Summary pops up dynamically */}
          {expSummary && (
            <div style={{ marginTop: "20px", padding: "15px", border: "1px solid #ddd", borderRadius: "8px", background: "#f7f7f7" }}>
              <h4>Price Summary</h4>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>₱{expSummary.pricePerPerson} × {expSummary.totalParticipants} participant{expSummary.totalParticipants > 1 ? "s" : ""}</span>
                <span>₱{expSummary.subtotal.toFixed(2)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>Service fee (12%)</span>
                <span>₱{expSummary.serviceFee.toFixed(2)}</span>
              </div>
              <hr style={{ margin: "10px 0" }} />
              <div style={{ display: "flex", justifyContent: "space-between", fontWeight: "bold", fontSize: "18px" }}>
                <span>Total</span>
                <span>₱{expSummary.total.toFixed(2)}</span>
              </div>
            </div>
          )}

          <div className="modal-actions">
            <button className="share-btn">Share</button>
            <button className="favorite-btn">Add to Favorites</button>
            <button className="reserve-btn" onClick={handleBookExperience}>Book Now</button>
          </div>
        </>
      );
      }

  case "Services": {
  // 👇 Compute price summary for services
  const servicePriceSummary = () => {
        if (!selectedDates.checkIn || !selectedDates.selectedTime) return null;

        const totalParticipants = adults;
        const pricePerPerson = parseFloat(listing.price) || 0;
        const subtotal = pricePerPerson * totalParticipants;
        const serviceFee = subtotal * 0.12;
        const total = subtotal + serviceFee;

        return { totalParticipants, pricePerPerson, subtotal, serviceFee, total };
      };

      const svcSummary = servicePriceSummary();

      return (
        <>
          <p><strong>Price:</strong> ₱{listing.price}</p>
          <p><strong>Service Type:</strong> {listing.serviceType}</p>
          <p><strong>Target Audience:</strong> {listing.targetAudience}</p>
          <p><strong>Duration:</strong> {listing.duration}</p>
          <p><strong>Recurrence:</strong> {listing.recurrence}</p>
          <p><strong>Location Type:</strong> {listing.locationType}</p>
          <p><strong>Address:</strong> {listing.address}</p>
          <p><strong>Cancellation Policy:</strong> {listing.cancellationPolicy}</p>
          <p><strong>Qualifications:</strong> {listing.qualifications}</p>

          {/* 👇 Participants Spinner */}
          <div style={{ border: "1px solid #ddd", padding: "15px", borderRadius: "8px", marginBottom: "20px" }}>
            <h4>Number of Participants</h4>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <button onClick={() => setAdults(Math.max(1, adults - 1))} disabled={adults <= 1}>−</button>
              <span>{adults}</span>
              <button onClick={() => setAdults(adults + 1)} disabled={adults >= (listing.maxParticipants || 10)}>+</button>
            </div>
          </div>

          {/* 👇 Calendar */}
          <h4>Select Available Date & Time</h4>
          <ExperienceCalendar
            availability={listing.schedule}
            onDateChange={(data) =>
              setSelectedDates({ checkIn: data.selectedDate, selectedTime: data.selectedTime })
            }
            disableOutsideDates={true}
          />

          {/* 👇 Price Summary pops up dynamically */}
          {svcSummary && (
            <div style={{ marginTop: "20px", padding: "15px", border: "1px solid #ddd", borderRadius: "8px", background: "#f7f7f7" }}>
              <h4>Price Summary</h4>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>₱{svcSummary.pricePerPerson} × {svcSummary.totalParticipants} participant{svcSummary.totalParticipants > 1 ? "s" : ""}</span>
                <span>₱{svcSummary.subtotal.toFixed(2)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>Service fee (12%)</span>
                <span>₱{svcSummary.serviceFee.toFixed(2)}</span>
              </div>
              <hr style={{ margin: "10px 0" }} />
              <div style={{ display: "flex", justifyContent: "space-between", fontWeight: "bold", fontSize: "18px" }}>
                <span>Total</span>
                <span>₱{svcSummary.total.toFixed(2)}</span>
              </div>
            </div>
          )}

          <div className="modal-actions">
            <button className="share-btn">Share</button>
            <button className="favorite-btn">Add to Favorites</button>
            <button className="reserve-btn" onClick={async () => {
              try {
                const user = auth.currentUser;
                if (!user) return alert("Please log in to book this service.");
                if (!selectedDates.checkIn || !selectedDates.selectedTime) return alert("Select date and time.");

                const totalParticipants = adults;
                if (totalParticipants > (listing.maxParticipants || 10)) {
                  return alert(`Maximum participants allowed: ${listing.maxParticipants}`);
                }

                const pricePerPerson = parseFloat(listing.price) || 0;
                const subtotal = pricePerPerson * totalParticipants;
                const serviceFee = subtotal * 0.12;
                const totalPrice = subtotal + serviceFee;

                const bookingData = {
                  uid: user.uid,
                  guestName: user.displayName || "",
                  guestEmail: user.email,
                  listingId: listingId,
                  listingTitle: listing.title,
                  listingCategory: "Services",
                  totalParticipants,
                  serviceDate: selectedDates.checkIn,
                  serviceTime: selectedDates.selectedTime,
                  pricePerPerson,
                  subtotal,
                  serviceFee,
                  totalPrice,
                  status: "pending",
                  paymentStatus: "pending",
                  createdAt: new Date(),
                  updatedAt: new Date(),
                };

                if (listing.uid) bookingData.hostId = listing.uid;
                if (listing.address) bookingData.listingAddress = listing.address;
                if (listing.photos?.length) bookingData.listingPhotos = listing.photos;

                const bookingsRef = collection(database, "bookings");
                const docRef = await addDoc(bookingsRef, bookingData);

                alert(`Service booked successfully! Booking ID: ${docRef.id}`);
                onClose();
              } catch (err) {
                console.error(err);
                alert("Failed to book service.");
              }
            }}>Book Now</button>
          </div>
        </>
      );
      }

      default:
        return <p>No details available.</p>;
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <button className="close-btn" onClick={onClose}>×</button>

        <div className="modal-header">
          <h2>{listing.title}</h2>
          <p>{listing.description}</p>
        </div>

        <div className="modal-images">
          {listing.photos?.map((photo, index) => (
            <img key={index} src={photo} alt={`Photo ${index + 1}`} />
          ))}
        </div>

        <div className="modal-details">
          {renderDetails()}
        </div>
      </div>
    </div>
  );
};

export default ListingDetailsModal;