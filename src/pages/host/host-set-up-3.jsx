import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { doc, collection, addDoc, updateDoc, query, where, getDocs } from "firebase/firestore";
import { auth, database } from "../../config/firebase";
import "./styles/host-set-up.css";

import {
  Box,
  Typography,
  TextField,
  Button,
  Toolbar,
  Grid,
  Card,
  CardActionArea,
  Stack,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Paper,
  CardMedia, 
  IconButton,
  Autocomplete,
  Chip,
  FormControlLabel,
  Checkbox,
} from '@mui/material';

import CloseIcon from '@mui/icons-material/Close';
import SchoolIcon from '@mui/icons-material/School';
import SpaIcon from '@mui/icons-material/Spa';
import CameraIcon from '@mui/icons-material/Camera';
import BusinessIcon from '@mui/icons-material/Business';
import BuildIcon from '@mui/icons-material/Build';
import MoreHorizIcon from '@mui/icons-material/MoreHoriz';

const CLOUD_NAME = "dijmlbysr"; // From Cloudinary dashboard
const UPLOAD_PRESET = "listing-uploads"; // Create an unsigned preset in Cloudinary for uploads

export const HostSetUpServices = () => {
  const location = useLocation();
  const initialCategory = location.state?.category || "Services";

  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [draftId, setDraftId] = useState(null);

  const [showAddSchedule, setShowAddSchedule] = useState(false);
  const [newSchedule, setNewSchedule] = useState({ date: "", time: "" });


  const [formData, setFormData] = useState({
    category: initialCategory,
    serviceType: "",
    title: "",
    description: "",
    includes: "",
    targetAudience: "",
    availability: [],
    schedule: [],
    duration: "",
    recurrence: "",
    price: "",
    pricingType: "",
    cancellationPolicy: "",
    qualifications: "",
    clientRequirements: "",
    maxParticipants: 1,
    ageRestriction: { min: 0, max: 100 },
    photos: [],
    languages: [],
    locationType: "", // or "online"
    address: "",
    agreeToTerms: false,
  });

  const nextStep = () => setStep((prev) => prev + 1);
  const prevStep = () => setStep((prev) => prev - 1);

  const handleChange = (key, value) => {
    setFormData({ ...formData, [key]: value });
  };

  const saveDraft = async () => {
    try {
      const user = auth.currentUser;
      if (!user) {
        alert("You must be logged in to save a draft.");
        return;
      }

      if (draftId) {
        const draftRef = doc(database, "listings", draftId);
        await updateDoc(draftRef, { ...formData, updatedAt: new Date() });
        alert("Draft updated!");
      navigate("/hostpage", { state: { activePage: "listings", showDrafts: true } });
      } else {
        const docRef = await addDoc(collection(database, "listings"), {
          ...formData,
          uid: user.uid,
          status: "draft",
          createdAt: new Date(),
        });
        setDraftId(docRef.id);
        alert("Draft saved!");
        
      navigate("/hostpage", { state: { activePage: "listings", showDrafts: true } });
      }
    } catch (error) {
      console.error("Error saving draft:", error);
      alert("Failed to save draft.");
    }
  };

  const handleSubmit = async () => {
    try {
      const user = auth.currentUser;
      if (!user) return alert("You must be logged in to publish.");

      const dataToSave = {
        ...formData,
        uid: user.uid,
        status: "published",
        publishedAt: new Date(),
      };

      if (draftId) {
        // update existing draft
        const draftRef = doc(database, "listings", draftId);
        await updateDoc(draftRef, dataToSave);
      } else {
        // create a new listing directly
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

  // 🔹 Screen 1: Choose Service Type
  if (step === 1)
  return (
    <Box sx={{ textAlign: 'center', mb: 4 }}>
      <Toolbar />
      <Toolbar />
      <Toolbar />
      <Toolbar />
      <Typography variant="h3" component="h1" gutterBottom sx={{ fontWeight: 600, color: 'primary.main' }}>
        What kind of service are you offering?
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
        Choose the type of service you're offering to get started.
      </Typography>

      <Grid container spacing={3} justifyContent="center" sx={{ mb: 4 }}>
        {[
          { value: "Tutoring", label: "Tutoring", desc: "Educational support and teaching services.", icon: <SchoolIcon sx={{ fontSize: 40, color: 'primary.main' }} /> },
          { value: "Wellness", label: "Wellness", desc: "Health and relaxation services.", icon: <SpaIcon sx={{ fontSize: 40, color: 'primary.main' }} /> },
          { value: "Photography", label: "Photography", desc: "Professional photo and video services.", icon: <CameraIcon sx={{ fontSize: 40, color: 'primary.main' }} /> },
          { value: "Consulting", label: "Consulting", desc: "Expert advice and consultation services.", icon: <BusinessIcon sx={{ fontSize: 40, color: 'primary.main' }} /> },
          { value: "Repair", label: "Repair", desc: "Fixing and maintenance services.", icon: <BuildIcon sx={{ fontSize: 40, color: 'primary.main' }} /> },
          { value: "Other", label: "Other", desc: "Any other type of service.", icon: <MoreHorizIcon sx={{ fontSize: 40, color: 'primary.main' }} /> },
        ].map((option) => (
          <Grid item xs={12} sm={6} md={4} key={option.value}>
            <Card
              sx={{
                height: '100%',
                border: formData.serviceType === option.value ? '2px solid' : '1px solid',
                borderColor: formData.serviceType === option.value ? 'primary.main' : 'grey.300',
                boxShadow: formData.serviceType === option.value ? 4 : 1,
                transition: 'all 0.3s ease',
                '&:hover': { boxShadow: 3 },
              }}
            >
              <CardActionArea
                onClick={() => handleChange("serviceType", option.value)}
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
          onClick={async () => {
            await saveHost();
            nextStep();
          }}
          disabled={!formData.serviceType}
          sx={{ px: 4 }}
        >
          Get Started
        </Button>
      </Stack>
    </Box>
  );

  // 🔹 Screen 2: Description
if (step === 2)
  return (
    <Box sx={{ textAlign: 'center', mb: 4, maxWidth: 600, mx: 'auto' }}>
      <Toolbar />
      <Toolbar />
      <Typography variant="h3" component="h1" gutterBottom sx={{ fontWeight: 600, color: 'primary.main' }}>
        Describe your service
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
        Provide details to help guests understand what you're offering.
      </Typography>

      <TextField
        fullWidth
        label="Title"
        placeholder="Service Title"
        value={formData.title}
        onChange={(e) => handleChange("title", e.target.value)}
        sx={{ mb: 3 }}
      />

      <TextField
        fullWidth
        label="Description"
        placeholder="Describe your service in detail"
        multiline
        rows={4}
        value={formData.description}
        onChange={(e) => handleChange("description", e.target.value)}
        sx={{ mb: 3 }}
      />

      <TextField
        fullWidth
        label="What's included?"
        placeholder="List what's included in your service"
        multiline
        rows={3}
        value={formData.includes}
        onChange={(e) => handleChange("includes", e.target.value)}
        sx={{ mb: 3 }}
      />

      <TextField
        fullWidth
        label="Target Audience"
        placeholder="Who is this service for? (e.g., students, professionals)"
        value={formData.targetAudience}
        onChange={(e) => handleChange("targetAudience", e.target.value)}
        sx={{ mb: 4 }}
      />

      <Stack direction="row" spacing={2} justifyContent="center">
        <Button variant="outlined" onClick={prevStep} sx={{ px: 4 }}>
          Back
        </Button>
        <Button
          variant="text"
          onClick={saveDraft}
          sx={{ px: 4 }}
        >
          Save Draft
        </Button>
        <Button
          variant="contained"
          onClick={nextStep}
          disabled={!formData.title || !formData.description}
          sx={{ px: 4 }}
        >
          Next
        </Button>
      </Stack>
    </Box>
  );


  if (step === 3)
  return (
    <Box sx={{ textAlign: 'center', mb: 4, maxWidth: 600, mx: 'auto' }}>
      <Toolbar />
      <Toolbar />
      <Typography variant="h3" component="h1" gutterBottom sx={{ fontWeight: 600, color: 'primary.main' }}>
        Set your schedule
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
        Define the duration and availability for your service.
      </Typography>

      <TextField
        fullWidth
        label="Duration"
        placeholder="e.g., 1 hour"
        value={formData.duration}
        onChange={(e) => handleChange("duration", e.target.value)}
        sx={{ mb: 3 }}
      />

      <FormControl fullWidth sx={{ mb: 4 }}>
        <InputLabel>Recurrence</InputLabel>
        <Select
          value={formData.recurrence}
          label="Recurrence"
          onChange={(e) => handleChange("recurrence", e.target.value)}
        >
          <MenuItem value="">
            <em>Select Recurrence</em>
          </MenuItem>
          <MenuItem value="one-time">One-time</MenuItem>
          <MenuItem value="weekly">Weekly</MenuItem>
          <MenuItem value="monthly">Monthly</MenuItem>
        </Select>
      </FormControl>

      <Typography variant="h6" sx={{ mb: 2, fontWeight: 500, color: 'primary.main' }}>
        Schedule List
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

        <Button
          variant="contained"
          onClick={() => setShowAddSchedule(true)}
          sx={{ mb: 2 }}
        >
          + Add Schedule
        </Button>

        {showAddSchedule && (
          <Box sx={{ mt: 2 }}>
            <Stack spacing={2}>
              <TextField
                type="date"
                label="Date"
                value={newSchedule.date}
                onChange={(e) => setNewSchedule({ ...newSchedule, date: e.target.value })}
                fullWidth
              />
              <TextField
                type="time"
                label="Time"
                value={newSchedule.time}
                onChange={(e) => setNewSchedule({ ...newSchedule, time: e.target.value })}
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
          disabled={!formData.duration || !formData.recurrence}
          sx={{ px: 4 }}
        >
          Next
        </Button>
      </Stack>
    </Box>
  );

  // 🔹 Screen 4: Pricing & Policy
  if (step === 4)
  return (
    <Box sx={{ textAlign: 'center', mb: 4, maxWidth: 600, mx: 'auto' }}>
      <Toolbar />
      <Toolbar />
      <Typography variant="h3" component="h1" gutterBottom sx={{ fontWeight: 600, color: 'primary.main' }}>
        Pricing and Policy
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
        Set your service price, pricing type, and cancellation policy.
      </Typography>

      <TextField
        fullWidth
        type="number"
        label="Price"
        placeholder="Enter your price"
        value={formData.price}
        onChange={(e) => handleChange("price", e.target.value)}
        sx={{ mb: 3 }}
      />

      <FormControl fullWidth sx={{ mb: 3 }}>
        <InputLabel>Pricing Type</InputLabel>
        <Select
          value={formData.pricingType}
          label="Pricing Type"
          onChange={(e) => handleChange("pricingType", e.target.value)}
        >
          <MenuItem value="">
            <em>Select Pricing Type</em>
          </MenuItem>
          <MenuItem value="per session">Per session</MenuItem>
          <MenuItem value="per hour">Per hour</MenuItem>
          <MenuItem value="per package">Per package</MenuItem>
        </Select>
      </FormControl>

      <TextField
        fullWidth
        label="Cancellation Policy"
        placeholder="Enter your cancellation policy"
        multiline
        rows={4}
        value={formData.cancellationPolicy}
        onChange={(e) => handleChange("cancellationPolicy", e.target.value)}
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
          disabled={!formData.price || !formData.pricingType || !formData.cancellationPolicy}
          sx={{ px: 4 }}
        >
          Next
        </Button>
      </Stack>
    </Box>
  );

  // 🔹 Screen 5: Host Requirements
  if (step === 5)
  return (
    <Box sx={{ textAlign: 'center', mb: 4, maxWidth: 600, mx: 'auto' }}>
      <Toolbar />
      <Toolbar />
      <Typography variant="h3" component="h1" gutterBottom sx={{ fontWeight: 600, color: 'primary.main' }}>
        Host Requirements
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
        Specify qualifications, client requirements, and participant restrictions.
      </Typography>

      <TextField
        fullWidth
        label="Qualifications / Experience"
        placeholder="Enter your qualifications or experience"
        multiline
        rows={3}
        value={formData.qualifications}
        onChange={(e) => handleChange("qualifications", e.target.value)}
        sx={{ mb: 3 }}
      />

      <TextField
        fullWidth
        type="number"
        label="Max Participants"
        inputProps={{ min: 1 }}
        value={formData.maxParticipants}
        onChange={(e) => handleChange("maxParticipants", Number(e.target.value))}
        sx={{ mb: 3 }}
      />

      <TextField
        fullWidth
        label="Client Requirements"
        placeholder="Enter client requirements"
        multiline
        rows={3}
        value={formData.clientRequirements}
        onChange={(e) => handleChange("clientRequirements", e.target.value)}
        sx={{ mb: 3 }}
      />

      <Grid container spacing={2} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6}>
          <TextField
            fullWidth
            type="number"
            label="Age Restriction (min)"
            value={formData.ageRestriction.min}
            onChange={(e) =>
              handleChange("ageRestriction", { ...formData.ageRestriction, min: e.target.value })
            }
          />
        </Grid>
        <Grid item xs={12} sm={6}>
          <TextField
            fullWidth
            type="number"
            label="Age Restriction (max)"
            value={formData.ageRestriction.max}
            onChange={(e) =>
              handleChange("ageRestriction", { ...formData.ageRestriction, max: e.target.value })
            }
          />
        </Grid>
      </Grid>

      <Stack direction="row" spacing={2} justifyContent="center">
        <Button variant="outlined" onClick={prevStep} sx={{ px: 4 }}>
          Back
        </Button>
        <Button variant="text" onClick={saveDraft} sx={{ px: 4 }}>
          Save Draft
        </Button>
        <Button variant="contained" onClick={nextStep} sx={{ px: 4 }}>
          Next
        </Button>
      </Stack>
    </Box>
  );

// 🔹 Screen 6: Media
if (step === 6) {
  return (
    <Box sx={{ textAlign: 'center', mb: 4 }}>
      <Toolbar />
      <Toolbar />
      <Typography
        variant="h3"
        component="h1"
        gutterBottom
        sx={{ fontWeight: 600, color: 'primary.main' }}
      >
        Upload Media
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
        Upload high-quality images to showcase your service.
      </Typography>

      {/* File upload */}
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
                    { method: 'POST', body: formDataUpload }
                  );
                  const data = await response.json();
                  if (data.secure_url) uploadedUrls.push(data.secure_url);
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
                  sx={{ height: '100%', objectFit: 'cover', borderRadius: 3 }}
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

      {/* Navigation buttons */}
      <Stack direction="row" spacing={2} justifyContent="center" sx={{ mt: 4 }}>
        <Button variant="outlined" onClick={prevStep} sx={{ px: 4 }}>
          Back
        </Button>
        <Button variant="text" onClick={saveDraft} sx={{ px: 4 }}>
          Save Draft
        </Button>
        <Button variant="contained" onClick={nextStep} sx={{ px: 4 }}>
          Next
        </Button>
      </Stack>
    </Box>
  );
}

  // 🔹 Screen 7: Communication
  if (step === 7) 
    return (
  <Box sx={{ textAlign: 'center', mb: 4, maxWidth: 600, mx: 'auto' }}>
    <Toolbar />
    <Toolbar />

    <Typography
      variant="h3"
      component="h1"
      gutterBottom
      sx={{ fontWeight: 600, color: 'primary.main' }}
    >
      Communication Details
    </Typography>

    <Typography
      variant="body1"
      color="text.secondary"
      sx={{ mb: 4 }}
    >
      Provide the languages you speak and how guests can reach you.
    </Typography>

    {/* Languages input */}
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
          label="Languages (comma-separated)"
          placeholder="Start typing..."
          fullWidth
        />
      )}
      sx={{ mb: 3 }}
    />

    {/* Location Type */}
    <FormControl fullWidth sx={{ mb: 3 }}>
      <InputLabel>Location Type</InputLabel>
      <Select
        value={formData.locationType}
        label="Location Type"
        onChange={(e) => handleChange("locationType", e.target.value)}
      >
        <MenuItem value="in-person">In-person</MenuItem>
        <MenuItem value="online">Online</MenuItem>
      </Select>
    </FormControl>

    {/* Address input (only if in-person) */}
    {formData.locationType === "in-person" && (
      <TextField
        fullWidth
        label="Service Address"
        placeholder="Enter your service address"
        value={formData.address}
        onChange={(e) => handleChange("address", e.target.value)}
        sx={{ mb: 4 }}
      />
    )}

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
        disabled={
          formData.languages.length === 0 ||
          (formData.locationType === "in-person" && !formData.address)
        }
        sx={{ px: 4 }}
      >
        Next
      </Button>
    </Stack>
  </Box>
);

// 🔹 Screen 8: Review & Publish
  return (
  <Box sx={{ textAlign: 'center', mb: 4 }}>
    <Toolbar />
    <Toolbar />

    <Typography
      variant="h3"
      component="h1"
      gutterBottom
      sx={{ fontWeight: 600, color: 'primary.main' }}
    >
      Review and Publish
    </Typography>

    <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
      Double-check all your details before publishing your service.
    </Typography>

    {/* Left: Photos | Right: Details */}
    <Box
      sx={{
        display: 'flex',
        flexDirection: { xs: 'column', md: 'row' },
        gap: 3,
        maxWidth: 900,
        mx: 'auto',
        mb: 4,
      }}
    >
      {/* Left: Photos */}
      <Box sx={{ flex: 1 }}>
        <Card
          sx={{
            height: 300,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
          }}
        >
          {formData.photos.length > 0 ? (
            <img
              src={formData.photos[0]}
              alt="Service"
              style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 4 }}
            />
          ) : (
            <Typography variant="body1" color="text.secondary">
              No photos uploaded
            </Typography>
          )}
        </Card>
      </Box>

      {/* Right: Details */}
      <Box sx={{ flex: 1 }}>
        <Card sx={{ height: 'auto', p: 4, overflowY: 'auto' }}>
          <Typography variant="h5" gutterBottom sx={{ fontWeight: 500, color: 'primary.main' }}>
            Service Details
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, textAlign: 'left' }}>
            <Typography variant="body1"><strong>Category:</strong> {formData.category}</Typography>
            <Typography variant="body1"><strong>Service Type:</strong> {formData.serviceType}</Typography>
            <Typography variant="body1"><strong>Title:</strong> {formData.title}</Typography>
            <Typography variant="body1"><strong>Description:</strong> {formData.description}</Typography>
            <Typography variant="body1"><strong>Includes:</strong> {formData.includes}</Typography>
            <Typography variant="body1"><strong>Target Audience:</strong> {formData.targetAudience}</Typography>
            <Typography variant="body1"><strong>Duration:</strong> {formData.duration}</Typography>
            <Typography variant="body1"><strong>Recurrence:</strong> {formData.recurrence}</Typography>
            <Typography variant="body1"><strong>Price:</strong> {formData.price} ({formData.pricingType})</Typography>
            <Typography variant="body1"><strong>Cancellation Policy:</strong> {formData.cancellationPolicy}</Typography>
            <Typography variant="body1"><strong>Qualifications:</strong> {formData.qualifications}</Typography>
            <Typography variant="body1"><strong>Client Requirements:</strong> {formData.clientRequirements || "None"}</Typography>
            <Typography variant="body1"><strong>Max Participants:</strong> {formData.maxParticipants}</Typography>
            <Typography variant="body1"><strong>Age Restriction:</strong> {formData.ageRestriction.min} - {formData.ageRestriction.max}</Typography>
            <Typography variant="body1"><strong>Languages:</strong> {formData.languages.join(", ")}</Typography>
            <Typography variant="body1"><strong>Location Type:</strong> {formData.locationType}</Typography>
            {formData.locationType === "in-person" && (
              <Typography variant="body1"><strong>Address:</strong> {formData.address}</Typography>
            )}
          </Box>
        </Card>
      </Box>
    </Box>

    {/* Agree to terms */}
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

    {/* Navigation Buttons */}
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
);
};
