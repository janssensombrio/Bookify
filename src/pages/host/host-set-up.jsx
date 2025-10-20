import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { doc, collection, addDoc, updateDoc, query, where, getDocs } from "firebase/firestore";
import { auth, database } from "../../config/firebase";
import "./styles/host-set-up.css";

import LocationDropdowns from "./components/LocationDropdowns";

import {
  Box,
  Typography,
  Button,
  Card,
  CardActionArea,
  Grid,
  RadioGroup,
  Stack,
  CardMedia,
  IconButton,
  Toolbar,
  FormControl,  // Added for dropdowns
  InputLabel,   // Added for dropdown labels
  Select,       // Added for dropdowns
  MenuItem,     // Added for dropdown options
  TextField,
  Checkbox,
  FormControlLabel,
  Link,
} from "@mui/material";

import { ArrowBackIosNew, ArrowForwardIos } from "@mui/icons-material";

import HomeIcon from "@mui/icons-material/Home";
import HotelIcon from "@mui/icons-material/Hotel";
import PeopleIcon from "@mui/icons-material/People";

import CloseIcon from "@mui/icons-material/Close";
import ApartmentIcon from "@mui/icons-material/Apartment";
import HouseIcon from "@mui/icons-material/House";
import CottageIcon from "@mui/icons-material/Cottage"; // If not available, use a generic icon like HomeIcon
import VillaIcon from "@mui/icons-material/Villa"; // If not available, use a generic icon like HomeIcon
import CabinIcon from "@mui/icons-material/Cabin"; // If not available, use a generic icon like HomeIcon
import Chip from "@mui/material/Chip";
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';

const CLOUD_NAME = "dijmlbysr"; // From Cloudinary dashboard
const UPLOAD_PRESET = "listing-uploads"; // Create an unsigned preset in Cloudinary for uploads

