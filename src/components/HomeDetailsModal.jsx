import React, { useEffect, useState } from "react";
import { doc, getDoc, addDoc, collection } from "firebase/firestore";
import {
  Modal,
  Box,
  Typography,
  IconButton,
  Button,
  Grid,
  useMediaQuery,
  Card,
  CardContent,
  Divider,
  FormControlLabel,
  Switch,
  Chip,
} from "@mui/material";

import Avatar from "@mui/material/Avatar";
import CloseIcon from "@mui/icons-material/Close";
import ArrowBackIosNewIcon from "@mui/icons-material/ArrowBackIosNew";
import ArrowForwardIosIcon from "@mui/icons-material/ArrowForwardIos";
import AddIcon from "@mui/icons-material/Add";
import RemoveIcon from "@mui/icons-material/Remove";
import PlaceRoundedIcon from '@mui/icons-material/PlaceRounded';
import SellRoundedIcon from '@mui/icons-material/SellRounded';
import HomeRoundedIcon from '@mui/icons-material/HomeRounded';

import AvailabilityCalendar from './availability-calendar';
import { database } from "../config/firebase";
import { PayPalButtons } from "@paypal/react-paypal-js";  // New import for PayPal
import { auth } from "../config/firebase";  
import { MessageHostModal } from "./message-host-modal";

