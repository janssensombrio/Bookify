import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { doc, collection, addDoc, updateDoc, query, where, getDocs } from "firebase/firestore";
import { auth, database } from "../../config/firebase";
import "./styles/host-set-up.css";

import { Box, Typography, Button, Toolbar, Grid, Card, CardActionArea, Stack, TextField, FormControl, FormControlLabel, InputLabel, Checkbox, Select, MenuItem, Chip, Autocomplete, Paper, IconButton, CardMedia } from '@mui/material';

import CloseIcon from "@mui/icons-material/Close";
import RestaurantIcon from '@mui/icons-material/Restaurant';
import ExploreIcon from '@mui/icons-material/Explore';
import SpaIcon from '@mui/icons-material/Spa';
import MuseumIcon from '@mui/icons-material/Museum';
import MovieIcon from '@mui/icons-material/Movie';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';


const CLOUD_NAME = "dijmlbysr"; // From Cloudinary dashboard
const UPLOAD_PRESET = "listing-uploads"; // Create an unsigned preset in Cloudinary for uploads

export const HostSetUpExperiences = () => {
  const location = useLocation();

  const initialCategory = location.state?.category || "";

  // for the location
  const [regions, setRegions] = useState([]);
  const [provinces, setProvinces] = useState([]);
  const [municipalities, setMunicipalities] = useState([]);
  const [barangays, setBarangays] = useState([]);

  // for the schedule
  const [showAddSchedule, setShowAddSchedule] = useState(false);
  const [newSchedule, setNewSchedule] = useState({ date: "", time: "" });

  const [newAmenity, setNewAmenity] = useState("");

  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);

  // for swithcing between pages
  const navigate = useNavigate();
  const [step, setStep] = useState(1);

  const [listingType, setListingType] = useState(""); // subcategory selected

  const [formData, setFormData] = useState({
    category: initialCategory,
    listingType: "",
    title: "",
    region: "",
    province: "",
    municipality: "",
    barangay: "",
    street: "",
    duration: "", // in hours or minutes
    maxParticipants: 1,
    ageRestriction: { min: 0, max: 100 },
    experienceType: "in-person", // in-person or online
    languages: [],
    schedule: [], // array of date/time objects
    price: "",
    amenities: [], // food, drinks, equipment, transport, etc.
    photos: [],
    description: "",
    hostRequirements: "",
    cancellationPolicy: "",
    agreeToTerms: false,
  });

  const nextStep = () => setStep(step + 1);
  const prevStep = () => setStep(step - 1);

  const handleChange = (key, value) => {
    setFormData(prev => ({ ...prev, [key]: value }));
  };

  const handleAmenityToggle = (amenity) => {
    setFormData((prev) => ({
      ...prev,
      amenities: prev.amenities.includes(amenity)
        ? prev.amenities.filter((a) => a !== amenity)
        : [...prev.amenities, amenity],
    }));
  };

  const handleLanguageToggle = (lang) => {
    setFormData((prev) => ({
      ...prev,
      languages: prev.languages.includes(lang)
        ? prev.languages.filter((l) => l !== lang)
        : [...prev.languages, lang],
    }));
  };

  // const handlePhotoUpload = (files) => {
  //   setFormData({ ...formData, photos: Array.from(files) });
  // };

  const [draftId, setDraftId] = useState(null);

  const saveDraft = async () => {
    try {
      const user = auth.currentUser;
      if (!user) return alert("You must be logged in to save a draft.");

      // ✅ Get readable names for location fields
      const selectedRegion = regions.find(r => r.code === formData.region)?.name || "";
      const selectedProvince = provinces.find(p => p.code === formData.province)?.name || "";
      const selectedMunicipality = municipalities.find(m => m.code === formData.municipality)?.name || "";
      const selectedBarangay = barangays.find(b => b.code === formData.barangay)?.name || "";

      const dataToSave = {
        ...formData,
        uid: user.uid,
        region: { code: formData.region, name: selectedRegion },
        province: { code: formData.province, name: selectedProvince },
        municipality: { code: formData.municipality, name: selectedMunicipality },
        barangay: { code: formData.barangay, name: selectedBarangay },
        status: "draft",
        savedAt: new Date(),
      };

      let docRef;

      if (draftId) {
        // ✅ Update existing draft
        docRef = doc(database, "listings", draftId);
        await updateDoc(docRef, dataToSave);
      } else {
        // ✅ Create a new draft
        docRef = await addDoc(collection(database, "listings"), dataToSave);
        setDraftId(docRef.id);
      }

      alert("Draft saved successfully!");

      navigate("/hostpage", { state: { activePage: "listings", showDrafts: true } });
    } catch (error) {
      console.error("Error saving draft:", error);
      alert("Failed to save draft.");
    }
  };
  
  const handleSubmit = async () => {
    try {
      const user = auth.currentUser;
      if (!user) return alert("You must be logged in to publish.");

      // ✅ Get readable names
      const selectedRegion = regions.find(r => r.code === formData.region)?.name || "";
      const selectedProvince = provinces.find(p => p.code === formData.province)?.name || "";
      const selectedMunicipality = municipalities.find(m => m.code === formData.municipality)?.name || "";
      const selectedBarangay = barangays.find(b => b.code === formData.barangay)?.name || "";

      const dataToSave = {
        ...formData,
        uid: user.uid,
        region: { code: formData.region, name: selectedRegion },
        province: { code: formData.province, name: selectedProvince },
        municipality: { code: formData.municipality, name: selectedMunicipality },
        barangay: { code: formData.barangay, name: selectedBarangay },
        status: "published",
        publishedAt: new Date(),
      };

      if (draftId) {
        // ✅ Update existing draft
        const draftRef = doc(database, "listings", draftId);
        await updateDoc(draftRef, dataToSave);
      } else {
        // ✅ Create a new document
        await addDoc(collection(database, "listings"), dataToSave);
      }

      alert("Your listing has been published!");
      
      navigate("/hostpage");
    } catch (error) {
      console.error("Error publishing listing:", error);
      alert("Failed to publish listing.");
      navigate("/hostpage");
    }
  };

  const saveHost = async () => {
    try {
        const user = auth.currentUser;
        if (!user) {
            alert("You must be logged in first.");
            return;
        }

        const hostsRef = collection(database, "hosts");
        const q = query(hostsRef, where("uid", "==", user.uid));
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            await addDoc(hostsRef, {
                uid: user.uid,
                email: user.email,
                createdAt: new Date(),
            });
            console.log("Host added successfully!");
        } else {
            console.log("Host already exists, skipping creation.");
        }
    } catch (err) {
        console.error("Error adding host:", err);
        alert("Something went wrong saving host.");
    }
    };

    const handleGetStarted = async () => {
        if (!listingType) return alert("Please select a subcategory to get started.");
        setFormData({ ...formData, listingType });
        await saveHost();
        setStep(2); // go to the next step
    };

    const handleBack = async () => {
      const user = auth.currentUser;
      if (!user) return navigate("/home"); // fallback
  
      const hostsRef = collection(database, "hosts");
      const q = query(hostsRef, where("uid", "==", user.uid));
      const snapshot = await getDocs(q);
  
      if (!snapshot.empty) {
        navigate("/hostpage"); // user is already a host
      } else {
        navigate("/home"); // regular user
      }
    };

    useEffect(() => {
      fetch("https://psgc.gitlab.io/api/regions/")
        .then((res) => res.json())
        .then((data) => setRegions(data))
        .catch((err) => console.error("Failed to load regions:", err));
    }, []);

    useEffect(() => {
      if (formData.schedule && Array.isArray(formData.schedule)) {
        const normalized = formData.schedule.map(item =>
          typeof item === "string"
            ? { date: item, startTime: "", endTime: "" }
            : item
        );
        setFormData(prev => ({ ...prev, schedule: normalized }));
      }
    }, []);

    useEffect(() => {
      if (!formData.schedule) setFormData(prev => ({ ...prev, schedule: [] }));
    }, []);

  return (
    <div className="host-setup-page">
       {step === 1 && (
            <Box sx={{ textAlign: 'center', mb: 4 }}>
              <Toolbar />
              <Toolbar />
              <Toolbar />
              <Toolbar />
              <Typography variant="h3" component="h1" gutterBottom sx={{ fontWeight: 600, color: 'primary.main' }}>
                Select Your Experience Type
              </Typography>
              <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
                Choose the type of experience you're offering to get started.
              </Typography>

              <Grid container spacing={3} justifyContent="center" sx={{ mb: 4 }}>
                {[
                  { value: "Food", label: "Food", desc: "Culinary adventures and dining experiences.", icon: <RestaurantIcon sx={{ fontSize: 40, color: 'primary.main' }} /> },
                  { value: "Adventure", label: "Adventure", desc: "Thrilling outdoor and exploratory activities.", icon: <ExploreIcon sx={{ fontSize: 40, color: 'primary.main' }} /> },
                  { value: "Wellness", label: "Wellness", desc: "Relaxing and health-focused experiences.", icon: <SpaIcon sx={{ fontSize: 40, color: 'primary.main' }} /> },
                  { value: "Culture", label: "Culture", desc: "Immersive cultural and historical tours.", icon: <MuseumIcon sx={{ fontSize: 40, color: 'primary.main' }} /> },
                  { value: "Entertainment", label: "Entertainment", desc: "Fun events and entertainment options.", icon: <MovieIcon sx={{ fontSize: 40, color: 'primary.main' }} /> },
                ].map((option) => (
                  <Grid item xs={12} sm={6} md={4} key={option.value}>
                    <Card
                      sx={{
                        height: '100%',
                        border: listingType === option.value ? '2px solid' : '1px solid',
                        borderColor: listingType === option.value ? 'primary.main' : 'grey.300',
                        boxShadow: listingType === option.value ? 4 : 1,
                        transition: 'all 0.3s ease',
                        '&:hover': { boxShadow: 3 },
                      }}
                    >
                      <CardActionArea
                        onClick={() => setListingType(option.value)}
                        sx={{ height: '100%', p: 2, textAlign: 'center' }}
                      >
                        <Box sx={{ mb: 2 }}>{option.icon}</Box>
                        <Typography variant="h6" component="h3" gutterBottom sx={{ fontWeight: 500 }}>
                          {option.label}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {option.desc}
                        </Typography>
                      </CardActionArea>
                    </Card>
                  </Grid>
                ))}
              </Grid>

              <Stack direction="row" spacing={2} justifyContent="center">
                <Button variant="outlined" onClick={handleBack} sx={{ px: 4 }}>
                  Back to Home
                </Button>
                <Button
                  variant="contained"
                  onClick={handleGetStarted}
                  disabled={!listingType}
                  sx={{ px: 4 }}
                >
                  Get Started
                </Button>
              </Stack>
            </Box>
          )}

      {/* Step 2: Basic Info */}
      {step === 2 && (
        <Box sx={{ textAlign: 'center', mb: 4, maxWidth: 600, mx: 'auto' }}>
          <Toolbar />
          <Toolbar />
          <Typography variant="h3" component="h1" gutterBottom sx={{ fontWeight: 600, color: 'primary.main' }}>
            Basic Information
          </Typography>

          <TextField
            fullWidth
            label="Experience Title"
            placeholder="Experience Title"
            value={formData.title}
            onChange={(e) => handleChange("title", e.target.value)}
            sx={{ mb: 3 }}
          />

          {/* REGION */}
          <FormControl fullWidth sx={{ mb: 3 }}>
            <InputLabel>Region</InputLabel>
            <Select
              value={formData.region}
              label="Region"
              onChange={async (e) => {
                const code = e.target.value;
                handleChange("region", code);
                handleChange("province", "");
                handleChange("municipality", "");
                handleChange("barangay", "");
                setProvinces([]);
                setMunicipalities([]);
                setBarangays([]);

                if (code) {
                  const res = await fetch(`https://psgc.gitlab.io/api/regions/${code}/provinces/`);
                  const data = await res.json();
                  setProvinces(data);
                }
              }}
            >
              <MenuItem value="">
                <em>Select Region</em>
              </MenuItem>
              {regions.map((region) => (
                <MenuItem key={region.code} value={region.code}>
                  {region.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* Province */}
          <FormControl fullWidth sx={{ mb: 3 }} disabled={!formData.region}>
            <InputLabel>Province</InputLabel>
            <Select
              value={formData.province}
              label="Province"
              onChange={async (e) => {
                const code = e.target.value;
                handleChange("province", code);
                handleChange("municipality", "");
                handleChange("barangay", "");
                setMunicipalities([]);
                setBarangays([]);

                if (code) {
                  const res = await fetch(`https://psgc.gitlab.io/api/provinces/${code}/municipalities/`);
                  const data = await res.json();
                  setMunicipalities(data);
                }
              }}
            >
              <MenuItem value="">
                <em>Select Province</em>
              </MenuItem>
              {provinces.map((prov) => (
                <MenuItem key={prov.code} value={prov.code}>
                  {prov.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* Municipality */}
          <FormControl fullWidth sx={{ mb: 3 }} disabled={!formData.province}>
            <InputLabel>Municipality</InputLabel>
            <Select
              value={formData.municipality}
              label="Municipality"
              onChange={async (e) => {
                const code = e.target.value;
                handleChange("municipality", code);
                handleChange("barangay", "");
                setBarangays([]);

                if (code) {
                  const res = await fetch(`https://psgc.gitlab.io/api/municipalities/${code}/barangays/`);
                  const data = await res.json();
                  setBarangays(data);
                }
              }}
            >
              <MenuItem value="">
                <em>Select Municipality</em>
              </MenuItem>
              {municipalities.map((mun) => (
                <MenuItem key={mun.code} value={mun.code}>
                  {mun.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* Barangay */}
          <FormControl fullWidth sx={{ mb: 3 }} disabled={!formData.municipality}>
            <InputLabel>Barangay</InputLabel>
            <Select
              value={formData.barangay}
              label="Barangay"
              onChange={(e) => handleChange("barangay", e.target.value)}
            >
              <MenuItem value="">
                <em>Select Barangay</em>
              </MenuItem>
              {barangays.map((brgy) => (
                <MenuItem key={brgy.code} value={brgy.code}>
                  {brgy.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* Street */}
          <TextField
            fullWidth
            label="Street / House No."
            placeholder="Street / House No."
            value={formData.street}
            disabled={!formData.barangay}
            onChange={(e) => handleChange("street", e.target.value)}
            sx={{ mb: 3 }}
          />

          <TextField
            fullWidth
            label="Duration"
            placeholder="Duration (e.g., 2 hours)"
            value={formData.duration}
            disabled={!formData.street}
            onChange={(e) => handleChange("duration", e.target.value)}
            sx={{ mb: 4 }}
          />

          <Stack direction="row" spacing={2} justifyContent="center">
            <Button variant="outlined" onClick={prevStep} sx={{ px: 4 }}>
              Back
            </Button>
            <Button
              variant="text"
              onClick={saveDraft}
              disabled={!formData.street || !formData.duration}
              sx={{ px: 4 }}
            >
              Save Draft
            </Button>
            <Button
              variant="contained"
              onClick={nextStep}
              disabled={!formData.street || !formData.duration}
              sx={{ px: 4 }}
            >
              Next
            </Button>
          </Stack>
        </Box>
      )}

      {/* Step 3: Participants & Type */}
      {step === 3 && (
        <Box sx={{ textAlign: 'center', mb: 4, maxWidth: 600, mx: 'auto' }}>
          <Toolbar />
          <Toolbar />
          <Typography
            variant="h3"
            component="h1"
            gutterBottom
            sx={{ fontWeight: 600, color: 'primary.main' }}
          >
            Participants & Type
          </Typography>

          {/* Max Participants */}
          <TextField
            fullWidth
            type="number"
            label="Maximum Participants"
            placeholder="Enter max number of participants"
            value={formData.maxParticipants}
            onChange={(e) => handleChange("maxParticipants", Number(e.target.value))}
            sx={{ mb: 3 }}
          />

          {/* Experience Type */}
          <FormControl fullWidth sx={{ mb: 3 }}>
            <InputLabel>Experience Type</InputLabel>
            <Select
              value={formData.experienceType}
              label="Experience Type"
              onChange={(e) => handleChange("experienceType", e.target.value)}
            >
              <MenuItem value="in-person">In-Person</MenuItem>
              <MenuItem value="online">Online</MenuItem>
            </Select>
          </FormControl>

          {/* Age Restriction */}
          <Typography variant="h6" sx={{ mb: 2, fontWeight: 500, color: 'primary.main' }}>
            Age Restriction
          </Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 4 }}>
            <TextField
              type="number"
              label="Minimum Age"
              placeholder="Min"
              value={formData.ageRestriction.min}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  ageRestriction: { ...formData.ageRestriction, min: Number(e.target.value) },
                })
              }
              fullWidth
            />
            <TextField
              type="number"
              label="Maximum Age"
              placeholder="Max"
              value={formData.ageRestriction.max}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  ageRestriction: { ...formData.ageRestriction, max: Number(e.target.value) },
                })
              }
              fullWidth
            />
          </Stack>

          {/* Buttons */}
          <Stack direction="row" spacing={2} justifyContent="center">
            <Button variant="outlined" onClick={prevStep} sx={{ px: 4 }}>
              Back
            </Button>
            <Button variant="text" onClick={saveDraft} sx={{ px: 4 }}>
              Save Draft
            </Button>
            <Button
              variant="contained"
              onClick={nextStep}
              disabled={!formData.maxParticipants || !formData.experienceType}
              sx={{ px: 4 }}
            >
              Next
            </Button>
          </Stack>
        </Box>
      )}

      {/* Step 4: Languages Offered */}
      {step === 4 && (
        <Box sx={{ textAlign: 'center', mb: 4, maxWidth: 600, mx: 'auto' }}>
          <Toolbar />
          <Toolbar />

          <Typography
            variant="h3"
            component="h1"
            gutterBottom
            sx={{ fontWeight: 600, color: 'primary.main' }}
          >
            Languages Offered
          </Typography>

          <Typography
            variant="body1"
            color="text.secondary"
            sx={{ mb: 4 }}
          >
            Select or type the languages you can offer to your guests.
          </Typography>

          <Autocomplete
            multiple
            freeSolo
            options={[
              "English", "Spanish", "French", "Mandarin", "Tagalog", "Arabic", "Hindi", "Bengali",
              "Portuguese", "Russian", "Japanese", "Korean", "German", "Italian", "Turkish", "Vietnamese",
              "Polish", "Dutch", "Thai", "Greek", "Swedish", "Czech", "Finnish", "Hungarian", "Romanian",
              "Hebrew", "Indonesian", "Malay", "Tamil", "Urdu", "Persian", "Punjabi", "Ukrainian",
              "Serbian", "Croatian", "Bulgarian", "Danish", "Norwegian", "Slovak", "Slovenian", "Latvian",
              "Lithuanian", "Estonian", "Swahili", "Filipino", "Cantonese", "Nepali", "Sinhala", "Burmese",
              "Khmer", "Lao", "Mongolian", "Amharic", "Zulu", "Xhosa", "Afrikaans"
            ]}
            value={formData.languages}
            onChange={(e, newValue) => setFormData({ ...formData, languages: newValue })}
            renderTags={(value, getTagProps) =>
              value.map((option, index) => (
                <Chip
                  key={option}
                  label={option}
                  color="primary"
                  variant="outlined"
                  {...getTagProps({ index })}
                />
              ))
            }
            renderInput={(params) => (
              <TextField
                {...params}
                label="Select or type a language"
                placeholder="Start typing..."
                fullWidth
              />
            )}
            sx={{ mb: 4 }}
          />

          <Stack direction="row" spacing={2} justifyContent="center">
            <Button variant="outlined" onClick={prevStep} sx={{ px: 4 }}>
              Back
            </Button>
            <Button variant="text" onClick={saveDraft} sx={{ px: 4 }}>
              Save Draft
            </Button>
            <Button
              variant="contained"
              onClick={nextStep}
              disabled={formData.languages.length === 0}
              sx={{ px: 4 }}
            >
              Next
            </Button>
          </Stack>
        </Box>
      )}

      {/* Step 5: Schedule */}
      {step === 5 && (
        <Box sx={{ textAlign: 'center', mb: 4, maxWidth: 600, mx: 'auto' }}>
          <Toolbar />
          <Toolbar />
          <Typography
            variant="h3"
            component="h1"
            gutterBottom
            sx={{ fontWeight: 600, color: 'primary.main' }}
          >
            Schedule
          </Typography>

          <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
            Add specific dates and times when your experience is available.
          </Typography>

          <Box
            sx={{
              border: '1px solid',
              borderColor: 'grey.300',
              borderRadius: 2,
              p: 3,
              textAlign: 'left',
              mb: 4,
            }}
          >
            <Typography variant="h6" sx={{ mb: 2, fontWeight: 500, color: 'primary.main' }}>
              Schedule List
            </Typography>

            {/* Display existing schedules */}
            {formData.schedule && formData.schedule.length > 0 ? (
              <Stack spacing={2} sx={{ mb: 3 }}>
                {formData.schedule.map((s, i) => (
                  <Paper
                    key={i}
                    sx={{
                      p: 2,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: 2,
                    }}
                    elevation={1}
                  >
                    <TextField
                      type="date"
                      label="Date"
                      value={s.date}
                      onChange={(e) => {
                        const updated = [...formData.schedule];
                        updated[i].date = e.target.value;
                        setFormData({ ...formData, schedule: updated });
                      }}
                      sx={{ width: { xs: '100%', sm: '45%' } }}
                    />
                    <TextField
                      type="time"
                      label="Time"
                      value={s.time}
                      onChange={(e) => {
                        const updated = [...formData.schedule];
                        updated[i].time = e.target.value;
                        setFormData({ ...formData, schedule: updated });
                      }}
                      sx={{ width: { xs: '100%', sm: '45%' } }}
                    />
                    <Button
                      variant="outlined"
                      color="error"
                      onClick={() => {
                        const filtered = formData.schedule.filter((_, idx) => idx !== i);
                        setFormData({ ...formData, schedule: filtered });
                      }}
                    >
                      Remove
                    </Button>
                  </Paper>
                ))}
              </Stack>
            ) : (
              <Typography color="text.secondary" sx={{ mb: 3 }}>
                No schedules yet.
              </Typography>
            )}

            {/* Add schedule button */}
            <Button
              variant="contained"
              onClick={() => setShowAddSchedule(true)}
              sx={{ mb: 2 }}
            >
              + Add Schedule
            </Button>

            {/* Add new schedule form */}
            {showAddSchedule && (
              <Box sx={{ mt: 2 }}>
                <Stack spacing={2}>
                  <TextField
                    type="date"
                    label=""
                    value={newSchedule.date}
                    onChange={(e) =>
                      setNewSchedule({ ...newSchedule, date: e.target.value })
                    }
                    fullWidth
                  />
                  <TextField
                    type="time"
                    label=""
                    value={newSchedule.time}
                    onChange={(e) =>
                      setNewSchedule({ ...newSchedule, time: e.target.value })
                    }
                    fullWidth
                  />
                  <Stack direction="row" spacing={2}>
                    <Button
                      variant="contained"
                      color="success"
                      onClick={() => {
                        if (!newSchedule.date || !newSchedule.time) {
                          alert("Please fill in both date and time.");
                          return;
                        }
                        setFormData({
                          ...formData,
                          schedule: [...(formData.schedule || []), newSchedule],
                        });
                        setNewSchedule({ date: "", time: "" });
                        setShowAddSchedule(false);
                      }}
                    >
                      Save Schedule
                    </Button>
                    <Button
                      variant="text"
                      color="error"
                      onClick={() => setShowAddSchedule(false)}
                    >
                      Cancel
                    </Button>
                  </Stack>
                </Stack>
              </Box>
            )}
          </Box>

          {/* Navigation buttons */}
          <Stack direction="row" spacing={2} justifyContent="center">
            <Button variant="outlined" onClick={prevStep} sx={{ px: 4 }}>
              Back
            </Button>
            <Button variant="text" onClick={saveDraft} sx={{ px: 4 }}>
              Save Draft
            </Button>
            <Button
              variant="contained"
              onClick={nextStep}
              disabled={!formData.schedule || formData.schedule.length === 0}
              sx={{ px: 4 }}
            >
              Next
            </Button>
          </Stack>
        </Box>
      )}

      {/* Step 6: Pricing & Amenities */}
      {step === 6 && (
        <Box sx={{ textAlign: 'center', mb: 4, maxWidth: 600, mx: 'auto' }}>
          <Toolbar />
          <Toolbar />

          <Typography
            variant="h3"
            component="h1"
            gutterBottom
            sx={{ fontWeight: 600, color: 'primary.main' }}
          >
            Pricing & Amenities
          </Typography>

          <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
            Set your price per participant and include any amenities provided in your experience.
          </Typography>

          <Box
            sx={{
              border: '1px solid',
              borderColor: 'grey.300',
              borderRadius: 2,
              p: 3,
              textAlign: 'left',
              mb: 4,
            }}
          >
            <Typography
              variant="h6"
              sx={{ mb: 2, fontWeight: 500, color: 'primary.main' }}
            >
              Price
            </Typography>

            {/* Price Input */}
            <TextField
              fullWidth
              type="number"
              label="Price per participant (₱)"
              variant="outlined"
              value={formData.price}
              onChange={(e) => handleChange("price", Number(e.target.value))}
              sx={{ mb: 4 }}
            />

            <Typography
              variant="h6"
              sx={{ mb: 2, fontWeight: 500, color: 'primary.main' }}
            >
              Amenities
            </Typography>

            {/* Amenities List */}
            {formData.amenities && formData.amenities.length > 0 ? (
              <Stack direction="row" flexWrap="wrap" spacing={1} sx={{ mb: 3 }}>
                {formData.amenities.map((a, i) => (
                  <Chip
                    key={i}
                    label={a}
                    onDelete={() => {
                      const updated = formData.amenities.filter((_, idx) => idx !== i);
                      setFormData({ ...formData, amenities: updated });
                    }}
                    color="primary"
                    variant="outlined"
                  />
                ))}
              </Stack>
            ) : (
              <Typography color="text.secondary" sx={{ mb: 3 }}>
                No amenities added yet.
              </Typography>
            )}

            {/* Add New Amenity */}
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField
                fullWidth
                label="Enter an amenity (e.g. Free snacks)"
                value={newAmenity}
                onChange={(e) => setNewAmenity(e.target.value)}
              />
              <Button
                variant="contained"
                onClick={() => {
                  if (!newAmenity.trim()) return alert("Please enter an amenity.");
                  setFormData({
                    ...formData,
                    amenities: [...(formData.amenities || []), newAmenity.trim()],
                  });
                  setNewAmenity("");
                }}
              >
                + Add
              </Button>
            </Stack>
          </Box>

          {/* Navigation Buttons */}
          <Stack direction="row" spacing={2} justifyContent="center">
            <Button variant="outlined" onClick={prevStep} sx={{ px: 4 }}>
              Back
            </Button>
            <Button variant="text" onClick={saveDraft} sx={{ px: 4 }}>
              Save Draft
            </Button>
            <Button
              variant="contained"
              onClick={nextStep}
              disabled={!formData.price || formData.price <= 0}
              sx={{ px: 4 }}
            >
              Next
            </Button>
          </Stack>
        </Box>
      )}

      {/* Step 7: Photos */}
      {step === 7 && (
        <Box sx={{ textAlign: 'center', mb: 4 }}>
          <Toolbar />
          <Toolbar />
          <Typography
            variant="h3"
            component="h1"
            gutterBottom
            sx={{ fontWeight: 600, color: 'primary.main' }}
          >
            Show guests what your experience looks like
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
            Upload high-quality photos to attract more guests.
          </Typography>

          {/* File upload for images */}
          <Box sx={{ maxWidth: 600, mx: 'auto', mb: 4 }}>
            <Button
              variant="outlined"
              component="label"
              fullWidth
              sx={{
                py: 2,
                borderStyle: 'dashed',
                borderWidth: 2,
                borderColor: 'primary.main',
                '&:hover': { borderColor: 'primary.dark' },
              }}
            >
              <Typography variant="body1">Click to upload images</Typography>
              <input
                type="file"
                multiple
                accept="image/*"
                hidden
                onChange={async (e) => {
                  const files = Array.from(e.target.files);
                  const uploadedUrls = [];

                  for (const file of files) {
                    const formDataUpload = new FormData();
                    formDataUpload.append('file', file);
                    formDataUpload.append('upload_preset', UPLOAD_PRESET);

                    try {
                      const response = await fetch(
                        `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
                        {
                          method: 'POST',
                          body: formDataUpload,
                        }
                      );
                      const data = await response.json();
                      if (data.secure_url) {
                        uploadedUrls.push(data.secure_url);
                      }
                    } catch (error) {
                      console.error('Upload failed:', error);
                      alert('Failed to upload image. Try again.');
                    }
                  }

                  setFormData((prev) => ({
                    ...prev,
                    photos: [...prev.photos, ...uploadedUrls],
                  }));
                }}
              />
            </Button>
          </Box>

          {/* Display uploaded images */}
          <Box sx={{ maxWidth: 800, mx: 'auto' }}>
            <Grid container spacing={2}>
              {formData.photos.map((url, index) => (
                <Grid item xs={12} sm={6} md={4} key={index}>
                  <Card sx={{ position: 'relative', height: 200, borderRadius: 3 }}>
                    <CardMedia
                      component="img"
                      image={url}
                      alt={`Photo ${index + 1}`}
                      sx={{
                        height: '100%',
                        objectFit: 'cover',
                        borderRadius: 3,
                      }}
                    />
                    <IconButton
                      sx={{
                        position: 'absolute',
                        top: 8,
                        right: 8,
                        bgcolor: 'rgba(255,255,255,0.85)',
                        '&:hover': { bgcolor: 'rgba(255,255,255,1)' },
                      }}
                      onClick={() => {
                        const newPhotos = formData.photos.filter(
                          (_, i) => i !== index
                        );
                        setFormData({ ...formData, photos: newPhotos });
                      }}
                    >
                      <CloseIcon />
                    </IconButton>
                  </Card>
                </Grid>
              ))}
            </Grid>
          </Box>

          {/* Navigation buttons */}
          <Stack
            direction="row"
            spacing={2}
            justifyContent="center"
            sx={{ mt: 4 }}
          >
            <Button variant="outlined" onClick={prevStep} sx={{ px: 4 }}>
              Back
            </Button>
            <Button variant="text" onClick={saveDraft} sx={{ px: 4 }}>
              Save to Drafts
            </Button>
            <Button variant="contained" onClick={nextStep} sx={{ px: 4 }}>
              Next
            </Button>
          </Stack>
        </Box>
      )}

      {/* Step 8: Description & Host Requirements */}
      {step === 8 && (
        <Box sx={{ textAlign: 'center', mb: 4 }}>
          <Toolbar />
          <Toolbar />

          <Typography
            variant="h3"
            component="h1"
            gutterBottom
            sx={{ fontWeight: 600, color: 'primary.main' }}
          >
            Description & Requirements
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
            Describe your experience and specify what guests should know before joining.
          </Typography>

          <Box sx={{ maxWidth: 700, mx: 'auto', display: 'flex', flexDirection: 'column', gap: 3 }}>
            <TextField
              label="Experience Description"
              placeholder="Describe your experience (what makes it special, what guests will do, etc.)"
              multiline
              rows={5}
              value={formData.description}
              onChange={(e) => handleChange('description', e.target.value)}
              fullWidth
              variant="outlined"
            />

            <TextField
              label="Host Requirements / Prerequisites"
              placeholder="List any requirements or conditions (e.g. age limit, attire, skill level)"
              multiline
              rows={4}
              value={formData.hostRequirements}
              onChange={(e) => handleChange('hostRequirements', e.target.value)}
              fullWidth
              variant="outlined"
            />
          </Box>

          {/* Navigation buttons */}
          <Stack
            direction="row"
            spacing={2}
            justifyContent="center"
            sx={{ mt: 5 }}
          >
            <Button variant="outlined" onClick={prevStep} sx={{ px: 4 }}>
              Back
            </Button>
            <Button variant="text" onClick={saveDraft} sx={{ px: 4 }}>
              Save to Drafts
            </Button>
            <Button
              variant="contained"
              onClick={nextStep}
              sx={{ px: 4 }}
              disabled={!formData.description.trim()}
            >
              Next
            </Button>
          </Stack>
        </Box>
      )}

      {/* Step 9: Cancellation Policy */}
      {step === 9 && (
        <Box sx={{ textAlign: 'center', mb: 4 }}>
          <Toolbar />
          <Toolbar />

          <Typography
            variant="h3"
            component="h1"
            gutterBottom
            sx={{ fontWeight: 600, color: 'primary.main' }}
          >
            Cancellation Policy
          </Typography>

          <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
            Clearly state your cancellation terms so guests know what to expect.
          </Typography>

          <Box sx={{ maxWidth: 700, mx: 'auto', display: 'flex', flexDirection: 'column', gap: 3 }}>
            <TextField
              label="Cancellation Policy"
              placeholder="Specify your cancellation policy (e.g. full refund up to 24 hours before start time)"
              multiline
              rows={5}
              value={formData.cancellationPolicy}
              onChange={(e) => handleChange('cancellationPolicy', e.target.value)}
              fullWidth
              variant="outlined"
            />
          </Box>

          {/* Navigation buttons */}
          <Stack direction="row" spacing={2} justifyContent="center" sx={{ mt: 5 }}>
            <Button variant="outlined" onClick={prevStep} sx={{ px: 4 }}>
              Back
            </Button>
            <Button variant="text" onClick={saveDraft} sx={{ px: 4 }}>
              Save to Drafts
            </Button>
            <Button
              variant="contained"
              onClick={nextStep}
              sx={{ px: 4 }}
              disabled={!formData.cancellationPolicy.trim()}
            >
              Next
            </Button>
          </Stack>
        </Box>
      )}

      {/* Step 10: Review & Publish */}
      {step === 10 && (
        <Box sx={{ textAlign: 'center', mb: 4 }}>
          <Toolbar />
          <Typography variant="h3" component="h1" gutterBottom sx={{ fontWeight: 600, color: 'primary.main' }}>
            Review & Publish
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
            Double-check all your details before publishing your experience.
          </Typography>

          {/* Left: Photo Preview | Right: Details */}
          <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 3, maxWidth: 900, mx: 'auto', mb: 4 }}>
            
            {/* Left Side: Photo */}
            <Box sx={{ flex: 1 }}>
              <Card sx={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                {formData.photos.length > 0 ? (
                  <img
                    src={formData.photos[currentPhotoIndex || 0]}
                    alt={`Photo ${currentPhotoIndex || 0}`}
                    style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 4 }}
                  />
                ) : (
                  <Typography variant="body1" color="text.secondary">No photos uploaded</Typography>
                )}
                {formData.photos.length > 1 && (
                  <>
                    <IconButton
                      sx={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', bgcolor: 'rgba(255,255,255,0.7)' }}
                      onClick={() => setCurrentPhotoIndex(prev => Math.max(0, prev - 1))}
                      disabled={(currentPhotoIndex || 0) === 0}
                    >
                      <ArrowBackIcon />
                    </IconButton>
                    <IconButton
                      sx={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', bgcolor: 'rgba(255,255,255,0.7)' }}
                      onClick={() => setCurrentPhotoIndex(prev => Math.min(formData.photos.length - 1, prev + 1))}
                      disabled={(currentPhotoIndex || 0) === formData.photos.length - 1}
                    >
                      <ArrowForwardIcon />
                    </IconButton>
                  </>
                )}
              </Card>
            </Box>

            {/* Right Side: Details */}
            <Box sx={{ flex: 1 }}>
              <Card sx={{ height: 'auto', p: 4, overflowY: 'auto' }}>
                <Typography variant="h5" gutterBottom sx={{ fontWeight: 500, color: 'primary.main' }}>
                  Listing Details
                </Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, textAlign: 'left' }}>
                  <Typography variant="body1"><strong>Category:</strong> {formData.category || "Not set"}</Typography>
                  <Typography variant="body1"><strong>Listing Type:</strong> {formData.listingType || "Not set"}</Typography>
                  <Typography variant="body1"><strong>Title:</strong> {formData.title || "Not set"}</Typography>
                  <Typography variant="body1"><strong>Location:</strong> {[
                    regions.find(r => r.code === formData.region)?.name,
                    provinces.find(p => p.code === formData.province)?.name,
                    municipalities.find(m => m.code === formData.municipality)?.name,
                    barangays.find(b => b.code === formData.barangay)?.name,
                    formData.street
                  ].filter(Boolean).join(", ") || "Not set"}</Typography>
                  <Typography variant="body1"><strong>Duration:</strong> {formData.duration || "Not set"}</Typography>
                  <Typography variant="body1"><strong>Max Participants:</strong> {formData.maxParticipants || 0}</Typography>
                  <Typography variant="body1"><strong>Age Restriction:</strong> {formData.ageRestriction ? `${formData.ageRestriction.min} - ${formData.ageRestriction.max}` : "None"}</Typography>
                  <Typography variant="body1"><strong>Experience Type:</strong> {formData.experienceType || "Not set"}</Typography>
                  <Typography variant="body1"><strong>Languages:</strong> {formData.languages?.length > 0 ? formData.languages.join(", ") : "None"}</Typography>
                  <Typography variant="body1"><strong>Schedule:</strong> {formData.schedule?.length > 0 ? formData.schedule.map(s => `${s.date} at ${s.time}`).join(", ") : "Not set"}</Typography>
                  <Typography variant="body1"><strong>Price:</strong> {formData.price ? `$${formData.price}` : "Not set"}</Typography>
                  <Typography variant="body1"><strong>Amenities:</strong> {formData.amenities?.length > 0 ? formData.amenities.join(", ") : "None"}</Typography>
                  <Typography variant="body1"><strong>Description:</strong> {formData.description || "Not set"}</Typography>
                  <Typography variant="body1"><strong>Host Requirements:</strong> {formData.hostRequirements || "None"}</Typography>
                  <Typography variant="body1"><strong>Cancellation Policy:</strong> {formData.cancellationPolicy || "Not set"}</Typography>
                </Box>
              </Card>
            </Box>
          </Box>

          <FormControlLabel
            control={
              <Checkbox
                checked={formData.agreeToTerms}
                onChange={(e) => handleChange("agreeToTerms", e.target.checked)}
                color="primary"
              />
            }
            label="I agree to the hosting terms"
            sx={{ mb: 4 }}
          />

          <Stack direction="row" spacing={2} justifyContent="center">
            <Button variant="outlined" onClick={prevStep} sx={{ px: 4 }}>
              Back
            </Button>
            <Button variant="text" onClick={saveDraft} sx={{ px: 4 }}>
              Save to Drafts
            </Button>
            <Button
              variant="contained"
              onClick={handleSubmit}
              disabled={!formData.agreeToTerms}
              sx={{ px: 4 }}
            >
              Publish
            </Button>
          </Stack>
        </Box>
      )}
    </div>
  );
};