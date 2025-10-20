import React, { useEffect, useState } from "react";
import { PayPalButtons } from "@paypal/react-paypal-js";  // For PayPal
import { auth } from "../config/firebase";  // For user auth
import { collection, addDoc } from "firebase/firestore";  // For Firestore (add to existing Firestore import)

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
import CloseIcon from "@mui/icons-material/Close";
import ArrowBackIosNewIcon from "@mui/icons-material/ArrowBackIosNew";
import ArrowForwardIosIcon from "@mui/icons-material/ArrowForwardIos";
import AddIcon from "@mui/icons-material/Add";
import RemoveIcon from "@mui/icons-material/Remove";
import ScheduleIcon from "@mui/icons-material/Schedule";
import GroupIcon from "@mui/icons-material/Group";
import LanguageIcon from "@mui/icons-material/Language";
import PlaceIcon from "@mui/icons-material/Place";
import { doc, getDoc } from "firebase/firestore";
import { database } from "../config/firebase";

const ExperienceDetailsModal = ({ listingId, onClose }) => {
  const [experience, setExperience] = useState(null);
  const [currentPhoto, setCurrentPhoto] = useState(0);
  const [selectedParticipants, setSelectedParticipants] = useState(1);
  const [selectedSchedule, setSelectedSchedule] = useState(null);
  const [paymentBreakdown, setPaymentBreakdown] = useState(null);
  const [includeExtras, setIncludeExtras] = useState(true);
  const isMobile = useMediaQuery("(max-width:768px)");

  const [showPayPal, setShowPayPal] = useState(false);

  useEffect(() => {
    const fetchExperienceDetails = async () => {
      try {
        const docRef = doc(database, "listings", listingId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setExperience(docSnap.data());
          setSelectedParticipants(1);
        }
      } catch (error) {
        console.error("Error fetching experience details:", error);
      }
    };

    if (listingId) fetchExperienceDetails();
    setCurrentPhoto(0);
  }, [listingId]);

  useEffect(() => {
    if (!experience?.photos?.length) {
      setCurrentPhoto(0);
      return;
    }
    setCurrentPhoto((idx) => {
      const len = experience.photos.length;
      if (idx >= len) return 0;
      if (idx < 0) return (idx + len) % len;
      return idx;
    });
  }, [experience?.photos]);

  // Calculate payment breakdown when participants, schedule, or extras preference changes
  useEffect(() => {
    if (selectedSchedule && experience) {
      calculatePayment();
    } else {
      setPaymentBreakdown(null);
    }
  }, [selectedParticipants, selectedSchedule, experience]);

  const calculatePayment = () => {
    if (!experience || !selectedSchedule) return;

    const basePrice = parseFloat(experience.price) || 0;
    const subtotal = basePrice * selectedParticipants;
    const totalBeforeTax = subtotal;  // No extrasCost added
    const tax = totalBeforeTax * 0.12;  // 12% tax
    const total = totalBeforeTax + tax;

    setPaymentBreakdown({
      participants: selectedParticipants,
      basePrice,
      subtotal,
      tax,
      total,
    });
  };

  const handleIncrementParticipants = () => {
    const maxParticipants = experience.maxParticipants || 30;
    if (selectedParticipants < maxParticipants) {
      setSelectedParticipants(prev => prev + 1);
    }
  };

  const handleDecrementParticipants = () => {
    if (selectedParticipants > 1) {
      setSelectedParticipants(prev => prev - 1);
    }
  };

  const handleScheduleSelect = (schedule) => {
    setSelectedSchedule(schedule);
  };

  const handleExtrasToggle = (event) => {
    setIncludeExtras(event.target.checked);
  };

  const handleBookNow = () => {
    if (!selectedSchedule || !paymentBreakdown) {
      alert("Please select a schedule and ensure payment details are calculated.");
      return;
    }
    setShowPayPal(true);  // Show PayPal buttons
  };

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

  if (!experience) return null;

  const photos = Array.isArray(experience.photos) ? experience.photos : [];
  const hasPhotos = photos.length > 0;
  const hasAmenities = experience.amenities && experience.amenities.length > 0;
  const hasSchedule = experience.schedule && experience.schedule.length > 0;
  const hasLanguages = experience.languages && experience.languages.length > 0;

  return (
    <Modal
      open={!!listingId}
      onClose={onClose}
      aria-labelledby="experience-details-title"
      aria-describedby="experience-details-desc"
    >
      <Box
        sx={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: isMobile ? "95%" : "1300px",
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
        <Grid container sx={{ height: "100%", flex: 1 }}>
          {/* LEFT - Image carousel */}
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
              minHeight: 300,
              flex: 2,
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
              {hasPhotos ? (
                <img
                  key={photos[currentPhoto]}
                  src={photos[currentPhoto]}
                  alt={`${experience.title} - photo ${currentPhoto + 1}`}
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
                      left: 16,
                      top: "50%",
                      transform: "translateY(-50%)",
                      bgcolor: "rgba(0,0,0,0.6)",
                      color: "common.white",
                      "&:hover": { bgcolor: "rgba(0,0,0,0.8)" },
                    }}
                  >
                    <ArrowBackIosNewIcon />
                  </IconButton>

                  <IconButton
                    onClick={nextPhoto}
                    aria-label="next-photo"
                    sx={{
                      position: "absolute",
                      right: 16,
                      top: "50%",
                      transform: "translateY(-50%)",
                      bgcolor: "rgba(0,0,0,0.6)",
                      color: "common.white",
                      "&:hover": { bgcolor: "rgba(0,0,0,0.8)" },
                    }}
                  >
                    <ArrowForwardIosIcon />
                  </IconButton>
                </>
              )}

              {hasPhotos && photos.length > 1 && (
                <Box
                  sx={{
                    position: "absolute",
                    bottom: 16,
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
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        bgcolor: i === currentPhoto ? "primary.main" : "rgba(255,255,255,0.6)",
                        cursor: "pointer",
                        transition: "all 0.2s",
                      }}
                    />
                  ))}
                </Box>
              )}
            </Box>
          </Grid>

          {/* RIGHT - Content and booking section */}
          <Grid
            item
            xs={12}
            md={6}
            sx={{
              height: "100%",
              position: "relative",
              p: { xs: 3, md: 4 },
              overflowY: "auto",
              bgcolor: "background.paper",
              flex: 1,
              display: "flex",
              flexDirection: "column",
              justifyContent: "flex-start",
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

            <Box sx={{ pt: 1 }}>
              {/* Header Section */}
              <Box sx={{ mb: 3 }}>
                <Typography variant="h4" fontWeight={700} gutterBottom>
                  {experience.title}
                </Typography>
                <Chip 
                  label={experience.listingType} 
                  color="primary" 
                  variant="outlined"
                  size="medium"
                  sx={{ mb: 2 }}
                />
                <Typography variant="body1" color="text.secondary" paragraph>
                  {experience.description}
                </Typography>
              </Box>

              {/* Key Details Grid */}
              <Grid container spacing={3} sx={{ mb: 4 }}>
                <Grid item xs={6}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <ScheduleIcon color="primary" />
                    <Box>
                      <Typography variant="subtitle2" color="text.secondary">
                        Duration
                      </Typography>
                      <Typography variant="body1" fontWeight={500}>
                        {experience.duration}
                      </Typography>
                    </Box>
                  </Box>
                </Grid>
                
                <Grid item xs={6}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <GroupIcon color="primary" />
                    <Box>
                      <Typography variant="subtitle2" color="text.secondary">
                        Max Participants
                      </Typography>
                      <Typography variant="body1" fontWeight={500}>
                        {experience.maxParticipants}
                      </Typography>
                    </Box>
                  </Box>
                </Grid>

                <Grid item xs={6}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <PlaceIcon color="primary" />
                    <Box>
                      <Typography variant="subtitle2" color="text.secondary">
                        Experience Type
                      </Typography>
                      <Typography variant="body1" fontWeight={500}>
                        {experience.experienceType === "in-person" ? "In-Person" : "Online"}
                      </Typography>
                    </Box>
                  </Box>
                </Grid>

                {hasLanguages && (
                  <Grid item xs={6}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <LanguageIcon color="primary" />
                      <Box>
                        <Typography variant="subtitle2" color="text.secondary">
                          Languages
                        </Typography>
                        <Typography variant="body1" fontWeight={500}>
                          {experience.languages.join(", ")}
                        </Typography>
                      </Box>
                    </Box>
                  </Grid>
                )}
              </Grid>

              {/* Location */}
              <Box sx={{ mb: 3 }}>
                <Typography variant="h6" gutterBottom>
                  Location
                </Typography>
                <Typography variant="body1">
                  {[experience.street, experience.barangay.name, experience.municipality.name, experience.province.name, experience.region.name]
                    .filter(Boolean)
                    .join(", ")}
                </Typography>
              </Box>

              {/* Age Restriction */}
              {experience.ageRestriction && (
                <Box sx={{ mb: 3 }}>
                  <Typography variant="h6" gutterBottom>
                    Age Requirements
                  </Typography>
                  <Typography variant="body1">
                    {experience.ageRestriction.min} - {experience.ageRestriction.max} years old
                  </Typography>
                </Box>
              )}

              {/* Host Requirements */}
              {experience.hostRequirements && (
                <Box sx={{ mb: 3 }}>
                  <Typography variant="h6" gutterBottom>
                    Requirements
                  </Typography>
                  <Typography variant="body1">
                    {experience.hostRequirements}
                  </Typography>
                </Box>
              )}

              {/* Booking Section */}
              <Card variant="outlined" sx={{ mb: 3 }}>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Book This Experience
                  </Typography>

                  {/* Participants Selection */}
                  <Box sx={{ mb: 3 }}>
                    <Typography variant="subtitle1" gutterBottom>
                      Number of Participants
                    </Typography>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                      <IconButton 
                        onClick={handleDecrementParticipants} 
                        disabled={selectedParticipants <= 1}
                        size="small"
                      >
                        <RemoveIcon />
                      </IconButton>
                      <Typography variant="h6" sx={{ minWidth: "40px", textAlign: "center" }}>
                        {selectedParticipants}
                      </Typography>
                      <IconButton 
                        onClick={handleIncrementParticipants} 
                        disabled={selectedParticipants >= experience.maxParticipants}
                        size="small"
                      >
                        <AddIcon />
                      </IconButton>
                      <Typography variant="body2" color="text.secondary">
                        Max: {experience.maxParticipants}
                      </Typography>
                    </Box>
                  </Box>

                  {/* Schedule Selection */}
                  <Box sx={{ mb: 3 }}>
                    <Typography variant="subtitle1" gutterBottom>
                      Select Schedule
                    </Typography>
                    {hasSchedule ? (
                      <Box sx={{ display: "grid", gap: 1 }}>
                        {experience.schedule.map((schedule, index) => (
                          <Card
                            key={index}
                            variant="outlined"
                            sx={{
                              cursor: "pointer",
                              border: selectedSchedule?.date === schedule.date && selectedSchedule?.time === schedule.time 
                                ? "2px solid" 
                                : "1px solid",
                              borderColor: selectedSchedule?.date === schedule.date && selectedSchedule?.time === schedule.time 
                                ? "primary.main" 
                                : "divider",
                              bgcolor: selectedSchedule?.date === schedule.date && selectedSchedule?.time === schedule.time 
                                ? "primary.light" 
                                : "background.paper",
                              transition: "all 0.2s",
                              '&:hover': {
                                borderColor: "primary.main",
                              },
                            }}
                            onClick={() => handleScheduleSelect(schedule)}
                          >
                            <CardContent sx={{ py: 2 }}>
                              <Typography variant="subtitle1" fontWeight="bold">
                                {new Date(schedule.date).toLocaleDateString('en-US', { 
                                  weekday: 'long', 
                                  year: 'numeric', 
                                  month: 'long', 
                                  day: 'numeric' 
                                })}
                              </Typography>
                              <Typography variant="body2" color="text.secondary">
                                {schedule.time}
                              </Typography>
                            </CardContent>
                          </Card>
                        ))}
                      </Box>
                    ) : (
                      <Typography variant="body2" color="text.secondary">
                        No schedules available.
                      </Typography>
                    )}
                  </Box>

                  {/* Amenities Toggle */}
                  {hasAmenities && (
                    <Box sx={{ mb: 3 }}>
                      <Typography variant="h6" gutterBottom>
                        Included Amenities
                      </Typography>
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                        {experience.amenities.map((amenity, index) => (
                          <Chip
                            key={index}
                            label={amenity}
                            color="primary"
                            variant="outlined"
                            size="small"
                          />
                        ))}
                      </Box>
                    </Box>
                  )}
                </CardContent>
              </Card>

              {/* Payment Breakdown */}
              {paymentBreakdown && (
                <Card sx={{ mb: 3 }}>
                  <CardContent>
                    <Typography variant="h6" gutterBottom sx={{ fontWeight: 'bold' }}>
                      Payment Summary
                    </Typography>
                    
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                      <Typography variant="body2">
                        ₱{experience.price} × {paymentBreakdown.participants} {paymentBreakdown.participants === 1 ? 'person' : 'people'}
                      </Typography>
                      <Typography variant="body2">
                        ₱{paymentBreakdown.subtotal.toLocaleString()}
                      </Typography>
                    </Box>

                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                      <Typography variant="body2">
                        Service Fee (12%)
                      </Typography>
                      <Typography variant="body2">
                        ₱{paymentBreakdown.tax.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </Typography>
                    </Box>

                    <Divider sx={{ my: 2 }} />

                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                        Total
                      </Typography>
                      <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                        ₱{paymentBreakdown.total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </Typography>
                    </Box>
                  </CardContent>
                </Card>
              )}

              {/* Cancellation Policy */}
              {experience.cancellationPolicy && (
                <Box sx={{ mt: 3, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
                  <Typography variant="subtitle2" gutterBottom>
                    Cancellation Policy
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {experience.cancellationPolicy}
                  </Typography>
                </Box>
              )}

              {/* Action Buttons */}
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
                    <div style={{ marginTop: "20px", width: "100%" }}>  {/* Wrapper for PayPal */}
                      <PayPalButtons
                        style={{ layout: "vertical" }}
                        createOrder={(data, actions) => {
                          return actions.order.create({
                            purchase_units: [
                              {
                                amount: {
                                  value: paymentBreakdown.total.toFixed(2),  // Use paymentBreakdown.total
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
                            // Experience-specific: Use selectedParticipants and selectedSchedule
                            const quantity = selectedParticipants;
                            const schedule = selectedSchedule;  // e.g., { date: "2023-10-01", time: "10:00 AM" }

                            if (!schedule || quantity <= 0) {
                              alert("Invalid schedule or quantity selected.");
                              return;
                            }

                            // Use your existing paymentBreakdown
                            const subtotal = paymentBreakdown.subtotal;
                            const serviceFee = paymentBreakdown.tax;  // 12% tax
                            const totalPrice = paymentBreakdown.total;

                            const bookingData = {
                              uid: user.uid,
                              quantity: quantity,
                              schedule: schedule,  // Add schedule details
                              guestEmail: user.email,
                              subtotal: subtotal,
                              serviceFee: serviceFee,
                              totalPrice: totalPrice,
                              listingTitle: experience.title || "Untitled",
                              listingCategory: "Experiences",  // Changed for experiences
                              status: "pending",
                              paymentStatus: "paid",
                              createdAt: new Date(),
                              updatedAt: new Date(),
                              // Add listing photos
                              listingPhotos: experience.photos && experience.photos.length > 0 ? experience.photos : [],
                            };

                            // Add optional fields from your experience listing
                            if (experience.uid) {
                              bookingData.hostId = experience.uid;  // Assuming experience has a host UID
                            }

                            if (user.displayName) {
                              bookingData.guestName = user.displayName;
                            }

                            if (experience.experienceType) {
                              bookingData.experienceType = experience.experienceType;  // e.g., "in-person" or "online"
                            }

                            if (experience.duration) {
                              bookingData.duration = experience.duration;
                            }

                            const bookingsRef = collection(database, "bookings");
                            const docRef = await addDoc(bookingsRef, bookingData);

                            alert("Booking successful!");
                            onClose();  // Closes the modal
                          } catch (error) {
                            console.error("Error creating reservation:", error);
                            alert(`Failed to create reservation: ${error.message}`);
                          }
                        }}

                        onCancel={() => {
                          setShowPayPal(false);  // Handle cancel
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
                      onClick={handleBookNow}  // Calls the new function
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
      </Box>
    </Modal>
  );
};

export default ExperienceDetailsModal;