const HomesDetailsModal = ({ listingId, onClose }) => {
  const [listing, setListing] = useState(null);
  const [currentPhoto, setCurrentPhoto] = useState(0);
  const [selectedGuests, setSelectedGuests] = useState(1);
  const [selectedDates, setSelectedDates] = useState({ start: null, end: null });
  const [paymentBreakdown, setPaymentBreakdown] = useState(null);
  const [includeCleaningFee, setIncludeCleaningFee] = useState(true); // New state for cleaning fee toggle
  const isMobile = useMediaQuery("(max-width:768px)");

  const [adults, setAdults] = useState(1);  // Default to 1 adult
  const [children, setChildren] = useState(0);  // Default to 0 children
  const [infants, setInfants] = useState(0);  // Default to 0 infants

  const [showPayPal, setShowPayPal] = useState(false);  // Tracks whether to show PayPal buttons
  const [totalAmount, setTotalAmount] = useState(0);   // Stores the total amount for PayPal

  const [host, setHost] = useState(null);
  const [showMessageModal, setShowMessageModal] = useState(false);

  useEffect(() => {
  if (!listing) return;

  const fetchHost = async () => {
    if (!listing.uid) return;
    try {
      const docRef = doc(database, "users", listing.uid);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) setHost(docSnap.data());
    } catch (err) {
      console.error("Failed to fetch host:", err);
    }
  };

  fetchHost();
}, [listing]);

  useEffect(() => {
    const fetchListingDetails = async () => {
      try {
        const docRef = doc(database, "listings", listingId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setListing(docSnap.data());
          setSelectedGuests(docSnap.data().guests || 1);
        } else {
          setListing(null);
        }
      } catch (error) {
        console.error("Error fetching listing details:", error);
        setListing(null);
      }
    };

    if (listingId) fetchListingDetails();
    setCurrentPhoto(0);
  }, [listingId]);

  useEffect(() => {
    if (!listing?.photos?.length) {
      setCurrentPhoto(0);
      return;
    }
    setCurrentPhoto((idx) => {
      const len = listing.photos.length;
      if (idx >= len) return 0;
      if (idx < 0) return (idx + len) % len;
      return idx;
    });
  }, [listing?.photos]);

  // Calculate payment breakdown when dates, guests, or cleaning fee preference changes
  useEffect(() => {
    if (selectedDates.start && selectedDates.end) {
      calculatePayment();
    } else {
      setPaymentBreakdown(null);
    }
  }, [selectedDates, adults, children, infants, listing, includeCleaningFee]);

  const handleBookNow = async () => {
    if (!selectedDates.start || !selectedDates.end) {
      return alert("Please select check-in and check-out dates.");
    }

    const checkIn = new Date(selectedDates.start);
    const checkOut = new Date(selectedDates.end);
    const nights = Math.ceil((checkOut - checkIn) / (1000 * 60 * 60 * 24));

    if (nights <= 0) return alert("Invalid date range.");

    const pricePerNight = parseFloat(listing.price) || 0;
    const cleaningFee = includeCleaningFee ? parseFloat(listing.cleaningFee) || 0 : 0;
    const subtotal = pricePerNight * nights;
    const serviceFee = subtotal * 0.12;
    const total = subtotal + cleaningFee + serviceFee;

    setTotalAmount(total);  // Set the total for PayPal
    setShowPayPal(true);    // Trigger PayPal display
  };

  const calculatePayment = () => {
    if (!listing || !selectedDates.start || !selectedDates.end) return;

    const start = new Date(selectedDates.start);
    const end = new Date(selectedDates.end);
    const nights = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
    
    if (nights <= 0) {
      setPaymentBreakdown(null);
      return;
    }

    const basePrice = listing.price || 0;
    const cleaningFee = includeCleaningFee ? (listing.cleaningFee || 0) : 0; // Use 0 if cleaning fee is not included
    const subtotal = basePrice * nights;
    
    // Calculate discount
    let discount = 0;
    if (listing.discountType && listing.discountValue) {
      if (listing.discountType === "percentage") {
        discount = (subtotal * listing.discountValue) / 100;
      } else {
        discount = Math.min(listing.discountValue, subtotal);
      }
    }

    const totalBeforeTax = subtotal - discount + cleaningFee;
    const tax = totalBeforeTax * 0.12; // Assuming 12% tax
    const total = totalBeforeTax + tax;

    setPaymentBreakdown({
      nights,
      basePrice,
      subtotal,
      discount,
      cleaningFee,
      tax,
      total,
      includeCleaningFee,
    });
  };

  const handleDateChange = (dates) => {
    console.log('Date change received:', dates);
    if (dates && dates.start && dates.end) {
      setSelectedDates({
        start: new Date(dates.start),
        end: new Date(dates.end)
      });
    } else {
      setSelectedDates({ start: null, end: null });
      setPaymentBreakdown(null);
    }
  };

  const handleCleaningFeeToggle = (event) => {
    setIncludeCleaningFee(event.target.checked);
  };

  if (!listing) return null;

  const photos = Array.isArray(listing.photos) ? listing.photos : [];
  const hasPhotos = photos.length > 0;
  const hasPromo = listing.discountType && listing.discountValue > 0;
  const hasCleaningFee = listing.cleaningFee && listing.cleaningFee > 0;

  const nextPhoto = (e) => {
    e?.stopPropagation();
    if (!hasPhotos) return;
    setCurrentPhoto((p) => (p + 1) % photos.length);
  };

  const prevPhoto = (e) => {
    e?.stopPropagation();
    if (!hasPhotos) return;
    setCurrentPhoto((p) => (p - 1 + photos.length) % photos.length);
  };

  return (
    <Modal
      open={!!listingId}
      onClose={onClose}
      aria-labelledby="home-details-title"
      aria-describedby="home-details-desc"
    >
      <Box
        sx={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: isMobile ? "84%" : "80%",
          height: isMobile ? "92vh" : "88vh",
          bgcolor: "background.paper",
          boxShadow: 24,
          borderRadius: 8,
          overflow: "hidden",
          outline: "none",
          display: "flex",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <Grid container sx={{ height: "100%", flex: 1, flexDirection: { xs: 'column', md: 'row' } }}>
          {/* LEFT - Image carousel with promo text */}
          <Grid
            item
            xs={12}
            md={6}
            sx={{
              height: "100%",
              position: "relative",
              bgcolor: "grey.900",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              minHeight: 200,
              flex: { xs: 0.8, md: 2 },  // Smaller on mobile (xs), original on md and up
            }}
          >
            <Box
              sx={{
                width: "100%",
                height: "100%",
                position: "relative",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {hasPromo && (
                <Box
                  sx={{
                    position: "absolute",
                    top: 24,
                    left: 24,
                    boxShadow: 20,
                    backgroundColor: "primary.main",
                    color: "white",
                    padding: "8px 10px",
                    borderRadius: 2,
                    zIndex: 10,
                    fontSize: "1.4rem",
                    fontWeight: "bold",
                  }}
                >
                  {`${listing.discountType !== "percentage" ? '₱' : ""}${listing.discountValue}${listing.discountType === "percentage" ? '%' : ""} off!`}
                </Box>
              )}

              {hasPhotos ? (
                <img
                  key={photos[currentPhoto]}
                  src={photos[currentPhoto]}
                  alt={`photo-${currentPhoto}`}
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    display: "block",
                  }}
                />
              ) : (
                <Box
                  sx={{
                    width: "100%",
                    height: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "text.secondary",
                    p: 2,
                  }}
                >
                  <Typography>No photos available</Typography>
                </Box>
              )}

              {hasPhotos && photos.length > 1 && (
                <>
                  <IconButton
                    onClick={prevPhoto}
                    aria-label="previous-photo"
                    sx={{
                      position: "absolute",
                      left: 8,
                      top: "50%",
                      transform: "translateY(-50%)",
                      bgcolor: "rgba(0,0,0,0.35)",
                      color: "common.white",
                      "&:hover": { bgcolor: "rgba(0,0,0,0.6)" },
                    }}
                  >
                    <ArrowBackIosNewIcon fontSize="small" />
                  </IconButton>

                  <IconButton
                    onClick={nextPhoto}
                    aria-label="next-photo"
                    sx={{
                      position: "absolute",
                      right: 8,
                      top: "50%",
                      transform: "translateY(-50%)",
                      bgcolor: "rgba(0,0,0,0.35)",
                      color: "common.white",
                      "&:hover": { bgcolor: "rgba(0,0,0,0.6)" },
                    }}
                  >
                    <ArrowForwardIosIcon fontSize="small" />
                  </IconButton>
                </>
              )}

              {hasPhotos && photos.length > 1 && (
                <Box
                  sx={{
                    position: "absolute",
                    bottom: 10,
                    left: "50%",
                    transform: "translateX(-50%)",
                    display: "flex",
                    gap: 1,
                    zIndex: 5,
                  }}
                >
                  {photos.map((_, i) => (
                    <Box
                      key={i}
                      onClick={(e) => {
                        e.stopPropagation();
                        setCurrentPhoto(i);
                      }}
                      sx={{
                        width: i === currentPhoto ? 10 : 8,
                        height: i === currentPhoto ? 10 : 8,
                        borderRadius: "50%",
                        bgcolor: i === currentPhoto ? "primary.main" : "rgba(255,255,255,0.6)",
                        cursor: "pointer",
                      }}
                    />
                  ))}
                </Box>
              )}
            </Box>
          </Grid>

          {/* RIGHT - Details with spinner and date picker */}
          <Grid
            item
            xs={12}
            md={6}
            sx={{
              height: "100%",
              position: "relative",
              p: { xs: 3.6, md: 4 },
              overflowY: "auto",
              bgcolor: "background.paper",
              flex: 1,
              display: "flex",
              flexDirection: "column",
              justifyContent: "flex-start",
              paddingBottom: 0,
            }}
          >
            <IconButton
              onClick={onClose}
              sx={{ position: "fixed", right: 24, top: 20, zIndex: 5,          
                    backgroundColor: 'grey.200',  // Light grey background
                    borderRadius: 10,  
                    padding: 0.8,  
               }}
            >
              <CloseIcon />
            </IconButton>

            <Box sx={{ pt: 1, flex: 1, display: "flex", flexDirection: "column" }}>
              <Typography id="home-details-title" variant="h4" fontWeight={700} gutterBottom>
                {listing.title ?? "No Title Available"}
              </Typography>
              <Box>
                <Chip 
                label={listing.listingType} 
                color="primary" 
                variant="outlined"
                size="medium"
                sx={{ mb: 2 }}
              />
              </Box>

              <Typography id="home-details-desc" variant="body2" color="text.secondary" gutterBottom>
                {listing.description ?? "No description available."}
              </Typography>

              <Box sx={{ mt: 2, display: "grid", gap: 1 }}>
                <Typography variant="subtitle2" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <HomeRoundedIcon color="primary" sx={{ fontSize: '1.28rem' }} /> <strong>{listing.propertyType ?? "N/A"}</strong>
                </Typography>
                <Typography variant="subtitle2" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <SellRoundedIcon color="primary" sx={{ fontSize: '1.28rem' }} /> <strong>₱{listing.price ?? "N/A"} / night</strong>
                </Typography>
                <Typography variant="subtitle2" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <PlaceRoundedIcon color="primary" sx={{ fontSize: '1.28rem' }} /> 
                <strong>
                  {[
                  listing.region.name,
                  listing.province.name,
                  listing.municipality.name,
                  listing.barangay.name,
                  listing.street.name,
                ]
                  .filter(Boolean)
                  .join(", ") || "N/A"}
                </strong>
              </Typography>
                <Box sx={{ display: "grid", gap: 2, mt: 2 }}>
                  {/* Adults Spinner */}
                  <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <Typography variant="subtitle2"><strong>Adults (Age 13+):</strong></Typography>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      <IconButton onClick={() => setAdults(Math.max(1, adults - 1))} disabled={adults <= 1}>
                        <RemoveIcon />
                      </IconButton>
                      <Typography>{adults}</Typography>
                      <IconButton onClick={() => setAdults(adults + 1)} disabled={adults + children + infants >= (listing.guests || 1)}>
                        <AddIcon />
                      </IconButton>
                    </Box>
                  </Box>

                  {/* Children Spinner */}
                  <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <Typography variant="subtitle2"><strong>Children (Ages 2-12):</strong></Typography>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      <IconButton onClick={() => setChildren(Math.max(0, children - 1))} disabled={children <= 0}>
                        <RemoveIcon />
                      </IconButton>
                      <Typography>{children}</Typography>
                      <IconButton onClick={() => setChildren(children + 1)} disabled={adults + children + infants >= (listing.guests || 1)}>
                        <AddIcon />
                      </IconButton>
                    </Box>
                  </Box>

                  {/* Infants Spinner */}
                  <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <Typography variant="subtitle2"><strong>Infants (Under 2):</strong></Typography>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      <IconButton onClick={() => setInfants(Math.max(0, infants - 1))} disabled={infants <= 0}>
                        <RemoveIcon />
                      </IconButton>
                      <Typography>{infants}</Typography>
                      <IconButton onClick={() => setInfants(infants + 1)} disabled={adults + children + infants >= (listing.guests || 1)}>
                        <AddIcon />
                      </IconButton>
                    </Box>
                  </Box>

                  {/* Total Guests Display (Optional, for reference) */}
                  <Typography variant="body2" color="text.secondary">
                    Total: {adults + children + infants} of {listing.guests || 1} guests
                  </Typography>
                </Box>
                <Typography variant="subtitle2">
                  <strong>Bedrooms:</strong> {listing.bedrooms ?? "N/A"}
                </Typography>
                <Typography variant="subtitle2">
                  <strong>Beds:</strong> {listing.beds ?? "N/A"}
                </Typography>
                <Typography variant="subtitle2">
                  <strong>Bathrooms:</strong> {listing.bathrooms ?? "N/A"}
                </Typography>
                {hasCleaningFee && (
                  <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <Typography variant="subtitle2">
                      <strong>Cleaning Fee:</strong> ₱{listing.cleaningFee}
                    </Typography>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={includeCleaningFee}
                          onChange={handleCleaningFeeToggle}
                          color="primary"
                        />
                      }
                      label={includeCleaningFee ? "Included" : "Excluded"}
                      labelPlacement="start"
                    />
                  </Box>
                )}
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mb: 1 }}>
                    <Typography variant="subtitle2">
                      <strong>Amenities: </strong> 
                        {Array.isArray(listing.amenities) && listing.amenities.length > 0 ? (
                          listing.amenities.map((amenity, index) => (
                            <Chip 
                              key={index}  // Use index as key; if amenities have unique IDs, use those instead
                              label={amenity}
                              color="primary" 
                              variant="outlined"
                              size="small"
                            /> 
                          ))
                        ) : (
                          <Chip 
                            label="N/A" 
                            color="primary" 
                            variant="outlined"
                            size="small"
                          />
                        )}
                      </Typography>

                      <Typography variant="body2" sx={{ mt: 1, color: 'text.primary' }}>
                        {listing.uniqueDescription || ""}
                      </Typography>
                  </Box>
              </Box>

              {console.log(host)}

              {host && (
                <Card sx={{ mt: 3, boxShadow: 2 }}>
                  <CardContent sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                    <Avatar src={host.photoURL || ""}>
                      {!host.photoURL && (host.firstName?.charAt(0) || "H")}
                    </Avatar>
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="subtitle1" fontWeight={600}>
                        {host.firstName} {host.lastName}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Host of this listing
                      </Typography>
                    </Box>
                    <Button variant="outlined" onClick={() => setShowMessageModal(true)}>
                      Message Host
                    </Button>
                  </CardContent>
                </Card>
              )}

              <Box sx={{ mt: 4 }}>
                <Typography variant="subtitle1" gutterBottom>
                  Select Dates:
                </Typography>
                <AvailabilityCalendar
                  availability={listing.availability}
                  onDateChange={handleDateChange}
                />
              </Box>

              {/* Payment Breakdown */}
              {paymentBreakdown && (
                <Card sx={{ mt: 3, boxShadow: 2 }}>
                  <CardContent>
                    <Typography variant="h6" gutterBottom sx={{ fontWeight: 'bold' }}>
                      Payment Breakdown
                    </Typography>
                    
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                      <Typography variant="body2">
                        <strong>₱{listing.price}</strong> × {paymentBreakdown.nights} night(s)
                      </Typography>
                      <Typography variant="body2">
                        ₱{paymentBreakdown.subtotal.toLocaleString()}
                      </Typography>
                    </Box>

                    {paymentBreakdown.discount > 0 && (
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                        <Typography variant="body2" color="success.main">
                          Discount({listing.discountType === "percentage" ? `${listing.discountValue}%` : `₱${listing.discountValue}`}):
                        </Typography>
                        <Typography variant="body2" color="success.main">
                          -₱{paymentBreakdown.discount.toLocaleString()}
                        </Typography>
                      </Box>
                    )}

                    {hasCleaningFee && (
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                        <Typography variant="body2" color={includeCleaningFee ? "text.primary" : "text.disabled"}>
                          Cleaning Fee {!includeCleaningFee && "(Excluded)"}
                        </Typography>
                        <Typography 
                          variant="body2" 
                          color={includeCleaningFee ? "text.primary" : "text.disabled"}
                          sx={!includeCleaningFee ? { textDecoration: 'line-through' } : {}}
                        >
                          ₱{paymentBreakdown.cleaningFee.toLocaleString()}
                        </Typography>
                      </Box>
                    )}

                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                      <Typography variant="body2">
                        Service Fee (12%)
                      </Typography>
                      <Typography variant="body2">
                        ₱{paymentBreakdown.tax.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </Typography>
                    </Box>

                    <Divider sx={{ my: 1 }} />

                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
                        Total
                      </Typography>
                      <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
                        ₱{paymentBreakdown.total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </Typography>
                    </Box>

                    {hasCleaningFee && !includeCleaningFee && (
                      <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                        *Cleaning fee has been excluded from the total
                      </Typography>
                    )}
                  </CardContent>
                </Card>
              )}

              <Box
                sx={{
                  position: 'sticky',
                  bottom: -34,
                  width: '100%',  // Ensures it takes the parent's width
                  mt: 4,
                  display: "flex",
                  gap: 2,
                  flexWrap: "wrap",
                  backgroundColor: "white",
                  paddingY: 2,
                }}
              >
                {showPayPal ? (
                  <>
                    <div style={{ marginTop: "20px", width: "100%" }}>  {/* Wrapper for PayPal to match your layout */}
                      <PayPalButtons
                        style={{ layout: "vertical" }}
                        createOrder={(data, actions) => {
                          return actions.order.create({
                            purchase_units: [
                              {
                                amount: {
                                  value: totalAmount.toFixed(2),  // Use the computed total
                                },
                              },
                            ],
                          });
                        }}
                        onApprove={async (data, actions) => {
                          const details = await actions.order.capture();
                          const user = auth.currentUser;

                          if (!user) {
                            alert("Please log in to make a reservation.");
                            return;
                          }

                          try {
                            const checkIn = selectedDates.start;  // Matches your HomesDetailsModal state
                            const checkOut = selectedDates.end;   // Matches your HomesDetailsModal state
                            const nights = Math.ceil((new Date(checkOut) - new Date(checkIn)) / (1000 * 60 * 60 * 24));
                            
                            if (!checkIn || !checkOut || nights <= 0) {
                              alert("Invalid dates selected.");
                              return;
                            }

                            const pricePerNight = parseFloat(listing.price) || 0;
                            const cleaningFee = includeCleaningFee ? parseFloat(listing.cleaningFee) || 0 : 0;
                            const subtotal = pricePerNight * nights;
                            const serviceFee = subtotal * 0.12;
                            const totalPrice = subtotal + cleaningFee + serviceFee;  // Uses your payment logic

                            const bookingData = {
                              uid: user.uid,
                              checkIn: checkIn,
                              checkOut: checkOut,
                              nights: nights,
                              infants:infants,
                              children: children,
                              adults: adults,  // Assuming selectedGuests represents adults; adjust if you have separate states
                              guestEmail: user.email,
                              pricePerNight: pricePerNight,
                              subtotal: subtotal,
                              cleaningFee: cleaningFee,
                              serviceFee: serviceFee,
                              totalPrice: totalPrice,
                              listingTitle: listing.title || "Untitled",
                              listingCategory: listing.category || "Homes",  // Specific to Homes
                              status: "pending",
                              paymentStatus: "paid",
                              createdAt: new Date(),
                              updatedAt: new Date(),
                            };

                            // Add optional fields from your listing
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

                            const bookingsRef = collection(database, "bookings");
                            const docRef = await addDoc(bookingsRef, bookingData);

                            alert("Booking successful!");
                            onClose();  // Closes the modal as in your original code
                          } catch (error) {
                            console.error("Error creating reservation:", error);
                            alert(`Failed to create reservation: ${error.message}`);
                          }
                        }}
                        onCancel={() => {
                          setShowPayPal(false);  // Optionally handle cancel, but we're using the Cancel button below
                        }}
                      />
                    </div>
                    <Button 
                      variant="outlined" 
                      color="inherit" 
                      sx={{ flex: 1, minWidth: 140 }} 
                      onClick={() => setShowPayPal(false)}  // Reverts to original buttons
                    >
                      Cancel
                    </Button>
                  </>
                ) : (
                  <>
                    <Button 
                      variant="contained" 
                      color="primary" 
                      sx={{ flex: 1, minWidth: 140 }}
                      disabled={!paymentBreakdown}
                      onClick={handleBookNow}  // Now calls the new function
                    >
                      Book Now  
                    </Button>
                    <Button variant="outlined" color="inherit" sx={{ flex: 1, minWidth: 140 }} onClick={onClose}>
                      Close
                    </Button>
                  </>
                )}
              </Box>
            </Box>
          </Grid>
        </Grid>
        
      {/* Message Host Modal */}
        <MessageHostModal
          open={showMessageModal}
          onClose={() => setShowMessageModal(false)}
          hostId={listing?.uid}
        />
      </Box>
    </Modal>
  );
};

export default HomesDetailsModal;