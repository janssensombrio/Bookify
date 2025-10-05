import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { Login } from './pages/guest/login.jsx';
import { Signup } from './pages/guest/signup.jsx';
import { Home } from './pages/guest/home.jsx';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Login />} />        {/* default page */}
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/home" element={<Home />} />     {/* after login/signup */}
      </Routes>
    </Router>
  );
}

export default App;
