import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  IconButton,
  Typography,
  Grid,
  Card,
  CardActionArea,
  Box,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import HomeIcon from '@mui/icons-material/Home';
import ExploreIcon from '@mui/icons-material/Explore';
import WorkIcon from '@mui/icons-material/Work';

function HostCategModal({ onClose, onSelectCategory }) {
  return (
    <Dialog
      open={true} // Assuming it's controlled externally; adjust if needed
      onClose={onClose}
      maxWidth="md"
      fullWidth
      sx={{
        '& .MuiDialog-paper': {
          borderRadius: 2,
          padding: 2,
        },
      }}
    >
      <DialogTitle
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingBottom: 1,
        }}
      >
        <Typography variant="h6" component="h4" sx={{ fontWeight: 600 }}>
          What would you like to host?
        </Typography>
        <IconButton
          edge="end"
          color="inherit"
          onClick={onClose}
          aria-label="close"
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent sx={{ paddingTop: 0 }}>
        <Grid container spacing={3} justifyContent="center">
          {[
            { label: 'Homes', value: 'Homes', icon: <HomeIcon sx={{ fontSize: 50, color: 'primary.main' }} /> },
            { label: 'Experiences', value: 'Experiences', icon: <ExploreIcon sx={{ fontSize: 50, color: 'primary.main' }} /> },
            { label: 'Services', value: 'Services', icon: <WorkIcon sx={{ fontSize: 50, color: 'primary.main' }} /> },
          ].map((category) => (
            <Grid item xs={12} sm={4} key={category.value}>
              <Card
                sx={{
                  height: '100%',
                  minHeight: 200,
                  transition: 'all 0.3s ease',
                  '&:hover': {
                    boxShadow: 3,
                    transform: 'translateY(-2px)',
                  },
                }}
              >
                <CardActionArea
                  onClick={() => onSelectCategory(category.value)}
                  sx={{
                    height: '100%',
                    padding: 4,
                    textAlign: 'center',
                  }}
                >
                  <Box sx={{ mb: 2 }}>{category.icon}</Box>
                  <Typography variant="h6" component="div" sx={{ fontWeight: 500 }}>
                    {category.label}
                  </Typography>
                </CardActionArea>
              </Card>
            </Grid>
          ))}
        </Grid>
      </DialogContent>
    </Dialog>
  );
}

export default HostCategModal;
