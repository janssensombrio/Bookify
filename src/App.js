import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { AuthPage } from "./pages/guest/auth-page.jsx";
import { Explore } from "./pages/guest/explore.jsx";
import { HostSetUp } from "./pages/host/host-set-up.jsx";
import { HostSetUpExperiences } from "./pages/host/host-set-up-2.jsx";
import { HostSetUpServices } from "./pages/host/host-set-up-3.jsx";
import HostPage from "./pages/host/host-page.jsx";
import MessagesPage from "./components/messaging-page.jsx";
import BookingsPage from "./pages/guest/bookings.jsx";
import GuestMessagesPage from "./pages/guest/messages.jsx";
import FavoritesPage from "./pages/guest/favorites.jsx";
import { VerifyPage }  from "./pages/guest/verify.jsx";
import Dashboard from "./pages/guest/dashboard.jsx";
import { SidebarProvider } from "./context/SidebarContext";
import ProfilePage from "./pages/guest/profile.jsx";
import WalletPage from "./pages/guest/wallet-page.jsx";

// ⬇️ Import the new page
import HomeDetailsPage from "./pages/host/HomeDetailsPage";
import ExperienceDetailsPage from "./pages/host/ExperienceDetailsPage";
import ServiceDetailsPage from "./pages/host/ServiceDetailsPage";
import AdminDashboard from "./pages/admin/AdminDashboard.jsx";
import AdminHostsPage from "./pages/admin/hosts.jsx";
import AdminListingsPage from "./pages/admin/listings.jsx";

function App() {
  return (
    <Router>
      <SidebarProvider>
          <Routes>
            <Route path="/" element={<AuthPage />} />
            <Route path="/verify" element={<VerifyPage />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/explore" element={<Explore />} />
            <Route path="/favorites" element={<FavoritesPage />} />
            <Route path="/host-set-up" element={<HostSetUp />} />
            <Route path="/host-set-up-2" element={<HostSetUpExperiences />} />
            <Route path="/host-set-up-3" element={<HostSetUpServices />} />
            <Route path="/hostpage" element={<HostPage />} />
            <Route path="/messages" element={<MessagesPage />} />
            <Route path="/bookings" element={<BookingsPage />} />
            <Route path="/guest-messages" element={<GuestMessagesPage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/wallet" element={<WalletPage />} />

            {/* ⬇️ New route for the full-page details */}
            <Route path="/homes/:listingId" element={<HomeDetailsPage />} />
            <Route path="/experiences/:listingId" element={<ExperienceDetailsPage />} />
            <Route path="/services/:listingId" element={<ServiceDetailsPage />} />

            {/* Admin */}
            <Route path="/admin-dashboard" element={<AdminDashboard />} />
            <Route path="/admin/hosts" element={<AdminHostsPage />} />
            <Route path="/admin/guests" element={<div />} />
            <Route path="/admin/listings" element={<AdminListingsPage />} />
            <Route path="/admin/bookings" element={<div />} />
            <Route path="/admin/wallet" element={<div />} />
            <Route path="/admin/users" element={<div />} />
          </Routes>
      </SidebarProvider>
    </Router>
  );
}

export default App;
