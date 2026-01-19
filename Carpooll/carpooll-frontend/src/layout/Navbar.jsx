// src/layout/Navbar.jsx
import React, { useState, useEffect, useRef } from "react";
import './Navbar.css';
import { Link, useNavigate, useLocation } from "react-router-dom";
import {
    LogOut,
    Home,
    List,
    MapPin,
    Calendar,
    Shield,
    X,
    DollarSign,
    User,
    Car,
    Clock,
    CreditCard,
    ChevronDown,
    Sun,
    Moon
} from "lucide-react";

import { useTheme } from "../context/ThemeContext";
import NotificationBell from "../components/NotificationBell";


export default function Navbar({ user, setUser }) {

    const { theme, toggleTheme } = useTheme();

    const navigate = useNavigate();
    const location = useLocation();
    const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
    const [showProfileMenu, setShowProfileMenu] = useState(false);
    const profileRef = useRef(null);

    useEffect(() => {
        function onDocClick(e) {
            if (profileRef.current && !profileRef.current.contains(e.target)) {
                setShowProfileMenu(false);
            }
        }
        function onKey(e) {
            if (e.key === 'Escape') setShowProfileMenu(false);
        }
        document.addEventListener('mousedown', onDocClick);
        document.addEventListener('keydown', onKey);
        return () => {
            document.removeEventListener('mousedown', onDocClick);
            document.removeEventListener('keydown', onKey);
        };
    }, []);

    function getInitials(name) {
        if (!name) return 'U';
        return name.split(' ').map(s => s[0]).slice(0,2).join('').toUpperCase();
    }

    function handleLogoutConfirm() {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        setUser(null);
        setShowLogoutConfirm(false);
        navigate("/");
    }

    const linkStyle = (path) => ({
        color: location.pathname === path ? "#3b82f6" : "var(--text)"
    });

    const isAuthPage =
        location.pathname === "/login" ||
        location.pathname === "/register";

    const isAdmin = (user && (user.role === "MANAGER" || (user.role || '').toUpperCase().includes('ADMIN')));

    return (
        <>
            <nav className="navbar">
                <div className="nav-container">

                    {/* LOGO */}
                    <Link to="/" className="logo" style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: "12px" }}>
                        <img src="/logo.png" alt="VeloCity" style={{ height: "66px", width: "66px", objectFit: "contain" }} />
                        <div style={{ display: "flex", flexDirection: "column" }}>
                            <span style={{
  fontSize: "28px",
  fontWeight: "900",
  color: "var(--text)"
}}>
  Velo<span style={{ color: "#3b82f6" }}>City</span>
