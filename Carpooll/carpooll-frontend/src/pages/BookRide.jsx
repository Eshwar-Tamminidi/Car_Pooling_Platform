import React, { useState, useEffect, useRef, useCallback } from "react";
// Leaflet is accessed via window.L to avoid resolution issues in this environment
import { 
    MapPin, Calendar, User, X, Car, Star, 
    Clock, ChevronRight, Loader, Search, ArrowRight,
    Navigation, CheckCircle, ShieldCheck, Info
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import Modal from "../components/Modal";
import RideMap from "../components/RideMap";


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
    const text = await res.text();
    const data = text ? (() => { try { return JSON.parse(text); } catch(e) { return text; } })() : null;
    if (!res.ok) throw new Error((data && data.message) || res.statusText);
    return data;
}

const apiGet = (path) => apiFetch(path, { method: "GET" });
const apiPost = (path, body) => apiFetch(path, { method: "POST", body });

async function searchLocation(query) {
    if (!query || query.length < 3) return [];
    try {
        const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5`);
        const data = await res.json();
        return data.map(item => ({ display_name: item.display_name, lat: parseFloat(item.lat), lon: parseFloat(item.lon) }));
    } catch (e) { return []; }
}

async function geocodeMany(names) {
    if (!names || names.length === 0) return [];
    try {
        const results = await Promise.all(names.map(async (name) => {
            const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(name)}&limit=1`);
            const data = await res.json();
            return data.length > 0 ? { name, lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) } : null;
        }));
        return results.filter(Boolean);
    } catch (e) { return []; }
}

async function getRoute(points) {
    if (!points || points.length < 2) return null;
    try {
        const coords = points.map(p => `${p.lng || p.lon},${p.lat}`).join(';');
        const res = await fetch(`https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson`);
        const data = await res.json();
        return (data.routes && data.routes.length > 0) ? { distance: data.routes[0].distance, geometry: data.routes[0].geometry } : null;
    } catch (e) { return null; }
}



