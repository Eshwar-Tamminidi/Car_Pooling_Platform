import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from "react-router-dom";
import { 
    Car, Map as MapIcon, X, User, Trash2, Calendar, ShieldCheck, 
    Smartphone, ArrowLeft, CheckCircle, Loader, Activity, Clock, CreditCard, Navigation, Info, Hash, ChevronRight, AlertCircle, Lock, Landmark, CreditCard as CardIcon, XCircle, QrCode, Wallet, Download, FileText,
    Star
} from 'lucide-react';
import jsPDF from 'jspdf';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import RideMap from '../components/RideMap';

// --- INLINED API UTILITIES ---
const API_BASE = "http://localhost:8080";
const getToken = () => localStorage.getItem("token");

async function apiFetch(path, opts = {}) {
    const url = path.startsWith("http") ? path : `${API_BASE}${path}`;
    const token = getToken();
    const headers = new Headers(opts.headers || {});
    if (opts.body && !(opts.body instanceof FormData) && !headers.has("Content-Type")) {
        headers.set("Content-Type", "application/json");
    }
    if (token) headers.set("Authorization", `Bearer ${token}`);
    const res = await fetch(url, {
        method: opts.method || "GET",
        headers,
        body: opts.body && !(opts.body instanceof FormData) && typeof opts.body === "object"
                ? JSON.stringify(opts.body) : opts.body,
    });
    if (res.status === 204) return null;
    const text = await res.text();
    let data = null;
    if (text && text.trim()) {
        try { data = JSON.parse(text); } catch (e) { data = text; }
    }
    if (!res.ok) throw new Error((data && data.message) || (typeof data === 'string' ? data : res.statusText));
    return data;
}

const apiGet = (path) => apiFetch(path, { method: "GET" });
const apiPost = (path, body) => apiFetch(path, { method: "POST", body });

// --- INVOICE GENERATION UTILITY ---
const generateInvoicePDF = (booking, ride) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    const fmt = (v) => {
        const n = Number(v || 0);
        return `Rs ${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    };

    // Header
    doc.setFillColor(59, 130, 246);
    doc.rect(0, 0, pageWidth, 44, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text('VeloCity', 20, 28);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('Car Pooling Platform', 20, 36);

    // Invoice title & meta
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('INVOICE', pageWidth - 20, 28, { align: 'right' });

    const yStart = 60;
    let y = yStart;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('From:', 20, y);
    doc.setFont('helvetica', 'normal');
    doc.text('VeloCity Car Pooling', 20, y + 6);
    doc.text('123 Transport Street', 20, y + 12);
    doc.text('City, State - 123456', 20, y + 18);
    doc.text('Email: support@velocity.com', 20, y + 24);

    doc.setFont('helvetica', 'bold');
    doc.text('Bill To:', pageWidth - 110, y);
    doc.setFont('helvetica', 'normal');
    doc.text(booking.requesterName || 'Passenger', pageWidth - 110, y + 6);
    doc.text(booking.requesterEmail || '', pageWidth - 110, y + 12);

    y += 40;

    doc.setFont('helvetica', 'bold');
    doc.text(`Invoice #: ${booking.transactionId || booking.id}`, 20, y);
    doc.text(`Date: ${booking.paymentCompletedAt ? new Date(booking.paymentCompletedAt).toLocaleDateString() : new Date().toLocaleDateString()}`, pageWidth - 80, y);

    y += 14;
    doc.setDrawColor(220, 220, 220);
    doc.line(20, y, pageWidth - 20, y);
    y += 10;

    // Journey / ride summary
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('Journey Details', 20, y);
    y += 8;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`From: ${ride?.fromLocation || 'N/A'}`, 20, y); y += 6;
    doc.text(`To: ${ride?.toLocation || 'N/A'}`, 20, y); y += 6;
    doc.text(`Journey Date: ${ride?.dateTime ? new Date(ride.dateTime).toLocaleString() : 'N/A'}`, 20, y); y += 6;
    doc.text(`Estimated End: ${ride?.estimatedCompletionDateTime ? new Date(ride.estimatedCompletionDateTime).toLocaleString() : 'N/A'}`, 20, y); y += 6;
    doc.text(`Passenger: ${booking.requesterName || 'N/A'}`, 20, y); y += 6;

    y += 6;

    // Table header
    const colDesc = 20;
    const colQty = 100;
    const colRate = 150;
    const colAmount = pageWidth - 24;

    doc.setFont('helvetica', 'bold');
    doc.text('Description', colDesc, y);
    doc.text('Qty', colQty, y);
    doc.text('Rate', colRate, y);
    doc.text('Amount', colAmount, y, { align: 'right' });
    y += 8;
    doc.setDrawColor(220, 220, 220);
    doc.line(20, y, pageWidth - 20, y);
    y += 8;

    // Line items using canonical computeFare utility
    const seats = booking.seatsRequested || 1;
    const fare = computeFareUtil(ride || {}, seats);
    const driverNet = Number((fare.base - fare.platformFee).toFixed(2));

    doc.setFont('helvetica', 'normal');
    doc.text('Seats x Price', colDesc, y);
    doc.text(String(seats), colQty, y);
    doc.text(fmt(ride?.price || 0), colRate, y);
    doc.text(fmt(fare.base), colAmount, y, { align: 'right' });
    y += 6;

    doc.text('Platform Fee (5%)', colDesc, y);
    doc.text(String(seats), colQty, y);
    doc.text(fmt((fare.platformFee / seats) || 0), colRate, y);
    doc.text(fmt(fare.platformFee), colAmount, y, { align: 'right' });
    y += 6;

    doc.text('CGST (1.8%)', colDesc, y);
    doc.text('-', colQty, y);
    doc.text('-', colRate, y);
    doc.text(fmt(fare.cgst), colAmount, y, { align: 'right' });
    y += 6;

    doc.text('SGST (1.8%)', colDesc, y);
    doc.text('-', colQty, y);
    doc.text('-', colRate, y);
    doc.text(fmt(fare.sgst), colAmount, y, { align: 'right' });
    y += 8;

    doc.setDrawColor(200, 200, 200);
    doc.line(20, y, pageWidth - 20, y);
    y += 8;

    doc.setFont('helvetica', 'bold');
    doc.text('Total Paid', colDesc, y);
    doc.text(fmt(fare.total), colAmount, y, { align: 'right' });
    y += 12;

    // Platform fee note for passenger
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    const note = "5% from the amount will be taken as a platform fees from driver and passanger to maintain the platform significantly.";
    const noteLines = doc.splitTextToSize(note, pageWidth - 40);
    doc.text(noteLines, 20, y);
    y += noteLines.length * 6;

    // Transaction details
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    doc.text(`Transaction ID: ${booking.transactionId || 'N/A'}`, 20, y);
    y += 6;
    doc.text(`Payment Status: ${booking.status === 'CONFIRMED' ? 'Paid' : 'Pending'}`, 20, y);

    // Footer
    doc.setTextColor(120, 120, 120);
    doc.setFontSize(8);
    doc.text('Thank you for choosing VeloCity!', pageWidth / 2, pageHeight - 24, { align: 'center' });
    doc.text('This is a computer-generated invoice.', pageWidth / 2, pageHeight - 18, { align: 'center' });

    doc.save(`Invoice_${booking.transactionId || booking.id}.pdf`);
};

import { computeFare as computeFareUtil } from '../utils/paymentUtils';
import { geocodeMany, getRoute, searchLocation } from '../utils/mapUtils';

// Wrapper so existing code that expects computeFare(total) still works
function computeFare(ride, seats = 1) {
    const obj = computeFareUtil(ride, seats);
    return { base: obj.base, platformFees: obj.platformFee, gst: obj.gstTotal, total: obj.total, ...obj };
}

// --- ADVANCED CARD PAYMENT FORM ---
function AdvancedCardPaymentForm({ paymentBooking, onSuccess, onError, disabled }) {
    const fareObj = computeFare(paymentBooking?.rideDetails || {}, paymentBooking?.seatsRequested || 1);
    const amount = fareObj.total;
    const [cardNumber, setCardNumber] = useState("");
    const [expiry, setExpiry] = useState("");
    const [cvc, setCvc] = useState("");
    const [cardholderName, setCardholderName] = useState("");
    const [processing, setProcessing] = useState(false);
    const [error, setError] = useState(null);
    const [cardType, setCardType] = useState("");

    useEffect(() => {
        const number = cardNumber.replace(/\s/g, '');
        if (number.startsWith('4')) setCardType('Visa');
        else if (number.startsWith('5') || number.startsWith('2')) setCardType('Mastercard');
        else if (number.startsWith('6')) setCardType('Discover');
        else if (number.startsWith('3')) setCardType('Amex');
        else setCardType('');
    }, [cardNumber]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(null);
        if (cardNumber.replace(/\s/g, '').length < 13) return setError("Please enter a valid card number");
        if (expiry.length < 5) return setError("Invalid expiry date");
        if (cvc.length < 3) return setError("Invalid CVV");
        
        setProcessing(true);
        try {
            await new Promise(resolve => setTimeout(resolve, 2000));
            // Demo Stripe Transaction ID - must start with "pi_"
            const demoTransactionId = `pi_stripe_${Date.now()}`;
            // Reset processing before calling onSuccess
            setProcessing(false);
            // Call onSuccess with the transaction ID
            onSuccess(demoTransactionId);
        } catch (err) {
            setError("Payment processing failed.");
            setProcessing(false);
        }
    };

    return (
        <form onSubmit={handleSubmit}>
            <div className="mb-4">
                <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700, marginBottom: '8px', display: 'block', textTransform: 'uppercase' }}>Card Number {cardType && `(${cardType})`}</label>
                <input placeholder="4242 4242 4242 4242" value={cardNumber} onChange={e => setCardNumber(e.target.value.replace(/[^\d]/g, '').replace(/(.{4})/g, '$1 ').trim())} maxLength={19} style={{ background: 'var(--input-bg)', border: '1px solid var(--border)', borderRadius: '12px', padding: '14px', color: 'var(--text)', width: '100%', fontSize: '16px' }} />
            </div>
            <div className="mb-4">
                <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700, marginBottom: '8px', display: 'block', textTransform: 'uppercase' }}>Cardholder Name</label>
                <input placeholder="JOHN DOE" value={cardholderName} onChange={e => setCardholderName(e.target.value.toUpperCase())} style={{ background: 'var(--input-bg)', border: '1px solid var(--border)', borderRadius: '12px', padding: '14px', color: 'var(--text)', width: '100%', fontSize: '16px' }} />
            </div>
            <div style={{ display: 'flex', gap: '15px', marginBottom: '20px' }}>
                <div style={{ flex: 1 }}>
                    <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700, marginBottom: '8px', display: 'block', textTransform: 'uppercase' }}>Expiry</label>
                    <input placeholder="MM/YY" value={expiry} onChange={e => setExpiry(e.target.value)} maxLength={5} style={{ background: 'var(--input-bg)', border: '1px solid var(--border)', borderRadius: '12px', padding: '14px', color: 'var(--text)', width: '100%' }} />
                </div>
                <div style={{ flex: 1 }}>
                    <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700, marginBottom: '8px', display: 'block', textTransform: 'uppercase' }}>CVV</label>
                    <input type="password" placeholder="***" value={cvc} onChange={e => setCvc(e.target.value)} maxLength={4} style={{ background: 'var(--input-bg)', border: '1px solid var(--border)', borderRadius: '12px', padding: '14px', color: 'var(--text)', width: '100%' }} />
                </div>
            </div>
            {error && <p style={{ color: '#ef4444', fontSize: '12px', marginBottom: '15px' }}>{error}</p>}
            <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '16px', fontSize: '15px', fontWeight: 800 }} disabled={processing || disabled}>
                {processing ? <Loader className="animate-spin" /> : `Pay ₹${amount}`}
            </button>
        </form>
    );
}



