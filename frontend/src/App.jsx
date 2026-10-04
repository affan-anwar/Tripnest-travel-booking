import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { useAuth } from "./AuthContext";
import Footer from "./components/Footer";
import Navbar from "./components/Navbar";
import About from "./pages/About";
import Account from "./pages/Account";
import Admin from "./pages/Admin";
import AuthPage from "./pages/AuthPage";
import Driver from "./pages/Driver";
import ForgotPassword from "./pages/ForgotPassword";
import Home from "./pages/Home";
import { Contact, Privacy, Terms } from "./pages/Legal";
import HotelDetails from "./pages/HotelDetails";
import Hotels from "./pages/Hotels";
import MyTrips from "./pages/MyTrips";
import PackageDetails from "./pages/PackageDetails";
import Track from "./pages/Track";
import Transfers from "./pages/Transfers";

// Sends visitors to the login page, or home, when they are not allowed to see a page.
function Gate({ roles, children }) {
  const { user, loading } = useAuth();
  if (loading) return <p className="center muted">Loading...</p>;
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  const { pathname } = useLocation();
  const fullWidth = ["/", "/login", "/register", "/forgot-password"].includes(pathname);
  return (
    <div className="app">
      <Navbar />
      <main className={fullWidth ? "" : "container"}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/trips/:id" element={<PackageDetails />} />
          <Route path="/hotels" element={<Hotels />} />
          <Route path="/hotels/:id" element={<HotelDetails />} />
          <Route path="/about" element={<About />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/login" element={<AuthPage mode="login" />} />
          <Route path="/register" element={<AuthPage mode="register" />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/transfers" element={<Gate roles={["customer", "admin"]}><Transfers /></Gate>} />
          <Route path="/track/:id" element={<Gate roles={["customer", "admin"]}><Track /></Gate>} />
          <Route path="/my-trips" element={<Gate roles={["customer", "admin"]}><MyTrips /></Gate>} />
          <Route path="/account" element={<Gate><Account /></Gate>} />
          <Route path="/driver" element={<Gate roles={["driver"]}><Driver /></Gate>} />
          <Route path="/admin" element={<Gate roles={["admin"]}><Admin /></Gate>} />
          <Route path="*" element={<p className="center muted">Page not found</p>} />
        </Routes>
      </main>
      <Footer />
    </div>
  );
}
