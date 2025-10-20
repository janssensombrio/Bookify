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
  Chip,
  IconButton,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Checkbox,
  FormControlLabel,
  Paper,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import { doc, updateDoc } from "firebase/firestore";
import { database } from "../../../config/firebase";

export const EditServiceModal = ({ open, onClose, listingData, refreshList }) => {
  const [formData, setFormData] = useState({
    serviceType: "",
    title: "",
    description: "",
    includes: "",
    targetAudience: "",
    schedule: [],
    price: "",
    pricingType: "",
    cancellationPolicy: "",
    qualifications: "",
    clientRequirements: "",
    maxParticipants: 1,
    ageRestriction: { min: 0, max: 100 },
    photos: [],
    agreeToTerms: false,
  });

  const [newSchedule, setNewSchedule] = useState({ date: "", time: "" });
  const [newAmenity, setNewAmenity] = useState("");

  useEffect(() => {
    if (listingData) setFormData(listingData);
  }, [listingData]);

  const handleChange = (key, value) =>
    setFormData((prev) => ({ ...prev, [key]: value }));

  const handleNestedChange = (field, key, value) =>
    setFormData((prev) => ({
      ...prev,
      [field]: { ...prev[field], [key]: value },
    }));

  const handleArrayChange = (field, index, key, value) => {
    const arr = [...(formData[field] || [])];
    if (key) arr[index][key] = value;
    else arr[index] = value;
    setFormData((prev) => ({ ...prev, [field]: arr }));
  };

  const handleAddArrayItem = (field, defaultValue) => {
    const arr = [...(formData[field] || []), defaultValue];
    setFormData((prev) => ({ ...prev, [field]: arr }));
  };

  const handleRemoveArrayItem = (field, index) => {
    const arr = [...(formData[field] || [])];
    arr.splice(index, 1);
    setFormData((prev) => ({ ...prev, [field]: arr }));
  };

    const handleSave = async () => {
    if (!listingData?.id) return;

    try {
        // Separate existing URLs and new files
        const existingPhotos = formData.photos.filter((p) => typeof p === "string");
        const newFiles = formData.photos.filter((p) => p instanceof File);

        // Upload new files to Cloudinary
        const uploadedUrls = await Promise.all(
        newFiles.map(async (file) => {
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
        ...formData,
        photos: [...existingPhotos, ...uploadedUrls],
        maxParticipants: Number(formData.maxParticipants),
        price: Number(formData.price),
        ageRestriction: {
            min: Number(formData.ageRestriction?.min || 0),
            max: Number(formData.ageRestriction?.max || 100),
        },
        };

        // Update Firestore
        const listingRef = doc(database, "listings", listingData.id);
        await updateDoc(listingRef, { ...updatedData, updatedAt: new Date() });

        if (typeof refreshList === "function") refreshList();
        alert("Service listing updated successfully!");
        onClose();
    } catch (err) {
        console.error("Cloudinary upload failed:", err);
        alert("Failed to upload photos. Please try again.");
    }
    };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle sx={{ fontWeight: 600, color: "primary.main" }}>
        Edit Service
        <IconButton
          onClick={onClose}
          sx={{ position: "absolute", right: 16, top: 16 }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
          {/* Service Type */}
          <Typography variant="h6" fontWeight={600}>
            🛠️ Service Type
          </Typography>
          <Grid container spacing={2}>
            {["Tutoring", "Wellness", "Photography", "Consulting", "Repair", "Other"].map(
              (type) => (
                <Grid item xs={6} key={type}>
                  <Paper
                    elevation={formData.serviceType === type ? 4 : 1}
                    sx={{
                      p: 2,
                      textAlign: "center",
                      border: formData.serviceType === type ? "2px solid" : "1px solid",
                      borderColor: formData.serviceType === type ? "primary.main" : "grey.300",
                      cursor: "pointer",
                    }}
                    onClick={() => handleChange("serviceType", type)}
                  >
                    {type}
                  </Paper>
                </Grid>
              )
            )}
          </Grid>

          {/* Title & Description */}
          <TextField
            fullWidth
            label="Title"
            value={formData.title}
            onChange={(e) => handleChange("title", e.target.value)}
          />
          <TextField
            fullWidth
            multiline
            rows={4}
            label="Description"
            value={formData.description}
            onChange={(e) => handleChange("description", e.target.value)}
          />
          <TextField
            fullWidth
            multiline
            rows={2}
            label="Qualifications"
            value={formData.qualifications}
            onChange={(e) => handleChange("qualifications", e.target.value)}
            />

            <TextField
            fullWidth
            multiline
            rows={2}
            label="Client Requirements"
            value={formData.clientRequirements}
            onChange={(e) => handleChange("clientRequirements", e.target.value)}
            />
          <TextField
            fullWidth
            multiline
            rows={3}
            label="What's included?"
            value={formData.includes}
            onChange={(e) => handleChange("includes", e.target.value)}
          />
          <TextField
            fullWidth
            label="Target Audience"
            value={formData.targetAudience}
            onChange={(e) => handleChange("targetAudience", e.target.value)}
          />

          {/* Schedule */}
          <Typography variant="h6" fontWeight={600}>
            🗓️ Schedule
          </Typography>
          {(formData.schedule || []).map((s, i) => (
            <Grid container spacing={2} key={i}>
              <Grid item xs={6}>
                <TextField
                  fullWidth
                  type="date"
                  value={s.date}
                  onChange={(e) => handleArrayChange("schedule", i, "date", e.target.value)}
                />
              </Grid>
              <Grid item xs={6}>
                <TextField
                  fullWidth
                  type="time"
                  value={s.time}
                  onChange={(e) => handleArrayChange("schedule", i, "time", e.target.value)}
                />
              </Grid>
              <Grid item xs={12}>
                <Button color="error" onClick={() => handleRemoveArrayItem("schedule", i)}>
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

          {/* Price & Terms */}
          <Typography variant="h6" fontWeight={600}>
            💰 Pricing & Terms
          </Typography>
          <TextField
            fullWidth
            type="number"
            label="Price"
            value={formData.price}
            onChange={(e) => handleChange("price", e.target.value)}
          />
          <FormControl fullWidth>
            <InputLabel>Pricing Type</InputLabel>
            <Select
              value={formData.pricingType}
              onChange={(e) => handleChange("pricingType", e.target.value)}
            >
              <MenuItem value="per session">Per session</MenuItem>
              <MenuItem value="per hour">Per hour</MenuItem>
              <MenuItem value="per package">Per package</MenuItem>
            </Select>
          </FormControl>

          {/* Participants & Age */}
          <Grid container spacing={2}>
            <Grid item xs={6}>
              <TextField
                fullWidth
                type="number"
                label="Max Participants"
                value={formData.maxParticipants}
                onChange={(e) => handleChange("maxParticipants", Number(e.target.value))}
              />
            </Grid>
            <Grid item xs={3}>
              <TextField
                fullWidth
                type="number"
                label="Min Age"
                value={formData.ageRestriction.min}
                onChange={(e) =>
                  handleNestedChange("ageRestriction", "min", Number(e.target.value))
                }
              />
            </Grid>
            <Grid item xs={3}>
              <TextField
                fullWidth
                type="number"
                label="Max Age"
                value={formData.ageRestriction.max}
                onChange={(e) =>
                  handleNestedChange("ageRestriction", "max", Number(e.target.value))
                }
              />
            </Grid>
            
            <TextField
                fullWidth
                multiline
                rows={3}
                label="Cancellation Policy"
                value={formData.cancellationPolicy}
                onChange={(e) => handleChange("cancellationPolicy", e.target.value)}
            />
          </Grid>

          {/* Photos */}
          <Typography variant="h6" fontWeight={600}>
            📸 Photos
          </Typography>
          <Button fullWidth variant="contained" component="label">
            Upload Photos
            <input
              hidden
              multiple
              type="file"
              accept="image/*"
              onChange={(e) =>
                handleChange("photos", [...formData.photos, ...Array.from(e.target.files)])
              }
            />
          </Button>
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 2, mt: 2 }}>
            {formData.photos?.map((photo, i) => (
              <Box key={i} sx={{ width: "49%", height: 200, position: "relative" }}>
                <IconButton
                  size="small"
                  color="error"
                  sx={{ position: "absolute", top: 4, right: 4, bgcolor: "white" }}
                  onClick={() =>
                    handleChange(
                      "photos",
                      formData.photos.filter((_, idx) => idx !== i)
                    )
                  }
                >
                  <CloseIcon fontSize="small" />
                </IconButton>
                <img
                  src={typeof photo === "string" ? photo : URL.createObjectURL(photo)}
                  alt={`Photo ${i}`}
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              </Box>
            ))}
          </Box>

        </Box>
      </DialogContent>

      <DialogActions sx={{ p: 3 }}>
        <Button variant="outlined" onClick={onClose}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleSave}
        >
          Save Changes
        </Button>
      </DialogActions>
    </Dialog>
  );
};
