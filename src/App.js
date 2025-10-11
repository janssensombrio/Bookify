import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { Login } from './pages/guest/login.jsx';
import { Signup } from './pages/guest/signup.jsx';
import { Home } from './pages/guest/home.jsx';
import { HostSetUp } from './pages/host/host-set-up.jsx'; // <-- import
import { HostSetUpExperiences } from './pages/host/host-set-up-2.jsx';
import { HostSetUpServices } from './pages/host/host-set-up-3.jsx';
import HostPage from './pages/host/host-page.jsx';
import { MessagesPage } from './components/messaging-page.jsx';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/home" element={<Home />} />
        <Route path="/host-set-up" element={<HostSetUp />} /> {/* new page */}
        <Route path="/host-set-up-2" element={<HostSetUpExperiences />} />
        <Route path="/host-set-up-3" element={<HostSetUpServices />} />
        <Route path="/hostpage" element={<HostPage />} />
        <Route path="/messages" element={<MessagesPage />} />
      </Routes>
    </Router>
  );
}

export default App;