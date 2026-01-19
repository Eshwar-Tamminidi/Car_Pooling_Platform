// src/App.jsx
import React, { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Navbar from "./layout/Navbar.jsx";
import Footer from "./layout/Footer.jsx";
import Home from "./pages/Home.jsx";
import Rides from "./pages/Rides.jsx";
import HostRide from "./pages/HostRide.jsx";
import BookRide from "./pages/BookRide.jsx";
import AdminDashboard from "./pages/admin/AdminDashboard.jsx";
import Login from "./pages/auth/Login.jsx";
import Register from "./pages/auth/Register.jsx";
import ResetPassword from "./pages/auth/ResetPassword.jsx";
import DriverTransactions from "./pages/driver/DriverTransactions.jsx";
import ProfileSettings from "./pages/profile/ProfileSettings.jsx";
import VehicleSettings from "./pages/profile/VehicleSettings.jsx";
import History from "./pages/profile/History.jsx";
import Transactions from "./pages/profile/Transactions.jsx";


export default function App() {
    const [currentUser, setCurrentUser] = useState(null);

    useEffect(() => {
        const u = localStorage.getItem("user");
        if (u) {
            try { setCurrentUser(JSON.parse(u)); }
            catch (err) { localStorage.removeItem("user"); }
        }
    }, []);

    const PrivateRoute = ({ element }) => currentUser ? element : <Navigate to="/login" replace />;
    
    // Updated AdminRoute to include ASSISTANT
    const AdminRoute = ({ element }) => {
        if (!currentUser) return <Navigate to="/" replace />;
        const role = currentUser.role ? currentUser.role.toUpperCase() : "";
        if (role.includes("ADMIN") || role === "MANAGER" || role === "ASSISTANT") {
            return element;
        }
        return <Navigate to="/" replace />;
    };

    return (
        <BrowserRouter>
            <div className="flex flex-col min-h-screen">
                <Navbar user={currentUser} setUser={setCurrentUser} />
                <div className="flex-grow">
                    <Routes>
                        <Route path="/" element={<Home user={currentUser} />} />
                        <Route path="/rides/hosted" element={<Rides user={currentUser} type="hosted" />} />
                        <Route path="/rides/travelled" element={<Rides user={currentUser} type="travelled" />} />
                        <Route path="/rides/requested" element={<Rides user={currentUser} type="requested" />} />
                        <Route path="/host" element={<PrivateRoute element={<HostRide user={currentUser} />} />} />
                        <Route path="/book" element={<PrivateRoute element={<BookRide user={currentUser} />} />} />
                        <Route path="/admin" element={<AdminRoute element={<AdminDashboard user={currentUser} />} />} />
                        <Route path="/login" element={<Login setUser={setCurrentUser} />} />
                        <Route path="/register" element={<Register setUser={setCurrentUser} />} />
                        <Route path="/reset-password" element={<ResetPassword />} />
                        <Route path="*" element={<Navigate to="/" replace />} />
                        <Route
  path="/driver/transactions"
  element={<PrivateRoute element={<DriverTransactions user={currentUser} />} />}
/>
                        <Route path="/profile" element={<PrivateRoute element={<ProfileSettings user={currentUser} setUser={setCurrentUser} />} />} />
                        <Route path="/vehicles" element={<PrivateRoute element={<VehicleSettings user={currentUser} />} />} />
                        <Route path="/history" element={<PrivateRoute element={<History user={currentUser} />} />} />
                        <Route path="/transactions" element={<PrivateRoute element={<Transactions user={currentUser} />} />} />

                    </Routes>
                </div>
                <Footer />
            </div>
        </BrowserRouter>
    );
}

// Global DOM observer to lock scrolling when modal overlays are present.
// We attach a MutationObserver once so any component rendering elements with
// class "modal-overlay" will cause body scroll to be disabled.
if (typeof window !== 'undefined') {
    const applyBodyLock = () => {
        try {
            const hasOverlay = document.querySelector('.modal-overlay') !== null;
            if (hasOverlay) {
                const scrollBarWidth = window.innerWidth - document.documentElement.clientWidth;
                if (scrollBarWidth > 0) document.body.style.paddingRight = `${scrollBarWidth}px`;
                document.body.style.overflow = 'hidden';
            } else {
                document.body.style.overflow = '';
                document.body.style.paddingRight = '';
            }
        } catch (e) { /* ignore */ }
    };

    const mo = new MutationObserver(() => applyBodyLock());
    mo.observe(document.body, { childList: true, subtree: true });
    // Initial check
    applyBodyLock();
}