export default function Rides({ user, type }) {
    // Rating states
const [ratingBooking, setRatingBooking] = useState(null);
const [stars, setStars] = useState(0);
const [reviewText, setReviewText] = useState("");
const [submittingRating, setSubmittingRating] = useState(false);
// Map of bookingId -> { stars, review } for ratings submitted in this session
const [submittedRatings, setSubmittedRatings] = useState({});

const submitRating = async () => {
    if (stars < 1) {
        alert("Please select stars");
        return;
    }

    if (!ratingBooking || !ratingBooking.id) {
        alert('Invalid booking selected');
        return;
    }

    setSubmittingRating(true);
    try {
        await apiPost("/api/ratings/submit", {
            bookingId: ratingBooking.id,
            stars: stars,
            review: reviewText
        });

        // mark locally as rated so UI updates immediately
        setSubmittedRatings(prev => ({ ...prev, [ratingBooking.id]: { stars, review: reviewText } }));

        setRatingBooking(null);
        setStars(0);
        setReviewText("");

        setShowSuccessModal({
            show: true,
            title: "Thank you!",
            message: "Your rating has been submitted."
        });

        setTimeout(() => {
            setShowSuccessModal({ show: false, title: "", message: "" });
        }, 2500);

        // refresh page-level data to update averages and server state
        loadData();

    } catch (e) {
        alert(e.message || "Rating failed");
    } finally {
        setSubmittingRating(false);
    }
};

    const navigate = useNavigate();
    const [showSuccessModal, setShowSuccessModal] = useState({ show: false, title: '', message: '' });
    const [data, setData] = useState([]);
    const [activeHosted, setActiveHosted] = useState([]);
    const [completedHosted, setCompletedHosted] = useState([]);
    const [loading, setLoading] = useState(false);
    
    // UI Modal States
    const [mapRide, setMapRide] = useState(null);
    const [routeGeom, setRouteGeom] = useState(null);
    const [allStops, setAllStops] = useState([]);
    const [isMapping, setIsMapping] = useState(false);
    const [modalType, setModalType] = useState(null); 
    const [selectedRideId, setSelectedRideId] = useState(null);
    const [requestsList, setRequestsList] = useState([]);
    const [passengersList, setPassengersList] = useState([]);
    const [selectedRideForPassengers, setSelectedRideForPassengers] = useState(null);
    // Refs for scrollable modal lists so we can reset scroll position when opening
    const passengersListRef = useRef(null);
    const requestsListRef = useRef(null);
    const [showCompleted, setShowCompleted] = useState(false);
    // Earnings panel state
    const [showEarnings, setShowEarnings] = useState(false);
    const [earningsLoading, setEarningsLoading] = useState(false);
    const [earningsTransactions, setEarningsTransactions] = useState([]);
    const [earningsFiltered, setEarningsFiltered] = useState([]);
    const [filterMode, setFilterMode] = useState('month'); // 'month' | 'year' | 'range'
    const [filterMonth, setFilterMonth] = useState(new Date().getMonth() + 1);
    const [filterYear, setFilterYear] = useState(new Date().getFullYear());
    const [startDateFilter, setStartDateFilter] = useState('');
    const [endDateFilter, setEndDateFilter] = useState('');
    const [showEarningsDetails, setShowEarningsDetails] = useState(false);
    const [showEarningsDebug, setShowEarningsDebug] = useState(false);
    const [earningsDebug, setEarningsDebug] = useState(null);
    const [earningsPage, setEarningsPage] = useState(1);
    const [earningsTotals, setEarningsTotals] = useState({ driverTx: 0, derived: 0, combined: 0 });
    const [earningsPeriodTotal, setEarningsPeriodTotal] = useState(0);
    const EARNINGS_PER_PAGE = 8;

    // Passenger rating (for hosts)
    const [ratingPassenger, setRatingPassenger] = useState(null);
    const [ratingStars, setRatingStars] = useState(0);
    const [ratingNote, setRatingNote] = useState("");
    const [ratingLoading, setRatingLoading] = useState(false);

    // When opening rating UI for a passenger, scroll the passengers list to the top (smooth)
    useEffect(() => {
        if (ratingPassenger && passengersListRef.current) {
            try {
                const el = passengersListRef.current;
                if (typeof el.scrollTo === 'function') el.scrollTo({ top: 0, behavior: 'smooth' });
                else el.scrollTop = 0;
            } catch (e) { /* ignore */ }
        }
    }, [ratingPassenger]);

    // Clear any inline rating UI when the passengers modal is closed or when switching between Completed/Active views
    useEffect(() => {
        if (modalType !== 'passengers') setRatingPassenger(null);
    }, [modalType]);

    useEffect(() => {
        // If switching between completed/active lists, ensure no lingering inline rating is visible
        setRatingPassenger(null);
    }, [showCompleted]);

    // Payment States
    const [paymentBooking, setPaymentBooking] = useState(null);
    const [paymentView, setPaymentView] = useState('method'); 
    const [utr, setUtr] = useState("");
    const [upiIdInput, setUpiIdInput] = useState("");
    const [isVerifying, setIsVerifying] = useState(false);
    const [verifyError, setVerifyError] = useState("");
    const [trackingBooking, setTrackingBooking] = useState(null);

    // Stripe states
    const [stripePk, setStripePk] = useState("");
    const [stripePromise, setStripePromise] = useState(null);
    const [stripeClientSecret, setStripeClientSecret] = useState(null);
    const [stripeCheckoutUrl, setStripeCheckoutUrl] = useState(null);
    const [stripeSessionId, setStripeSessionId] = useState(null);
    
    // Selection states
    const [selectedBank, setSelectedBank] = useState("");
    // Map of userId -> user (for showing averageRating without extra prop drilling)
    const [userMap, setUserMap] = useState({});

    // Passenger ratings summary for the selected ride (modal) and per-ride aggregates
    const [currentPassengerRatings, setCurrentPassengerRatings] = useState(null);
    const [passengerRatingsByRide, setPassengerRatingsByRide] = useState({});

    const fetchUsersForRides = async (ridesArray = []) => {
        try {
            const ids = Array.from(new Set(ridesArray.map(r => r.ownerId).filter(Boolean)));
            const missing = ids.filter(id => !userMap[id]);
            if (missing.length === 0) return;
            const results = await Promise.all(missing.map(id => apiGet(`/api/users/${id}`).catch(() => null)));
            const map = { ...userMap };
            results.forEach(u => { if (u && u.id) map[u.id] = u; });
            setUserMap(map);
        } catch (e) { console.error('Failed to fetch users for rides', e); }
    };

    const fetchUsersByIds = async (ids = []) => {
        try {
            const uniq = Array.from(new Set((ids || []).filter(Boolean)));
            const missing = uniq.filter(id => !userMap[id]);
            if (missing.length === 0) return;
            const results = await Promise.all(missing.map(id => apiGet(`/api/users/${id}`).catch(() => null)));
            const map = { ...userMap };
            results.forEach(u => { if (u && u.id) map[u.id] = u; });
            setUserMap(map);
        } catch (e) { console.error('Failed to fetch users by ids', e); }
    };
    const [selectedWallet, setSelectedWallet] = useState("");

    useEffect(() => { loadData(); }, [type]);
    async function ensureLeafletLoaded() {
        if (typeof window === 'undefined') return;
        if (window.L) return;
        // Prevent concurrent loads
        if (window._leafletLoading) return window._leafletLoading;
        window._leafletLoading = new Promise((resolve, reject) => {
            try {
                const script = document.createElement('script');
                script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
                script.async = true;
                script.onload = () => { window._leafletLoading = null; resolve(); };
                script.onerror = (e) => { window._leafletLoading = null; reject(new Error('Failed to load Leaflet')); };
                document.head.appendChild(script);
            } catch (e) { window._leafletLoading = null; reject(e); }
        });
        return window._leafletLoading;
    }

    useEffect(() => { 
        if (!mapRide) return;
        (async () => {
            try {
                await ensureLeafletLoaded();
            } catch (e) {
                console.warn('Leaflet failed to load', e);
            }
            fetchFullRoute();
        })();
    }, [mapRide]);

    // Refresh rides/aggregates when a rating is submitted elsewhere in the app
    useEffect(() => {
        const handler = (e) => {
            try { loadData(); } catch (err) { console.error('Failed to refresh after rating update', err); }
        };
        window.addEventListener('rating:updated', handler);
        return () => window.removeEventListener('rating:updated', handler);
    }, []);

    // Forcible remount key so map reinitializes on retry
    const [mapKey, setMapKey] = useState(0);
    const [routeError, setRouteError] = useState(null);

    async function resolvePoints(points) {
        if (!points || points.length === 0) return [];
        const objs = (points || []).filter(p => p && typeof p === 'object' && (p.lat !== undefined || p.lng !== undefined || p.lon !== undefined)).map(p => ({ name: p.name, lat: Number(p.lat), lng: Number(p.lng || p.lon) }));
        const strs = (points || []).filter(p => typeof p === 'string');
        let geocoded = [];
        if (strs.length > 0) {
            try { geocoded = await geocodeMany(strs); } catch (e) { console.debug('geocodeMany error', e); }
        }
        return [...objs, ...geocoded];
    }

    async function fetchFullRoute() {
        setIsMapping(true);
        setRouteError(null);
        try {
            // Resolve all intermediate stops whether they are stored as strings or objects
            const pickupCoords = await resolvePoints(mapRide.pickupPoints || []);
            const dropoffCoords = await resolvePoints(mapRide.dropoffPoints || []);
            setAllStops([...pickupCoords, ...dropoffCoords]);

            // Ensure we have numeric from/to coords; if missing, attempt geocoding the textual location
            let from = (mapRide.fromLat && mapRide.fromLng) ? { lat: Number(mapRide.fromLat), lng: Number(mapRide.fromLng) } : null;
            let to = (mapRide.toLat && mapRide.toLng) ? { lat: Number(mapRide.toLat), lng: Number(mapRide.toLng) } : null;

            if (!from && mapRide.fromLocation) {
                try {
                    const s = await searchLocation(mapRide.fromLocation);
                    if (s && s.length > 0) from = { lat: s[0].lat, lng: s[0].lon };
                } catch (e) { console.debug('searchLocation failed for fromLocation', e); }
            }
            if (!to && mapRide.toLocation) {
                try {
                    const s2 = await searchLocation(mapRide.toLocation);
                    if (s2 && s2.length > 0) to = { lat: s2[0].lat, lng: s2[0].lon };
                } catch (e) { console.debug('searchLocation failed for toLocation', e); }
            }

            const fullPath = [from, ...pickupCoords, ...dropoffCoords, to].filter(p => p && p.lat);
            console.debug('fetchFullRoute: from', from, 'to', to, 'pickup', pickupCoords.length, 'drop', dropoffCoords.length, 'fullPath length', fullPath.length);
            if (fullPath.length < 2) {
                setRouteGeom(null);
                setRouteError('Insufficient coordinate data to draw a route.');
                return;
            }

            const route = await getRoute(fullPath);
            console.debug('fetchFullRoute: route', route && Boolean(route.geometry));
            if (route && route.geometry) {
                setRouteGeom(route.geometry);
                // bump mapKey to force remount so map fits to new route reliably
                setMapKey(k => k + 1);
            } else {
                setRouteGeom(null);
                setRouteError('Routing service returned no route. Please try again.');
            }
        } catch (err) {
            console.error('Failed to fetch route', err);
            setRouteError('Unable to fetch route — please try again');
            setRouteGeom(null);
        } finally {
            setIsMapping(false);
        }
    }

    async function loadData() {
        setLoading(true);
        try {
            if (type === 'hosted') {
                let rides = [];
                try {
                    const res = await apiGet("/api/rides/hosted");
                    rides = res || [];
                } catch (err) {
                    if (err && err.status === 401) {
                        alert('Please sign in to view your hosted rides.');
                        setData([]);
                        setActiveHosted([]);
                        setCompletedHosted([]);
                        setLoading(false);
                        return;
                    }
                    console.error('Failed to fetch hosted rides', err);
                    rides = [];
                }

                // Also fetch bookings for the host to detect completed journeys even if the ride end time parsing fails or server time drift occurs
                const hostBookings = await apiGet('/api/bookings/for-host') || [];
                const completedRideIds = new Set(hostBookings.filter(b => b.status === 'COMPLETED').map(b => b.rideId));
                const now = new Date();
                const getRideEnd = (r) => (r && (r.estimatedCompletionDateTime || r.dateTime));
                // Best-effort: for rides that have ended by time, ask server to ensure bookings are marked COMPLETED
                await Promise.all(rides.map(async r => {
                    try {
                        const end = getRideEnd(r);
                        if (end && new Date(end) < now) {
                            await apiPost(`/api/rides/${r.id}/ensure-completed`, {}).catch(() => {});
                        }
                    } catch (err) { console.error('ensure-completed error', err); }
                }));

                const active = rides.filter(r => {
                    const end = getRideEnd(r);
                    const endedByTime = end && new Date(end) < now;
                    const hasCompletedBooking = completedRideIds.has(r.id);
                    return (!endedByTime) && !hasCompletedBooking;
                });
                const completed = rides.filter(r => {
                    const end = getRideEnd(r);
                    const endedByTime = end && new Date(end) < now;
                    const hasCompletedBooking = completedRideIds.has(r.id);
                    return endedByTime || hasCompletedBooking;
                });
                setActiveHosted(active);
                setCompletedHosted(completed);
                setData(rides);
                // fetch owner user objects for rating display
                fetchUsersForRides(rides);

                // Best-effort: fetch passenger rating aggregates for completed rides (so cards can show passenger-average)
                try{
                    const completedIds = completed.filter(r => r && r.id).map(r => r.id);
                    const pairs = await Promise.all(completedIds.map(async id => {
                        try{
                            const s = await apiGet(`/api/rides/${id}/passenger-ratings`);
                            return [id, s?.average ?? null];
                        }catch(e){ return [id, null]; }
                    }));
                    const map = {};
                    pairs.forEach(p => { map[p[0]] = p[1]; });
                    setPassengerRatingsByRide(map);
                }catch(e){ console.error('Failed to fetch passenger rating aggregates', e); }
            } else {
                const bookings = await apiGet("/api/bookings/my") || [];
                const withRide = await Promise.all(bookings.map(async b => {
                    try { const r = await apiGet(`/api/rides/${b.rideId}`); return { ...b, rideDetails: r }; }
                    catch(e){ return b; }
                }));
                const now = new Date();
                const getRideEnd = (r) => (r && (r.estimatedCompletionDateTime || r.dateTime));

                if (type === 'requested') {
                    const upcoming = withRide.filter(b => b.status !== 'REJECTED' && (b.rideDetails && (!getRideEnd(b.rideDetails) || new Date(getRideEnd(b.rideDetails)) >= now)));
                    setData(upcoming);
                    // ensure we have user objects for the referenced rides
                    fetchUsersForRides(upcoming.map(b => b.rideDetails).filter(Boolean));
                } else {
                    // JOURNEY HISTORY → ONLY CONFIRMED RIDES
                    const history = withRide.filter(b => b.rideDetails && getRideEnd(b.rideDetails) && new Date(getRideEnd(b.rideDetails)) < now).map(b => ({ ...b, status: 'COMPLETED' }));
                    setData(history);
                    fetchUsersForRides(history.map(b => b.rideDetails).filter(Boolean));

                    // Fetch per-ride passenger ratings summary so we can determine if the current user already rated a booking
                    try {
                        const rideIds = Array.from(new Set(history.map(b => b.rideId).filter(Boolean)));
                        await Promise.all(rideIds.map(async id => {
                            try {
                                const s = await apiGet(`/api/rides/${id}/passenger-ratings`);
                                if (s && s.ratedByMe) {
                                    const entries = Object.entries(s.ratedByMe).reduce((acc, [bookingId, stars]) => {
                                        // ensure we store as same shape used elsewhere
                                        acc[bookingId] = { stars: Number(stars), review: '' };
                                        return acc;
                                    }, {});
                                    setSubmittedRatings(prev => ({ ...prev, ...entries }));
                                }
                            } catch (err) { /* ignore per-ride failures */ }
                        }));
                    } catch (err) { console.error('Failed to fetch ride-level ratedByMe info', err); }
                }
            }
        } catch (e) { console.error(e); } finally { setLoading(false); }
    }

    const startPayment = async (item) => {
        setPaymentBooking(item);
        setPaymentView('method');
        setUtr("");
        setUpiIdInput("");
        setVerifyError("");
        setSelectedBank("");
        setSelectedWallet("");
        setStripeClientSecret(null);
        setStripeCheckoutUrl(null);
        setStripeSessionId(null);
        try {
            // Try to fetch Stripe publishable key and store locally for client usage
            const cfg = await apiGet('/api/bookings/config/stripe');
            if (cfg && cfg.publishableKey) setStripePk(cfg.publishableKey);

            await apiPost(`/api/bookings/${item.id}/initiate-payment`, {});
        } catch (e) { console.error(e); }
    };

    const handleConfirmPayment = async (customId = null) => {
        setIsVerifying(true);
        setVerifyError("");
    
        // DEMO LOGIC: Automatically format IDs to satisfy backend regex if needed
        let finalTxId = customId;
        if (!finalTxId) {
            if (paymentView === 'upi_qr') {
                // If UTR is provided, use it but format to start with "pi_" for backend validation
                if (utr && utr.length === 12) {
                    finalTxId = `pi_upi_${utr}`;
                } else if (utr && utr.length > 0) {
                    setIsVerifying(false);
                    return setVerifyError("Please enter a valid 12-digit UTR");
                } else {
                    setIsVerifying(false);
                    return setVerifyError("Please enter the transaction UTR");
                }
            } else if (paymentView === 'upi_id') {
                if (!upiIdInput) {
                    setIsVerifying(false);
                    return setVerifyError("Please enter UPI ID");
                }
                // If UTR is provided, use it
                if (utr && utr.length === 12) {
                    finalTxId = `pi_upi_${utr}`;
                } else {
                    // Generate demo transaction ID if no UTR
                    finalTxId = `pi_upi_${Date.now()}`;
                }
            } else if (paymentView === 'netbanking') {
                if (!selectedBank) {
                    setIsVerifying(false);
                    return setVerifyError("Please select a bank");
                }
                finalTxId = `pi_nb_${Date.now()}`;
            } else if (paymentView === 'wallet') {
                if (!selectedWallet) {
                    setIsVerifying(false);
                    return setVerifyError("Please select a wallet");
                }
                finalTxId = `pi_wallet_${Date.now()}`;
            }
        }
    
        try {
            await apiPost(`/api/bookings/${paymentBooking.id}/verify-payment`, { transactionId: finalTxId });
            
            // Close payment gateway FIRST
            setPaymentBooking(null);
            setPaymentView('method');
            setIsVerifying(false);
            
            // Refresh data
            loadData();
            
            // Show success popup immediately
            setShowSuccessModal({ show: true, title: "Payment Successful!", message: "Your seat is now secured." });
            
            // Auto-close popup after 3 seconds
            setTimeout(() => {
                setShowSuccessModal({ show: false, title: '', message: "" });
            }, 3000);
        } catch (err) { 
            console.error("Payment verification error:", err);
            setVerifyError(err.message || "Gateway error. Please try again."); 
            setIsVerifying(false);
        }
    };

    const handleDecide = async (bookingId, action) => {
        try {
            await apiPost(`/api/bookings/${bookingId}/decide?action=${action}`, {});
            const actionText = action === 'accept' ? 'approved' : 'rejected';
            setShowSuccessModal({ show: true, title: 'Success', message: `Request ${actionText} successfully!` });
            loadData();
            if (modalType === 'requests') handleOpenRequests(selectedRideId);
            else if (modalType === 'passengers') handleOpenPassengers({ id: selectedRideId });
            
            // Auto close after 2 seconds
            setTimeout(() => {
                setShowSuccessModal({ show: false, title: '', message: "" });
            }, 2000);
        } catch (err) {
            console.error("Decide error:", err);
            const errorMsg = err.message || `Failed to ${action} request. Please try again.`;
            alert(errorMsg);
        }
    };

    const handleOpenRequests = async (rideId) => {
        setSelectedRideId(rideId); setModalType('requests');
        try {
            const all = await apiGet("/api/bookings/for-host") || [];
            setRequestsList(all.filter(r => r.rideId === rideId && r.status === 'PENDING'));
            // prefetch requester user profiles for rating display
            fetchUsersByIds(all.map(r => r.requesterId));

            // ensure the list scrolls to top when opened (immediate + smooth)
            requestAnimationFrame(() => {
                try {
                    const el = requestsListRef.current;
                    if (el) {
                        el.scrollTop = 0;
                        if (typeof el.scrollTo === 'function') el.scrollTo({ top: 0, behavior: 'smooth' });
                        el.style.scrollBehavior = 'smooth';
                    }
                } catch (e) { /* ignore */ }
            });
        } catch (e) { console.error(e); }
    };

    const handleOpenPassengers = async (ride) => {
        setSelectedRideId(ride?.id);
        setSelectedRideForPassengers(ride || null);
        setModalType('passengers');
        try {
            // Ensure bookings are marked completed if the ride end time is past (best-effort)
            try { await apiPost(`/api/rides/${ride.id}/ensure-completed`, {}); } catch (err) { /* ignore 400/not-past */ }
            const all = await apiGet("/api/bookings/for-host") || [];
            const list = all.filter(r => r.rideId === (ride && ride.id) && (['ACCEPTED','CONFIRMED','COMPLETED'].includes(r.status)));
            setPassengersList(list);
            fetchUsersByIds(all.map(r => r.requesterId));

            // ensure the list scrolls to top when opened (immediate + smooth) — use RAF to wait for render
            requestAnimationFrame(() => {
                try {
                    const el = passengersListRef.current;
                    if (el) {
                        el.scrollTop = 0; // ensure immediate top
                        if (typeof el.scrollTo === 'function') el.scrollTo({ top: 0, behavior: 'smooth' });
                        el.style.scrollBehavior = 'smooth';
                    }
                } catch (e) { /* ignore */ }
            });

            // fetch passenger ratings summary for this ride to disable already-rated bookings and show per-ride average
            try{
                const summary = await apiGet(`/api/rides/${ride.id}/passenger-ratings`);
                setCurrentPassengerRatings(summary);
            }catch(e){ console.error('Failed to fetch passenger ratings', e); setCurrentPassengerRatings(null); }
        } catch (e) { console.error(e); setPassengersList([]); setCurrentPassengerRatings(null); }
    };



    const submitPassengerRating = async (booking) => {
        if (ratingStars < 1) return alert('Please select stars');
        // Ratings are open: no need for booking to be COMPLETED
        if (!booking) return alert('Invalid booking');
        setRatingLoading(true);
        try{
            // Use the generic /submit endpoint; backend determines reviewer from auth token
            await apiPost('/api/ratings/submit', {
                bookingId: booking.id,
                stars: ratingStars,
                review: ratingNote
            });
            alert('Rating submitted');
            // mark locally as rated so UI updates immediately
            setSubmittedRatings(prev => ({ ...prev, [booking.id]: { stars: ratingStars, review: ratingNote } }));

            // Also update the currently-open passenger ratings summary locally so the host's UI disables the Rate button
            setCurrentPassengerRatings(prev => {
                try {
                    const perBooking = prev && prev.perBooking ? { ...prev.perBooking } : {};
                    // naive merge: if we have an existing per-booking average, average with the new rating to avoid showing stale null
                    perBooking[booking.id] = prev && prev.perBooking && prev.perBooking[booking.id] ? Math.round(((Number(prev.perBooking[booking.id]) + ratingStars) / 2) * 10) / 10 : ratingStars;
                    const ratedByMe = prev && prev.ratedByMe ? { ...prev.ratedByMe } : {};
                    ratedByMe[booking.id] = ratingStars;
                    const vals = Object.values(perBooking).map(v => Number(v)).filter(v => !Number.isNaN(v));
                    const avg = vals.length > 0 ? Math.round((vals.reduce((a,b)=>a+b,0) / vals.length) * 10) / 10 : ratingStars;

                    // update ride-level cached average used on cards
                    if (selectedRideForPassengers && selectedRideForPassengers.id) {
                        setPassengerRatingsByRide(prevMap => ({ ...prevMap, [selectedRideForPassengers.id]: avg }));
                    }

                    return { average: avg, perBooking: perBooking, ratedByMe: ratedByMe };
                } catch (e) { return prev; }
            });

            setRatingPassenger(null);
            setRatingStars(0);
            setRatingNote('');
            // refresh page-level data (best-effort) to pick up server-side aggregates
            await loadData();
            // Broadcast rating update so other components (e.g., ride page modal) can refresh
            try{ window.dispatchEvent(new CustomEvent('rating:updated', { detail: { rideId: booking.rideId, bookingId: booking.id } })); }catch(e){}
        }catch(err){
            console.error('Passenger rating error:', err);
            // Provide actionable message when server returns generic 500
            const msg = (err && err.message && err.message !== 'Internal Server Error') ? err.message : 'Rating failed: you may have already rated this booking.';
            alert(msg);
        }finally{ setRatingLoading(false); }
    };

    const getStatusLabel = (status) => {
        let style = 'bg-zinc-800 text-zinc-400';
        if (status === 'CONFIRMED') style = 'bg-emerald-500/20 text-emerald-400';
        if (status === 'ACCEPTED') style = 'bg-blue-500/20 text-blue-400';
        if (status === 'PENDING') style = 'bg-amber-500/20 text-amber-400';
        return <span className={`text-[10px] font-black uppercase px-3 py-1 rounded-full ${style}`}>{status}</span>;
    };

    // Earnings helpers
    const computeChartPoints = (list) => {
        const map = {};
        (list || []).forEach(t => {
            const d = (t.journeyDate || t.date || t.createdAt || t.paymentCompletedAt);
            const key = d ? new Date(d).toISOString().split('T')[0] : 'unknown';
            const amt = Number(t.amount || t.netAmount || t.value || 0) || 0;
            map[key] = (map[key] || 0) + amt;
        });
        const keys = Object.keys(map).sort();
        return keys.map(k => ({ label: k, value: map[k] }));
    };

    const formatDateOnly = (date) => {
        if (!date) return 'N/A';
        try { const d = new Date(date); if (isNaN(d.getTime())) return 'N/A'; return d.toLocaleDateString(); } catch (e) { return 'N/A'; }
    };

    const EarningsChart = ({ data = [], height = 120 }) => {
        if (!data || data.length === 0) return <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>No data</div>;
        const values = data.map(d => d.value || 0);
        const max = Math.max(...values, 1);
        const pts = values.map((v, i) => `${(i/(values.length-1))*100},${100 - (v/max*100)}`).join(' ');
        return (
            <svg viewBox={`0 0 100 100`} style={{ width: '100%', height }} preserveAspectRatio="none">
                <polyline fill="none" stroke="#3b82f6" strokeWidth="1.5" points={pts} strokeLinejoin="round" strokeLinecap="round" />
                {values.map((v,i) => (
                    <circle key={i} cx={`${(i/(values.length-1))*100}%`} cy={`${100 - (v/max*100)}%`} r={1.8} fill="#3b82f6" />
                ))}
            </svg>
        );
    };

    const fetchEarnings = async () => {
        try {
            setEarningsLoading(true);
            const user = JSON.parse(localStorage.getItem('user') || '{}');
            const email = user?.email;
            if (!email) { setEarningsTransactions([]); setEarningsFiltered([]); setEarningsLoading(false); return; }

            const q = new URLSearchParams({ driverEmail: email }).toString();
            const txs = await apiGet(`/api/driver/transactions?${q}`) || [];
            // Diagnostics: log raw transactions count and a small sample
            console.debug('fetchEarnings: raw txs count=', (txs||[]).length, 'sample=', (txs||[]).slice(0,6)); 

            const hostBookings = await apiGet('/api/bookings/for-host').catch(()=>[]);

            const norm = (txs || []).map(tx => {
                let journeyDate = tx.journeyDate || tx.date || tx.createdAt || tx.paymentCompletedAt || null;
                if (!journeyDate && tx.transactionId) {
                    const b = (hostBookings || []).find(bk => bk.transactionId === tx.transactionId);
                    if (b) journeyDate = b.paymentCompletedAt || b.confirmedAt || b.requestedAt || null;
                }
                const canonicalDate = tx.paymentCompletedAt || tx.date || tx.createdAt || tx.settlementDate || tx.settledAt || tx.timestamp || journeyDate || null;
                return { ...tx, journeyDate, date: canonicalDate };
            });

            console.debug('fetchEarnings: normalized txs with date count=', (norm||[]).filter(t=>t.date).length, 'sampleDates=', (norm||[]).slice(0,6).map(t => t.date));

            // Normalize amounts and select credited transactions (driver receipts)
            const credited = norm
                .filter(t => (t.type || '').toLowerCase() === 'credited' || (t.role || '').toLowerCase() === 'driver')
                .map(t => ({ ...t, amount: Number(t.amount ?? t.netAmount ?? t.creditedAmount ?? t.value ?? 0) }));

            // Diagnostics: log credited count and sample
            console.debug('fetchEarnings: credited count=', credited.length, 'sample=', credited.slice(0,6));

            // --- Booking-derived driver earnings (fallback) ---
            // Consider host bookings that represent passenger payments and compute driver base amount (GST & platform excluded)
            const bookingCandidates = (hostBookings || []).filter(b => b && (b.status === 'PAID' || b.status === 'CONFIRMED' || b.status === 'COMPLETED' || b.paymentCompletedAt));
            const bookingMapByTx = new Map((hostBookings || []).filter(b => b && b.transactionId).map(b => [b.transactionId, b]));

            const derivedPromises = bookingCandidates.map(async b => {
                try {
                    // fetch ride for price/date details
                    const ride = b.rideId ? await apiGet(`/api/rides/${b.rideId}`).catch(() => null) : null;
                    const seats = Number(b.seatsRequested || 1);
                    // Prefer ride.price for the driver's base payout; fallback to amountPaid minus platform fees (20 per seat)
                    let base = 0;
                    if (ride && ride.price !== undefined && ride.price !== null) base = Number(ride.price) * seats;
                    else if (b.amountPaid !== undefined && b.amountPaid !== null) base = Math.max(0, Number(b.amountPaid) - 20 * seats);
                    else base = 0;
                    const date = b.paymentCompletedAt || b.confirmedAt || b.requestedAt || (ride && (ride.dateTime || ride.estimatedCompletionDateTime)) || null;
                    return { bookingId: b.id, rideId: b.rideId || null, seats, bookingAmountPaid: b.amountPaid ?? null, transactionId: b.transactionId || null, amount: Number(base), type: 'derived', role: 'driver', date, journeyDate: ride?.dateTime || null };
                } catch (err) {
                    console.error('Error deriving booking amount for booking', b && b.id, err);
                    return null;
                }
            });

            const derivedAll = (await Promise.all(derivedPromises)).filter(Boolean);
            // Build quick lookup of credited txs (transactionId map + normalized metadata for fuzzy matching)
            const creditedTxIds = new Set(credited.map(c => c.transactionId).filter(Boolean));
            // Map transactionId -> booking (if available) so we can find rideId for credited txs (bookingMapByTx already built above)


            const creditedLookup = (credited || []).map(c => {
                const cDate = c.paymentCompletedAt || c.date || c.createdAt || c.journeyDate || null;
                const cDateStr = cDate ? new Date(cDate).toISOString().split('T')[0] : null;
                const cRideId = (c.transactionId && bookingMapByTx.get(c.transactionId)?.rideId) || null;
                return { amount: Number(c.amount || 0), dateStr: cDateStr, rideId: cRideId };
            });

            // Deduplicate derived entries by matching transaction id, rideId (if present) or date+amount (fuzzy)
            let derivedExcludedByTx = 0, derivedExcludedByMatch = 0;
            const EPS = 1.0; // rupee tolerance for numeric comparison
            const derivedFiltered = derivedAll.filter(d => {
                if (!d) return false;
                const dAmount = Number(d.amount || 0);
                const dDateStr = d.date ? new Date(d.date).toISOString().split('T')[0] : null;
                // Exclude if same transactionId exists in credited txs
                if (d.transactionId && creditedTxIds.has(d.transactionId)) { derivedExcludedByTx++; return false; }
                // Exclude if a credited tx exists for the same rideId and similar amount
                const hasRideMatch = creditedLookup.some(c => c.rideId && d.rideId && String(c.rideId) === String(d.rideId) && Math.abs(c.amount - dAmount) <= EPS);
                if (hasRideMatch) { derivedExcludedByMatch++; return false; }
                // Exclude if a credited tx exists on the same day with very similar amount
                const hasDateAmountMatch = creditedLookup.some(c => c.dateStr && dDateStr && c.dateStr === dDateStr && Math.abs(c.amount - dAmount) <= EPS);
                if (hasDateAmountMatch) { derivedExcludedByMatch++; return false; }
                return true;
            });

            // Combine driver txs (authoritative payouts) and derived booking amounts
            const combined = [...credited.map(c => ({ ...c, _source: 'driverTx' })), ...derivedFiltered.map(d => ({ ...d, _source: 'derived' }))];

            // Sort combined by date (newest first) — prefer transaction/payment date then journeyDate
            combined.sort((a,b) => {
                const pa = new Date(a.paymentCompletedAt || a.date || a.createdAt || a.settlementDate || a.settledAt || a.timestamp || a.journeyDate || 0);
                const pb = new Date(b.paymentCompletedAt || b.date || b.createdAt || b.settlementDate || b.settledAt || b.timestamp || b.journeyDate || 0);
                return pb - pa;
            });

            setEarningsTransactions(combined);

            const txTotal = credited.reduce((s, t) => s + (Number(t.amount || 0) || 0), 0);
            const derivedTotal = derivedFiltered.reduce((s, t) => s + (Number(t.amount || 0) || 0), 0);
            const combinedTotal = txTotal + derivedTotal;
            setEarningsTotals({ driverTx: txTotal, derived: derivedTotal, combined: combinedTotal });

            console.debug('fetchEarnings: derived counts:', { totalDerived: derivedAll.length, excludedByTx: derivedExcludedByTx, excludedByMatch: derivedExcludedByMatch, kept: derivedFiltered.length });

            // compute range
            let from = null, to = null;
            if (filterMode === 'month') {
                from = new Date(filterYear, filterMonth-1, 1).toISOString().split('T')[0];
                to = new Date(filterYear, filterMonth, 0).toISOString().split('T')[0];
            } else if (filterMode === 'year') {
                from = `${filterYear}-01-01`; to = `${filterYear}-12-31`;
            } else if (filterMode === 'range') {
                from = startDateFilter || null; to = endDateFilter || null;
            }

            // Apply same date filtering on the combined list
            const filtered = (combined || []).filter(t => {
                const d = t.paymentCompletedAt || t.date || t.createdAt || t.settlementDate || t.settledAt || t.timestamp || t.journeyDate || null;
                if (!d && (from || to)) return false;
                if (!d) return true;
                const ds = new Date(d).toISOString().split('T')[0];
                if (from && ds < from) return false;
                if (to && ds > to) return false;
                return true;
            });

            setEarningsFiltered(filtered);

            // log items excluded due to missing date when a filter is active
            const excludedNoDate = (combined || []).filter(t => {
                const d = t.paymentCompletedAt || t.date || t.createdAt || t.settlementDate || t.settledAt || t.timestamp || t.journeyDate || null;
                return (!d && (from || to));
            });
            console.debug('fetchEarnings: excluded (no date) count=', excludedNoDate.length, 'sample=', excludedNoDate.slice(0,6));

            // compute period total from combined source
            const periodTotal = filtered.reduce((s,t) => s + (Number(t.amount ?? t.netAmount ?? t.creditedAmount ?? t.value ?? 0) || 0), 0);
            setEarningsPeriodTotal(periodTotal);
            const driverAllTotal = (txs || []).reduce((s,t) => s + (Number(t.amount ?? t.netAmount ?? t.creditedAmount ?? t.value ?? 0) || 0), 0);
            console.debug('fetchEarnings: filtered count=', filtered.length, 'periodTotal=', periodTotal, 'driverAllTotal=', driverAllTotal);

            // Populate debug payload for on-screen inspection (include derived info)
            setEarningsDebug({
                rawCount: (txs || []).length,
                normalizedWithDateCount: (norm || []).filter(t => t.date).length,
                creditedCount: (credited || []).length,
                derivedCount: derivedAll.length,
                derivedExcludedByTx: typeof derivedExcludedByTx !== 'undefined' ? derivedExcludedByTx : 0,
                derivedExcludedByMatch: typeof derivedExcludedByMatch !== 'undefined' ? derivedExcludedByMatch : 0,
                excludedNoDateCount: excludedNoDate ? excludedNoDate.length : 0,
                filteredCount: (filtered || []).length,
                periodTotal,
                driverAllTotal,
                sampleCredited: (credited || []).slice(0,10).map(t => ({ transactionId: t.transactionId || t.id || null, amount: t.amount, date: t.date || t.paymentCompletedAt || t.journeyDate || null, paymentCompletedAt: t.paymentCompletedAt || null, journeyDate: t.journeyDate || null })),
                sampleDerived: derivedFiltered.slice(0,10).map(t => ({ bookingId: t.bookingId, rideId: t.rideId, transactionId: t.transactionId, amount: t.amount, date: t.date || null })),
                sampleDerivedExcluded: derivedAll.filter(d => !(derivedFiltered.includes(d))).slice(0,10).map(t => ({ bookingId: t.bookingId, rideId: t.rideId, transactionId: t.transactionId, amount: t.amount, date: t.date || null }))
            });

            setEarningsPage(1);
        } catch (err) {
            console.error('Failed to fetch earnings', err);
            setEarningsTransactions([]); setEarningsFiltered([]);
        } finally { setEarningsLoading(false); }
    };

    useEffect(() => {
        let poll = null;
        if (showEarnings) {
            fetchEarnings();
            poll = setInterval(() => fetchEarnings(), 30000);
        }
        return () => { if (poll) clearInterval(poll); };
    }, [showEarnings, filterMode, filterMonth, filterYear, startDateFilter, endDateFilter]);

    return (
        <div className="container animate-fade" style={{ padding: '40px 20px', minHeight: '85vh' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '40px', gap: '20px', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: '200px' }}>
                    <h1 style={{ fontSize: '32px', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '8px' }}>
                        {type === 'hosted' ? 'My Hosted Rides' : (type === 'requested' ? 'Requested Journeys' : 'Journey History')}
                    </h1>
                    <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Secure Stripe-powered checkout and journey schedule</p>
                </div>
                
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                    {type === 'hosted' && (
                        <div style={{ display: 'inline-flex', background: 'linear-gradient(90deg, rgba(255,255,255,0.02), rgba(255,255,255,0.01))', padding: 6, borderRadius: 12, border: '1px solid rgba(255,255,255,0.04)' }}>
                            <button onClick={() => { setShowCompleted(false); setShowEarnings(false); }} className={(!showCompleted && !showEarnings) ? 'btn btn-primary' : 'btn btn-secondary'} style={{ minWidth: 110, padding: '8px 14px', borderRadius: 8, fontWeight: 800 }}>
                                Active
                            </button>
                            <button onClick={() => { setShowCompleted(true); setShowEarnings(false); }} className={showCompleted ? 'btn btn-primary' : 'btn btn-secondary'} style={{ minWidth: 110, padding: '8px 14px', borderRadius: 8, fontWeight: 800 }}>
                                Completed
                            </button>
                            <button onClick={() => { setShowCompleted(false); setShowEarnings(true); setShowEarningsDetails(false); }} className={showEarnings ? 'btn btn-primary' : 'btn btn-secondary'} style={{ minWidth: 110, padding: '8px 14px', borderRadius: 8, fontWeight: 800 }}>
                                Earnings
                            </button>
                        </div>
                    )}

                    {type === 'hosted' && (
                        <button 
                            onClick={() => navigate('/host')} 
                            className="btn btn-primary" 
                            style={{ 
                                padding: '14px 32px',
                                fontSize: '15px',
                                fontWeight: 700,
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '10px',
                                whiteSpace: 'nowrap',
                                alignSelf: 'flex-start',
                                marginTop: '8px'
                            }}
                        >
                            <Car size={18} /> Host New Ride
                        </button>
                    )}
                </div>
            </div>

            {loading ? <div style={{ textAlign: 'center', padding: '100px 0' }}><Loader className="animate-spin text-blue-500" size={40} style={{ margin: 'auto' }} /></div> : (
                <div className="grid-cols" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '30px' }}>
                    {type === 'hosted' ? (
                        <>
                                {showEarnings ? (
                                    <div style={{ gridColumn: '1 / -1' }}>
                                        <h3 style={{ color: 'var(--text-primary)', marginBottom: 12 }}>Earnings</h3>

                                        <div className="card" style={{ padding: 20, marginBottom: 20, border: '1px solid var(--glass-border)' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                                                <div>
                                                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Total (selected period)</div>
                                                    <div style={{ fontSize: 28, fontWeight: 900, color: 'var(--text-primary)' }}>
                                                        {earningsLoading ? 'Loading...' : `₹${Number(earningsPeriodTotal || 0).toFixed(2)}`}
                                                    </div>
                                                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Driver earnings received (GST & platform excluded)</div>

                                                </div>

                                                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                                                    <select value={filterMode} onChange={e => setFilterMode(e.target.value)} style={{ padding: 8, borderRadius: 8 }}>
                                                        <option value="month">This Month / Select Month</option>
                                                        <option value="year">Year</option>
                                                        <option value="range">Date Range</option>
                                                    </select>

                                                    {filterMode === 'month' && (
                                                        <>
                                                            <select value={filterMonth} onChange={e => setFilterMonth(Number(e.target.value))} style={{ padding: 8, borderRadius: 8 }}>
                                                                {[...Array(12)].map((_, i) => <option key={i+1} value={i+1}>{new Date(0, i).toLocaleString(undefined, { month: 'long' })}</option>)}
                                                            </select>
                                                            <select value={filterYear} onChange={e => setFilterYear(Number(e.target.value))} style={{ padding: 8, borderRadius: 8 }}>
                                                                {Array.from({ length: 6 }).map((_, i) => { const y = new Date().getFullYear() - i; return <option key={y} value={y}>{y}</option>; })}
                                                            </select>
                                                        </>
                                                    )}

                                                    {filterMode === 'year' && (
                                                        <select value={filterYear} onChange={e => setFilterYear(Number(e.target.value))} style={{ padding: 8, borderRadius: 8 }}>
                                                            {Array.from({ length: 6 }).map((_, i) => { const y = new Date().getFullYear() - i; return <option key={y} value={y}>{y}</option>; })}
                                                        </select>
                                                    )}

                                                    {filterMode === 'range' && (
                                                        <>
                                                            <input type="date" value={startDateFilter} onChange={e => setStartDateFilter(e.target.value)} style={{ padding: 8, borderRadius: 8 }} />
                                                            <input type="date" value={endDateFilter} onChange={e => setEndDateFilter(e.target.value)} style={{ padding: 8, borderRadius: 8 }} />
                                                        </>
                                                    )}

                                                    <button className="btn btn-primary" onClick={() => { setEarningsPage(1); fetchEarnings(); setShowEarningsDetails(false); }} style={{ padding: '8px 12px' }}>Apply</button>
                                                    <button className="btn btn-secondary" onClick={() => setShowEarningsDetails(s => !s)} style={{ padding: '8px 12px' }}>{showEarningsDetails ? 'Hide details' : 'View details'}</button>
                                                    <button className="btn btn-ghost" onClick={() => setShowEarningsDebug(s => !s)} style={{ padding: '8px 12px', border: '1px dashed rgba(255,255,255,0.04)' }}>{showEarningsDebug ? 'Hide debug' : 'Debug'}</button>
                                                </div>
                                            </div>

                                            <div style={{ marginTop: 16 }}>
                                                {!showEarningsDetails ? (
                                                    <div style={{ color: 'var(--text-muted)' }}>
                                                        Apply filters to update the total. Click "View details" to see the chart and breakdown.
                                                    </div>
                                                ) : (
                                                    <div>
                                                        <EarningsChart data={computeChartPoints(earningsFiltered)} height={120} />
                                                    </div>
                                                )}

                                                {showEarningsDebug && earningsDebug && (
                                                    <div className="card" style={{ padding: 12, marginTop: 12, border: '1px solid var(--glass-border)' }}>
                                                        <h4 style={{ marginTop: 0 }}>Earnings Debug</h4>
                                                        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                                                            <div style={{ minWidth: 160 }}><strong>Raw txs:</strong> {earningsDebug.rawCount}</div>
                                                            <div style={{ minWidth: 160 }}><strong>With date:</strong> {earningsDebug.normalizedWithDateCount}</div>
                                                            <div style={{ minWidth: 160 }}><strong>Credited:</strong> {earningsDebug.creditedCount}</div>
                                                            <div style={{ minWidth: 160 }}><strong>Excluded (no date):</strong> {earningsDebug.excludedNoDateCount}</div>
                                                            <div style={{ minWidth: 160 }}><strong>Filtered:</strong> {earningsDebug.filteredCount}</div>
                                                            <div style={{ minWidth: 200 }}><strong>Period total:</strong> ₹{Number(earningsDebug.periodTotal || 0).toFixed(2)}</div>
                                                            <div style={{ minWidth: 200 }}><strong>Driver all total:</strong> ₹{Number(earningsDebug.driverAllTotal || 0).toFixed(2)}</div>
                                                        </div>


                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {showEarningsDetails && (
                                            <div className="card" style={{ padding: 12, border: '1px solid var(--glass-border)' }}>
                                                <h4 style={{ marginTop: 0 }}>Earnings Details</h4>
                                                <div style={{ overflowX: 'auto' }}>
                                                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                                        <thead>
                                                            <tr style={{ textAlign: 'left', color: 'var(--text-muted)', fontSize: 12 }}>
                                                                <th style={{ padding: 8 }}>Date</th>
                                                                <th style={{ padding: 8 }}>Filter date</th>
                                                                <th style={{ padding: 8 }}>Ride</th>
                                                                <th style={{ padding: 8 }}>Passenger</th>
                                                                <th style={{ padding: 8 }}>Amount (₹)</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {earningsLoading ? <tr><td colSpan={5} style={{ padding: 20 }}>Loading...</td></tr> : (
                                                                (earningsFiltered.slice((earningsPage-1)*EARNINGS_PER_PAGE, earningsPage*EARNINGS_PER_PAGE) || []).map((tx, idx) => (
                                                                    <tr key={idx} style={{ borderTop: '1px solid var(--glass-border)' }}>
                                                                        <td style={{ padding: 8 }}>{formatDateOnly(tx.journeyDate || tx.date || tx.createdAt || tx.paymentCompletedAt)}</td>
                                                                        <td style={{ padding: 8 }}>{(function(){ const d = tx.paymentCompletedAt || tx.date || tx.createdAt || tx.settlementDate || tx.settledAt || tx.timestamp || tx.journeyDate || null; return d ? new Date(d).toISOString().split('T')[0] : '—'; })()}</td>
                                                                        <td style={{ padding: 8 }}>{tx.source || tx.fromLocation || '—'} → {tx.destination || tx.toLocation || '—'}</td>
                                                                        <td style={{ padding: 8 }}>{tx.passengerName || tx.requesterName || tx.payer || '-'}</td>
                                                                        <td style={{ padding: 8, fontWeight: 800 }}>₹{Number(tx.amount || tx.netAmount || tx.value || 0).toFixed(2)}</td>
                                                                    </tr>
                                                                ))
                                                            )}
                                                        </tbody>
                                                    </table>
                                                </div>

                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
                                                    <div style={{ color: 'var(--text-muted)' }}>Showing page {earningsPage}</div>
                                                    <div style={{ display: 'flex', gap: 8 }}>
                                                        <button className="btn btn-secondary" disabled={earningsPage <= 1} onClick={() => setEarningsPage(p => Math.max(1, p-1))}>Prev</button>
                                                        <button className="btn btn-primary" disabled={(earningsPage*EARNINGS_PER_PAGE) >= earningsFiltered.length} onClick={() => setEarningsPage(p => p+1)}>Next</button>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ) : showCompleted ? (
                                    <div style={{ gridColumn: '1 / -1', marginTop: 24 }}>
                                        <h3 style={{ color: 'var(--text-primary)', marginBottom: 12 }}>Completed Rides</h3>
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '30px' }}>
                                            {completedHosted.map(ride => (
                                                <div key={ride.id} className="card" style={{ display: 'flex', flexDirection: 'column', gap: '12px', background: 'var(--card-bg)', border: '1px solid var(--glass-border)', padding: '18px', minHeight: 220 }}>
                                                    <div style={{ marginBottom: 6 }}>
                                                        <div style={{ background: 'var(--success-bg)', padding: 12, borderRadius: 12, color: 'var(--success-text)', fontWeight: 700, display: 'flex', gap: '10px', alignItems: 'center', border: '1px solid var(--success-border)' }}>
                                                            <CheckCircle size={18} />
                                                            <div style={{ fontSize: 13 }}> <div style={{ fontSize: 13 }}>
    Ride completed successfully. Please rate your passengers.
</div>
 </div>
                                                        </div>
                                                    </div>

                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                                        <div style={{ flex: 1 }}>
                                                            <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)' }}>{ride.fromLocation} ➔ {ride.toLocation}</div>
                                                            <div style={{ fontSize: '13px',  color: 'var(--text-secondary)',fontWeight: 700,marginTop: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                                <Calendar size={15} className="text-blue-500" /> {ride.dateTime ? new Date(ride.dateTime).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : '—'}
                                                                {ride.estimatedCompletionDateTime && (
                                                                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 700 }}>• Est: {new Date(ride.estimatedCompletionDateTime).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</div>
                                                                )}
                                                            </div>
                                                        </div>
                                                        <div style={{ textAlign: 'right' }}>
                                                            <div style={{ fontSize: '22px', fontWeight: 900, color: 'white' }}></div>
                                                        </div>
                                                    </div>

                                                    <div style={{ display: 'flex', gap: '12px', marginTop: 'auto' }}>
                                                        <button onClick={() => setMapRide(ride)} className="btn btn-secondary" style={{ flex: 1, padding: '12px', fontSize: '12px' }}><MapIcon size={14} className="mr-2" />Route</button>
                                                        <button onClick={() => handleOpenPassengers(ride)} className="btn" style={{ flex: 1, padding: '12px', fontSize: '12px', background: '#facc15', color: '#000', fontWeight: 900 }}><Star size={14} className="mr-2" /> Rate</button>
                                                        <button onClick={() => handleOpenPassengers(ride)} className="btn btn-secondary" style={{ flex: 1, padding: '12px', fontSize: '12px' }}>Passengers</button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ) : (
                                    <div style={{ gridColumn: '1 / -1' }}>
                                        <h3 style={{ color: 'var(--text-primary)', marginBottom: 12 }}>Active Rides</h3>
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '30px' }}>
                                            {activeHosted.map(ride => (
                                                <div key={ride.id} className="card" style={{ display: 'flex', flexDirection: 'column', gap: '20px', background: 'var(--card-bg)', border: '1px solid var(--glass-border)', padding: '28px', minHeight: 220 }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                                        <div style={{ flex: 1 }}>
                                                            <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)' }}>{ride.fromLocation} ➔ {ride.toLocation}</div>
                                                            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                                <Calendar size={15} className="text-blue-500" /> {ride.dateTime ? new Date(ride.dateTime).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : '—'}
                                                            {ride.estimatedCompletionDateTime && (
                                                                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginLeft: '8px' }}>• Est: {new Date(ride.estimatedCompletionDateTime).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</div>
                                                            )}
                                                            </div>
                                                        </div>
                                                        <div style={{ textAlign: 'right' }}>
                                                            <div style={{ fontSize: '22px', fontWeight: 900, color: 'white' }}></div>
                                                        </div>
                                                    </div>

                                                    <div style={{ display: 'flex', gap: '12px', marginTop: 'auto' }}>
                                                        <button onClick={() => setMapRide(ride)} className="btn btn-secondary" style={{ flex: 1, padding: '12px', fontSize: '12px' }}><MapIcon size={14} className="mr-2" />Route</button>
                                                        <button onClick={() => handleOpenRequests(ride.id)} className="btn btn-primary" style={{ flex: 1, padding: '12px', fontSize: '12px' }}>Requests</button>
                                                        <button onClick={() => handleOpenPassengers(ride)} className="btn btn-secondary" style={{ flex: 1, padding: '12px', fontSize: '12px' }}>Passengers</button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                        </>
                    ) : (
                        <>
                            {data.map(item => {
                                const ride = item.rideDetails;
                                if (!ride) return null;
                                return (
                                    <div key={item.id} className="card" style={{ display: 'flex', flexDirection: 'column', gap: '20px', background: 'var(--card-bg)', border: '1px solid var(--glass-border)', padding: '24px' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                            <div style={{ flex: 1 }}>
                                                <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)' }}>{ride.fromLocation} ➔ {ride.toLocation}</div>
                                                <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <Calendar size={15} className="text-blue-500" /> {new Date(ride.dateTime).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                                                </div>
                                                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>
                                                    Driver: {(userMap[ride.ownerId] && (userMap[ride.ownerId].fullname || userMap[ride.ownerId].email)) || ride.ownerName || 'Driver'} • {(userMap[ride.ownerId] && (userMap[ride.ownerId].phone || userMap[ride.ownerId].email)) || ride.ownerEmail || '-'}
                                                </div>
                                            </div>
                                            <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
    
    <div style={{ marginTop: '8px' }}>
        {getStatusLabel(item.status)}
    </div>

    {submittedRatings[item.id] && (
        <div style={{ fontSize: 13, color: '#facc15', marginTop: 6, fontWeight: 800 }}>
            Your rating: {submittedRatings[item.id].stars} ★
        </div>
    )}

</div>

                                            
                                        </div>

                                        {item.status === 'CONFIRMED' && (
                                            <div style={{ background: 'rgba(16, 185, 129, 0.05)', border: '1px solid rgba(16, 185, 129, 0.2)', padding: '12px', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                <ShieldCheck size={18} className="text-emerald-500" />
                                                <span style={{ fontSize: '11px', color: '#10b981', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Payment Verified • Seat Secured</span>
                                            </div>
                                        )}

                                        <div style={{ display: 'flex', gap: '12px', marginTop: 'auto' }}>
                                            <button onClick={() => setMapRide(ride)} className="btn btn-secondary" style={{ flex: 1, padding: '12px', fontSize: '12px' }}><MapIcon size={14} className="mr-2" />Route</button>

                                            {item.status === 'ACCEPTED' && (
                                                <button onClick={() => startPayment(item)} className="btn" style={{ flex: 1.5, background: '#10b981', color: 'white', fontSize: '12px', fontWeight: 800, padding: '12px' }}>
                                                    <Smartphone size={14} className="mr-2" />Make Payment
                                                </button>
                                            )}

                                            {item.status === 'CONFIRMED' && (
                                                <>
                                                    <button
                                                        onClick={() => setTrackingBooking(item)}
                                                        className="btn btn-primary"
                                                        style={{ flex: 1.2, padding: '12px', fontSize: '12px' }}
                                                    >
                                                        Track Status
                                                    </button>

                                                    {new Date(item.rideDetails.dateTime) < new Date() && (
                                                        submittedRatings[item.id] ? (
                                                            <button className="btn btn-secondary" style={{ flex: 1, padding: '12px', fontSize: '12px' }} disabled>
                                                                ⭐ Rated {submittedRatings[item.id].stars} ★
                                                            </button>
                                                        ) : (
                                                            <button
                                                                onClick={() => setRatingBooking(item)}
                                                                className="btn"
                                                                style={{
                                                                    flex: 1,
                                                                    background: '#facc15',
                                                                    color: '#000',
                                                                    fontWeight: 900,
                                                                    fontSize: '12px'
                                                                }}
                                                            >
                                                                ⭐ Rate
                                                            </button>
                                                        )
                                                    )}
                                                </>
                                            )}

                                            {item.status === 'COMPLETED' && (
                                                <>
                                                    <button onClick={() => setTrackingBooking(item)} className="btn btn-primary" style={{ padding: '12px', fontSize: '12px' }}>
                                                        <Info size={14} className="mr-2" />Payment details
                                                    </button>

                                                    {submittedRatings[item.id] ? (
                                                        <button className="btn btn-secondary" style={{ padding: '12px', fontSize: '12px' }} disabled>
                                                            ⭐ Rated {submittedRatings[item.id].stars} ★
                                                        </button>
                                                    ) : (
                                                        <button
                                                            onClick={() => setRatingBooking(item)}
                                                            className="btn"
                                                            style={{
                                                                padding: '12px',
                                                                background: '#facc15',
                                                                color: '#000',
                                                                fontWeight: 900,
                                                                fontSize: '12px'
                                                            }}
                                                        >
                                                            ⭐ Rate
                                                        </button>
                                                    )}
                                                </>
                                            )}
                                        </div>
                                                    </div>
                                );
                            })}

                            {data.length === 0 && (
                                <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '100px 20px', border: '2px dashed var(--border)', borderRadius: '32px', background: 'var(--bg-secondary)' }}>
                                    <Car size={60} style={{ color: 'var(--text-muted)', opacity: 0.3, margin: '0 auto 20px' }} />
                                    <h3 style={{ color: 'var(--text-muted)', marginBottom: '20px' }}>No activity found in this section.</h3>
                                    <button onClick={() => navigate(type === 'hosted' ? '/host' : '/book')} className="btn btn-primary" style={{ width: 'auto', padding: '14px 40px' }}>
                                        {type === 'hosted' ? "Host Your First Ride" : "Find a Journey"}
                                    </button>
                                </div>
                            )}
                        </>
                    )}
                </div>
                
            )}

            {/* --- MODAL: PAYMENT GATEWAY --- */}
            {paymentBooking && (
                <div className="modal-overlay">
                    <div className="card" style={{ maxWidth: '440px', width: '95%', padding: 0, overflow: 'hidden', background: 'var(--card-bg)', border: `1px solid var(--border)` }}>
                        <div style={{ background: 'var(--bg-secondary)', padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `1px solid var(--border)` }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                {paymentView !== 'method' && paymentView !== 'success' && <ArrowLeft size={18} className="cursor-pointer text-white" onClick={() => setPaymentView('method')} />}
                                <div style={{ background: '#3b82f6', padding: '6px', borderRadius: '8px' }}><Lock size={16} color="white" /></div>
                                <span style={{ fontWeight: 700, fontSize: '15px', color: 'var(--text)' }}>Secure Checkout</span>
                            </div>
                            <X size={20} className="cursor-pointer" style={{ color: 'var(--text-muted)' }} onClick={() => setPaymentBooking(null)} />
                        </div>
                        <div style={{ padding: '32px' }}>
                            {paymentView !== 'success' && (
                                <div style={{ textAlign: 'center', marginBottom: '32px' }}>
                                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>Payable Amount</div>
                                    <div style={{ fontSize: '42px', fontWeight: 900, color: 'var(--text)' }}>
                                        ₹{computeFare(paymentBooking?.rideDetails || {}, paymentBooking?.seatsRequested || 1).total}
                                    </div>

                                    {/* Breakdown */}
                                    <div style={{ marginTop: 10, color: 'var(--text-muted)', fontSize: 13 }}>
                                        {(() => {
                                            const f = computeFare(paymentBooking?.rideDetails || {}, paymentBooking?.seatsRequested || 1);
                                            return (
                                                <div style={{ lineHeight: '1.4' }}>
                                                    <div>Base fare: ₹{f.base.toFixed(2)}</div>
                                                    <div>Platform fee (5%): ₹{f.platformFee.toFixed(2)}</div>
                                                    <div>GST (3.6% total — CGST 1.8% + SGST 1.8%): ₹{f.gstTotal.toFixed(2)} (CGST ₹{f.cgst.toFixed(2)} + SGST ₹{f.sgst.toFixed(2)})</div>
                                                </div>
                                            );
                                        })()}
                                    </div>
                                </div>
                            )}

                            {paymentView === 'method' && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                                    <button onClick={() => setPaymentView('upi_qr')} className="btn btn-secondary" style={{ justifyContent: 'flex-start', padding: '18px', gap: '15px', background: 'var(--bg-secondary)', border: `1px solid var(--border)`, color: 'var(--text)' }}>
                                        <QrCode size={20} className="text-blue-500" />
                                        <div style={{ textAlign: 'left', flex: 1 }}>
                                            <div style={{ fontWeight: 700, fontSize: '14px', color: 'var(--text)' }}>UPI QR Code</div>
                                            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Scan QR with GPay, PhonePe, Paytm</div>
                                        </div>
                                        <ChevronRight size={18} style={{ color: 'var(--text-muted)' }} />
                                    </button>
                                    <button onClick={() => setPaymentView('card')} className="btn btn-secondary" style={{ justifyContent: 'flex-start', padding: '18px', gap: '15px', background: 'var(--bg-secondary)', border: '2px solid var(--primary)', color: 'var(--text)' }}>
                                        <CardIcon size={20} className="text-emerald-500" />
                                        <div style={{ textAlign: 'left', flex: 1 }}>
                                            <div style={{ fontWeight: 700, fontSize: '14px', color: 'var(--text)' }}>Credit / Debit Card</div>
                                            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Secure Stripe card checkout</div>
                                        </div>
                                        <ChevronRight size={18} className="text-zinc-500" />
                                    </button>
                                    <button onClick={() => setPaymentView('netbanking')} className="btn btn-secondary" style={{ justifyContent: 'flex-start', padding: '18px', gap: '15px', background: 'rgba(255,255,255,0.02)' }}>
                                        <Landmark size={20} className="text-amber-500" />
                                        <div style={{ textAlign: 'left', flex: 1 }}>
                                            <div style={{ fontWeight: 700, fontSize: '14px', color: 'white' }}>Net Banking</div>
                                            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>All major Indian banks</div>
                                        </div>
                                        <ChevronRight size={18} className="text-zinc-500" />
                                    </button>
                                    <button onClick={() => setPaymentView('wallet')} className="btn btn-secondary" style={{ justifyContent: 'flex-start', padding: '18px', gap: '15px', background: 'rgba(255,255,255,0.02)' }}>
                                        <Wallet size={20} className="text-pink-500" />
                                        <div style={{ textAlign: 'left', flex: 1 }}>
                                            <div style={{ fontWeight: 700, fontSize: '14px', color: 'white' }}>Digital Wallets</div>
                                            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Amazon Pay, PhonePe, Paytm</div>
                                        </div>
                                        <ChevronRight size={18} className="text-zinc-500" />
                                    </button>
                                </div>
                            )}

                            {paymentView === 'upi_qr' && (
                                <div className="text-center animate-fade">
                                    <div style={{ background: 'white', padding: '16px', borderRadius: '20px', display: 'inline-block', marginBottom: '24px', border: '1px solid #eee' }}>
                                        <img src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(`upi://pay?pa=velocity.ride@upi&pn=VeloCity&am=${(paymentBooking?.rideDetails?.price ?? 0) * (paymentBooking?.seatsRequested ?? 1)}&cu=INR`)}`} alt="UPI QR" style={{ width:'180px', height:'180px' }} />
                                    </div>
                                    <div className="mb-6 text-left">
                                        <label style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 700, marginBottom: '8px', display: 'block' }}>Transaction ID (UTR)</label>
                                        <input placeholder="Enter 12-digit number" value={utr} onChange={e => setUtr(e.target.value.replace(/\D/g, '').slice(0, 12))} style={{ background: 'var(--input-bg)', border: '1px solid var(--border)', borderRadius: '12px', padding: '14px', color: 'var(--text)', width: '100%', fontSize: '16px', letterSpacing: '1px' }} />
                                        {verifyError && <div className="flex gap-2 items-center mt-3 text-red-500 text-[11px] font-bold" style={{ background: 'rgba(239, 68, 68, 0.1)', padding: '8px', borderRadius: '8px' }}><AlertCircle size={14}/> {verifyError}</div>}
                                    </div>
                                    <button onClick={() => handleConfirmPayment()} className="btn btn-primary" style={{ width: '100%', padding: '16px' }} disabled={isVerifying}>
                                        {isVerifying ? <div className="flex items-center justify-center gap-2"><Loader className="animate-spin" size={18} /> Verifying...</div> : "I have sent payment"}
                                    </button>
                                </div>
                            )}

                            {paymentView === 'upi_id' && (
                                <div className="animate-fade">
                                    <div className="mb-4">
                                        <label style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 700, marginBottom: '8px', display: 'block' }}>Enter UPI ID</label>
                                        <input placeholder="yourname@upi" value={upiIdInput} onChange={e => setUpiIdInput(e.target.value)} style={{ background: 'var(--input-bg)', border: '1px solid var(--border)', borderRadius: '12px', padding: '14px', color: 'var(--text)', width: '100%', fontSize: '16px' }} />
                                    </div>
                                    <div className="mb-6">
                                        <label style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 700, marginBottom: '8px', display: 'block' }}>Transaction ID (UTR)</label>
                                        <input placeholder="12-digit number" value={utr} onChange={e => setUtr(e.target.value.replace(/\D/g, '').slice(0, 12))} style={{ background: 'var(--input-bg)', border: '1px solid var(--border)', borderRadius: '12px', padding: '14px', color: 'var(--text)', width: '100%', fontSize: '16px', letterSpacing: '1px' }} />
                                    </div>
                                    {verifyError && <div className="flex gap-2 items-center mb-4 text-red-500 text-[11px] font-bold" style={{ background: 'rgba(239, 68, 68, 0.1)', padding: '8px', borderRadius: '8px' }}><AlertCircle size={14}/> {verifyError}</div>}
                                    <button onClick={() => handleConfirmPayment()} className="btn btn-primary" style={{ width: '100%', padding: '16px' }} disabled={isVerifying}>
                                        {isVerifying ? <Loader className="animate-spin" size={18} /> : "Verify Payment"}
                                    </button>
                                </div>
                            )}

                            {paymentView === 'card' && (
                                <div className="animate-fade">
                                    <AdvancedCardPaymentForm 
                                        paymentBooking={paymentBooking}
                                        onSuccess={(txId) => handleConfirmPayment(txId)}
                                        onError={(err) => setVerifyError(err)}
                                        disabled={isVerifying}
                                    />
                                </div>
                            )}

                            {paymentView === 'netbanking' && (
                                <div className="animate-fade">
                                    <label style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 700, marginBottom: '12px', display: 'block' }}>Select Bank</label>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '24px' }}>
                                        {['HDFC Bank', 'ICICI Bank', 'SBI', 'Axis Bank', 'KOTAK Bank'].map(bank => (
                                            <div 
                                                key={bank} 
                                                onClick={() => setSelectedBank(bank)}
                                                style={{ 
                                                    padding: '12px 16px', 
                                                    background: selectedBank === bank ? 'rgba(59, 130, 246, 0.1)' : 'var(--bg-secondary)', 
                                                    border: selectedBank === bank ? '1px solid #3b82f6' : `1px solid var(--border)`,
                                                    borderRadius: '10px',
                                                    cursor: 'pointer',
                                                    color: 'var(--text)',
                                                    fontSize: '14px',
                                                    display: 'flex',
                                                    justifyContent: 'space-between',
                                                    alignItems: 'center'
                                                }}
                                            >
                                                {bank}
                                                {selectedBank === bank && <CheckCircle size={16} className="text-blue-500" />}
                                            </div>
                                        ))}
                                    </div>
                                    {verifyError && <div className="flex gap-2 items-center mb-4 text-red-500 text-[11px] font-bold"><AlertCircle size={14}/> {verifyError}</div>}
                                    <button onClick={() => handleConfirmPayment()} className="btn btn-primary" style={{ width: '100%', padding: '16px' }} disabled={isVerifying}>
                                        {isVerifying ? <Loader className="animate-spin" size={18} /> : "Continue to Bank"}
                                    </button>
                                </div>
                            )}

                            {paymentView === 'wallet' && (
                                <div className="animate-fade">
                                    <label style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 700, marginBottom: '12px', display: 'block' }}>Select Wallet</label>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '24px' }}>
                                        {['Paytm', 'PhonePe', 'Amazon Pay'].map(wallet => (
                                            <div 
                                                key={wallet} 
                                                onClick={() => setSelectedWallet(wallet)}
                                                style={{ 
                                                    padding: '12px 16px', 
                                                    background: selectedWallet === wallet ? 'rgba(236, 72, 153, 0.1)' : 'var(--bg-secondary)', 
                                                    border: selectedWallet === wallet ? '1px solid #ec4899' : `1px solid var(--border)`,
                                                    borderRadius: '10px',
                                                    cursor: 'pointer',
                                                    color: 'var(--text)',
                                                    fontSize: '14px',
                                                    display: 'flex',
                                                    justifyContent: 'space-between',
                                                    alignItems: 'center'
                                                }}
                                            >
                                                {wallet}
                                                {selectedWallet === wallet && <CheckCircle size={16} className="text-pink-500" />}
                                            </div>
                                        ))}
                                    </div>
                                    {verifyError && <div className="flex gap-2 items-center mb-4 text-red-500 text-[11px] font-bold"><AlertCircle size={14}/> {verifyError}</div>}
                                    <button onClick={() => handleConfirmPayment()} className="btn btn-primary" style={{ width: '100%', padding: '16px' }} disabled={isVerifying}>
                                        {isVerifying ? <Loader className="animate-spin" size={18} /> : "Link & Pay"}
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* --- MODAL: TRACKING STATUS --- */}
            {trackingBooking && (
                <div className="modal-overlay">
                    <div className="card" style={{ maxWidth: '500px', width: '95%', background: 'var(--card-bg)', padding: '32px', border: `1px solid var(--border)`, color: 'var(--text)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '32px', alignItems: 'center' }}>
                            <h3 style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text)', margin: 0 }}>Payment Tracking</h3>
                            <X className="cursor-pointer" style={{ color: 'var(--text-muted)' }} size={24} onClick={() => setTrackingBooking(null)} />
                        </div>
                        
                        {trackingBooking.rideDetails && (
                            <div style={{ background: 'rgba(59, 130, 246, 0.05)', border: '1px solid rgba(59, 130, 246, 0.2)', borderRadius: '12px', padding: '16px', marginBottom: '24px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Journey:</span>
                                    <span style={{ fontSize: '12px', color: 'var(--text)', fontWeight: 700 }}>{trackingBooking.rideDetails.fromLocation} → {trackingBooking.rideDetails.toLocation}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Seats:</span>
                                    <span style={{ fontSize: '12px', color: 'var(--text)', fontWeight: 700 }}>{trackingBooking.seatsRequested || 1}</span>
                                </div>
                                {trackingBooking.paymentCompletedAt ? (
                                    (() => {
                                        const fareObj = computeFare(trackingBooking.rideDetails || {}, trackingBooking.seatsRequested || 1);
                                        return (
                                            <div style={{ padding: '8px 12px', borderRadius: 8, background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                                                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Base Fare</span>
                                                    <span style={{ fontSize: '12px', color: 'var(--text)' }}>₹{fareObj.base.toFixed(2)}</span>
                                                </div>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                                                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Platform Fee (5%)</span>
                                                    <span style={{ fontSize: '12px', color: 'var(--text)' }}>₹{(fareObj.platformFees ?? fareObj.platformFee ?? 0).toFixed ? (fareObj.platformFees ?? fareObj.platformFee).toFixed(2) : (fareObj.platformFees ?? fareObj.platformFee)}</span>
                                                </div>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                                                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>CGST (1.8%)</span>
                                                    <span style={{ fontSize: '12px', color: 'var(--text)' }}>₹{(fareObj.cgst || 0).toFixed(2)}</span>
                                                </div>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                                                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>SGST (1.8%)</span>
                                                    <span style={{ fontSize: '12px', color: 'var(--text)' }}>₹{(fareObj.sgst || 0).toFixed(2)}</span>
                                                </div>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px dashed var(--border)', paddingTop: 8 }}>
                                                    <strong style={{ fontSize: '12px' }}>Total Paid</strong>
                                                    <strong style={{ fontSize: '14px', color: 'var(--success)' }}>₹{(fareObj.total || 0).toFixed(2)}</strong>
                                                </div>
                                            </div>
                                        );
                                    })()
                                ) : (
                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Amount</span>
                                        <span style={{ fontSize: '16px', color: 'var(--text)', fontWeight: 700 }}>₹{(trackingBooking.rideDetails.price || 0) * (trackingBooking.seatsRequested || 1)}</span>
                                    </div>
                                )}
                            </div>
                        )}

                        <div className="flex flex-col gap-10 relative px-2">
                            <div style={{ position:'absolute', left:'15px', top:'20px', bottom:'20px', width:'2px', background: 'var(--border-soft)' }}></div>
                            <div className="flex gap-5 items-start relative z-10">
                                <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center border-4 border-[var(--border-soft)]
 shadow-lg"><Clock size={16} color="white" /></div>
                                <div style={{ flex: 1 }}>
                                    <div className="font-bold text-sm text-[color:var(--text-primary)]">Payment Initiated</div>
                                    <div className="text-[11px] font-medium mt-1 text-[color:var(--text-secondary)]">
                                        {trackingBooking.paymentInitiatedAt ? new Date(trackingBooking.paymentInitiatedAt).toLocaleString() : '---'}
                                    </div>
                                </div>
                            </div>
                            <div className="flex gap-5 items-start relative z-10">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center border-4 border-[var(--border-soft)]
 shadow-lg ${trackingBooking.paymentCompletedAt ? 'bg-emerald-500' : 'bg-zinc-800'}`}>
                                    <CreditCard size={16} color="white" />
                                </div>
                                <div style={{ flex: 1 }}>
                                    <div className="font-bold text-sm text-[color:var(--text-primary)]">Transaction Completed</div>
                                    <div className="text-[11px] font-medium mt-1 text-[color:var(--text-secondary)]">
                                        {trackingBooking.transactionId ? `Transaction ID: ${trackingBooking.transactionId}` : 'Awaiting Receipt'}
                                    </div>
                                    {trackingBooking.paymentCompletedAt && (
                                        <div className="text-[11px] mt-1 text-[color:var(--text-secondary)]">
                                            Paid on: {new Date(trackingBooking.paymentCompletedAt).toLocaleString()}
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div className="flex gap-5 items-start relative z-10">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center border-4 border-[var(--border-soft)]
 shadow-lg ${trackingBooking.confirmedAt ? 'bg-emerald-500' : 'bg-zinc-800'}`}>
                                    <ShieldCheck size={16} color="white" />
                                </div>
                                <div style={{ flex: 1 }}>
                                    <div className="font-bold text-sm text-[color:var(--text-primary)]">Seat Secured & Confirmed</div>
                                    <div className="text-[11px] font-medium mt-1 text-[color:var(--text-secondary)]">
                                        {trackingBooking.confirmedAt ? `Confirmed at ${new Date(trackingBooking.confirmedAt).toLocaleString()}` : 'System verifying...'}
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        <div style={{ display: 'flex', gap: '12px', marginTop: '32px' }}>
                            <button 
                                onClick={() => {
                                    if (trackingBooking.rideDetails) {
                                        generateInvoicePDF(trackingBooking, trackingBooking.rideDetails);
                                    } else {
                                        apiGet(`/api/rides/${trackingBooking.rideId}`).then(ride => {
                                            generateInvoicePDF(trackingBooking, ride);
                                        }).catch(() => alert('Unable to generate invoice.'));
                                    }
                                }}
                                className="btn btn-secondary" 
                                style={{ flex: 1, padding: '14px', gap: '8px' }}
                            >
                                <Download size={16} />
                                Download Invoice
                            </button>
                            <button onClick={() => setTrackingBooking(null)} className="btn btn-primary" style={{ flex: 1, padding: '14px' }}>Close</button>
                        </div>
                    </div>
                </div>
            )}

            {/* --- MODAL: PASSENGERS --- */}
            {modalType === 'passengers' && (
                <div className="modal-overlay">
                    <div className="card" style={{ maxWidth: '550px', width: '95%', background: 'var(--card-bg)', padding: '32px', border: `1px solid var(--border)`, color: 'var(--text)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '32px', alignItems: 'center' }}>
                            <h3 style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text)', margin: 0 }}>Journey Passengers</h3>
                            <X className="cursor-pointer" style={{ color: 'var(--text-muted)' }} onClick={() => setModalType(null)} />
                        </div>
                        <div ref={passengersListRef} style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '55vh', overflowY: 'auto', paddingRight: 8, scrollBehavior: 'smooth' }}>
                            {passengersList.length === 0 ? <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '40px 0' }}>No confirmed passengers yet.</p> : passengersList.map(r => (
                                <div key={r.id} style={{ background: 'var(--bg-secondary)', padding: '16px', borderRadius: '16px', display: 'flex', flexDirection: 'column', gap: 8, border: r.status === 'CONFIRMED' ? '1px solid rgba(16, 185, 129, 0.3)' : `1px solid var(--border)` }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px', justifyContent: 'space-between' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                            <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: 'var(--bg-secondary)', border: `1px solid var(--border)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><User size={20} color="var(--text-muted)" /></div>
                                            <div>
                                                <div style={{ fontWeight: 700, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    {r.requesterName} 
                                                    {r.status === 'CONFIRMED' && <ShieldCheck size={16} className="text-emerald-500" />}
                                                </div>
                                                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>{r.seatsRequested} Seat(s) • {r.status}</div>
                                                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '6px' }}>
                                                    Contact: {r.requesterPhone || r.requesterEmail || '-'}
                                                </div>
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                            {['PENDING','ACCEPTED'].includes(r.status) ? (
                                                <button onClick={() => handleDecide(r.id, 'reject')} style={{ color: '#ef4444', background: 'rgba(239, 68, 68, 0.1)', border: 'none', cursor: 'pointer', padding: '10px', borderRadius: '12px' }}><Trash2 size={18}/></button>
                                            ) : (
                                                (selectedRideForPassengers && selectedRideForPassengers.dateTime && new Date(selectedRideForPassengers.dateTime) < new Date()) ? (
                                                    (submittedRatings[r.id] || (currentPassengerRatings && currentPassengerRatings.ratedByMe && currentPassengerRatings.ratedByMe[r.id])) ? (
                                                        <button className="btn btn-secondary btn-sm" disabled>Rated {submittedRatings[r.id] ? submittedRatings[r.id].stars : (currentPassengerRatings && currentPassengerRatings.ratedByMe ? currentPassengerRatings.ratedByMe[r.id] : '')} ★</button>
                                                    ) : (
                                                        <button onClick={() => setRatingPassenger(r)} className="btn btn-secondary btn-sm">Rate</button>
                                                    )
                                                ) : (
                                                    <span style={{ fontSize: '10px', fontWeight: 900, color: '#10b981', background: 'rgba(16, 185, 129, 0.1)', padding: '6px 12px', borderRadius: '8px', border: '1px solid rgba(16, 185, 129, 0.2)' }}>LOCKED</span>
                                                )
                                            )}
                                        </div>
                                    </div>

                                    {/* Inline rating field for this passenger */}
                                    {ratingPassenger && ratingPassenger.id === r.id && (
                                        <div style={{ marginTop: 6, background: 'var(--bg-secondary)', padding: 12, borderRadius: 8, border: '1px solid var(--border)' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <div>
                                                    <div style={{ fontWeight: 800, color: 'var(--text)' }}>Rate {r.requesterName}</div>
                                                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{r.requesterEmail || r.requesterPhone}</div>
                                                </div>
                                                <div style={{ display: 'flex', gap: 8 }}>
                                                    {[1,2,3,4,5].map(n=> (
                                                        <button key={n} onClick={() => setRatingStars(n)} style={{ fontSize: 18, background: 'none', border: 'none', cursor: 'pointer', color: n<=ratingStars ? '#facc15' : 'var(--text-muted)' }}>{'★'}</button>
                                                    ))}
                                                </div>
                                            </div>
                                            <textarea placeholder="Feedback (optional)" value={ratingNote} onChange={e => setRatingNote(e.target.value)} style={{ width: '100%', marginTop: 10, padding: 8, borderRadius: 8, background: 'var(--input-bg)', color: 'var(--text)', border: '1px solid var(--border)' }} />
                                            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                                                <button onClick={() => submitPassengerRating(r)} className="btn btn-primary" disabled={ratingLoading}>{ratingLoading ? 'Submitting...' : 'Submit Rating'}</button>
                                                <button onClick={() => setRatingPassenger(null)} className="btn btn-secondary">Cancel</button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* --- MODAL: REQUESTS --- */}
            {modalType === 'requests' && (
                <div className="modal-overlay">
                    <div className="card" style={{ maxWidth: '500px', width: '95%', background: 'var(--card-bg)', padding: '32px', border: `1px solid var(--border)`, color: 'var(--text)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '32px', alignItems: 'center' }}>
                            <h3 style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text)', margin: 0 }}>Pending Requests</h3>
                            <button onClick={() => setModalType(null)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)' }}><X size={24}/></button>
                        </div>
                        <div ref={requestsListRef} style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '55vh', overflowY: 'auto', paddingRight: 8, scrollBehavior: 'smooth' }}>
                            {requestsList.length === 0 ? <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '40px 0' }}>No new ride requests.</p> : requestsList.map(r => (
                                <div key={r.id} style={{ background: 'var(--bg-secondary)', padding: '20px', borderRadius: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: `1px solid var(--border)` }}>
                                    <div>
                                        <div style={{ fontWeight: 700, color: 'var(--text)', fontSize: '16px' }}>{r.requesterName}</div>
                                        <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                                            <span>{r.requesterEmail}</span>
                                            {r.requesterPhone && <span> • {r.requesterPhone}</span>}
                                            <div style={{ marginTop: '4px' }}>Requested {r.seatsRequested} Seat(s)</div>
                                        </div>
                                        <div style={{ fontSize: '12px', color: '#f59e0b', marginTop: '6px' }}>
                                            {(() => {
                                                const ru = userMap[r.requesterId];
                                                if (!ru) return 'Rating: —';
                                                return `Rating: ${ru.averageRating ?? '—'} ${ru.ratingCount ? `(${ru.ratingCount})` : ''} ★`;
                                            })()}
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', gap: '10px' }}>
                                        <button onClick={() => handleDecide(r.id, 'accept')} style={{ background: '#059669', color: 'white', fontSize: '11px', fontWeight: 800, padding: '10px 16px', borderRadius: '12px', border: 'none', cursor: 'pointer' }}>APPROVE</button>
                                        <button onClick={() => handleDecide(r.id, 'reject')} style={{ background: '#dc2626', color: 'white', fontSize: '11px', fontWeight: 800, padding: '10px 16px', borderRadius: '12px', border: 'none', cursor: 'pointer' }}>DECLINE</button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* --- MODAL: ROUTE MAP --- */}
            {mapRide && (
                <div className="modal-overlay" onClick={() => setMapRide(null)}>
                    <div onClick={(e) => e.stopPropagation()} className="card p-0 max-w-6xl w-full flex flex-col overflow-hidden" style={{ height: '85vh', width: '92%', background: 'var(--card-bg)', border: '1px solid var(--border)', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)' }}>
                        <div style={{ background: 'var(--bg-secondary)', padding: '20px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', zIndex: 20, position: 'relative' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <Navigation size={20} className="text-blue-500" />
                                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: 'var(--text)' }}>Journey visualization</h3>
                            </div>
                            <button onClick={() => setMapRide(null)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X/></button>
                        </div>
                        <div className="flex-1 relative" style={{ minHeight: '400px' }}>
                            {isMapping && (
                                <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 100, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '15px' }}>
                                    <Loader className="animate-spin text-blue-500" size={32} />
                                    <span style={{ fontSize: '11px', color: 'white', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '2px' }}>Tracing Route...</span>
                                </div>
                            )}

                            {routeError && (
                                <div style={{ position: 'absolute', inset: 16, zIndex: 150, display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-end' }}>
                                    <div style={{ background: 'rgba(0,0,0,0.7)', padding: 12, borderRadius: 10, border: '1px solid rgba(255,255,255,0.06)', color: 'white' }}>
                                        <div style={{ fontWeight: 800, marginBottom: 6 }}>Route Error</div>
                                        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>{routeError}</div>
                                        <div style={{ display: 'flex', gap: 8 }}>
                                            <button className="btn btn-primary" onClick={() => { setRouteError(null); setIsMapping(false); setMapKey(k => k + 1); fetchFullRoute(); }}>Retry</button>
                                            <button className="btn btn-secondary" onClick={() => { setMapRide(null); setRouteError(null); }}>Close</button>
                                        </div>
                                    </div>
                                </div>
                            )}

                            <RideMap key={mapKey} pickup={{ lat: mapRide.fromLat, lng: mapRide.fromLng }} drop={{ lat: mapRide.toLat, lng: mapRide.toLng }} stops={allStops} routeGeometry={routeGeom} />
                        </div>
                        
                    </div>
                </div>
            )}
            {/* Success Modal */}
            {/* Success Modal */}
{showSuccessModal.show && (
    <div className="modal-overlay" style={{ 
        position: 'fixed', 
        top: 0, 
        left: 0, 
        right: 0, 
        bottom: 0, 
        background: 'var(--modal-overlay)', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        zIndex: 10000 
    }}>
        <div className="card" style={{ 
            maxWidth: '400px', 
            textAlign: 'center', 
            padding: '40px', 
            background: 'var(--card-bg)', 
            border: `1px solid var(--border)`,
            borderRadius: '16px',
            boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
            color: 'var(--text)'
        }}>
            <div style={{ 
                width: '80px', 
                height: '80px', 
                borderRadius: '50%', 
                background: 'rgba(16, 185, 129, 0.1)', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                margin: '0 auto 20px' 
            }}>
                <CheckCircle size={40} color="#10b981"/>
            </div>
            <h3 style={{ 
                fontSize: '24px', 
                fontWeight: 'bold', 
                marginBottom: '10px', 
                color: 'white' 
            }}>
                {showSuccessModal.title || 'Success'}
            </h3>
            <p style={{ 
                color: 'var(--text-muted)', 
                marginBottom: '30px', 
                lineHeight: '1.6' 
            }}>
                {showSuccessModal.message}
            </p>
            <button 
                onClick={() => setShowSuccessModal({ show: false, title: '', message: "" })} 
                className="btn btn-primary" 
                style={{ 
                    width: '100%', 
                    padding: '14px',
                    fontSize: '16px',
                    fontWeight: 'bold'
                }}
            >
                Close
            </button>
        </div>
    </div>
)}
{ratingBooking && (
    <div className="modal-overlay">
        <div className="card" style={{ maxWidth: 620, width: '95%', background: 'var(--card-bg)', padding: 28, borderRadius: 16, color: 'var(--text)' }}>
            <h3 style={{ color: 'var(--text)', fontWeight: 800, marginBottom: 12 }}>
                Rate Your Ride
            </h3>

            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>
                {ratingBooking.rideDetails.fromLocation} → {ratingBooking.rideDetails.toLocation}
            </p>

            {/* Stars */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
                {[1,2,3,4,5].map(n => (
                    <span
                        key={n}
                        onClick={() => setStars(n)}
                        style={{
                            fontSize: 28,
                            cursor: 'pointer',
                            color: n <= stars ? '#facc15' : '#444'
                        }}
                    >
                        ★
                    </span>
                ))}
            </div>

            {/* Review */}
            <textarea
                placeholder="Write your experience (optional)"
                value={reviewText}
                onChange={e => setReviewText(e.target.value)}
                style={{
                    width: '100%',
                    minHeight: 90,
                    background: 'var(--input-bg)',
                    border: '1px solid var(--border)',
                    borderRadius: 12,
                    padding: 12,
                    color: 'var(--text)',
                    marginBottom: 20
                }}
            />

            <div style={{ display: 'flex', gap: 12 }}>
                <button
                    onClick={() => setRatingBooking(null)}
                    className="btn btn-secondary"
                    style={{ flex: 1 }}
                >
                    Cancel
                </button>

                <button
                    onClick={submitRating}
                    className="btn btn-primary"
                    style={{ flex: 1 }}
                    disabled={submittingRating}
                >
                    {submittingRating ? "Submitting..." : "Submit"}
                </button>
            </div>
        </div>
    </div>
)}

        </div>
    );
}