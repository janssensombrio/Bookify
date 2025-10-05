import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { Login } from './pages/guest/login.jsx';
import { Signup } from './pages/guest/signup.jsx';
import { Home } from './pages/guest/home.jsx';
import { HostSetUp } from './pages/host/host-set-up.jsx'; // <-- import

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/home" element={<Home />} />
        <Route path="/host-setup" element={<HostSetUp />} /> {/* new page */}
      </Routes>
    </Router>
  );
}

export default App;