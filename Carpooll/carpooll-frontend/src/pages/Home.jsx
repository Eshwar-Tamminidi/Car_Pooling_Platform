// src/pages/Home.jsx
import React, { useEffect, useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { ShieldCheck, Calendar, Users, ArrowRight, MapPin, Clock, Car } from "lucide-react";

const API_BASE = "http://localhost:8080";

const apiGet = async (path) => {
  const token = localStorage.getItem("token");
  const res = await fetch(`${API_BASE}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {}
  });
  if (!res.ok) throw new Error("Failed to load rides");
  return res.json();
};

export default function Home({ user }) {
  const navigate = useNavigate();
  const location = useLocation();

  const [latestRides, setLatestRides] = useState([]);
  const [loadingRides, setLoadingRides] = useState(false);
  const [showCreatedModal, setShowCreatedModal] = useState(false);

  // --- dynamic hero stats ---
  const [ridesCompleted, setRidesCompleted] = useState(null);
  const [trustedDrivers, setTrustedDrivers] = useState(null);
  const [activeRiders, setActiveRiders] = useState(null);
  const [loadingStats, setLoadingStats] = useState(false);

  useEffect(() => {
    if (user) loadLatestRides();
  }, [user]);

  // Show created modal when navigated from register
  useEffect(() => {
    if (location && location.state && location.state.showCreatedModal) {
      setShowCreatedModal(true);
      // Clear history state so modal does not re-appear on back/refresh
      window.history.replaceState({}, document.title, location.pathname);
    }
  }, [location]);

  async function loadLatestRides() {
    setLoadingRides(true);
    try {
      // Fetch all rides (global) - select latest hosted upcoming rides (createdAt preferred)
      const all = await apiGet("/api/rides");
      const getRideEnd = (r) => (r && (r.estimatedCompletionDateTime || r.dateTime));

      // Helper to choose sort key: prefer createdAt, then id, then dateTime
      const getSortKey = (r) => {
        if (!r) return 0;
        if (r.createdAt) return new Date(r.createdAt).getTime() || 0;
        if (r.id !== undefined && r.id !== null) return Number(r.id) || 0;
        if (r.dateTime) return new Date(r.dateTime).getTime() || 0;
        return 0;
      };

      const upcoming = all
        .filter(r => getRideEnd(r) && new Date(getRideEnd(r)) > new Date())
        .sort((a, b) => getSortKey(b) - getSortKey(a)) // Sort by most recently hosted first
        .slice(0, 3); // Get latest 3 hosted upcoming rides

      setLatestRides(upcoming);

      // Also compute / fetch hero stats based on rides and other available endpoints
      loadStats(all);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingRides(false);
    }
  }

  // Compute dynamic hero stats (best-effort; falls back to static values on error)
  async function loadStats(allRides) {
    setLoadingStats(true);
    try {
      const all = allRides || (await apiGet('/api/rides')) || [];
      const now = new Date();

      // Rides completed (global)
      const getRideEnd = (r) => (r && (r.estimatedCompletionDateTime || r.dateTime));
      const completed = all.filter(r => getRideEnd(r) && new Date(getRideEnd(r)) < now).length;
      setRidesCompleted(completed);

      // Trusted drivers: best-effort rule — consider a driver trusted if they have hosted more than 3 rides
      const ownerCounts = all.reduce((m, r) => {
        if (r && r.ownerId) m[r.ownerId] = (m[r.ownerId] || 0) + 1;
        return m;
      }, {});
      const trustedCount = Object.values(ownerCounts).filter(c => c > 3).length;
      setTrustedDrivers(trustedCount);

      // Active riders: best-effort count of unique requester emails from visible bookings
      // Try host bookings and public bookings endpoints; fall back to 0 on failure
      const seen = new Set();
      try {
        const hostBookings = await apiGet('/api/bookings/for-host').catch(() => []);
        (hostBookings || []).forEach(b => b.requesterEmail && seen.add((b.requesterEmail || '').toLowerCase()));
      } catch (e) { /* ignore */ }
      try {
        const myBookings = await apiGet('/api/bookings/my').catch(() => []);
        (myBookings || []).forEach(b => b.requesterEmail && seen.add((b.requesterEmail || '').toLowerCase()));
      } catch (e) { /* ignore */ }
      setActiveRiders(seen.size);

      // If all counts failed to load, leave them null to show graceful fallback
    } catch (e) {
      console.error('Failed to compute home stats', e);
    } finally {
      setLoadingStats(false);
    }
  }

  // Logged out state - Better UI
  if (!user) {
    return (
      <div style={{
        minHeight: "calc(100vh - 70px)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "40px 24px",
        textAlign: "center",
      background: "var(--hero-bg)"
      }}>
        <div style={{
          maxWidth: "800px",
          animation: "slideUp 0.6s ease-out"
        }}>
          {/* Logo/Brand */}
          <div style={{ marginBottom: "40px" }}>
            <h1 style={{
              fontSize: "4.5rem",
              fontWeight: "900",
              marginBottom: "20px",
              background: "linear-gradient(135deg, #ffffff 0%, #3b82f6 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text"
            }}>
              Velo<span style={{ color: "#3b82f6" }}>City</span>
            </h1>
          </div>

          {/* Slogan */}
          <h2 style={{
            fontSize: "2.5rem",
            fontWeight: "700",
            color: "var(--hero-title)",
            marginBottom: "24px",
            lineHeight: "1.2"
          }}>
            Your Journey Starts Here
          </h2>
          
          <p style={{
            fontSize: "1.25rem",
            color: "var(--hero-muted)",
            marginBottom: "50px",
            lineHeight: "1.6",
            maxWidth: "600px",
            margin: "0 auto 50px"
          }}>
            Connect with fellow travelers. Share rides, save money, and make every journey memorable. 
            Join thousands of riders and drivers building a sustainable transportation community.
          </p>

          {/* CTA Buttons */}
          <div style={{
            display: "flex",
            gap: "20px",
            justifyContent: "center",
            flexWrap: "wrap",
            marginBottom: "60px"
          }}>
            <Link 
              to="/register" 
              className="btn btn-primary"
              style={{
                padding: "16px 40px",
                fontSize: "18px",
                fontWeight: "600",
                borderRadius: "12px",
                textDecoration: "none",
                display: "inline-flex",
                alignItems: "center",
                gap: "8px"
              }}
            >
              Get Started
            </Link>
            <Link
  to="/login"
  className="btn btn-secondary"
  style={{
    padding: "16px 40px",
    fontSize: "18px",
    fontWeight: "600",
    borderRadius: "12px",
    textDecoration: "none",
    display: "inline-flex",
    alignItems: "center",
    gap: "8px"
  }}
>
  Sign In
</Link>

          </div>

          {/* Features */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: "30px",
            maxWidth: "700px",
            margin: "0 auto"
          }}>
            <div style={{
              padding: "24px",
              background: "var(--card-bg)",
              borderRadius: "16px",
              border: "1px solid var(--border)"
            }}>
              <Car size={32} color="#3b82f6" style={{ marginBottom: "12px" }} />
              <h3 style={{ color: "var(--text)", marginBottom: "8px", fontSize: "18px" }}>Safe Rides</h3>
              <p style={{ color: "var(--text-muted)", fontSize: "14px" }}>Verified drivers and secure payments</p>
            </div>
            <div style={{
              padding: "24px",
              background: "var(--card-bg)",
              borderRadius: "16px",
              border: "1px solid var(--border)"
            }}>
              <Users size={32} color="#3b82f6" style={{ marginBottom: "12px" }} />
              <h3 style={{ color: "var(--text)", marginBottom: "8px", fontSize: "18px" }}>Save Money</h3>
              <p style={{ color: "var(--text-muted)", fontSize: "14px" }}>Share costs and travel affordably</p>
            </div>
            <div style={{
              padding: "24px",
              background: "var(--card-bg)",
              borderRadius: "16px",
              border: "1px solid var(--border)"
            }}>
              <MapPin size={32} color="#3b82f6" style={{ marginBottom: "12px" }} />
              <h3 style={{ color: "var(--text)", marginBottom: "8px", fontSize: "18px" }}>Easy Booking</h3>
              <p style={{ color: "var(--text-muted)", fontSize: "14px" }}>Quick search and instant booking</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (user.role?.includes("Admin")) {
    return (
      <div className="container text-center" style={{ marginTop: 120 }}>
        <ShieldCheck size={60} />
        <button className="btn btn-primary" onClick={() => navigate("/admin")}>
          Enter Dashboard
        </button>
      </div>
    );
  }

  return (
    <>
      {/* Created modal (only shown here if navigated with state) */}
      {showCreatedModal && (
        <div className="modal-overlay">
          <div className="card" style={{ maxWidth: 420, padding: 28, textAlign: 'center', borderRadius: 12, background: '#111827', color: 'white' }}>
            <div style={{ width: 70, height: 70, borderRadius: '50%', background: '#10b981', display: 'flex', justifyContent: 'center', alignItems: 'center', margin: '0 auto 18px' }}>
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M20 6L9 17L4 12" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <h3 style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>Account Created Successfully 🎉</h3>
            <p style={{ color: 'var(--text-muted)', marginTop: 8 }}>Welcome to VeloCity. Your journey starts now.</p>
            <button onClick={() => setShowCreatedModal(false)} className="btn btn-primary" style={{ marginTop: 18, width: '100%', padding: '12px 18px' }}>Go to Home Now</button>
          </div>
        </div>
      )}

      {/* ================= HERO ================= */}
      <div className="home-hero">
        <div className="hero-left">
          <h1>
            Your Journey <br />
            <span>Starts Here</span>
          </h1>

          <p>
            Easy Ride brings riders and drivers together for safe, affordable,
            and convenient transportation.
          </p>

          <div className="hero-actions">
            <button className="btn btn-primary" onClick={() => navigate("/book")}>
              Find Ride →
            </button>
            <button className="btn btn-secondary" onClick={() => navigate("/host")}>
              Become Driver →
            </button>
          </div>

          <div className="hero-stats">
            <div>
              <strong>{loadingStats ? '…' : (activeRiders === null ? '10+' : (activeRiders >= 100 ? `${activeRiders}+` : activeRiders))}</strong>
              <span>Active Riders</span>
            </div>
            <div>
              <strong>{loadingStats ? '…' : (trustedDrivers === null ? '2+' : (trustedDrivers >= 100 ? `${trustedDrivers}+` : trustedDrivers))}</strong>
              <span>Trusted Drivers</span>
            </div>
            <div>
              <strong>{loadingStats ? '…' : (ridesCompleted === null ? '5+' : (ridesCompleted >= 100 ? `${ridesCompleted}+` : ridesCompleted))}</strong>
              <span>Rides Completed</span>
            </div>
          </div>
        </div>

        <div className="hero-card card">
          <h3>Book Your Ride</h3>

          <label>From</label>
          <input placeholder="Pickup location" />

          <label>To</label>
          <input placeholder="Dropoff location" />

          <div className="hero-row">
            <div>
              <label>Date</label>
              <input type="date" />
            </div>
            <div>
              <label>Time</label>
              <input type="time" />
            </div>
          </div>

          <button className="btn btn-primary hero-search" onClick={() => navigate("/book")}>
            Search Rides
          </button>
        </div>
      </div>

      {/* ================= LATEST RIDES ================= */}
<section className="container" style={{ marginTop: 60, marginBottom: 60 }}>
  <div style={{ textAlign: "center", marginBottom: 40 }}>
    <h2 style={{ 
      fontSize: "2rem", 
      fontWeight: "800", 
      color: "var(--text-primary)", 
      marginBottom: "8px" 
    }}>
      Latest Available Rides
    </h2>
    <p style={{ fontSize: "1rem", color: "var(--hero-muted)" }}>
      Book a seat before it's gone
    </p>
  </div>

  {loadingRides ? (
    <div className="text-center" style={{ color: "var(--hero-muted)", padding: "40px" }}>
      <div style={{ fontSize: "16px" }}>Loading rides...</div>
    </div>
  ) : latestRides.length === 0 ? (
    <div className="text-center" style={{ color: "var(--hero-muted)", padding: "40px" }}>
      <div style={{ fontSize: "16px" }}>No rides available at the moment</div>
    </div>
  ) : (
    <div style={{
      background: "var(--card-bg)",
      borderRadius: "20px",
      border: "1px solid var(--border)",
      overflow: "hidden",
      maxWidth: "1000px",
      margin: "0 auto"
    }}>
      <div style={{ overflowX: "auto" }}>
        <table style={{
          width: "100%",
          borderCollapse: "collapse"
        }}>
          <thead>
            <tr style={{
              background: "var(--bg-secondary)",
              borderBottom: "2px solid var(--border)"
            }}>
              <th style={{
                padding: "16px 20px",
                textAlign: "left",
                fontSize: "12px",
                fontWeight: "700",
                color: "var(--text-muted)",
                textTransform: "uppercase",
                letterSpacing: "0.5px"
              }}>Route</th>
              <th style={{
                padding: "16px 20px",
                textAlign: "left",
                fontSize: "12px",
                fontWeight: "700",
                color: "var(--text-muted)",
                textTransform: "uppercase",
                letterSpacing: "0.5px"
              }}>Driver</th>
              <th style={{
                padding: "16px 20px",
                textAlign: "left",
                fontSize: "12px",
                fontWeight: "700",
                color: "var(--text-muted)",
                textTransform: "uppercase",
                letterSpacing: "0.5px"
              }}>Date & Time</th>
              <th style={{
                padding: "16px 20px",
                textAlign: "center",
                fontSize: "12px",
                fontWeight: "700",
                color: "var(--text-muted)",
                textTransform: "uppercase",
                letterSpacing: "0.5px"
              }}>Seats</th>
              <th style={{
                padding: "16px 20px",
                textAlign: "right",
                fontSize: "12px",
                fontWeight: "700",
                color: "var(--text-muted)",
                textTransform: "uppercase",
                letterSpacing: "0.5px"
              }}>Price</th>
              <th style={{
                padding: "16px 20px",
                textAlign: "center",
                fontSize: "12px",
                fontWeight: "700",
                color: "var(--text-muted)",
                textTransform: "uppercase",
                letterSpacing: "0.5px"
              }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {latestRides.map((ride, index) => (
              <tr
                key={ride.id}
                style={{
                  borderBottom: index < latestRides.length - 1 ? "1px solid var(--border)" : "none",
                  transition: "background 0.2s",
                  color: "var(--text)"
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "rgba(59, 130, 246, 0.05)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "transparent";
                }}
              >
                <td style={{ padding: "20px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <MapPin size={16} color="#3b82f6" />
                    <div>
                      <div style={{ 
                        fontSize: "15px", 
                        fontWeight: "700", 
                        color: "var(--text)",
                        marginBottom: "4px"
                      }}>
                        {ride.fromLocation}
                      </div>
                      <div style={{ 
                        fontSize: "13px", 
                        color: "var(--text-muted)",
                        display: "flex",
                        alignItems: "center",
                        gap: "6px"
                      }}>
                        <ArrowRight size={12} />
                        {ride.toLocation}
                      </div>
                    </div>
                  </div>
                </td>
                <td style={{ padding: "20px" }}>
                  <div style={{ 
                    fontSize: "14px", 
                    color: "var(--text)",
                    fontWeight: "600"
                  }}>
                    {ride.driverName || "Driver"}
                  </div>
                </td>
                <td style={{ padding: "20px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <Calendar size={16} color="var(--text-muted)" />
                    <div>
                      <div style={{ 
                        fontSize: "14px", 
                        color: "var(--text)",
                        fontWeight: "600",
                        marginBottom: "2px"
                      }}>
                        {new Date(ride.dateTime).toLocaleDateString('en-IN', { 
                          day: 'numeric', 
                          month: 'short',
                          year: 'numeric'
                        })}
                      </div>
                      <div style={{ 
                        fontSize: "12px", 
                        color: "var(--text-muted)"
                      }}>
                        {new Date(ride.dateTime).toLocaleTimeString('en-IN', { 
                          hour: '2-digit', 
                          minute: '2-digit' 
                        })}
                      </div>
                    </div>
                  </div>
                </td>
                <td style={{ padding: "20px", textAlign: "center" }}>
                  <div style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    padding: "6px 12px",
                    background: "rgba(16, 185, 129, 0.1)",
                    borderRadius: "8px",
                    border: "1px solid rgba(16, 185, 129, 0.2)"
                  }}>
                    <Users size={14} color="#10b981" />
                    <span style={{ 
                      fontSize: "14px", 
                      fontWeight: "700", 
                      color: "var(--success)"
                    }}>
                      {ride.seatsAvailable || 0}
                    </span>
                  </div>
                </td>
                <td style={{ padding: "20px", textAlign: "right" }}>
                  <div style={{ 
                    fontSize: "18px", 
                    fontWeight: "800", 
                    color: "var(--primary)",
                    display: "flex",
                    alignItems: "baseline",
                    justifyContent: "flex-end",
                    gap: "4px"
                  }}>
                    ₹{ride.price}
                    <span style={{ 
                      fontSize: "12px", 
                      fontWeight: "500", 
                      color: "var(--text-muted)"
                    }}>
                      /seat
                    </span>
                  </div>
                </td>
                <td style={{ padding: "20px", textAlign: "center" }}>
                  <button
                    className="btn btn-primary"
                    style={{
                      padding: "8px 16px",
                      borderRadius: "8px",
                      fontSize: "13px",
                      fontWeight: "600",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px"
                    }}
                    onClick={() => navigate("/book")}
                  >
                    View Ride
                    <ArrowRight size={14} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )}
</section>
    </>
  );
}