</span>

                            <span style={{ fontSize: "10px", fontWeight: "600", color: "var(--text-muted)", letterSpacing: "1px" }}>
                                Carpool Platform
                            </span>
                        </div>
                    </Link>

                    <div className="nav-links">
                        {user ? (
                            <>
                                {/* USER NAV */}
                                {user.role === "USER" && (
                                    <>
                                        <Link to="/" className="nav-item" style={linkStyle("/")}>
                                            <Home size={18} /> Home
                                        </Link>
                                        <Link to="/driver/transactions" className="nav-item" style={linkStyle("/driver/transactions")}>
                                            <DollarSign size={18} /> Transactions
                                        </Link>
                                        <Link to="/rides/hosted" className="nav-item" style={linkStyle("/rides/hosted")}>
                                            <List size={18} /> Offered Rides
                                        </Link>
                                        <Link to="/rides/travelled" className="nav-item" style={linkStyle("/rides/travelled")}>
                                            <MapPin size={18} /> Ride History
                                        </Link>
                                        <Link to="/rides/requested" className="nav-item" style={linkStyle("/rides/requested")}>
                                            <Calendar size={18} /> Requested
                                        </Link>
                                    </>
                                )}

                                {/* DRIVER NAV */}
                                {user.role === "DRIVER" && (
                                    <>
                                        <Link to="/" className="nav-item" style={linkStyle("/")}>
                                            <Home size={18} /> Home
                                        </Link>
                                        <Link to="/rides/hosted" className="nav-item" style={linkStyle("/rides/hosted")}>
                                            <List size={18} /> Hosted Rides
                                        </Link>
                                        <Link to="/driver/transactions" className="nav-item" style={linkStyle("/driver/transactions")}>
                                            <DollarSign size={18} /> Earnings
                                        </Link>
                                    </>
                                )}

                                {/* ADMIN */}
                                {(user.role === "MANAGER" || user.role?.toUpperCase().includes("ADMIN")) && (
                                    <Link to="/admin" className="nav-item" style={{ color: "#10b981", fontWeight: 700 }}>
                                        <Shield size={18} /> Admin Portal
                                    </Link>
                                )}

                                {/* 🌗 THEME TOGGLE (NEW) */}
                                <button
                                    onClick={toggleTheme}
                                    title="Toggle theme"
                                    style={{
                                        background: "var(--card-bg)",
                                        border: "1px solid var(--border)",
                                        borderRadius: "50%",
                                        padding: "8px",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        cursor: "pointer"
                                    }}
                                >
                                    {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
                                </button>

                                {/* PROFILE */}
                                <div className="user-profile" ref={profileRef}>
                                    <button onClick={() => setShowProfileMenu(p => !p)} className="profile-button">
                                        {user.profilePhotoUrl
                                            ? <img src={user.profilePhotoUrl} alt="avatar" className="profile-avatar" />
                                            : <div className="profile-initials">{getInitials(user.fullname)}</div>
                                        }
                                    </button>
<NotificationBell userId={user.id} />

                                    {showProfileMenu && (
                                        <div className="profile-menu">
                                            <Link to="/profile" className="profile-menu-item" onClick={()=>setShowProfileMenu(false)}>
                                                <User size={16} /> Profile settings
                                            </Link>

                                            {!isAdmin && (
                                                <>
                                                    <Link to="/vehicles" className="profile-menu-item" onClick={()=>setShowProfileMenu(false)}>
                                                        <Car size={16} /> Vehicle settings
                                                    </Link>
                                                    <Link to="/history" className="profile-menu-item" onClick={()=>setShowProfileMenu(false)}>
                                                        <Clock size={16} /> Travel history
                                                    </Link>
                                                    <Link to="/transactions" className="profile-menu-item" onClick={()=>setShowProfileMenu(false)}>
                                                        <CreditCard size={16} /> Transactions
                                                    </Link>
                                                </>
                                            )}

                                            <div className="border-t my-1"></div>
                                            <button onClick={() => { setShowProfileMenu(false); setShowLogoutConfirm(true); }} className="profile-menu-item logout">
                                                <LogOut size={16} /> Logout
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </>
                        ) : (
                            !isAuthPage && (
                                <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                                    <Link to="/login" className="btn btn-secondary">Login</Link>
                                    <Link to="/register" className="btn btn-primary">Sign Up</Link>

                                    {/* 🌗 TOGGLE ALSO FOR GUEST */}
                                    <button
                                        onClick={toggleTheme}
                                        style={{
                                            background: "var(--card-bg)",
                                            border: "1px solid var(--border)",
                                            borderRadius: "50%",
                                            padding: "8px",
                                            cursor: "pointer"
                                        }}
                                    >
                                        {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
                                    </button>
                                </div>
                            )
                        )}
                    </div>
                </div>
            </nav>

            {/* LOGOUT CONFIRM */}
            {showLogoutConfirm && (
                <div className="modal-overlay">
                    <div className="popup-box">
                        <div className="cross-circle">
                            <X size={40} color="white" />
                        </div>
                        <h3 className="popup-title">Logout?</h3>
                        <p className="popup-msg">Are you sure you want to end your current session?</p>
                        <div className="flex gap-3 mt-6">
                            <button onClick={() => setShowLogoutConfirm(false)} className="btn btn-secondary flex-1">
                                Cancel
                            </button>
                            <button onClick={handleLogoutConfirm} className="btn btn-danger flex-1">
                                Yes, Logout
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
