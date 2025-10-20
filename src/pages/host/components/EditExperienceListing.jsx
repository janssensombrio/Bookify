import React, { useState, useEffect } from "react";
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
  Chip,
  IconButton,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { database } from "../../../config/firebase";

export default function ExperienceEditModal({ listingId, onClose, refreshList }) {
  const [experience, setExperience] = useState(null);
  const [selectedParticipants, setSelectedParticipants] = useState(1);
  const [newAmenity, setNewAmenity] = useState("");

  useEffect(() => {
    if (!listingId) return;
    const fetchExperience = async () => {
      try {
        const docRef = doc(database, "listings", listingId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setExperience(docSnap.data());
          setSelectedParticipants(1);
        }
      } catch (error) {
        console.error(error);
      }
    };
    fetchExperience();
  }, [listingId]);

  const handleFieldChange = (field, value) =>
    setExperience((prev) => ({ ...prev, [field]: value }));

  const handleNestedChange = (field, key, value) =>
    setExperience((prev) => ({
      ...prev,
      [field]: { ...prev[field], [key]: value },
    }));

  const handleArrayChange = (field, index, key, value) => {
    const arr = [...(experience[field] || [])];
    if (key) arr[index][key] = value;
    else arr[index] = value;
    setExperience((prev) => ({ ...prev, [field]: arr }));
  };

  const handleAddArrayItem = (field, defaultValue) => {
    const arr = [...(experience[field] || []), defaultValue];
    setExperience((prev) => ({ ...prev, [field]: arr }));
  };

  const handleRemoveArrayItem = (field, index) => {
    const arr = [...(experience[field] || [])];
    arr.splice(index, 1);
    setExperience((prev) => ({ ...prev, [field]: arr }));
  };

  const handleIncrementParticipants = () => {
    if (selectedParticipants < (experience.maxParticipants || 30))
      setSelectedParticipants((p) => p + 1);
  };

  const handleDecrementParticipants = () => {
    if (selectedParticipants > 1) setSelectedParticipants((p) => p - 1);
  };

  const handleSave = async () => {
  if (!listingId) return;

  try {
    // Separate existing URLs from new File objects
    const existingPhotos = (experience.photos || []).filter(p => typeof p === "string");
    const newPhotos = (experience.photos || []).filter(p => p instanceof File);

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

    // Merge existing + new uploaded URLs
    const updatedData = {
      ...experience,
      photos: [...existingPhotos, ...uploadedUrls],
      maxParticipants: Number(experience.maxParticipants),
      price: Number(experience.price),
      ageRestriction: {
        min: Number(experience.ageRestriction?.min || 0),
        max: Number(experience.ageRestriction?.max || 0),
      },
    };

    // Save to Firestore
    const docRef = doc(database, "listings", listingId);
    await updateDoc(docRef, updatedData);

    if (typeof refreshList === "function") {
      refreshList();
    }
    
    alert("Listing Updated Successfully!");
    onClose();
  } catch (err) {
    console.error("Cloudinary upload failed:", err);
    alert("Failed to upload photos. Please try again.");
  }
};

  if (!experience) return null;

  return (
    <Dialog open={!!listingId} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle sx={{ fontWeight: 600, color: "primary.main" }}>
        Edit Experience
        <IconButton
          onClick={onClose}
          sx={{ position: "absolute", right: 16, top: 16 }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
          {/* Title & Description */}
          <TextField
            fullWidth
            label="Title"
            value={experience.title || ""}
            onChange={(e) => handleFieldChange("title", e.target.value)}
          />
          <TextField
            fullWidth
            multiline
            rows={4}
            label="Description"
            value={experience.description || ""}
            onChange={(e) => handleFieldChange("description", e.target.value)}
          />

          {/* Basic Info */}
          <Typography variant="h6" fontWeight={600}>
            🏠 Basic Info
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={6}>
              <TextField
                fullWidth
                label="Duration"
                value={experience.duration || ""}
                onChange={(e) => handleFieldChange("duration", e.target.value)}
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth
                type="number"
                label="Max Participants"
                value={experience.maxParticipants || 1}
                onChange={(e) =>
                  handleFieldChange("maxParticipants", Number(e.target.value))
                }
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                select
                fullWidth
                label="Experience Type"
                value={experience.experienceType || "in-person"}
                onChange={(e) =>
                  handleFieldChange("experienceType", e.target.value)
                }
              >
                <MenuItem value="in-person">In-Person</MenuItem>
                <MenuItem value="online">Online</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth
                label="Languages (comma separated)"
                value={(experience.languages || []).join(", ")}
                onChange={(e) =>
                  handleFieldChange(
                    "languages",
                    e.target.value.split(",").map((l) => l.trim())
                  )
                }
              />
            </Grid>
          </Grid>

          {/* Location */}
          <Typography variant="h6" fontWeight={600}>
            📍 Location
          </Typography>
          <Grid container spacing={2}>
            {["street", "barangay", "municipality", "province", "region"].map(
              (field) => (
                <Grid item xs={12} sm={6} key={field}>
                  <TextField
                    fullWidth
                    label={
                      field.charAt(0).toUpperCase() + field.slice(1)
                    }
                    value={experience[field]?.name || experience[field] || ""}
                    onChange={(e) =>
                      ["barangay", "municipality", "province", "region"].includes(
                        field
                      )
                        ? handleNestedChange(field, "name", e.target.value)
                        : handleFieldChange(field, e.target.value)
                    }
                  />
                </Grid>
              )
            )}
          </Grid>

          {/* Age Restriction */}
          <Typography variant="h6" fontWeight={600}>
            👶 Age Restriction
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={6}>
              <TextField
                fullWidth
                type="number"
                label="Min Age"
                value={experience.ageRestriction?.min || ""}
                onChange={(e) =>
                  handleNestedChange("ageRestriction", "min", Number(e.target.value))
                }
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth
                type="number"
                label="Max Age"
                value={experience.ageRestriction?.max || ""}
                onChange={(e) =>
                  handleNestedChange("ageRestriction", "max", Number(e.target.value))
                }
              />
            </Grid>
          </Grid>

          {/* Host Requirements */}
          <TextField
            fullWidth
            multiline
            rows={3}
            label="Host Requirements"
            value={experience.hostRequirements || ""}
            onChange={(e) => handleFieldChange("hostRequirements", e.target.value)}
          />

          {/* Amenities */}
          <Typography variant="h6" fontWeight={600}>
            🛋️ Amenities
          </Typography>
          <Stack direction="row" spacing={2} flexWrap="wrap" sx={{ mb: 2 }}>
            {(experience.amenities || []).map((amenity, i) => (
              <Chip
                key={i}
                label={amenity}
                onDelete={() => handleRemoveArrayItem("amenities", i)}
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
                  handleFieldChange("amenities", [
                    ...(experience.amenities || []),
                    newAmenity.trim(),
                  ]);
                  setNewAmenity("");
                }
              }}
            >
              Add
            </Button>
          </Box>

          {/* Schedule */}
          <Typography variant="h6" fontWeight={600}>
            🗓️ Schedule
          </Typography>
          {(experience.schedule || []).map((sched, idx) => (
            <Grid container spacing={2} key={idx} sx={{ mb: 1 }}>
              <Grid item xs={6}>
                <TextField
                  fullWidth
                  type="date"
                  label="Date"
                  value={sched.date || ""}
                  onChange={(e) =>
                    handleArrayChange("schedule", idx, "date", e.target.value)
                  }
                />
              </Grid>
              <Grid item xs={6}>
                <TextField
                  fullWidth
                  type="time"
                  label="Time"
                  value={sched.time || ""}
                  onChange={(e) =>
                    handleArrayChange("schedule", idx, "time", e.target.value)
                  }
                />
              </Grid>
              <Grid item xs={12}>
                <Button
                  variant="outlined"
                  color="error"
                  onClick={() => handleRemoveArrayItem("schedule", idx)}
                >
                  Remove
                </Button>
              </Grid>
            </Grid>
          ))}
          <Button
            variant="contained"
            onClick={() => handleAddArrayItem("schedule", { date: "", time: "" })}
          >
            Add Schedule
          </Button>

          {/* Participants */}
          <Typography variant="h6" fontWeight={600} sx={{ mt: 2 }} >
            👥 Participants
          </Typography>
          <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
            <Button variant="outlined" onClick={handleDecrementParticipants}>
              -
            </Button>
            <Typography>{selectedParticipants}</Typography>
            <Button variant="outlined" onClick={handleIncrementParticipants}>
              +
            </Button>
            <TextField
            fullWidth
            type="number"
            label="Price per Participant"
            value={experience.price || ""}
            onChange={(e) => handleFieldChange("price", Number(e.target.value))}
          />
          </Box>

          {/* 📸 Photos */}
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
                setExperience((prev) => ({
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
            {experience.photos?.map((photo, i) => (
                <Box
                key={i}
                sx={{
                    position: "relative",
                    width: "49%",
                    height: 200,
                    borderRadius: 2,
                    overflow: "hidden",
                    boxShadow: 1,
                }}
                >
                {/* Delete Button */}
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
                    setExperience((prev) => ({
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

          <Typography variant="h6" fontWeight={600} sx={{ mt: 2 }} >
            ❎ Cancellation Policy
          </Typography>
            <TextField
            fullWidth
            multiline
            rows={3}
            label="Cancellation Policy"
            value={experience.cancellationPolicy || ""}
            onChange={(e) => handleFieldChange("cancellationPolicy", e.target.value)}
            />

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
