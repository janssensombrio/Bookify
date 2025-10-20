import { useState, useEffect } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  Typography,
  TextField,
  Button,
  Grid,
  Stack,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Toolbar,
  InputAdornment,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import IconButton from "@mui/material/IconButton";
import ApartmentIcon from "@mui/icons-material/Apartment";
import HouseIcon from "@mui/icons-material/House";
import CottageIcon from "@mui/icons-material/Cottage";
import VillaIcon from "@mui/icons-material/Villa";
import CabinIcon from "@mui/icons-material/Cabin";

import HomeIcon from "@mui/icons-material/Home";
import HotelIcon from "@mui/icons-material/Hotel";
import MeetingRoomIcon from "@mui/icons-material/MeetingRoom";


export default function EditHomeModal({ open, onClose, listing, onSave }) {
  const [regions, setRegions] = useState([]);
  const [provinces, setProvinces] = useState([]);
  const [municipalities, setMunicipalities] = useState([]);
  const [barangays, setBarangays] = useState([]);

  const [formData, setFormData] = useState(listing || {});
  const [newAmenity, setNewAmenity] = useState("");

  useEffect(() => {
    if (listing) setFormData(listing);
  }, [listing]);

  useEffect(() => {
    fetch("https://psgc.gitlab.io/api/regions/")
      .then((res) => res.json())
      .then((data) => setRegions(data))
      .catch((err) => console.error("Failed to load regions:", err));
  }, []);

  useEffect(() => {
  if (!listing) return;

  const loadLocationData = async () => {
    try {
      // Load provinces if region exists
      if (listing.region?.code) {
        const res = await fetch(
          `https://psgc.gitlab.io/api/regions/${listing.region.code}/provinces/`
        );
        const data = await res.json();
        setProvinces(data);
      }

      // Load municipalities if province exists
      if (listing.province?.code) {
        const res = await fetch(
          `https://psgc.gitlab.io/api/provinces/${listing.province.code}/municipalities/`
        );
        const data = await res.json();
        setMunicipalities(data);
      }

      // Load barangays if municipality exists
      if (listing.municipality?.code) {
        const res = await fetch(
          `https://psgc.gitlab.io/api/municipalities/${listing.municipality.code}/barangays/`
        );
        const data = await res.json();
        setBarangays(data);
      }
    } catch (err) {
      console.error("Failed to load location data:", err);
    }
  };

  loadLocationData();
}, [listing]);


  const handleChange = (key, value) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

const handleSave = async () => {
  // Basic validation rules
  const requiredFields = {
    listingType: "Listing Type",
    propertyType: "Property Type",
    title: "Title",
    description: "Description",
    price: "Price",
    cleaningFee: "Cleaning Fee",
    region: "Region",
    province: "Province",
    municipality: "Municipality",
    barangay: "Barangay",
    street: "Street / House No.",
    bedrooms: "Bedrooms",
    beds: "Beds",
    bathrooms: "Bathrooms",
    guests: "Number of Guests",
  };

  // Find missing fields
  const missing = Object.entries(requiredFields)
    .filter(([key]) => {
      const value = formData[key];
      if (typeof value === "object" && value !== null) {
        return !value.code;
      }
      return !value || value === "";
    })
    .map(([_, label]) => label);

  // Alert if any are missing
  if (missing.length > 0) {
    alert(`Please fill out the following fields:\n\n${missing.join("\n")}`);
    return;
  }

  // ✅ Get readable names for location fields
  const selectedRegion = regions.find(r => r.code === formData.region?.code)?.name || "";
  const selectedProvince = provinces.find(p => p.code === formData.province?.code)?.name || "";
  const selectedMunicipality = municipalities.find(m => m.code === formData.municipality?.code)?.name || "";
  const selectedBarangay = barangays.find(b => b.code === formData.barangay?.code)?.name || "";

  try {
    // Separate old URLs (strings) from new File objects
    const existingPhotos = (formData.photos || []).filter((p) => typeof p === "string");
    const newPhotos = (formData.photos || []).filter((p) => p instanceof File);

    // Upload new photos to Cloudinary
    const uploadedUrls = await Promise.all(
      newPhotos.map(async (file) => {
        const data = new FormData();
        data.append("file", file);
        data.append("upload_preset", "listing-uploads");
        data.append("cloud_name", "dijmlbysr");

        const res = await fetch("https://api.cloudinary.com/v1_1/dijmlbysr/image/upload", {
          method: "POST",
          body: data,
        });
        const json = await res.json();
        return json.secure_url;
      })
    );

    // Merge existing + newly uploaded URLs and include readable names
    const updatedData = {
      ...formData,
      photos: [...existingPhotos, ...uploadedUrls],
      region: { ...formData.region, name: selectedRegion },
      province: { ...formData.province, name: selectedProvince },
      municipality: { ...formData.municipality, name: selectedMunicipality },
      barangay: { ...formData.barangay, name: selectedBarangay },

      // Convert number fields
        price: Number(formData.price),
        cleaningFee: Number(formData.cleaningFee),
        discountValue: Number(formData.discountValue),
        bedrooms: Number(formData.bedrooms),
        beds: Number(formData.beds),
        bathrooms: Number(formData.bathrooms),
        guests: Number(formData.guests),
    };

    

    await onSave(updatedData);
  } catch (err) {
    console.error("Cloudinary upload failed:", err);
    alert("Failed to upload photos. Please try again.");
  }
};

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle sx={{ fontWeight: 600, color: "primary.main" }}>
        Edit Listing
        <IconButton
          onClick={onClose}
          sx={{ position: "absolute", right: 16, top: 16 }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>

            {/* Listing Type */}
            <TextField
            select
            fullWidth
            label="Listing Type"
            value={formData.listingType || ""}
            onChange={(e) => handleChange("listingType", e.target.value)}
            margin="normal"
            >
            <MenuItem value="Entire place">
                <HomeIcon sx={{ mr: 1 , color: "primary.main" }} /> Entire Place
            </MenuItem>
            <MenuItem value="Private room">
                <HotelIcon sx={{ mr: 1 , color: "primary.main" }} /> Private Room
            </MenuItem>
            <MenuItem value="Shared room">
                <MeetingRoomIcon sx={{ mr: 1 , color: "primary.main" }} /> Shared Room
            </MenuItem>
            </TextField>

            {/* 🏡 Property Type */}
            <Grid item xs={12} sm={6}>
                <FormControl fullWidth>
                <InputLabel>Property Type</InputLabel>
                <Select
                    value={formData.propertyType}
                    label="Property Type"
                    onChange={(e) => handleChange("propertyType", e.target.value)}
                >
                    <MenuItem value="Apartment">
                    <ApartmentIcon sx={{ mr: 1, color: "primary.main" }} /> Apartment
                    </MenuItem>
                    <MenuItem value="House">
                    <HouseIcon sx={{ mr: 1, color: "primary.main" }} /> House
                    </MenuItem>
                    <MenuItem value="Cottage">
                    <CottageIcon sx={{ mr: 1, color: "primary.main" }} /> Cottage
                    </MenuItem>
                    <MenuItem value="Villa">
                    <VillaIcon sx={{ mr: 1, color: "primary.main" }} /> Villa
                    </MenuItem>
                    <MenuItem value="Cabin">
                    <CabinIcon sx={{ mr: 1, color: "primary.main" }} /> Cabin
                    </MenuItem>
                </Select>
                </FormControl>
            </Grid>

          {/* Location Section */}
          <Typography variant="h6" fontWeight={600}>
            📍 Location
          </Typography>

          <Grid container spacing={4}>
            <Grid item xs={4} sm={2}>
              <FormControl fullWidth>
                <InputLabel>Region</InputLabel>
                <Select
                  value={formData.region?.code || "Select Region"}
                  label="Region"
                  onChange={async (e) => {
                    const code = e.target.value;
                    handleChange("region", { code });
                    handleChange("province", "");
                    handleChange("municipality", "");
                    handleChange("barangay", "");
                    const res = await fetch(
                      `https://psgc.gitlab.io/api/regions/${code}/provinces/`
                    );
                    const data = await res.json();
                    setProvinces(data);
                  }}
                >
                  <MenuItem value="Select Region">
                    <em>Select Region</em>
                  </MenuItem>
                  {regions.map((region) => (
                    <MenuItem key={region.code} value={region.code}>
                      {region.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Province</InputLabel>
                <Select
                  value={formData.province?.code || "Select Province"}
                  label="Province"
                  onChange={async (e) => {
                    const code = e.target.value;
                    handleChange("province", { code });
                    const res = await fetch(
                      `https://psgc.gitlab.io/api/provinces/${code}/municipalities/`
                    );
                    const data = await res.json();
                    setMunicipalities(data);
                  }}
                >
                  <MenuItem value="Select Province">
                    <em>Select Province</em>
                  </MenuItem>
                  {provinces.map((p) => (
                    <MenuItem key={p.code} value={p.code}>
                      {p.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Municipality</InputLabel>
                <Select
                  value={formData.municipality?.code || "Select Municipality"}
                  label="Municipality"
                  onChange={async (e) => {
                    const code = e.target.value;
                    handleChange("municipality", { code });
                    const res = await fetch(
                      `https://psgc.gitlab.io/api/municipalities/${code}/barangays/`
                    );
                    const data = await res.json();
                    setBarangays(data);
                  }}
                >
                  <MenuItem value="Select Municipality">
                    <em>Select Municipality</em>
                  </MenuItem>
                  {municipalities.map((m) => (
                    <MenuItem key={m.code} value={m.code}>
                      {m.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Barangay</InputLabel>
                <Select
                  value={formData.barangay?.code || "Select Barangay"}
                  label="Barangay"
                  onChange={(e) =>
                    handleChange("barangay", { code: e.target.value })
                  }
                >
                  <MenuItem value="Select Barangay">
                    <em>Select Barangay</em>
                  </MenuItem>
                  {barangays.map((b) => (
                    <MenuItem key={b.code} value={b.code}>
                      {b.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Street / House No."
                value={formData.street || ""}
                onChange={(e) => handleChange("street", e.target.value)}
              />
            </Grid>
          </Grid>

          {/* Property Details */}
          <Typography variant="h6" fontWeight={600} sx={{ mt: 4 }}>
            🏠 Property Details
          </Typography>

            <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {/* Title */}
            <TextField
                fullWidth
                label="Title"
                value={formData.title || ""}
                onChange={(e) => handleChange("title", e.target.value)}
            />

            {/* Description */}
            <TextField
                fullWidth
                label="Description"
                multiline
                rows={4} // taller textarea
                value={formData.description || ""}
                onChange={(e) => handleChange("description", e.target.value)}
            />

            {/* Price */}
            <TextField
                fullWidth
                label="Price (₱)"
                type="number"
                value={formData.price || ""}
                onChange={(e) => Number(handleChange("price", e.target.value))}
            />

            {/* Cleaning Fee */}
            <TextField
                fullWidth
                label="Cleaning Fee (₱)"
                type="number"
                value={formData.cleaningFee || ""}
                onChange={(e) => Number(handleChange("cleaningFee", e.target.value))}
            />
            </Box>

          <Typography variant="h6" fontWeight={600} sx={{ mt: 4 }}>
            🏠 Additional Details
          </Typography>

          <TextField
            fullWidth
            label="Unique Description"
            multiline
            rows={3}
            value={formData.uniqueDescription || ""}
            onChange={(e) => handleChange("uniqueDescription", e.target.value)}
            sx={{ mt: 2 }}
            />

            <Grid container spacing={2} sx={{ mt: 2 }}>
                <Grid item xs={12} sm={6}>
                    <FormControl fullWidth>
                    <InputLabel>Discount Type</InputLabel>
                    <Select
                        value={formData.discountType || ""}
                        onChange={(e) => handleChange("discountType", e.target.value)}
                    >
                        
                        <MenuItem value="none">None</MenuItem>
                        <MenuItem value="percentage">Percentage</MenuItem>
                        <MenuItem value="fixed">Fixed Amount</MenuItem>
                    </Select>
                    </FormControl>
                </Grid>
                <Grid item xs={12} sm={6}>
                    <TextField
                    fullWidth
                    label="Discount Value"
                    type="number"
                    disabled={formData.discountType === "none"}
                    value={formData.discountType === "none" ? 0 : formData.discountValue}
                    onChange={(e) => Number(handleChange("discountValue", e.target.value))}
                    />
                </Grid>
            </Grid>

            <Grid container spacing={2} sx={{ mt: 2 }}>
                <Grid item xs={12} sm={6}>
                    <TextField
                    fullWidth
                    type="date"
                    label="Availability Start"
                    InputLabelProps={{ shrink: true }}
                    value={formData.availability?.start || ""}
                    onChange={(e) =>
                        handleChange("availability", { ...formData.availability, start: e.target.value })
                    }
                    />
                </Grid>
                <Grid item xs={12} sm={6}>
                    <TextField
                    fullWidth
                    type="date"
                    label="Availability End"
                    InputLabelProps={{ shrink: true }}
                    value={formData.availability?.end || ""}
                    onChange={(e) =>
                        handleChange("availability", { ...formData.availability, end: e.target.value })
                    }
                    />
                </Grid>
            </Grid>

          {/* 👥 Guest Capacity */}
        <Grid item xs={12} sm={6}>
            <TextField
            fullWidth
            label="Number of Guests"
            type="number"
            value={formData.guests || ""}
            onChange={(e) => Number(handleChange("maxGuests", e.target.value))}
            />
        </Grid>

        <Box display="grid" gridTemplateColumns="repeat(3, 1fr)" gap={2}>
            <TextField
                fullWidth
                type="number"
                label="Bedrooms"
                value={formData.bedrooms || ""}
                onChange={(e) => Number(handleChange("bedrooms", e.target.value))}
                variant="outlined"
                inputProps={{ min: 0 }}
            />
            <TextField
                fullWidth
                type="number"
                label="Beds"
                value={formData.beds || ""}
                onChange={(e) => Number(handleChange("beds", e.target.value))}
                variant="outlined"
                inputProps={{ min: 0 }}
            />
            <TextField
                fullWidth
                type="number"
                label="Bathrooms"
                value={formData.bathrooms || ""}
                onChange={(e) => Number(handleChange("bathrooms", e.target.value))}
                variant="outlined"
                inputProps={{ min: 0 }}
            />
            </Box>

          {/* Amenities */}
          <Typography variant="h6" fontWeight={600} sx={{ mt: 4 }}>
            🛋️ Amenities
          </Typography>

          <Stack direction="row" spacing={2} flexWrap="wrap" sx={{ mb: 2 }}>
            {formData.amenities?.map((amenity, i) => (
              <Chip
                key={i}
                label={amenity}
                onDelete={() =>
                  handleChange(
                    "amenities",
                    formData.amenities.filter((a) => a !== amenity)
                  )
                }
                color="primary"
                variant="outlined"
              />
            ))}
          </Stack>

          <Box sx={{ display: "flex", gap: 2 }}>
            <TextField
              fullWidth
              label="Add Amenity"
              value={newAmenity}
              onChange={(e) => setNewAmenity(e.target.value)}
            />
            <Button
              variant="contained"
              onClick={() => {
                if (newAmenity.trim()) {
                  handleChange("amenities", [
                    ...(formData.amenities || []),
                    newAmenity.trim(),
                  ]);
                  setNewAmenity("");
                }
              }}
            >
              Add
            </Button>
          </Box>

          {/* 📸 Photo Upload */}
            <Grid item xs={12}>
            <Typography variant="h6" fontWeight={600} sx={{ mt: 4 }}>
                📸 Photos
            </Typography>

            {/* Upload Button */}
            <Button
                fullWidth
                variant="contained"
                component="label"
                sx={{ mt: 2, p: 2 }}
            >
                Upload Photos
                <input
                hidden
                multiple
                type="file"
                accept="image/*"
                onChange={(e) => {
                    const newFiles = Array.from(e.target.files);
                    // ✅ Keep existing photos + add new ones
                    setFormData((prev) => ({
                    ...prev,
                    photos: [...(prev.photos || []), ...newFiles],
                    }));
                }}
                />
            </Button>

            {/* Photo Preview */}
            <Box
                sx={{
                display: "flex",
                flexWrap: "wrap",
                gap: 2,
                mt: 2,
                }}
            >
                {formData.photos?.map((photo, i) => (
                <Box
                    key={i}
                    sx={{
                    position: "relative",
                    width: "49%",
                    height: "auto",
                    borderRadius: 2,
                    overflow: "hidden",
                    boxShadow: 1,
                    }}
                >
                    {/* ❌ Delete Button */}
                    <IconButton
                    size="small"
                    color="error"
                    sx={{
                        position: "absolute",
                        top: 4,
                        right: 4,
                        bgcolor: "rgba(255,255,255,0.8)",
                        "&:hover": { bgcolor: "rgba(255,255,255,1)" },
                    }}
                    onClick={() => {
                        setFormData((prev) => ({
                        ...prev,
                        photos: prev.photos.filter((_, index) => index !== i),
                        }));
                    }}
                    >
                    <CloseIcon fontSize="small" />
                    </IconButton>

                    {/* Image */}
                    <img
                    src={typeof photo === "string" ? photo : URL.createObjectURL(photo)}
                    alt={`Photo ${i + 1}`}
                    style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                    }}
                    />
                </Box>
                ))}
            </Box>
            </Grid>
          
        </Box>
      </DialogContent>

      <DialogActions sx={{ p: 3 }}>
        <Button variant="outlined" onClick={onClose}>
          Cancel
        </Button>
        <Button variant="contained" onClick={handleSave}>
          Save Changes
        </Button>
      </DialogActions>
    </Dialog>
  );
}
