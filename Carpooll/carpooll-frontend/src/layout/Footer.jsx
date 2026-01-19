// src/layout/Footer.jsx
import React from 'react';
import { Link } from 'react-router-dom';
import { Twitter, Facebook, Instagram, Linkedin } from 'lucide-react';
import './Footer.css';

export default function Footer() {
    return (
        <footer className="footer">
            <div className="footer-container">
                <div className="footer-grid">
                    
                    {/* 1. Brand Section */}
                    <div className="footer-brand">
                        <Link to="/" style={{textDecoration:'none', display:'inline-flex', alignItems:'center', gap:'8px'}}>
                            {/* Updated to use the Image Logo */}
                            <img 
                                src="/logo.png" 
                                alt="VeloCity" 
                                style={{ height: '32px', width: 'auto', objectFit: 'contain' }}
                                onError={(e) => {e.target.style.display='none'}} 
                            />
                            <h2>Velo<span className="text-blue-500">City</span></h2>
                        </Link>
                        <p>
                            Revolutionizing urban mobility. Connect with verified drivers and riders for a seamless, eco-friendly journey.
                        </p>
                    </div>

                    {/* 2. Quick Links */}
                    <div className="footer-section">
                        <h3>Explore</h3>
                        <ul className="footer-links">
                            <li><Link to="/">Home</Link></li>
                            <li><Link to="/book">Find a Ride</Link></li>
                            <li><Link to="/host">Host a Ride</Link></li>
                         
                        </ul>
                    </div>

                    {/* 3. Contact & Social */}
                    <div className="footer-section">
                        <h3>Connect</h3>
                        <div className="social-icons">
                            <a href="#" className="social-icon"><Twitter size={20} /></a>
                            <a href="#" className="social-icon"><Facebook size={20} /></a>
                            <a href="#" className="social-icon"><Instagram size={20} /></a>
                            <a href="#" className="social-icon"><Linkedin size={20} /></a>
                        </div>
                        <div className="contact-info">
                            <p>support@velocity.app</p>
                            <p>+1 (800) 123-VELO</p>
                        </div>
                    </div>
                </div>

                {/* 4. Copyright */}
                <div className="footer-bottom">
                    <p>© {new Date().getFullYear()} VeloCity Inc. All rights reserved.</p>
                </div>
            </div>
        </footer>
    );
}