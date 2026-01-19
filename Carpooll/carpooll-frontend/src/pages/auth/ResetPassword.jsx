import React, { useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { apiPost } from "../../api/api";

export default function ResetPassword() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const token = searchParams.get("token"); // Get Token
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    
    async function handleReset(e) {
        e.preventDefault();
        setLoading(true);
        try {
            // Send token + new password
            await apiPost("/api/auth/reset-password", { token, password });
            alert("Password updated successfully! Please login with your new password.");
            navigate("/login");
        } catch(err) {
            alert("Failed to reset: " + err.message);
        } finally {
            setLoading(false);
        }
    }

    if (!token) {
        return <div className="text-center text-white mt-20">Invalid Reset Link.</div>;
    }

    return (
        <div className="auth-container">
            <div className="auth-card">
                <h2 className="text-2xl font-bold mb-4 text-center">Set New Password</h2>
                <p className="text-gray-400 text-center mb-6 text-sm">
                    Please enter your new password below.
                </p>
                <form onSubmit={handleReset}>
                    <label>New Password</label>
                    <input
                        type="password"
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        required
                        placeholder="Enter new password"
                    />
                    <button className="btn btn-primary" disabled={loading}>
                        {loading ? "Updating..." : "Update Password"}
                    </button>
                </form>
            </div>
        </div>
    );
}