export const HostSetUp = () => {
  const location = useLocation();
  const initialCategory = location.state?.category || "";
  
  const navigate = useNavigate();

  const [step, setStep] = useState(1);

  const [regions, setRegions] = useState([]);
  const [provinces, setProvinces] = useState([]);
  const [municipalities, setMunicipalities] = useState([]);
  const [barangays, setBarangays] = useState([]);

  const [newAmenity, setNewAmenity] = useState("");  // Add this line
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);

  const [formData, setFormData] = useState({
    category: initialCategory,
    listingType: "",
    region: "",
    province: "",
    municipality: "",
    barangay: "",
    street: "",
    propertyType: "",
    uniqueDescription: "",
    guests: 1,
    bedrooms: 1,
    beds: 1,
    bathrooms: 1,
    amenities: [],
    photos: [],
    title: "",
    description: "",
    price: "",
    cleaningFee: "",
    discountType: "",
    discountValue: 0,
    availability: { start: "", end: "" },
    agreeToTerms: false,
  });

  const nextStep = () => setStep(step + 1);
  const prevStep = () => setStep(step - 1);

  const handleChange = (key, value) => {
  setFormData(prev => ({ ...prev, [key]: value }));
};

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

  const handleSelect = (option) => {
    setFormData({ ...formData, listingType: option });
  };

  const handleAmenityToggle = (amenity) => {
    setFormData((prev) => ({
      ...prev,
      amenities: prev.amenities.includes(amenity)
        ? prev.amenities.filter((a) => a !== amenity)
        : [...prev.amenities, amenity],
    }));
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

  useEffect(() => {
    fetch("https://psgc.gitlab.io/api/regions/")
      .then((res) => res.json())
      .then((data) => setRegions(data))
      .catch((err) => console.error("Failed to load regions:", err));
  }, []);

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

  return (
    <div className="host-setup-page">
      {/* 🖥️ Screen 1 */}
      {step === 1 && (
        <Box sx={{ textAlign: 'center', mb: 4 }}>
        <Toolbar/>
        <Toolbar/>
        <Toolbar/>
        <Toolbar/>
          <Typography variant="h3" component="h1" gutterBottom sx={{ fontWeight: 600, color: 'primary.main' }}>
            What kind of place are you listing?
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
            Choose the type of accommodation you're offering to get started.
          </Typography>

          <RadioGroup
            value={formData.listingType}
            onChange={(e) => handleSelect(e.target.value)}
            sx={{ mb: 4 }}
          >
            <Grid container spacing={3} justifyContent="center">
              {[
                { value: "Entire place", label: "Entire place", desc: "Guests have the whole space to themselves.", icon: <HomeIcon sx={{ fontSize: 40, color: 'primary.main' }} /> },
                { value: "Private room", label: "Private room", desc: "Guests have a private room but share common spaces.", icon: <HotelIcon sx={{ fontSize: 40, color: 'primary.main' }} /> },
                { value: "Shared room", label: "Shared room", desc: "Guests share both the room and common areas.", icon: <PeopleIcon sx={{ fontSize: 40, color: 'primary.main' }} /> },
              ].map((option) => (
                <Grid item xs={12} sm={6} md={4} key={option.value}>
                  <Card
                    sx={{
                      height: '100%',
                      border: formData.listingType === option.value ? '2px solid' : '1px solid',
                      borderColor: formData.listingType === option.value ? 'primary.main' : 'grey.300',
                      boxShadow: formData.listingType === option.value ? 4 : 1,
                      transition: 'all 0.3s ease',
                      '&:hover': { boxShadow: 3 },
                    }}
                  >
                    <CardActionArea
                      onClick={() => handleSelect(option.value)}
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
          </RadioGroup>

          <Stack direction="row" spacing={2} justifyContent="center">
            <Button variant="outlined" onClick={handleBack} sx={{ px: 4 }}>
              Back to Home
            </Button>
            <Button
              variant="contained"
              onClick={nextStep}
              disabled={!formData.listingType}
              sx={{ px: 4 }}
            >
              Next
            </Button>
          </Stack>
        </Box>
      )}

      {/* 📍 Screen 2 */}
      {step === 2 && (
        <Box sx={{ textAlign: 'center', mb: 4 }}>
          <Toolbar/>
          <Toolbar/>
          <Typography variant="h3" component="h1" gutterBottom sx={{ fontWeight: 600, color: 'primary.main' }}>
            Where’s your place located?
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
            Help guests find your listing by providing the exact location.
          </Typography>

          <Box sx={{ maxWidth: 600, mx: 'auto', display: 'flex', flexDirection: 'column', gap: 3 }}>
            {/* Region */}
            <FormControl fullWidth>
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
            <FormControl fullWidth disabled={!formData.region}>
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
            <FormControl fullWidth disabled={!formData.province}>
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
            <FormControl fullWidth disabled={!formData.municipality}>
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
              placeholder="e.g., 123 Main St."
              value={formData.street}
              disabled={!formData.barangay}
              onChange={(e) => handleChange("street", e.target.value)}
              variant="outlined"
            />
          </Box>

          <Stack direction="row" spacing={2} justifyContent="center" sx={{ mt: 4 }}>
            <Button variant="outlined" onClick={prevStep} sx={{ px: 4 }}>
              Back
            </Button>
            <Button
              variant="contained"
              onClick={async () => {
                await saveHost(); // save host before moving
                nextStep();
              }}
              disabled={!formData.street}
              sx={{ px: 4 }}
            >
              Get Started
            </Button>
          </Stack>
        </Box>
      )}

      {/* 🏡 Screen 3 */}
      {step === 3 && (
        <Box sx={{ textAlign: 'center', mb: 4 }}>
          <Toolbar/>
          <Toolbar/>
          <Toolbar/>
          <Typography variant="h3" component="h1" gutterBottom sx={{ fontWeight: 600, color: 'primary.main' }}>
            What type of place do you have?
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
            Select the best category that describes your property.
          </Typography>

          <Grid container spacing={3} justifyContent="center" sx={{ mb: 4 }}>
            {[
              { value: "Apartment", label: "Apartment", desc: "A self-contained unit in a building.", icon: <ApartmentIcon sx={{ fontSize: 40, color: 'primary.main' }} /> },
              { value: "House", label: "House", desc: "A standalone home with full privacy.", icon: <HouseIcon sx={{ fontSize: 40, color: 'primary.main' }} /> },
              { value: "Cottage", label: "Cottage", desc: "A cozy, small home often in rural areas.", icon: <CottageIcon sx={{ fontSize: 40, color: 'primary.main' }} /> },
              { value: "Villa", label: "Villa", desc: "A luxurious home with spacious amenities.", icon: <VillaIcon sx={{ fontSize: 40, color: 'primary.main' }} /> },
              { value: "Cabin", label: "Cabin", desc: "A rustic retreat surrounded by nature.", icon: <CabinIcon sx={{ fontSize: 40, color: 'primary.main' }} /> },
            ].map((type) => (
              <Grid item xs={12} sm={6} md={4} key={type.value}>
                <Card
                  sx={{
                    height: '100%',
                    border: formData.propertyType === type.value ? '2px solid' : '1px solid',
                    borderColor: formData.propertyType === type.value ? 'primary.main' : 'grey.300',
                    boxShadow: formData.propertyType === type.value ? 4 : 1,
                    transition: 'all 0.3s ease',
                    '&:hover': { boxShadow: 3 },
                  }}
                >
                  <CardActionArea
                    onClick={() => handleChange("propertyType", type.value)}
                    sx={{ height: '100%', p: 2, textAlign: 'center' }}
                  >
                    <Box sx={{ mb: 2 }}>{type.icon}</Box>
                    <Typography variant="h6" component="h3" gutterBottom sx={{ fontWeight: 500 }}>
                      {type.label}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {type.desc}
                    </Typography>
                  </CardActionArea>
                </Card>
              </Grid>
            ))}
          </Grid>

          <Box sx={{ maxWidth: 600, mx: 'auto', mb: 4 }}>
            <TextField
              fullWidth
              multiline
              rows={4}
              label="What makes your place unique? (optional)"
              placeholder="Describe any special features or highlights..."
              value={formData.uniqueDescription}
              onChange={(e) => handleChange("uniqueDescription", e.target.value)}
              variant="outlined"
            />
          </Box>

          <Stack direction="row" spacing={2} justifyContent="center">
            <Button variant="outlined" onClick={prevStep} sx={{ px: 4 }}>
              Back
            </Button>
            <Button variant="text" onClick={saveDraft} sx={{ px: 4 }}>
              Save to Drafts
            </Button>
            <Button
              variant="contained"
              onClick={nextStep}
              disabled={!formData.propertyType}
              sx={{ px: 4 }}
            >
              Next
            </Button>
          </Stack>
        </Box>
      )}

      {/* 🛏️ Screen 4 */}
      {step === 4 && (
        <Box sx={{ textAlign: 'center', mb: 4 }}>
          <Toolbar/>
          <Toolbar/>
          <Toolbar/>
          <Typography variant="h3" component="h1" gutterBottom sx={{ fontWeight: 600, color: 'primary.main' }}>
            How many guests can stay?
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
            Provide details about the capacity and sleeping arrangements.
          </Typography>

          <Box sx={{ maxWidth: 600, mx: 'auto', display: 'flex', flexDirection: 'column', gap: 3 }}>
            <TextField
              fullWidth
              type="number"
              label="Guests"
              value={formData.guests}
              onChange={(e) => handleChange("guests", e.target.value)}
              variant="outlined"
              inputProps={{ min: 1 }}
            />
            <TextField
              fullWidth
              type="number"
              label="Bedrooms"
              value={formData.bedrooms}
              onChange={(e) => handleChange("bedrooms", e.target.value)}
              variant="outlined"
              inputProps={{ min: 0 }}
            />
            <TextField
              fullWidth
              type="number"
              label="Beds"
              value={formData.beds}
              onChange={(e) => handleChange("beds", e.target.value)}
              variant="outlined"
              inputProps={{ min: 0 }}
            />
            <TextField
              fullWidth
              type="number"
              label="Bathrooms"
              value={formData.bathrooms}
              onChange={(e) => handleChange("bathrooms", e.target.value)}
              variant="outlined"
              inputProps={{ min: 0 }}
            />
          </Box>

          <Stack direction="row" spacing={2} justifyContent="center" sx={{ mt: 4 }}>
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

      {/* 🛋️ Screen 5 */}
      {step === 5 && (
        <Box sx={{ textAlign: 'center', mb: 4 }}>
          <Toolbar/>
          <Toolbar/>
          <Toolbar/>
          <Toolbar/>
          <Typography variant="h3" component="h1" gutterBottom sx={{ fontWeight: 600, color: 'primary.main' }}>
            What amenities do you offer?
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
            Add amenities that guests can enjoy at your place.
          </Typography>

          <Box sx={{ maxWidth: 600, mx: 'auto', mb: 4 }}>
            {/* Display added amenities as chips */}
            <Box sx={{ mb: 4 }}>
              <Stack direction="row" spacing={2} flexWrap="wrap">
                {formData.amenities.map((amenity, index) => (
                  <Chip
                    key={index}
                    label={amenity}
                    onDelete={() => {
                      const updated = formData.amenities.filter((_, i) => i !== index);
                      handleChange("amenities", updated);
                    }}
                    color="primary"
                    variant="outlined"
                  />
                ))}
              </Stack>
            </Box>

            {/* Add new amenity */}
            <Box sx={{ display: 'flex', gap: 2 }}>
              <TextField
                fullWidth
                label="Add an amenity"
                placeholder="e.g., Wi-Fi, Kitchen, Pool"
                value={newAmenity}
                onChange={(e) => setNewAmenity(e.target.value)}
                variant="outlined"
              />
              <Button
                variant="contained"
                onClick={() => {
                  if (newAmenity.trim() && !formData.amenities.includes(newAmenity.trim())) {
                    handleChange("amenities", [...formData.amenities, newAmenity.trim()]);
                    setNewAmenity("");
                  }
                }}
                sx={{ px: 4 }}
              >
                Add
              </Button>
            </Box>
          </Box>

          <Stack direction="row" spacing={2} justifyContent="center">
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

      {/* 📸 Screen 6 */}
      {step === 6 && (
        <Box sx={{ textAlign: 'center', mb: 4 }}>
          <Toolbar/>
          <Toolbar/>
          <Typography variant="h3" component="h1" gutterBottom sx={{ fontWeight: 600, color: 'primary.main' }}>
            Show guests what your place looks like
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
              sx={{ py: 2, borderStyle: 'dashed', borderWidth: 2 }}
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
                    formDataUpload.append("file", file);
                    formDataUpload.append("upload_preset", UPLOAD_PRESET);

                    try {
                      const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, {
                        method: "POST",
                        body: formDataUpload,
                      });
                      const data = await response.json();
                      if (data.secure_url) {
                        uploadedUrls.push(data.secure_url); // Store the Cloudinary URL
                      }
                    } catch (error) {
                      console.error("Upload failed:", error);
                      alert("Failed to upload image. Try again.");
                    }
                  }

                  // Add uploaded URLs to formData.photos
                  setFormData((prev) => ({
                    ...prev,
                    photos: [...prev.photos, ...uploadedUrls],
                  }));
                }}
              />
            </Button>
          </Box>

          {/* Display uploaded images */}
          <Box sx={{ maxWidth: 800, mx: 'auto'}}>
            <Grid container spacing={2}>
              {formData.photos.map((url, index) => (
                <Grid item xs={12} sm={6} md={4} key={index}>
                  <Card sx={{ position: 'relative', height: 200 }}>
                    <CardMedia
                      component="img"
                      image={url}
                      alt={`Photo ${index + 1}`}
                      sx={{ height: '100%', objectFit: 'cover' }}
                    />
                    <IconButton
                      sx={{
                        position: 'absolute',
                        top: 8,
                        right: 8,
                        bgcolor: 'rgba(255, 255, 255, 0.8)',
                        '&:hover': { bgcolor: 'rgba(255, 255, 255, 1)' },
                      }}
                      onClick={() => {
                        const newPhotos = formData.photos.filter((_, i) => i !== index);
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

          <Stack direction="row" spacing={2} justifyContent="center" sx={{ mt: 4 }}>
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

      {/* 📝 Screen 7 */}
      {step === 7 && (
        <Box sx={{ textAlign: 'center', mb: 4 }}>
          <Toolbar/>
          <Toolbar/>
          <Toolbar/>
          <Typography variant="h3" component="h1" gutterBottom sx={{ fontWeight: 600, color: 'primary.main' }}>
            Add a title and description
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
            Create an appealing title and detailed description to highlight your listing.
          </Typography>

          <Box sx={{ maxWidth: 600, mx: 'auto', display: 'flex', flexDirection: 'column', gap: 3 }}>
            <TextField
              fullWidth
              label="Listing Title"
              placeholder="e.g., Cozy Beachfront Villa"
              value={formData.title}
              onChange={(e) => handleChange("title", e.target.value)}
              variant="outlined"
            />
            <TextField
              fullWidth
              multiline
              rows={6}
              label="Detailed Description"
              placeholder="Describe your place, amenities, and what makes it special..."
              value={formData.description}
              onChange={(e) => handleChange("description", e.target.value)}
              variant="outlined"
            />
          </Box>

          <Stack direction="row" spacing={2} justifyContent="center" sx={{ mt: 4 }}>
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

      {/* 💰 Screen 8 */}
      {step === 8 && (
        <Box sx={{ textAlign: 'center', mb: 4 }}>
          <Toolbar/>
          <Toolbar/>
          <Toolbar/>
          <Typography variant="h3" component="h1" gutterBottom sx={{ fontWeight: 600, color: 'primary.main' }}>
            Set your nightly price
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
            Choose a competitive price and optional fees.
          </Typography>

          <Box sx={{ maxWidth: 600, mx: 'auto', display: 'flex', flexDirection: 'column', gap: 3 }}>
            <TextField
              fullWidth
              type="number"
              label="Price per night"
              placeholder="e.g., 100"
              value={formData.price}
              onChange={(e) => handleChange("price", e.target.value)}
              variant="outlined"
              InputProps={{ startAdornment: <Typography sx={{ mr: 1 }}>$</Typography> }}
            />
            <TextField
              fullWidth
              type="number"
              label="Cleaning fee (optional)"
              placeholder="e.g., 50"
              value={formData.cleaningFee}
              onChange={(e) => handleChange("cleaningFee", e.target.value)}
              variant="outlined"
              InputProps={{ startAdornment: <Typography sx={{ mr: 1 }}>$</Typography> }}
            />
            <FormControl fullWidth>
              <InputLabel>Discount Type</InputLabel>
              <Select
                value={formData.discountType}
                label="Discount Type"
                onChange={(e) => handleChange("discountType", e.target.value)}
              >
                <MenuItem value="">
                  <em>Select discount type</em>
                </MenuItem>
                <MenuItem value="none">None</MenuItem>
                <MenuItem value="percentage">Percentage (%)</MenuItem>
                <MenuItem value="fixed">Fixed amount</MenuItem>
              </Select>
            </FormControl>
            <TextField
              fullWidth
              type="number"
              label="Discount Value"
              placeholder="Enter discount value"
              value={formData.discountValue}
              onChange={(e) => handleChange("discountValue", Number(e.target.value))}
              variant="outlined"
              disabled={formData.discountType === "none" || !formData.discountType}
              InputProps={{
                startAdornment: formData.discountType === "percentage" ? <Typography sx={{ mr: 1 }}>%</Typography> : <Typography sx={{ mr: 1 }}>$</Typography>
              }}
            />
          </Box>

          <Stack direction="row" spacing={2} justifyContent="center" sx={{ mt: 4 }}>
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

      {/* 📅 Screen 9 - Enhanced with Calendar */}
      {step === 9 && (
        <Box sx={{ textAlign: 'center', mb: 4 }}>
          <Toolbar/>
          <Toolbar/>
          <Toolbar/>
          <Toolbar/>
          <Typography variant="h3" component="h1" gutterBottom sx={{ fontWeight: 600, color: 'primary.main' }}>
            When can guests book your place?
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
            Set the dates when your listing is available.
          </Typography>

          <Box sx={{ maxWidth: 600, mx: 'auto', display: 'flex', flexDirection: 'column', gap: 3 }}>
            <TextField
              fullWidth
              type="date"
              label="Start Date"
              value={formData.availability.start}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  availability: { ...formData.availability, start: e.target.value },
                })
              }
              variant="outlined"
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              fullWidth
              type="date"
              label="End Date"
              value={formData.availability.end}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  availability: { ...formData.availability, end: e.target.value },
                })
              }
              variant="outlined"
              InputLabelProps={{ shrink: true }}
            />
          </Box>

          <Stack direction="row" spacing={2} justifyContent="center" sx={{ mt: 4 }}>
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

      {/* ✅ Screen 10 */}
      {step === 10 && (
        <Box sx={{ textAlign: 'center', mb: 1, height: 'auto' }}>
          <Toolbar/>
          <Typography variant="h3" component="h1" gutterBottom sx={{ fontWeight: 600, color: 'primary.main' }}>
            Review and publish
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
            Double-check your details before publishing your listing.
          </Typography>

          <Box sx={{ maxWidth: '80%', height: '500px', mx: 'auto', mb: 4, display: 'flex', gap: 3, alignItems: 'stretch' }}>  {/* Changed maxHeight to fixed height: '500px' */}
            {/* Left Side: Photo Carousel */}
            <Box sx={{ flex: 1 }}>
              <Card sx={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>  {/* Changed to height: '100%' */}
                {formData.photos.length > 0 ? (
                  <Box sx={{ position: 'relative', width: '100%', height: '100%' }}>
                    <img
                      src={formData.photos[currentPhotoIndex || 0]} // Use state for current index
                      alt="Listing Photo"
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                    {formData.photos.length > 1 && (
                      <>
                        <IconButton
                          sx={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', bgcolor: 'rgba(255,255,255,0.7)' }}
                          onClick={() => setCurrentPhotoIndex((prev) => Math.max(0, prev - 1))}
                          disabled={(currentPhotoIndex || 0) === 0}
                        >
                          <ArrowBackIcon />
                        </IconButton>
                        <IconButton
                          sx={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', bgcolor: 'rgba(255,255,255,0.7)' }}
                          onClick={() => setCurrentPhotoIndex((prev) => Math.min(formData.photos.length - 1, prev + 1))}
                          disabled={(currentPhotoIndex || 0) === formData.photos.length - 1}
                        >
                          <ArrowForwardIcon />
                        </IconButton>
                      </>
                    )}
                  </Box>
                ) : (
                  <Typography variant="body1" color="text.secondary">No photos uploaded</Typography>
                )}
              </Card>
            </Box>

            {/* Right Side: Details Card */}
            <Box sx={{ flex: 1 }}>  {/* Removed flexWrap: 'wrap' */}
              <Card sx={{ height: 'auto', p: 4, overflowY: 'auto' }}>  {/* Changed to height: '100%' */}
                <Typography variant="h4" gutterBottom sx={{ color: 'primary.main', fontWeight: 500 }}>
                  Listing Details
                </Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, textAlign: 'left' }}>
                  <Typography variant="body1"><strong>Category:</strong> {formData.category || "Not set"}</Typography>
                  <Typography variant="body1"><strong>Listing Type:</strong> {formData.listingType || "Not set"}</Typography>
                  <Typography variant="body1"><strong>Location:</strong> {[
                    regions.find(r => r.code === formData.region)?.name,
                    provinces.find(p => p.code === formData.province)?.name,
                    municipalities.find(m => m.code === formData.municipality)?.name,
                    barangays.find(b => b.code === formData.barangay)?.name,
                    formData.street
                  ].filter(Boolean).join(", ") || "Not set"}</Typography>
                  <Typography variant="body1"><strong>Property Type:</strong> {formData.propertyType || "Not set"}</Typography>
                  <Typography variant="body1"><strong>Guests:</strong> {formData.guests || 0} | <strong>Bedrooms:</strong> {formData.bedrooms || 0} | <strong>Beds:</strong> {formData.beds || 0} | <strong>Bathrooms:</strong> {formData.bathrooms || 0}</Typography>
                  <Typography variant="body1"><strong>Amenities:</strong> {formData.amenities.length > 0 ? formData.amenities.join(", ") : "None"}</Typography>
                  <Typography variant="body1"><strong>Title:</strong> {formData.title || "Not set"}</Typography>
                  <Typography variant="body1"><strong>Description:</strong> {formData.description || "Not set"}</Typography>
                  <Typography variant="body1"><strong>Price:</strong> {formData.price ? `$${formData.price}` : "Not set"}</Typography>
                  <Typography variant="body1"><strong>Cleaning Fee:</strong> {formData.cleaningFee ? `$${formData.cleaningFee}` : "Not set"}</Typography>
                  <Typography variant="body1"><strong>Discount:</strong> {formData.discountType && formData.discountValue ? `${formData.discountValue} (${formData.discountType})` : "None"}</Typography>
                  <Typography variant="body1"><strong>Availability:</strong> {formData.availability.start && formData.availability.end ? `${formData.availability.start} to ${formData.availability.end}` : "Not set"}</Typography>
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
