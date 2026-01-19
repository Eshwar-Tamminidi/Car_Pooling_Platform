import React, { useState } from "react";
import "./Auth.css";
import { Link, useNavigate } from "react-router-dom";
import { UserPlus, HelpCircle } from "lucide-react";

export default function Register({ setUser }) {
    const navigate = useNavigate();
    const [formData, setFormData] = useState({
        fullname: "", email: "", phone: "", password: "", role: "USER", gender: "Male"
    });
    const [loading, setLoading] = useState(false);
    const [showPendingModal, setShowPendingModal] = useState(false);

    async function handleRegister(e) {
        e.preventDefault();
        setLoading(true);
        try {
            const res = await fetch("http://localhost:8080/api/auth/register", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(formData)
            });
            const text = await res.text();
            if (!res.ok) throw new Error(text);

            if (res.status === 202 || formData.role === "ADMIN") {
                // Show Custom Pending Modal instead of alert
                setShowPendingModal(true);
            } else {
                const data = JSON.parse(text);
                localStorage.setItem("token", data.token);
                localStorage.setItem("user", JSON.stringify(data));
                setUser(data);
                // Navigate to home and request that home show the created modal
                navigate('/', { state: { showCreatedModal: true } });
            }
        } catch (err) {
            alert(err.message || "Registration failed");
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="auth-container">
            {/* Hover Effects & Styles */}
            <style>{`
                .auth-card {
                    transition: transform 0.3s ease, box-shadow 0.3s ease, border-color 0.3s ease;
                }
                .auth-card:hover {
                    transform: translateY(-5px);
                    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.7);
                    border-color: rgba(59, 130, 246, 0.5);
                }
                input, select {
                    transition: all 0.2s ease;
                }
                input:hover, input:focus, select:hover, select:focus {
                    border-color: #3b82f6;
                    box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.1);
                    background: var(--input-bg);
                }
                .btn-register {
                    transition: all 0.2s ease;
                }
                .btn-register:hover {
                    transform: scale(1.02);
                    box-shadow: 0 0 20px rgba(37, 99, 235, 0.5);
                    filter: brightness(1.1);
                }
            `}</style>

            <div className="auth-card">
                <div style={{ textAlign: "center", marginBottom: 24 }}>
                    <UserPlus
                        size={40}
                        className="text-blue-500 mx-auto mb-2"
                        color="#3b82f6"
                    />
                    <h2 className="text-2xl font-bold" style={{ margin: 0 }}>
                        Create Account
                    </h2>
                    <p style={{ color: "#94a3b8", marginTop: 5 }}>
                        Join VeloCity today
                    </p>
                </div>

                <form onSubmit={handleRegister}>
                    <label>Full Name</label>
                    <input
                        value={formData.fullname}
                        onChange={(e) =>
                            setFormData({ ...formData, fullname: e.target.value })
                        }
                        required
                        placeholder="John Doe"
                    />

                    <label>Email</label>
                    <input
                        type="email"
                        value={formData.email}
                        onChange={(e) =>
                            setFormData({ ...formData, email: e.target.value })
                        }
                        required
                        placeholder="name@example.com"
                    />

                    <label>Phone</label>
                    <input
                        value={formData.phone}
                        onChange={(e) =>
                            setFormData({ ...formData, phone: e.target.value })
                        }
                        placeholder="+1 234 567 890"
                    />

                    <label>Gender</label>
                    <div style={{ display: "flex", gap: 20, marginBottom: 16 }}>
                        <label
                            style={{
                                display: "flex",
                                alignItems: "center",
                                cursor: "pointer",
                                color: "var(--text)",
                            }}
                        >
                            <input
                                type="radio"
                                name="gender"
                                value="Male"
                                checked={formData.gender === "Male"}
                                onChange={(e) =>
                                    setFormData({ ...formData, gender: e.target.value })
                                }
                                style={{ width: "auto", marginRight: 8 }}
                            />
                            Male
                        </label>
                        <label
                            style={{
                                display: "flex",
                                alignItems: "center",
                                cursor: "pointer",
                                color: "var(--text)",
                            }}
                        >
                            <input
                                type="radio"
                                name="gender"
                                value="Female"
                                checked={formData.gender === "Female"}
                                onChange={(e) =>
                                    setFormData({ ...formData, gender: e.target.value })
                                }
                                style={{ width: "auto", marginRight: 8 }}
                            />
                            Female
                        </label>
                        <label
                            style={{
                                display: "flex",
                                alignItems: "center",
                                cursor: "pointer",
                                color: "var(--text)",
                            }}
                        >
                            <input
                                type="radio"
                                name="gender"
                                value="Other"
                                checked={formData.gender === "Other"}
                                onChange={(e) =>
                                    setFormData({ ...formData, gender: e.target.value })
                                }
                                style={{ width: "auto", marginRight: 8 }}
                            />
                            Other
                        </label>
                    </div>

                    <label>Password</label>
                    <input
                        type="password"
                        value={formData.password}
                        onChange={(e) =>
                            setFormData({ ...formData, password: e.target.value })
                        }
                        required
                        placeholder="••••••••"
                    />

                    <label>Role</label>
                    <select
                        value={formData.role}
                        onChange={(e) =>
                            setFormData({ ...formData, role: e.target.value })
                        }
                    >
                        <option value="USER">Traveller / Driver</option>
                        <option value="ADMIN">
                            Administrator (Requires Approval)
                        </option>
                    </select>

                    <button
                        className="btn btn-primary btn-register"
                        style={{ marginTop: 20 }}
                        disabled={loading}
                    >
                        {loading ? "Creating..." : "Create Account"}
                    </button>
                </form>

                <div
                    style={{
                        marginTop: 24,
                        textAlign: "center",
                        fontSize: 14,
                        color: "#94a3b8",
                    }}
                >
                    Already have an account?
                    <Link
                        to="/login"
                        style={{
                            color: "#3b82f6",
                            fontWeight: "bold",
                            textDecoration: "none",
                            marginLeft: 4,
                        }}
                    >
                        Log In
                    </Link>
                </div>
            </div>



            {/* Warning / Pending Approval Modal */}
            {showPendingModal && (
                <div className="modal-overlay">
                    <div className="popup-box">
                        <div
                            style={{
                                width: 70,
                                height: 70,
                                borderRadius: "50%",
                                background: "#fef3c7",
                                display: "flex",
                                justifyContent: "center",
                                alignItems: "center",
                                margin: "0 auto 15px",
                            }}
                        >
                            <HelpCircle size={40} color="#d97706" strokeWidth={3} />
                        </div>
                        <h3 className="popup-title" style={{ color: "#d97706" }}>
                            Approval Pending
                        </h3>
                        <p className="popup-msg">
                            Registration successful! Your account is waiting for Manager
                            approval.
                        </p>
                        <button
                            onClick={() => navigate("/login")}
                            className="btn btn-primary"
                            style={{ width: "100%", backgroundColor: "#d97706" }}
                        >
                            Go to Login
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
