import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { collection, query, where, getDocs } from "firebase/firestore";
import { auth, database } from "../config/firebase";
import LogoutConfirmationModal from "../pages/host/components/logout-confirmation-modal";

import Avatar from "@mui/material/Avatar";
import AppBar from "@mui/material/AppBar";
import Toolbar from "@mui/material/Toolbar";
import IconButton from "@mui/material/IconButton";
import Typography from "@mui/material/Typography";
import MenuIcon from "@mui/icons-material/Menu";
import Button from "@mui/material/Button";
import Drawer from "@mui/material/Drawer";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemText from "@mui/material/ListItemText";
import ListItemIcon from "@mui/material/ListItemIcon";
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";
import Box from "@mui/material/Box";
import BottomNavigation from "@mui/material/BottomNavigation";
import BottomNavigationAction from "@mui/material/BottomNavigationAction";
import AddHomeRoundedIcon from '@mui/icons-material/AddHomeRounded';

import TodayIcon from "@mui/icons-material/Today";
import MessageIcon from "@mui/icons-material/Message";
import ListIcon from "@mui/icons-material/List";
import CalendarIcon from "@mui/icons-material/CalendarToday";
import LogoutIcon from "@mui/icons-material/Logout";
import HomeIcon from "@mui/icons-material/HomeRounded";
import FavoriteIcon from "@mui/icons-material/Favorite";
import TravelExploreIcon from "@mui/icons-material/BeachAccessRounded";
import BookIcon from "@mui/icons-material/Book";

function HostNavigation({ setActivePage }) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeTab, setActiveTab] = useState(0);
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);

  const navigate = useNavigate();
  const pages = ["today", "messages", "listings", "calendar"];
  const pageLabels = ["Today", "Messages", "Listings", "Calendar"];
  const tabIcons = [<TodayIcon />, <MessageIcon />, <ListIcon />, <CalendarIcon />];

  const handlePageClick = (index) => {
    setActiveTab(index);
    setActivePage(pages[index]);
  };

  const handleLogout = async () => {
    try {
      await auth.signOut();
      localStorage.removeItem("isHost");
      navigate("/login");
    } catch (err) {
      console.error("Logout error:", err.message);
      alert("Failed to logout. Try again.");
    }
  };

  return (
    <>
      {/* Top AppBar */}
      <AppBar position="fixed" color="primary">
        <Toolbar sx={{ justifyContent: "space-between" }}>
          <IconButton edge="start" color="inherit" onClick={() => setDrawerOpen(true)}>
            <MenuIcon />
          </IconButton>

          {/* Title */}
          <Typography variant="h6" sx={{ fontWeight: "bold" }}>
            <AddHomeRoundedIcon fontSize="medium" sx={{pt: 1, ml: 2}}/> Host Dashboard
          </Typography>

          {/* Desktop Tabs */}
          <Box sx={{ flexGrow: 1, display: { xs: "none", sm: "flex" }, justifyContent: "center" }}>
            <Tabs
              value={activeTab}
              onChange={(e, newValue) => handlePageClick(newValue)}
              textColor="inherit"
              indicatorColor="secondary"
            >
              {pageLabels.map((label, index) => (
                <Tab
                  key={label}
                  label={label}
                  icon={activeTab === index ? tabIcons[index] : null}
                  iconPosition="start"
                />
              ))}
            </Tabs>
          </Box>

          {/* Desktop Actions */}
          <Box sx={{ display: { xs: "none", sm: "flex" }, gap: 1 }}>
            <Button color="inherit" onClick={() => navigate("/home")}>
              <TravelExploreIcon sx={{mr: 1}}/>
              Switch to Travelling
            </Button>
          </Box>
        </Toolbar>
      </AppBar>

      {/* Drawer */}
      <Drawer
        anchor="left"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        PaperProps={{ sx: { width: 300, borderTopRightRadius: 20, borderBottomRightRadius: 20 } }}
      >
        {/* Host Dashboard Header */}
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, p: 2, bgcolor: "primary.main", color: "white", fontWeight: "bold", fontSize: 20 }}>
          <BookIcon /> Host Dashboard
        </Box>
        <Toolbar />

        {/* Profile */}
        <Box sx={{ p: 2, display: "flex", flexDirection: "column", alignItems: "center", gap: 1 }}>
          <Avatar src={auth.currentUser?.photoURL || "/default-profile.png"} sx={{ width: 84, height: 84 }} />
          <Typography variant="h6" sx={{ fontWeight: "bold" }}>
            {auth.currentUser?.displayName || "Host User"}
          </Typography>
          <Typography variant="body4" color="text.secondary">
            {auth.currentUser?.email || "host@example.com"}
          </Typography>
          <Button variant="outlined" size="small" sx={{ mt: 1 }} onClick={() => navigate("/profile")}>
            View Profile
          </Button>
          <Toolbar />
        </Box>

        {/* Drawer Menu */}
        <List>
          <ListItem disablePadding>
            <ListItemButton onClick={() => navigate("/home")}>
              <ListItemIcon><TravelExploreIcon /></ListItemIcon>
              <ListItemText primary="Switch to Travelling" />
            </ListItemButton>
          </ListItem>

          <ListItem disablePadding>
            <ListItemButton onClick={() => navigate("/favorites")}>
              <ListItemIcon><FavoriteIcon /></ListItemIcon>
              <ListItemText primary="Favorites" />
            </ListItemButton>
          </ListItem>

          <ListItem disablePadding>
            <ListItemButton onClick={() => setActivePage("messages")}>
              <ListItemIcon><MessageIcon /></ListItemIcon>
              <ListItemText primary="Messages" />
            </ListItemButton>
          </ListItem>
          
         <ListItem disablePadding>
          <ListItemButton
            onClick={() => {
              setIsLogoutModalOpen(true);
              setDrawerOpen(false);
            }}
          >
            <ListItemIcon>
              <LogoutIcon />
            </ListItemIcon>
            <ListItemText primary="Logout" />
          </ListItemButton>
        </ListItem>
        </List>
      </Drawer>

      {/* Bottom Navigation for Mobile */}
      <Box sx={{ display: { xs: "block", sm: "none" }, position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 10 }}>
        <BottomNavigation
          value={activeTab}
          onChange={(e, newValue) => handlePageClick(newValue)}
          showLabels
        >
          {pageLabels.map((label, index) => (
            <BottomNavigationAction key={label} label={label} icon={tabIcons[index]} />
          ))}
        </BottomNavigation>
      </Box>

      {/* Logout Modal */}
      <LogoutConfirmationModal
        isOpen={isLogoutModalOpen}
        onClose={() => setIsLogoutModalOpen(false)}
        onLogout={handleLogout}
      />
    </>
  );
}

export default HostNavigation;