export default function BookRide({ user }) {
    const navigate = useNavigate();
    const [fromQuery, setFromQuery] = useState("");
    const [toQuery, setToQuery] = useState("");
    const [fromCoords, setFromCoords] = useState(null);
    const [toCoords, setToCoords2] = useState(null);
    const [rides, setRides] = useState([]);
    const [suggestions, setSuggestions] = useState([]);
    const [activeInput, setActiveInput] = useState(null);
    const [loading, setLoading] = useState(false);
    const [selectedRide, setSelectedRide] = useState(null);
    const [routeGeom, setRouteGeom] = useState(null);
    const [allStops, setAllStops] = useState([]);
    const [isMapping, setIsMapping] = useState(false);
    const [seats, setSeats] = useState(1);
    const [msg, setMsg] = useState(null);
    const [driverInfo, setDriverInfo] = useState(null);
    const [rideReviews, setRideReviews] = useState([]);
    const [driverReviews, setDriverReviews] = useState(null);

    // Ratings modal state
    const [showRatingsModal, setShowRatingsModal] = useState(false);
    const [ratingsSummary, setRatingsSummary] = useState(null);
    const [ratingsLoading, setRatingsLoading] = useState(false);
    const [ratingsList, setRatingsList] = useState([]);
    
    // Booking request states
    const [isRequesting, setIsRequesting] = useState(false);
    const [showSuccessPopup, setShowSuccessPopup] = useState(false);

    useEffect(() => {
        (async () => {
            try {
                const data = await apiGet('/api/rides');
                if (data) {
                    const now = new Date();
                    const getRideEnd = (r) => (r && (r.estimatedCompletionDateTime || r.dateTime));
                    const filtered = data.filter(r => getRideEnd(r) && new Date(getRideEnd(r)) > now).sort((a,b) => b.id - a.id);
                    setRides(filtered);
                }
            } catch (e) { console.error(e); }
        })();
    }, []);

    useEffect(() => {
        if (selectedRide || showSuccessPopup) document.body.style.overflow = 'hidden';
        else document.body.style.overflow = 'auto';
        return () => { document.body.style.overflow = 'auto'; };
    }, [selectedRide, showSuccessPopup]);

    // Small pie chart helper
    function RatingPieChart({ counts = {} , size = 160 }) {
        // Normalize incoming count keys (they may be stringified numbers from backend)
        const norm = {1:0,2:0,3:0,4:0,5:0};
        Object.keys(counts || {}).forEach(k => {
            const n = Number(k);
            if (n >= 1 && n <= 5) norm[n] = Number(counts[k] || 0);
        });
        const values = [5,4,3,2,1].map(s => Number(norm[s] || 0));
        const total = values.reduce((a,b) => a + b, 0) || 0;
        const colors = ['#16a34a','#84cc16','#f59e0b','#fb923c','#ef4444'];
        const cx = size/2, cy = size/2, r = size/2 - 4;
        let acc = 0;

        // If there's nothing to show, render an empty-state circle with muted text
        if (total === 0) {
            return (
                <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
                    <circle cx={cx} cy={cy} r={r} fill="rgba(255,255,255,0.03)" stroke="var(--border)" />
                    <circle cx={cx} cy={cy} r={r*0.55} fill="var(--modal-bg)" />
                    <text x={cx} y={cy} textAnchor="middle" dominantBaseline="central" style={{ fontWeight: 700, fontSize: 12, fill: 'var(--popup-title-color)' }}>0</text>
                </svg>
            );
        }

        const paths = values.map((v, idx) => {
            const start = (acc / total * 2 * Math.PI - Math.PI/2);
            acc += v;
            const end = (acc / total * 2 * Math.PI - Math.PI/2);
            const large = end - start > Math.PI ? 1 : 0;
            const x1 = cx + r * Math.cos(start), y1 = cy + r * Math.sin(start);
            const x2 = cx + r * Math.cos(end), y2 = cy + r * Math.sin(end);
            if (v === 0) return null;
            const d = [`M ${cx} ${cy}`, `L ${x1} ${y1}`, `A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`, 'Z'].join(' ');
            return <path key={idx} d={d} fill={colors[idx]} stroke="none" />;
        });

        return (
            <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
                {paths}
                <circle cx={cx} cy={cy} r={r*0.55} fill="var(--modal-bg)" />
                <text x={cx} y={cy} textAnchor="middle" dominantBaseline="central" style={{ fontWeight: 800, fontSize: 12, fill: 'var(--popup-title-color)' }}>{total}</text>
            </svg>
        );
    }

    const openRatingsModal = async () => {
        if (!selectedRide) return;
        // show modal immediately and show loader while we fetch
        setShowRatingsModal(true);
        setRatingsLoading(true);
        setRatingsSummary(null);
        setRatingsList([]);
        try {
            // fetch driver-focused ratings (counts + reviews) and textual reviews, then merge
            const [drvRes, textOnly] = await Promise.all([
                apiGet(`/api/rides/${selectedRide.id}/driver-ratings`).catch(e => { console.debug('driver-ratings fetch failed', e); return null; }),
                apiGet(`/api/rides/${selectedRide.id}/reviews`).catch(e => { console.debug('ride reviews fetch failed', e); return null; })
            ]);

            const raw = drvRes || {};
            const countsRaw = raw.counts || {};
            const normalizedCounts = {1:0,2:0,3:0,4:0,5:0};
            Object.keys(countsRaw || {}).forEach(k => {
                const key = Number(k);
                if (key >= 1 && key <= 5) normalizedCounts[key] = Number(countsRaw[k] || 0);
            });
            const summary = { ...raw, counts: normalizedCounts };

            console.debug('driver-ratings + reviews for ride', selectedRide.id, { raw, reviewsFetched: Array.isArray(textOnly) ? textOnly.length : null, summary });

            setRatingsSummary(summary);

            // Merge reviews: prefer textual reviews (from /reviews) when available; merge by bookingId
            const byBooking = {};
            (raw?.reviews || []).forEach(r => { if (r && r.bookingId != null) byBooking[r.bookingId] = { ...r }; });
            (Array.isArray(textOnly) ? textOnly : []).forEach(r => { if (r && r.bookingId != null) byBooking[r.bookingId] = { ...byBooking[r.bookingId], ...r }; });

            // Collect merged textual reviews
            const merged = Object.values(byBooking);

            if (merged.length > 0) {
                // If we have textual reviews, show them (they may also include star-only entries)
                setRatingsList(merged);
            } else {
                // No textual reviews — fall back to server-provided reviews (may be star-only) or synthesize from counts
                const serverReviews = raw?.reviews || [];
                if (serverReviews.length > 0) {
                    setRatingsList(serverReviews);
                } else {
                    const totalFromCounts = Object.values(normalizedCounts).reduce((a,b) => a + Number(b || 0), 0);
                    if (totalFromCounts > 0) {
                        const gen = [];
                        for (let s = 5; s >= 1; s--) {
                            const c = Number(normalizedCounts[s] || 0);
                            for (let i = 0; i < c; i++) gen.push({ bookingId: null, stars: s, review: null, reviewerName: 'Passenger' });
                        }
                        console.debug('Generated star-only reviews for display (open)', { rideId: selectedRide.id, generated: gen.length });
                        setRatingsList(gen);
                    } else {
                        setRatingsList([]);
                    }
                }
            }
        } catch (e) {
            console.error('Failed to fetch driver ratings', e);
            setRatingsSummary(null);
            setRatingsList([]);
        }
        setRatingsLoading(false);
    }

    // Refresh ratings when other components report a rating update
    useEffect(() => {
        const handler = (e) => {
            const rideId = selectedRide && selectedRide.id;
            if (!rideId) return;
            // If the modal is open, re-fetch driver ratings so UI reflects latest changes
            if (showRatingsModal) {
                (async () => {
                    setRatingsLoading(true);
                    try {
                        const [drvRes, textOnly] = await Promise.all([
                            apiGet(`/api/rides/${rideId}/driver-ratings`).catch(e => { console.debug('driver-ratings fetch failed', e); return null; }),
                            apiGet(`/api/rides/${rideId}/reviews`).catch(e => { console.debug('ride reviews fetch failed', e); return null; })
                        ]);
                        const raw = drvRes || {};
                        const countsRaw = raw.counts || {};
                        const normalizedCounts = {1:0,2:0,3:0,4:0,5:0};
                        Object.keys(countsRaw || {}).forEach(k => {
                            const key = Number(k);
                            if (key >= 1 && key <= 5) normalizedCounts[key] = Number(countsRaw[k] || 0);
                        });
                        const normalized = { ...raw, counts: normalizedCounts };
                        setRatingsSummary(normalized || null);

                        // Merge reviews by bookingId preferring textual /reviews data when available
                        const byBooking = {};
                        (raw?.reviews || []).forEach(r => { if (r && r.bookingId != null) byBooking[r.bookingId] = { ...r }; });
                        (Array.isArray(textOnly) ? textOnly : []).forEach(r => { if (r && r.bookingId != null) byBooking[r.bookingId] = { ...byBooking[r.bookingId], ...r }; });
                        const merged = Object.values(byBooking);

                        if (merged.length > 0) {
                            setRatingsList(merged);
                        } else {
                            const serverReviews = raw?.reviews || [];
                            if (serverReviews.length > 0) {
                                setRatingsList(serverReviews);
                            } else {
                                const totalCounts = Object.values(normalizedCounts || {}).reduce((a,b) => a + Number(b || 0), 0);
                                if (totalCounts > 0) {
                                    const gen = [];
                                    for (let s = 5; s >= 1; s--) {
                                        const c = Number(normalizedCounts[s] || 0);
                                        for (let i = 0; i < c; i++) gen.push({ bookingId: null, stars: s, review: null, reviewerName: 'Passenger' });
                                    }
                                    console.debug('Generated star-only reviews (refresh) for display', { rideId, generated: gen.length });
                                    setRatingsList(gen);
                                } else {
                                    setRatingsList([]);
                                }
                            }
                        }
                    } catch (err) { console.error('Failed to refresh driver ratings', err); }
                    setRatingsLoading(false);
                })();
            }
        };
        window.addEventListener('rating:updated', handler);
        return () => window.removeEventListener('rating:updated', handler);
    }, [selectedRide, showRatingsModal]);; 

    useEffect(() => {
        if (!selectedRide) return;
        (async () => {
            setIsMapping(true);
            try {
                const pickupCoords = await geocodeMany(selectedRide.pickupPoints || []);
                const dropoffCoords = await geocodeMany(selectedRide.dropoffPoints || []);
                const intermediate = [...pickupCoords, ...dropoffCoords];
                setAllStops(intermediate);
                
                const fullPath = [
                    { lat: selectedRide.fromLat, lng: selectedRide.fromLng },
                    ...intermediate,
                    { lat: selectedRide.toLat, lng: selectedRide.toLng }
                ].filter(p => p && !isNaN(p.lat));

                const route = await getRoute(fullPath);
                if (route) setRouteGeom(route.geometry);
                const driver = await apiGet(`/api/users/${selectedRide.ownerId}`);
                setDriverInfo(driver);
                // fetch ride reviews (textual comments) and ride-level driver ratings (counts + reviews)
                let textualReviews = [];
                try{
                    textualReviews = await apiGet(`/api/rides/${selectedRide.id}/reviews`);
                    setRideReviews(textualReviews || []);
                }catch(e){ console.error('Failed to fetch ride reviews', e); setRideReviews([]); }

                try {
                    const dr = await apiGet(`/api/rides/${selectedRide.id}/driver-ratings`);
                    const countsRaw = dr?.counts || {};
                    const normalizedCounts = {1:0,2:0,3:0,4:0,5:0};
                    Object.keys(countsRaw || {}).forEach(k => {
                        const key = Number(k);
                        if (key >= 1 && key <= 5) normalizedCounts[key] = Number(countsRaw[k] || 0);
                    });
                    const total = Object.values(normalizedCounts).reduce((a,b) => a + Number(b || 0), 0);
                    // merge server reviews and textual reviews preferring textual data when available
                    const byBooking = {};
                    (dr?.reviews || []).forEach(r => { if (r && r.bookingId != null) byBooking[r.bookingId] = { ...r }; });
                    (textualReviews || []).forEach(r => { if (r && r.bookingId != null) byBooking[r.bookingId] = { ...byBooking[r.bookingId], ...r }; });
                    const merged = Object.values(byBooking);
                    setDriverReviews({ averageRating: dr?.average ?? null, totalReviews: total, counts: normalizedCounts, reviews: merged.length ? merged : (textualReviews || []) });
                } catch (err) {
                    // fallback: display textual reviews if driver-ratings endpoint is not available
                    setDriverReviews({ averageRating: null, totalReviews: (textualReviews||[]).length, counts: {1:0,2:0,3:0,4:0,5:0}, reviews: textualReviews || [] });
                }
                setSeats(selectedRide.seatsAvailable > 0 ? 1 : 0);
            } catch (e) { console.error("Error loading ride details", e); }
            setIsMapping(false);
        })();
    }, [selectedRide]);
    

    const handleSearch = async (e) => {
        e.preventDefault();
        setLoading(true); setMsg(null);
        let url = '/api/rides';
        if (fromCoords && toCoords) url += `?fromLat=${fromCoords.lat}&fromLng=${fromCoords.lng}&toLat=${toCoords.lat}&toLng=${toCoords.lng}`;
        else url += `?from=${fromQuery.split(',')[0]}&to=${toQuery.split(',')[0]}`;
        try {
            const res = await apiGet(url);
            setRides(res || []);
            if (!res || res.length === 0) setMsg({ type: 'info', text: "No rides found." });
        } catch(e) { setMsg({ type: 'error', text: "Search failed." }); } 
        finally { setLoading(false); }
    };

    const handleSendRequest = async () => {
        if (!selectedRide) return;
        setIsRequesting(true);
        try {
            await apiPost("/api/bookings/request", { 
                rideId: selectedRide.id, 
                seatsRequested: seats 
            });
            // If we get here, request succeeded
            setSelectedRide(null);
            setShowSuccessPopup(true);
        } catch (e) {
            console.error("Request error:", e);
            const errorMessage = e.message || "Failed to send request. Please try again.";
            alert(errorMessage);
        } finally {
            setIsRequesting(false);
        }
    };

    return (
        <div className="container" style={{ maxWidth: '1000px', padding: '20px' }}>
            {/* SEARCH SECTION */}
            <div className="card" style={{ padding: '30px', marginBottom: '40px' }}>
                <h2 style={{ textAlign: 'center', marginBottom: '30px', fontSize: '24px', fontWeight: 'bold' }}>Find a Ride</h2>
                <form onSubmit={handleSearch} style={{ display: 'flex', gap: '15px', flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: '250px', position: 'relative' }}>
                        <MapPin size={18} style={{ position: 'absolute', top: '14px', left: '12px', color: '#3b82f6' }}/>
                        <input placeholder="From... (Press Enter)" value={fromQuery} 
                            onChange={e => { setFromQuery(e.target.value); setFromCoords(null); }}
                            onKeyDown={async e => { if(e.key==='Enter'){ e.preventDefault(); setActiveInput('from'); setSuggestions(await searchLocation(fromQuery)); } }}
                            style={{ width: '100%', paddingLeft: '40px' }}
                        />
                        {activeInput === 'from' && suggestions.length > 0 && (
                            <ul style={{ position: 'absolute', top: '100%', left: 0, width: '100%', background: '#18181b', border: '1px solid #333', borderRadius: '8px', zIndex: 100, padding: 0, margin: '5px 0', maxHeight: '200px', overflowY: 'auto', listStyle: 'none' }}>
                                {suggestions.map((s, i) => <li key={i} onClick={() => { setFromQuery(s.display_name); setFromCoords({lat: s.lat, lng: s.lon}); setSuggestions([]); }} style={{ padding: '10px', cursor: 'pointer', borderBottom: '1px solid #374151', fontSize: '13px' }}>{s.display_name}</li>)}
                            </ul>
                        )}
                    </div>
                    <div style={{ flex: 1, minWidth: '250px', position: 'relative' }}>
                        <MapPin size={18} style={{ position: 'absolute', top: '14px', left: '12px', color: '#ef4444' }}/>
                        <input placeholder="To..." value={toQuery} 
                            onChange={e => { setToQuery(e.target.value); setToCoords2(null); }}
                            onKeyDown={async e => { if(e.key==='Enter'){ e.preventDefault(); setActiveInput('to'); setSuggestions(await searchLocation(toQuery)); } }}
                            style={{ width: '100%', paddingLeft: '40px' }}
                        />
                        {activeInput === 'to' && suggestions.length > 0 && (
                            <ul style={{ position: 'absolute', top: '100%', left: 0, width: '100%', background: '#18181b', border: '1px solid #333', borderRadius: '8px', zIndex: 100, padding: 0, margin: '5px 0', maxHeight: '200px', overflowY: 'auto', listStyle: 'none' }}>
                                {suggestions.map((s, i) => <li key={i} onClick={() => { setToQuery(s.display_name); setToCoords2({lat: s.lat, lng: s.lon}); setSuggestions([]); }} style={{ padding: '10px', cursor: 'pointer', borderBottom: '1px solid #374151', fontSize: '13px' }}>{s.display_name}</li>)}
                            </ul>
                        )}
                    </div>
                    <button className="btn btn-primary" style={{ padding: '0 40px', height: '48px' }}>
                        {loading ? <Loader className="animate-spin" size={20}/> : <Search size={20}/>}
                    </button>
                </form>
            </div>

            <h3 style={{ fontSize: '14px', color: '#9ca3af', marginBottom: '20px', fontWeight: 'bold', textTransform: 'uppercase' }}>Available Journeys</h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                {rides.map(r => {
                    const isFull = Number(r.seatsAvailable) <= 0;
                    return (
                        <div key={r.id} onClick={() => !isFull && setSelectedRide(r)} className="card" style={{ cursor: isFull ? 'default' : 'pointer', display: 'flex', alignItems: 'center', padding: '20px', gap: '20px', opacity: isFull ? 0.7 : 1 }}>
                            <div style={{ width: '80px', height: '60px', borderRadius: '8px', background: 'var(--card-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                {r.carImageUrl ? <img src={r.carImageUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="car" /> : <Car size={24} color="var(--text-muted)"/>}
                            </div>
                            <div style={{ flex: 1 }}>
                                <div style={{ fontWeight: 'bold' }}>{r.fromLocation} ➔ {r.toLocation}</div>
                                <div style={{ fontSize: '12px', color: '#9ca3af' }}>{new Date(r.dateTime).toLocaleString()} • {r.driverName}</div>
                                <div style={{ fontSize: '12px', color: '#a3a3a3', marginTop: '6px' }}>Estimated End: {r && r.estimatedCompletionDateTime ? new Date(r.estimatedCompletionDateTime).toLocaleString() : '—'}</div>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                                <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#3b82f6' }}>₹{r.price}</div>
                                {isFull ? <span style={{fontSize:'10px', color:'#ef4444'}}>Full</span> : <button className="btn btn-secondary" style={{ marginTop: '5px', fontSize: '11px', padding: '5px 12px' }}>View & Book</button>}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* RIDE DETAILS MODAL */}
            {selectedRide && (
                <div className="modal-overlay">
                    <div className="card" style={{ padding: 0, width: '95%', maxWidth: '950px', height: '85vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)' }}>
                        <div style={{ padding: '20px', background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
                            <h3 style={{ margin: 0, color: 'var(--text)' }}>Ride Details</h3>
                            <button onClick={() => setSelectedRide(null)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={24}/></button>
                        </div>
                        <div style={{ flex: 1, display: 'flex', flexWrap: 'nowrap', overflow: 'hidden' }}>
                            {/* Map Side */}
                            <div style={{ flex: 1, background: 'var(--card-bg)', minWidth: '400px', position: 'relative' }}>
                                <RideMap pickup={{ lat: selectedRide.fromLat, lng: selectedRide.fromLng, name: selectedRide.fromLocation }} drop={{ lat: selectedRide.toLat, lng: selectedRide.toLng, name: selectedRide.toLocation }} stops={allStops} routeGeometry={routeGeom} />
                            </div>
                            
                            {/* Details Sidebar */}
                            <div style={{ width: '400px', backgroundColor: 'var(--card-bg)', display: 'flex', flexDirection: 'column', flexShrink: 0, overflowY: 'auto', padding: '25px' }}>
                                
                                <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '25px' }}>
                                    <div style={{ width: '50px', height: '50px', borderRadius: '50%', overflow: 'hidden', background: 'var(--bg-secondary)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                                        {selectedRide.driverPhotoUrl ? <img src={selectedRide.driverPhotoUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="dr" /> : <User size={24}/>}
                                    </div>
                                    <div>
                                        <div style={{ fontWeight: 'bold', color: 'var(--text)' }}>{selectedRide.driverName}</div>
                                        <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <span style={{ color: 'var(--warning)', fontWeight: 800 }}>Community Rating: {driverInfo?.averageRating || 'Community Trusted'}</span>
                                        </div>

                                        <div style={{ marginTop: '6px' }}>
                                            <a href="#" onClick={(e) => { e.preventDefault(); openRatingsModal(); }} style={{ color: 'var(--primary)', textDecoration: 'underline', fontSize: '12px' }}>{ratingsLoading ? 'Loading…' : 'View all ratings'}</a>
                                        </div>

                                        <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '8px' }}><Calendar size={14} style={{ marginRight: '8px' }} /> Estimated End: {selectedRide.estimatedCompletionDateTime ? new Date(selectedRide.estimatedCompletionDateTime).toLocaleString() : '—'}</div>
                                    </div>
                                    </div>
                                </div>

                                <div style={{ background: 'var(--bg-secondary)', padding: '20px', borderRadius: '12px', marginBottom: '20px', border: '1px solid var(--border)' }}>
                                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '15px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <Navigation size={14} /> Full Route
                                    </div>
                                    <div style={{ position: 'relative' }}>
                                        <div style={{ position: 'absolute', left: '7px', top: '10px', bottom: '10px', width: '2px', background: 'var(--border)' }}></div>
                                        <div style={{ position: 'relative', display: 'flex', gap: '15px', marginBottom: '15px' }}>
                                            <div style={{ width: '16px', height: '16px', borderRadius: '50%', border: '2px solid var(--primary)', background: 'var(--card-bg)', zIndex: 1 }}></div>
                                            <div><div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 'bold' }}>START</div><div style={{ fontSize: '14px', fontWeight: 'bold', color: 'var(--text)' }}>{selectedRide.fromLocation}</div></div>
                                        </div>
                                        {allStops.map((stop, idx) => (
                                            <div key={idx} style={{ position: 'relative', display: 'flex', gap: '15px', marginBottom: '15px' }}>
                                                <div style={{ width: '16px', height: '16px', borderRadius: '50%', background: 'var(--border)', zIndex: 1, marginTop: '2px' }}></div>
                                                <div><div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 'bold' }}>VIA</div><div style={{ fontSize: '13px', color: 'var(--text)' }}>{stop.name}</div></div>
                                            </div>
                                        ))}
                                        <div style={{ position: 'relative', display: 'flex', gap: '15px' }}>
                                            <div style={{ width: '16px', height: '16px', borderRadius: '50%', border: '2px solid var(--danger)', background: 'var(--card-bg)', zIndex: 1 }}></div>
                                            <div><div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 'bold' }}>END</div><div style={{ fontSize: '14px', fontWeight: 'bold', color: 'var(--text)' }}>{selectedRide.toLocation}</div></div>
                                        </div>
                                    </div>
                                </div>
                                {rideReviews && rideReviews.length > 0 && (
                                    <div style={{ background: 'var(--card-bg)', padding: '14px', borderRadius: 12, border: '1px solid var(--border)', marginBottom: 16 }}>
                                        <div style={{ fontWeight: 800, marginBottom: 8, color: 'var(--text)' }}>Passenger Reviews</div>
                                        {rideReviews.map((rev, idx) => (
                                            <div key={idx} style={{ padding: '10px', borderRadius: 8, background: 'var(--bg-secondary)', marginBottom: 8, border: '1px solid var(--border)' }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                                                    <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text)' }}>{rev.reviewerName || 'Passenger'}</div>
                                                    <div style={{ color: 'var(--warning)', fontWeight: 800 }}>{rev.stars} ★</div>
                                                </div>
                                                <div style={{ color: 'var(--popup-msg-color)', fontSize: 13 }}>{rev.review}</div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                                <div style={{ background: 'var(--bg-secondary)', padding: '15px', borderRadius: '12px' }}>
                                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '5px' }}>Vehicle</div>
                                    <div style={{ fontWeight: 'bold', color: 'var(--text)' }}>{selectedRide.carName}</div>
                                    <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{selectedRide.vehicleNumber}</div>
                                </div>

                                <div style={{ padding: '25px', borderTop: '1px solid var(--border)', background: 'var(--bg-secondary)', marginTop: 'auto' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                                        <div><div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Fare</div><div style={{ fontSize: '32px', fontWeight: 'bold', color: 'var(--success)' }}>₹{selectedRide.price * seats}</div></div>
                                        <div style={{ display: 'flex', alignItems: 'center', background: 'var(--bg-secondary)', padding: '8px', borderRadius: '10px', border: '1px solid var(--border)' }}>
                                            <button onClick={() => setSeats(s => Math.max(1, s-1))} style={{ background: 'none', border: 'none', color: 'var(--text)', padding: '5px 12px', cursor: 'pointer', fontSize: '20px' }}>-</button>
                                            <span style={{ fontWeight: 'bold', width: '30px', textAlign: 'center', fontSize: '18px' }}>{seats}</span>
                                            <button onClick={() => setSeats(s => Math.min(selectedRide.seatsAvailable, s+1))} style={{ background: 'none', border: 'none', color: 'var(--text)', padding: '5px 12px', cursor: 'pointer', fontSize: '20px' }}>+</button>
                                        </div>
                                    </div>
                                    
                                    <button 
                                        onClick={handleSendRequest} 
                                        className="btn btn-primary" 
                                        style={{ width: '100%', padding: '18px', fontSize: '18px', fontWeight: 'bold' }}
                                        disabled={isRequesting}
                                    >
                                        {isRequesting ? <Loader className="animate-spin" size={24}/> : "Send Request"}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* RATINGS LIST / PIECHART MODAL */}
            {showRatingsModal && (
                <Modal show={showRatingsModal} onClose={() => setShowRatingsModal(false)} maxWidth={900}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                        <h3 style={{ margin: 0, color: 'var(--popup-title-color)' }}>Ratings & Reviews</h3>
                        <button onClick={() => setShowRatingsModal(false)} style={{ background: 'none', border: 'none', color: 'var(--popup-msg-color)', cursor: 'pointer' }}><X/></button>
                    </div>
                    <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                        {ratingsLoading ? (
                            <div style={{ width: '100%', textAlign: 'center', padding: 30 }}>
                                <Loader className="animate-spin" />
                                <div style={{ marginTop: 10, color: 'var(--text-muted)' }}>Loading reviews…</div>
                            </div>
                        ) : (
                            <>
                                <div style={{ width: 260, padding: 8, borderRadius: 12, background: 'var(--card-bg)', border: '1px solid var(--border)' }}>
                                    <div style={{ textAlign: 'center', marginBottom: 12 }}>
                                        {/* Pie chart removed per request — show compact numeric summary instead */}
                                        {(() => {
                                            const countsObj = (ratingsSummary && ratingsSummary.counts) ? ratingsSummary.counts : null;
                                            const totalFromCounts = countsObj ? Object.values(countsObj).reduce((a,b) => a + Number(b || 0), 0) : (ratingsList ? ratingsList.length : 0);
                                            const avg = ratingsSummary?.average ?? ratingsSummary?.avg ?? driverInfo?.averageRating ?? null;
                                            const avgNum = Number(avg);
                                            return (
                                                <>
                                                    <div style={{ fontSize: 28, fontWeight: 800 }}>
                                                        { !Number.isNaN(avgNum) && avg != null ? `${avgNum.toFixed(1)} ★` : '—' }
                                                    </div>
                                                    { totalFromCounts > 0 ? (
                                                        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>
                                                            {`${totalFromCounts} rating${totalFromCounts !== 1 ? 's' : ''}`}
                                                        </div>
                                                    ) : null }
                                                </>
                                            );
                                        })()}
                                    </div>
                                    <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 12, fontWeight: 700 }}>
                                        {/* Keep Average label below compact summary for clarity */}
                                        {/* Prefer server 'average' then legacy 'avg' then fallback to driverInfo */}
                                        {(() => {
                                            const avg = ratingsSummary?.average ?? ratingsSummary?.avg ?? driverInfo?.averageRating ?? null;
                                            const avgNum = Number(avg);
                                            return !Number.isNaN(avgNum) ? (`Average: ${avgNum.toFixed(1)} ★`) : (`Average: ${avg || '—'} ★`);
                                        })()}
                                    </div>
                                </div>
                                <div style={{ flex: 1, maxHeight: '60vh', overflowY: 'auto' }}>
                                    {(() => {
                                        // Prefer counts from ratingsSummary, fall back to driverReviews counts if present
                                        const countsObj = (ratingsSummary && ratingsSummary.counts) ? ratingsSummary.counts : (driverReviews && driverReviews.counts) ? driverReviews.counts : null;
                                        // Determine total reviews from available sources (counts, ratingsList, or driverReviews)
                                        let totalFromCounts = 0;
                                        if (countsObj) totalFromCounts = Object.values(countsObj).reduce((a,b) => a + Number(b || 0), 0);
                                        if (!totalFromCounts) totalFromCounts = (ratingsList && ratingsList.length) ? ratingsList.length : (driverReviews && driverReviews.reviews ? driverReviews.reviews.length : 0);

                                        // Build a list of individual reviews to display. Prefer textual reviews; use driverReviews.reviews when available;
                                        // if none exist but counts exist, synthesize star-only entries per passenger so host can see one row per passenger.
                                        let displayReviews = [];
                                        if (ratingsList && ratingsList.length > 0) {
                                            displayReviews = ratingsList;
                                        } else if (driverReviews && Array.isArray(driverReviews.reviews) && driverReviews.reviews.length > 0) {
                                            displayReviews = driverReviews.reviews;
                                        } else if (totalFromCounts > 0 && countsObj) {
                                            const gen = [];
                                            for (let s = 5; s >= 1; s--) {
                                                const c = Number((countsObj && (countsObj[s] ?? countsObj[String(s)])) || 0);
                                                for (let i = 0; i < c; i++) {
                                                    gen.push({ bookingId: null, reviewerName: 'Passenger', stars: s, review: null, id: `s${s}-${i}` });
                                                }
                                            }
                                            displayReviews = gen;
                                        }

                                        if (displayReviews.length > 0) {
                                            // Render as a table: Reviewer | Rating | Review | Date
                                            return (
                                                <div style={{ overflowX: 'auto' }}>
                                                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                                        <thead>
                                                            <tr style={{ textAlign: 'left', color: 'var(--text-muted)', fontSize: 12 }}>
                                                                <th style={{ padding: '8px 12px', minWidth: 160 }}>Reviewer</th>
                                                                <th style={{ padding: '8px 12px', width: 100 }}>Rating</th>
                                                                <th style={{ padding: '8px 12px' }}>Review</th>
                                                                <th style={{ padding: '8px 12px', width: 150 }}>Date</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {displayReviews.map((r, i) => {
                                                                const reviewer = r.reviewerName || r.reviewer || r.name || 'Passenger';
                                                                const stars = r.stars || r.rating || 0;
                                                                const reviewText = r.review || r.comment || null;
                                                                const rawDate = r.createdAt || r.date || r.submittedAt || r.publishedAt || r.dateTime || null;
                                                                const dateStr = rawDate ? new Date(rawDate).toLocaleString() : '—';
                                                                return (
                                                                    <tr key={r.id || r.bookingId || i} style={{ borderTop: '1px solid var(--border)' }}>
                                                                        <td style={{ padding: '10px 12px', verticalAlign: 'top', fontWeight: 700, color: 'var(--text)' }}>{reviewer}</td>
                                                                        <td style={{ padding: '10px 12px', verticalAlign: 'top', color: 'var(--warning)', fontWeight: 800 }}>{stars} ★</td>
                                                                        <td style={{ padding: '10px 12px', verticalAlign: 'top', color: 'var(--popup-msg-color)' }}>{reviewText || <span style={{ color: 'var(--text-muted)' }}>No comment</span>}</td>
                                                                        <td style={{ padding: '10px 12px', verticalAlign: 'top', color: 'var(--text-muted)' }}>{dateStr}</td>
                                                                    </tr>
                                                                );
                                                            })}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            );
                                        }

                                        return <div style={{ color: 'var(--text-muted)', padding: 20 }}>No reviews yet.</div>;
                                    })()}
                                </div>
                            </>
                        )}
                    </div>
                </Modal>
            )}

            {/* SUCCESS POPUP MODAL */}
            {showSuccessPopup && (
                <div className="modal-overlay">
                    <div className="card" style={{ maxWidth: '400px', textAlign: 'center', padding: '40px', background: 'var(--card-bg)', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                        <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'rgba(16, 185, 129, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
                            <CheckCircle size={40} color="#10b981"/>
                        </div>
                        <h3 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '10px', color: 'var(--text)' }}>Ride Requested!</h3>
                        <p style={{ color: '#9ca3af', marginBottom: '30px', lineHeight: '1.6' }}>
                            Your booking request has been sent to the driver. <br/>
                            Updates can be seen in the <strong>Requests</strong> section.
                        </p>
                        <button onClick={() => setShowSuccessPopup(false)} className="btn btn-primary" style={{ width: '100%', padding: '14px' }}>Done</button>
                    </div>
                </div>
            )}
        </div>
    );
}