// src/pages/auth/Login.jsx 
import React, { useState } from "react";
import "./Auth.css";
import { Link, useNavigate } from "react-router-dom";
import { apiPost } from "../../api/api";
import { Car, X, Check } from "lucide-react";

export default function Login({ setUser }) {
    const navigate = useNavigate();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    
    // Popup States
    const [popup, setPopup] = useState({ show: false, type: '', msg: '' }); 
    const [showForgot, setShowForgot] = useState(false);

    // Forgot Password Logic States
    const [forgotEmail, setForgotEmail] = useState("");
    const [forgotLoading, setForgotLoading] = useState(false);
    const [forgotMsg, setForgotMsg] = useState(null);
    
    async function handleLogin(e) {
        e.preventDefault();
        setLoading(true);
        try {
            const data = await apiPost("/api/auth/login", { email, password });
            
            // Success Logic
            setPopup({ show: true, type: 'success', msg: 'Login Successful!' });
            
            setTimeout(() => {
                localStorage.setItem("token", data.token);
                localStorage.setItem("user", JSON.stringify(data));
                setUser(data);
                
                // --- ROLE BASED REDIRECT ---
                const role = data.role ? data.role.toUpperCase() : "USER";
                if (role.includes("ADMIN") || role === "MANAGER" || role === "ASSISTANT") {
                    navigate("/admin");
                } else {
                    navigate("/"); 
                }
            }, 2000); 

        } catch (err) {
            setPopup({ show: true, type: 'error', msg: err.message || 'Invalid Credentials.' });
            setLoading(false);
        }
    }

    async function handleForgotPassword() {
        const cleanEmail = forgotEmail.trim();

        if (!cleanEmail) {
            setForgotMsg({ type: 'error', text: 'Please enter your email address.' });
            return;
        }

        setForgotLoading(true);
        setForgotMsg(null);

        try {
            await apiPost("/api/auth/forgot-password", { email: cleanEmail });
            setForgotMsg({ type: 'success', text: 'Reset link sent! Valid for 20 mins.' });
        } catch (err) {
            if (err.status === 404) {
                setForgotMsg({ type: 'error', text: 'User not found. Please check email or Sign Up.' });
            } else {
                setForgotMsg({ type: 'error', text: 'Failed to send email. Try again later.' });
            }
        } finally {
            setForgotLoading(false);
        }
    }

    return (
        <div className="auth-container">
            {/* Added CSS for Hover Effects */}
            <style>{`
                .auth-card {
                    transition: transform 0.3s ease, box-shadow 0.3s ease, border-color 0.3s ease;
                }
                .auth-card:hover {
                    transform: translateY(-5px);
                    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.7);
                    border-color: rgba(59, 130, 246, 0.5);
                }
                .login-input {
                    transition: all 0.2s ease;
                }
                .login-input:hover, .login-input:focus {
                    border-color: #3b82f6;
                    box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.1);
                    background: var(--input-bg);
                }
                .login-btn {
                    transition: all 0.2s ease;
                }
                .login-btn:hover {
                    transform: scale(1.02);
                    box-shadow: 0 0 20px rgba(37, 99, 235, 0.5);
                    filter: brightness(1.1);
                }
                .forgot-btn:hover {
                    color: #60a5fa !important;
                    text-decoration: underline;
                }
            `}</style>

            <div className="auth-card">
                <div style={{textAlign:'center', marginBottom:24}}>
                    <Car size={40} className="text-blue-500 mx-auto mb-2"/>
                    <h2 className="text-2xl font-bold">Welcome Back</h2>
                    <p className="text-gray-900">Login to continue</p>
                </div>

                <form onSubmit={handleLogin}>
                    <label className="text-gray-900">Email Address</label>
                    <input 
                    
                        className="login-input"
                        type="email" 
                        value={email} 
                        onChange={e => setEmail(e.target.value)} 
                        required 
                        placeholder="name@example.com" 
                    />
                    
                    <label className="text-gray-900">Password</label>
                    <input 
                        className="login-input"
                        type="password" 
                        value={password} 
                        onChange={e => setPassword(e.target.value)} 
                        required 
                        placeholder="••••••••" 
                    />
                    
                    <div style={{ textAlign: 'right', marginTop: '8px' }}>
                        <button 
                            type="button"
                            onClick={() => setShowForgot(true)}
                            className="forgot-btn"
                            style={{ 
                                background: 'transparent', 
                                border: 'none', 
                                color: '#3b82f6', 
                                cursor: 'pointer', 
                                fontSize: '13px', 
                                fontWeight: '600',
                                transition: 'color 0.2s'
                            }}
                        >
                            Forgot Password?
                        </button>
                    </div>
                    
                    <button 
                        className="btn login-btn"
                        style={{
                            background: 'linear-gradient(135deg, #2563eb 0%, #3a88edff 100%)',
                            width: '100%', padding: '14px', borderRadius: '50px', marginTop: '24px',
                            color: 'white', fontWeight: 'bold', border: 'none', cursor: 'pointer', fontSize: '16px'
                        }}
                        disabled={loading}
                    >
                        {loading ? "Verifying..." : "Sign In"}
                    </button>
                </form>

                <div style={{marginTop:24, textAlign:'center', fontSize:14, color:'#94a3b8'}}>
                    Don't have an account? <Link to="/register" style={{color:'#3b82f6', fontWeight:'bold', textDecoration:'none', marginLeft:'4px'}}>Sign Up</Link>
                </div>
            </div>

            {/* --- CUSTOM POPUPS --- */}
            {popup.show && (
                <div className="modal-overlay">
                    <div className="popup-box">
                        {popup.type === 'success' ? (
                            <>
                                <div className="tick-circle"><Check size={40} color="white" strokeWidth={4}/></div>
                                <h3 className="popup-title text-green-600">Success!</h3>
                                <p className="popup-msg">{popup.msg}</p>
                                <p className="text-xs" style={{ color: 'var(--text-muted)', marginTop: '8px' }}>Redirecting...</p>
                            </>
                        ) : (
                            <>
                                <div className="cross-circle"><X size={40} color="white" strokeWidth={4}/></div>
                                <h3 className="popup-title text-red-600">Login Failed</h3>
                                <p className="popup-msg">{popup.msg}</p>
                                <div className="flex gap-4 mt-4">
                                    <button onClick={() => setPopup({ ...popup, show: false })} className="btn btn-primary flex-1">Retry</button>
                                    <button onClick={() => { setPopup({ ...popup, show: false }); setShowForgot(true); }} className="btn btn-secondary flex-1 bg-gray-200 text-gray-800 hover:bg-gray-300">Forgot Password?</button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}

            {/* Forgot Password Modal */}
            {showForgot && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <div className="modal-header">
                            <h3 className="text-xl font-bold" style={{ color: 'var(--text)' }}>Reset Password</h3>
                            <button onClick={() => { setShowForgot(false); setForgotMsg(null); setForgotEmail(""); }} style={{ color: 'var(--text-muted)', cursor: 'pointer' }} className="hover:text-white"><X size={20}/></button>
                        </div>
                        
                        <p className="mb-4 text-sm" style={{ color: 'var(--text-muted)' }}>Enter your registered email address to receive a password reset link.</p>
                        
                        <input 
                            placeholder="name@example.com" 
                            className="mb-4 w-full"
                            value={forgotEmail}
                            onChange={(e) => setForgotEmail(e.target.value)}
                        />

                        {/* Status Message */}
                        {forgotMsg && (
                            <div className={`mb-4 p-3 rounded-lg text-sm font-bold border ${forgotMsg.type === 'success' ? 'bg-green-500/20 text-green-400 border-green-500/50' : 'bg-red-500/20 text-red-400 border-red-500/50'}`}>
                                {forgotMsg.text}
                            </div>
                        )}

                        <button 
                            onClick={handleForgotPassword} 
                            className="btn btn-primary w-full py-3"
                            disabled={forgotLoading}
                        >
                            {forgotLoading ? "Sending..." : "Send Reset Link"}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}