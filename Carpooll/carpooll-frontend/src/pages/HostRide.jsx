// src/pages/HostRide.jsx
import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { computeFare } from '../utils/paymentUtils';
import { useNavigate } from "react-router-dom";
import { 
    MapPin, CheckCircle, Upload, Wind, Music, Radio, 
    Loader, Car, AlertCircle, Plus, Trash2, X, User,
    Clock as ClockIcon, Calendar as CalendarIcon, Navigation, ChevronRight
} from "lucide-react";

// --- INLINED UTILITIES FOR STABILITY ---

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
        ...opts,
        headers,
        body: opts.body && !(opts.body instanceof FormData) && typeof opts.body === "object"
            ? JSON.stringify(opts.body) : opts.body,
    });

    if (res.status === 204) return null;
    const text = await res.text();
    let data = null;
    if (text) {
        try { data = JSON.parse(text); } catch (e) { data = text; }
    }
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
        return data.map(item => ({
            display_name: item.display_name,
            lat: parseFloat(item.lat),
            lon: parseFloat(item.lon)
        }));
    } catch (e) { return []; }
}

async function getRoute(points) {
    if (!points || points.length < 2) return null;
    try {
        const coords = points.map(p => `${p.lng || p.lon},${p.lat}`).join(';');
        const res = await fetch(`https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson`);
        const data = await res.json();
        if (data.routes && data.routes.length > 0) {
            return { distance: data.routes[0].distance, geometry: data.routes[0].geometry };
        }
        return null;
    } catch (e) { return null; }
}

function calculateFare(distanceMeters) {
    if (!distanceMeters) return 0;
    const distanceKm = distanceMeters / 1000;
    return Math.round(250 + (12 * distanceKm)/11.5);
}

// Robust RideMap Component
function RideMap({ pickup, drop, stops = [], routeGeometry }) {
    const mapRef = useRef(null);
    const mapInstance = useRef(null);
    const polylineRef = useRef(null);
    const markersRef = useRef([]);

    const updateMap = useCallback(() => {
        const L = window.L; 
        if (!L || !mapInstance.current) return;
        markersRef.current.forEach(m => m.remove()); 
        markersRef.current = [];
        if (polylineRef.current) polylineRef.current.remove();
        const getLat = (obj) => parseFloat(obj?.lat);
        const getLng = (obj) => parseFloat(obj?.lng || obj?.lon);
        const allMarkers = [pickup ? { ...pickup, l: 'Start' } : null, ...(stops || []), drop ? { ...drop, l: 'End' } : null].filter(p => p && !isNaN(getLat(p)));
        if (allMarkers.length === 0) return;
        const bounds = L.latLngBounds();
        allMarkers.forEach(m => {
            const marker = L.marker([getLat(m), getLng(m)]).addTo(mapInstance.current);
            markersRef.current.push(marker); 
            bounds.extend([getLat(m), getLng(m)]);
        });
        if (routeGeometry?.coordinates) {
            const coords = routeGeometry.coordinates.map(c => [c[1], c[0]]);
            polylineRef.current = L.polyline(coords, { color: '#3b82f6', weight: 5, opacity: 0.8 }).addTo(mapInstance.current);
            bounds.extend(coords);
        }
        if (bounds.isValid()) mapInstance.current.fitBounds(bounds, { padding: [50, 50], maxZoom: 13 });
    }, [pickup, drop, stops, routeGeometry]);

    useEffect(() => {
        if (!window.L) {
            const link = document.createElement('link');
            link.rel = 'stylesheet'; link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
            document.head.appendChild(link);
            const script = document.createElement('script');
            script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
            script.async = true; script.onload = initMap;
            document.head.appendChild(script);
        } else { initMap(); }
        function initMap() {
            if (!mapRef.current || mapInstance.current) return;
            const container = mapRef.current;
            if (container._leaflet_id) return; 
            mapInstance.current = window.L.map(container).setView([20, 78], 5);
            window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(mapInstance.current);
            updateMap();
        }
        return () => { if (mapInstance.current) { mapInstance.current.remove(); mapInstance.current = null; } };
    }, [updateMap]);

    useEffect(() => { updateMap(); }, [updateMap]);
    return <div ref={mapRef} style={{ height: '100%', width: '100%', borderRadius: '16px', zIndex: 1 }} />;
}

// --- MAIN COMPONENT ---

export default function HostRide({ user }) {
    const navigate = useNavigate();
    
    // --- STATE ---
    const [date, setDate] = useState("");
    const [time, setTime] = useState("09:00");
    // Optional estimated completion (drop-off) datetime
    const [endDate, setEndDate] = useState("");
    const [endTime, setEndTime] = useState("10:00");
    
    // Time Selector Sub-states
    const [selHour, setSelHour] = useState("09");
    const [selMin, setSelMin] = useState("00");
    const [selPeriod, setSelPeriod] = useState("AM");

    const [form, setForm] = useState({
        seatsAvailable: 1, 
        price: 0, 
        description: "", 
        features: { ac: true, music: false, radio: false },
        driverPhotoUrl: "" 
    });

    const [pickup, setPickup] = useState(null);
    const [drop, setDrop] = useState(null);
    const [pickupQuery, setPickupQuery] = useState("");
    const [dropQuery, setDropQuery] = useState("");
    
    const [suggestions, setSuggestions] = useState([]);
    const [activeField, setActiveField] = useState(null); 
    const [isSearching, setIsSearching] = useState(false);

    const [extraPickups, setExtraPickups] = useState([]); 
    const [extraDrops, setExtraDrops] = useState([]);
    const [routeInfo, setRouteInfo] = useState(null);

    const [myCars, setMyCars] = useState([]);
    const [selectedCarId, setSelectedCarId] = useState("");
    const [showAddCar, setShowAddCar] = useState(false);
    const [newCar, setNewCar] = useState({ name: "", number: "", imageUrl: "" });
    const [loading, setLoading] = useState(false);
    const [successModal, setSuccessModal] = useState(false);
    const [errorMsg, setErrorMsg] = useState("");

    // SYNC TIME DROPDOWNS TO TIME STRING
    useEffect(() => {
        let h = parseInt(selHour);
        if (selPeriod === "PM" && h < 12) h += 12;
        if (selPeriod === "AM" && h === 12) h = 0;
        setTime(`${String(h).padStart(2, '0')}:${selMin}`);
    }, [selHour, selMin, selPeriod]);

    const triggerSearch = async (val, fieldName) => {
        if (!val || val.length < 3) return;
        setIsSearching(true);
        setActiveField(fieldName);
        setSuggestions([]);
        const res = await searchLocation(val);
        setSuggestions(res);
        setIsSearching(false);
    };

    const handleKeyDown = (e, val, type, id) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            const fieldName = type.startsWith('via') ? `${type}-${id}` : type;
            triggerSearch(val, fieldName);
        }
    };

    const selectLocation = (item) => {
        if (!item || !item.lat || !item.lon) return;
        const coords = { lat: parseFloat(item.lat), lng: parseFloat(item.lon), name: item.display_name };
        if (activeField === 'pickup') { setPickup(coords); setPickupQuery(item.display_name); }
        else if (activeField === 'drop') { setDrop(coords); setDropQuery(item.display_name); }
        else if (activeField?.startsWith('via-pickup')) {
            const id = parseInt(activeField.split('-').pop());
            setExtraPickups(prev => prev.map(p => p.id === id ? { ...p, query: item.display_name, coords: coords } : p));
        } else if (activeField?.startsWith('via-drop')) {
            const id = parseInt(activeField.split('-').pop());
            setExtraDrops(prev => prev.map(p => p.id === id ? { ...p, query: item.display_name, coords: coords } : p));
        }
        setSuggestions([]); setActiveField(null);
    };

    const addStop = (type) => {
        const newStop = { id: Date.now(), query: "", coords: null };
        if(type === 'pickup') setExtraPickups([...extraPickups, newStop]);
        else setExtraDrops([...extraDrops, newStop]);
    };

    const removeStop = (type, id) => {
        if(type === 'pickup') setExtraPickups(extraPickups.filter(p => p.id !== id));
        else setExtraDrops(extraDrops.filter(p => p.id !== id));
    };

    const allStops = useMemo(() => [
        ...extraPickups.filter(p => p.coords).map(p => ({ ...p.coords, name: "Via " + (p.query || "").split(',')[0] })),
        ...extraDrops.filter(p => p.coords).map(p => ({ ...p.coords, name: "Via " + (p.query || "").split(',')[0] }))
    ], [extraPickups, extraDrops]);

    useEffect(() => {
        async function calculate() {
            const allPoints = [];
            if (pickup) allPoints.push(pickup);
            extraPickups.forEach(p => { if (p.coords) allPoints.push(p.coords); });
            extraDrops.forEach(p => { if (p.coords) allPoints.push(p.coords); });
            if (drop) allPoints.push(drop);
            if (allPoints.length >= 2) {
                const route = await getRoute(allPoints);
                if (route) {
                    setRouteInfo(route);
                    setForm(prev => ({ ...prev, price: calculateFare(route.distance) }));
                }
            } else {
                setRouteInfo(null); setForm(prev => ({ ...prev, price: 0 }));
            }
        }
        calculate();
    }, [pickup, drop, allStops]);

    // keep estimated end date in sync with departure date by default
    useEffect(() => {
        if (date && !endDate) setEndDate(date);
    }, [date, endDate]);

    async function handleSubmit(e) {
        e.preventDefault();
        setErrorMsg("");
        if (!selectedCarId || selectedCarId === 'add' || !pickup || !drop || !date || !time) {
            setErrorMsg("Please fill all required fields.");
            return;
        }
        setLoading(true);
        const car = myCars.find(c => String(c.id) === String(selectedCarId));
        if (!car) { setErrorMsg("Selected vehicle not found."); setLoading(false); return; }
        try {
            const payload = {
                ownerEmail: user.email, ownerId: user.id, driverName: user.fullname,
                fromLocation: pickup.name.split(',')[0], toLocation: drop.name.split(',')[0],
                fromLat: pickup.lat, fromLng: pickup.lng,
                toLat: drop.lat, toLng: drop.lng,
                dateTime: `${date}T${time}`,
                estimatedCompletionDateTime: (endDate && endTime) ? `${endDate}T${endTime}` : undefined,
                seatsAvailable: Number(form.seatsAvailable || 1), price: Number(form.price || 0),
                distanceKm: routeInfo ? routeInfo.distance / 1000 : 0,
                carName: car.name, vehicleNumber: car.number, carImageUrl: car.imageUrl,
                driverPhotoUrl: form.driverPhotoUrl, 
                features: Object.keys(form.features).filter(k => form.features[k]),
                description: form.description,
                pickupPoints: extraPickups.map(p => p.query).filter(Boolean),
                dropoffPoints: extraDrops.map(p => p.query).filter(Boolean)
            };
            await apiPost("/api/rides", payload);
            setSuccessModal(true);
        } catch (err) { setErrorMsg(err.message || "Failed to publish ride."); } 
        finally { setLoading(false); }
    }

    useEffect(() => { if(user) apiGet(`/api/users/${user.id}/cars`).then(setMyCars).catch(() => {}); }, [user]);
    
    const handleImageUpload = (e, setter) => {
        const file = e.target.files[0];
        if(file){ const r = new FileReader(); r.onloadend=()=>setter(r.result); r.readAsDataURL(file); }
    };

    const handleAddCar = async (e) => {
        e.preventDefault();
        try { 
            const c = await apiPost(`/api/users/${user.id}/cars`, newCar); 
            setMyCars([...myCars, c]); setSelectedCarId(c.id); setShowAddCar(false); 
            setNewCar({ name: "", number: "", imageUrl: "" });
        } catch(e){ alert("Error saving vehicle"); }
    };

    return (
        <div className="container" style={{ padding: '20px', maxWidth: '1200px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '30px', alignItems: 'start' }}>
                
                {/* --- LEFT: FORM --- */}
                <div className="card" style={{ padding: '30px' }}>
                    <h2 style={{
  fontSize: '24px',
  marginBottom: '25px',
  borderBottom: '1px solid var(--border)',
  paddingBottom: '10px',
  color: 'var(--text-muted)'

}}>
  Host a Ride
</h2>

                    
                    {errorMsg && <div style={{ background: 'rgba(239, 68, 68, 0.2)', color: '#fca5a5', padding: '10px', borderRadius: '8px', marginBottom: '15px', fontSize: '14px', display:'flex', alignItems:'center', gap:'8px' }}><AlertCircle size={16}/> {errorMsg}</div>}

                    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        
                        {/* DRIVER PHOTO */}
                        <div>
                            <label style={{ display: 'block', color: 'var(--text-muted)', marginBottom: '8px', fontSize: '12px', fontWeight: 'bold', textTransform: 'uppercase' }}>Host Photo</label>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '20px', background: 'rgba(255,255,255,0.02)', padding: '15px', borderRadius: '15px', border: '1px solid rgba(255,255,255,0.05)' }}>
                                <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: '#333', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid #3b82f6' }}>
                                    {form.driverPhotoUrl ? <img src={form.driverPhotoUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="Driver" /> : <User size={30} color="#666"/>}
                                </div>
                                <label className="btn btn-secondary" style={{ cursor: 'pointer', padding: '10px 15px', fontSize: '13px' }}>
                                    <Upload size={14} style={{ marginRight: '8px' }} /> {form.driverPhotoUrl ? "Change Photo" : "Upload Photo"}
                                    <input type="file" accept="image/*" onChange={(e) => handleImageUpload(e, (url) => setForm({...form, driverPhotoUrl: url}))} style={{ display: 'none' }} />
                                </label>
                            </div>
                        </div>

                        {/* LOCATIONS */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                            <div style={{ position: 'relative' }}>
                                <label style={{ display: 'block', color: 'var(--text-muted)', marginBottom: '8px', fontSize: '12px', fontWeight: 'bold', textTransform: 'uppercase' }}>Pickup Location</label>
                                <div style={{ position: 'relative' }}>
                                    <MapPin size={18} color="#22c55e" style={{ position: 'absolute', top: '14px', left: '14px' }}/>
                                    <input value={pickupQuery} onChange={e => setPickupQuery(e.target.value)} onKeyDown={e => handleKeyDown(e, pickupQuery, 'pickup')} placeholder="Type & Press Enter..." style={{ width: '100%', paddingLeft: '45px', paddingRight: '40px' }} />
                                    {isSearching && activeField === 'pickup' && <Loader size={16} className="animate-spin" style={{ position: 'absolute', top: '15px', right: '15px', color: '#3b82f6' }}/>}
                                </div>
                                {activeField === 'pickup' && suggestions.length > 0 && (
                                    <ul style={{ position: 'absolute', top: '100%', left: 0, width: '100%', background: '#18181b', border: '1px solid #333', borderRadius: '12px', zIndex: 500, maxHeight: '200px', overflowY: 'auto', listStyle: 'none', padding: 0, margin: '5px 0', boxShadow: '0 10px 25px rgba(0,0,0,0.5)' }}>
                                        {suggestions.map((s,i) => <li key={i} onClick={()=>selectLocation(s)} style={{ padding: '12px', borderBottom: '1px solid #27272a', cursor: 'pointer', fontSize: '13px', color: '#eee' }}>{s.display_name}</li>)}
                                    </ul>
                                )}
                            </div>

                            {extraPickups.map(p => (
                                <div key={p.id} style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                                    <div style={{ position: 'relative', flex: 1 }}>
                                        <input value={p.query} onChange={e => setExtraPickups(prev => prev.map(x => x.id === p.id ? { ...x, query: e.target.value } : x))} onKeyDown={e => handleKeyDown(e, p.query, 'via-pickup', p.id)} placeholder="Via stop (Press Enter)..." style={{ fontSize: '13px', padding: '12px' }} />
                                        {activeField === `via-pickup-${p.id}` && suggestions.length > 0 && (
                                            <ul style={{ position: 'absolute', top: '100%', left: 0, width: '100%', background: '#18181b', border: '1px solid #333', borderRadius: '8px', zIndex: 500, listStyle: 'none', padding: 0, margin: '5px 0' }}>
                                                {suggestions.map((s,i) => <li key={i} onClick={()=>selectLocation(s)} style={{ padding: '10px', cursor: 'pointer', fontSize: '12px' }}>{s.display_name}</li>)}
                                            </ul>
                                        )}
                                    </div>
                                    <button type="button" onClick={()=>removeStop('pickup', p.id)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '5px' }}><Trash2 size={18}/></button>
                                </div>
                            ))}
                            <button type="button" onClick={()=>addStop('pickup')} style={{ background: 'none', border: 'none', color: '#3b82f6', fontSize: '12px', cursor: 'pointer', alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 'bold' }}><Plus size={14}/> Add Pickup Stop</button>

                            <div style={{ position: 'relative', marginTop: '10px' }}>
                                <label style={{ display: 'block', color: 'var(--text-muted)', marginBottom: '8px', fontSize: '12px', fontWeight: 'bold', textTransform: 'uppercase' }}>Dropoff Location</label>
                                <div style={{ position: 'relative' }}>
                                    <MapPin size={18} color="#ef4444" style={{ position: 'absolute', top: '14px', left: '14px' }}/>
                                    <input value={dropQuery} onChange={e => setDropQuery(e.target.value)} onKeyDown={e => handleKeyDown(e, dropQuery, 'drop')} placeholder="Type & Press Enter..." style={{ width: '100%', paddingLeft: '45px', paddingRight: '40px' }} />
                                    {isSearching && activeField === 'drop' && <Loader size={16} className="animate-spin" style={{ position: 'absolute', top: '15px', right: '15px', color: '#3b82f6' }}/>}
                                </div>
                                {activeField === 'drop' && suggestions.length > 0 && (
                                    <ul style={{ position: 'absolute', top: '100%', left: 0, width: '100%', background: '#18181b', border: '1px solid #333', borderRadius: '12px', zIndex: 500, maxHeight: '200px', overflowY: 'auto', listStyle: 'none', padding: 0, margin: '5px 0', boxShadow: '0 10px 25px rgba(0,0,0,0.5)' }}>
                                        {suggestions.map((s,i) => <li key={i} onClick={()=>selectLocation(s)} style={{ padding: '12px', borderBottom: '1px solid #27272a', cursor: 'pointer', fontSize: '13px', color: '#eee' }}>{s.display_name}</li>)}
                                    </ul>
                                )}
                            </div>

                             {extraDrops.map(p => (
                                <div key={p.id} style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                                    <div style={{ position: 'relative', flex: 1 }}>
                                        <input value={p.query} onChange={e => setExtraDrops(prev => prev.map(x => x.id === p.id ? { ...x, query: e.target.value } : x))} onKeyDown={e => handleKeyDown(e, p.query, 'via-drop', p.id)} placeholder="Via stop (Press Enter)..." style={{ fontSize: '13px', padding: '12px' }} />
                                        {activeField === `via-drop-${p.id}` && suggestions.length > 0 && (
                                            <ul style={{ position: 'absolute', top: '100%', left: 0, width: '100%', background: '#18181b', border: '1px solid #333', borderRadius: '8px', zIndex: 500, listStyle: 'none', padding: 0, margin: '5px 0' }}>
                                                {suggestions.map((s,i) => <li key={i} onClick={()=>selectLocation(s)} style={{ padding: '10px', cursor: 'pointer', fontSize: '12px' }}>{s.display_name}</li>)}
                                            </ul>
                                        )}
                                    </div>
                                    <button type="button" onClick={()=>removeStop('drop', p.id)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '5px' }}><Trash2 size={18}/></button>
                                </div>
                            ))}
                            <button type="button" onClick={()=>addStop('drop')} style={{ background: 'none', border: 'none', color: '#f87171', fontSize: '12px', cursor: 'pointer', alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 'bold' }}><Plus size={14}/> Add Drop Stop</button>
                        </div>

                        {/* DATE & TIME SECTION */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                            <div>
                                <label style={{ display: 'block', color: 'var(--text-muted)', marginBottom: '8px', fontSize: '12px', fontWeight: 'bold', textTransform: 'uppercase' }}>Departure Date</label>
                                <div style={{ position:'relative' }}>
                                    <CalendarIcon size={16} style={{ position:'absolute', top:'14px', left:'14px', color:'#71717a' }}/>
                                    <input type="date" value={date} onChange={e=>setDate(e.target.value)} required min={new Date().toISOString().split('T')[0]} style={{ paddingLeft:'42px' }} />
                                </div>
                            </div>
                            <div>
                                <label style={{ display: 'block', color: 'var(--text-muted)', marginBottom: '8px', fontSize: '12px', fontWeight: 'bold', textTransform: 'uppercase' }}>Departure Time</label>
                                <div style={{ display: 'flex', gap: '4px', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', padding: '0 8px' }}>
                                    <ClockIcon size={16} style={{ color:'#71717a' }}/>
                                    <select value={selHour} onChange={e=>setSelHour(e.target.value)} style={{ border: 'none', background: 'transparent', padding: '12px 2px', width: '45px', textAlign: 'center', color: 'var(--text)', fontSize:'14px' }}>
                                        {[...Array(12)].map((_, i) => <option key={i} value={String(i+1).padStart(2, '0')}>{i+1}</option>)}
                                    </select>
                                    <span style={{ color: '#71717a' }}>:</span>
                                    <select value={selMin} onChange={e=>setSelMin(e.target.value)} style={{ border: 'none', background: 'transparent', padding: '12px 2px', width: '45px', textAlign: 'center', color: 'var(--text)', fontSize:'14px' }}>
                                        {['00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55'].map(m => <option key={m} value={m}>{m}</option>)}
                                    </select>
                                    <select value={selPeriod} onChange={e=>setSelPeriod(e.target.value)} style={{ border: 'none', background: 'transparent', padding: '12px 2px', width: '55px', textAlign: 'center', color:'#3b82f6', fontWeight:'bold', fontSize:'13px' }}>
                                        <option value="AM">AM</option>
                                        <option value="PM">PM</option>
                                    </select>
                                </div>
                            </div>                            </div>
                        {/* ESTIMATED COMPLETION (DROP-OFF) */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginTop: '10px' }}>
                            <div>
                                <label style={{ display: 'block', color: 'var(--text-muted)', marginBottom: '8px', fontSize: '12px', fontWeight: 'bold', textTransform: 'uppercase' }}>Estimated Completion Date</label>
                                <div style={{ position:'relative' }}>
                                    <CalendarIcon size={16} style={{ position:'absolute', top:'14px', left:'14px', color:'#71717a' }}/>
                                    <input type="date" value={endDate} onChange={e=>setEndDate(e.target.value)} min={new Date().toISOString().split('T')[0]} style={{ paddingLeft:'42px' }} />
                                </div>
                            </div>
                            <div>
                                <label style={{ display: 'block', color: 'var(--text-muted)', marginBottom: '8px', fontSize: '12px', fontWeight: 'bold', textTransform: 'uppercase' }}>Estimated Completion Time</label>
                                <div style={{ display: 'flex', gap: '4px', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', padding: '0 8px' }}>
                                    <ClockIcon size={16} style={{ color:'#71717a' }}/>
                                    <input type="time" value={endTime} onChange={e=>setEndTime(e.target.value)} style={{ border: 'none', background: 'transparent', padding: '12px 2px', width: '100%', textAlign: 'center', color: 'var(--text)', fontSize:'14px' }} />
                                </div>
                            </div>
                        </div>


                        {/* CAR SELECTION */}
                        <div>
                            <label style={{ display: 'block', color: 'var(--text-muted)', marginBottom: '8px', fontSize: '12px', fontWeight: 'bold', textTransform: 'uppercase' }}>Select Vehicle</label>
                            <select value={selectedCarId} onChange={e => e.target.value === 'add' ? setShowAddCar(true) : setSelectedCarId(e.target.value)} style={{ padding: '12px' }}>
                                <option value="">-- Choose Car --</option>
                                {myCars.map(c => <option key={c.id} value={c.id}>{c.name} ({c.number})</option>)}
                                <option value="add" style={{color:'#3b82f6', fontWeight:'bold'}}>+ Add New Vehicle</option>
                            </select>
                        </div>

                        {/* PRICE & SEATS SUMMARY */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '20px', padding: '20px', background: 'rgba(59, 130, 246, 0.05)', borderRadius: '16px', border: '1px solid rgba(59, 130, 246, 0.1)' }}>
                            <div style={{ flex: 1 }}>
                                <div style={{ fontSize: '10px', color: '#3b82f6', textTransform: 'uppercase', fontWeight: 'black', marginBottom: '4px' }}>Estimated Fare</div>
                                        <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Per seat</div>
                                        <div style={{ fontSize: '32px', fontWeight: 'black', color: 'var(--text)' }}>₹{form.price}</div>
                                        {(() => {
                                            const fare = computeFare({ price: form.price }, form.seatsAvailable || 1);
                                            const netToDriver = Number((fare.base - fare.platformFee).toFixed(2));
                                            return (
                                                <div style={{ marginTop: '8px', fontSize: '13px', color: 'var(--text-muted)' }}>
                                                    <div>Platform fee (5%): ₹{fare.platformFee.toFixed(2)}</div>
                                                    <div>Net to host: ₹{netToDriver.toFixed(2)}</div>
                                                </div>
                                            );
                                        })()}
                            </div>
                            <div style={{ textAlign: 'center' }}>
                                <label style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px', fontWeight:'bold' }}>SEATS</label>
                                <div style={{
  display: 'flex',
  alignItems: 'center',
  gap: '8px'
}}>
  <button
    type="button"
    onClick={() =>
      setForm(prev => ({
        ...prev,
        seatsAvailable: Math.max(1, prev.seatsAvailable - 1)
      }))
    }
    style={{
      width: '36px',
      height: '36px',
      borderRadius: '8px',
      border: '1px solid var(--border)',
      background: 'var(--card-bg)',
      color: 'var(--text)',
      fontSize: '20px',
      fontWeight: 'bold',
      cursor: 'pointer'
    }}
  >
    −
  </button>

  <input
    type="text"
    value={form.seatsAvailable}
    readOnly
    style={{
      width: '48px',
      height: '36px',
      textAlign: 'center',
      fontWeight: 'bold',
      fontSize: '18px',
      borderRadius: '8px',
      border: '1px solid var(--border)',
      background: 'var(--card-bg)',
      color: 'var(--text)'
    }}
  />

  <button
    type="button"
    onClick={() =>
      setForm(prev => ({
        ...prev,
        seatsAvailable: Math.min(8, prev.seatsAvailable + 1)
      }))
    }
    style={{
      width: '36px',
      height: '36px',
      borderRadius: '8px',
      border: '1px solid var(--border)',
      background: 'var(--card-bg)',
      color: 'var(--text)',
      fontSize: '20px',
      fontWeight: 'bold',
      cursor: 'pointer'
    }}
  >
    +
  </button>
</div>

                            </div>
                        </div>

                        <button type="submit" className="btn btn-primary" style={{ padding: '18px', fontSize: '18px', fontWeight: 'bold', borderRadius: '15px' }} disabled={loading}>{loading ? "Publishing..." : "Publish Ride"}</button>
                    </form>
                </div>

                {/* --- RIGHT: MAP PREVIEW (Sticky) --- */}
                <div style={{ position: 'sticky', top: '20px', height: '650px' }}>
                    <div className="card" style={{ padding: 0, height: '100%', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)' }}>
                        {(pickup && pickup.lat && drop && drop.lat) ? (
                            <RideMap pickup={pickup} drop={drop} stops={allStops} routeGeometry={routeInfo?.geometry} />
                        ) : (
                            <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#3f3f46', textAlign: 'center', padding: '40px' }}>
                                <Navigation size={64} style={{ opacity: 0.1, marginBottom: '20px' }}/>
                                <h3 style={{ color: '#71717a', marginBottom: '10px' }}>Route Preview</h3>
                                <p style={{ fontSize: '13px', maxWidth: '250px' }}>Enter pickup and destination to visualize your path and calculate distance.</p>
                            </div>
                        )}
                    </div>
                </div>

            </div>

            {/* --- MODALS --- */}
            {successModal && (
                <div className="modal-overlay">
                    <div className="card" style={{ maxWidth: '400px', textAlign: 'center', padding: '40px' }}>
                        <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'rgba(34, 197, 94, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
                            <CheckCircle size={40} color="#4ade80"/>
                        </div>
                        <h3 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '10px' }}>Success!</h3>
                        <p style={{ color: 'var(--text-muted)', marginBottom: '30px' }}>Your journey has been published successfully.</p>
                        <button onClick={()=>navigate('/rides/hosted')} className="btn btn-primary" style={{ width: '100%', padding: '14px' }}>View My Rides</button>
                    </div>
                </div>
            )}
            
             {showAddCar && (
                <div className="modal-overlay">
                    <div className="card" style={{ maxWidth: '450px', width: '90%' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px' }}>
                            <h3 style={{ margin: 0, fontSize: '20px' }}>Add Vehicle</h3>
                            <button onClick={()=>setShowAddCar(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={24}/></button>
                        </div>
                        <form onSubmit={handleAddCar} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                            <div>
                                <label style={{ fontSize: '11px', color: '#71717a', fontWeight: 'bold', marginBottom: '8px', textTransform:'uppercase' }}>Car Model</label>
                                <input placeholder="e.g. Honda Civic" value={newCar.name} onChange={e=>setNewCar({...newCar, name:e.target.value})} required />
                            </div>
                            <div>
                                <label style={{ fontSize: '11px', color: '#71717a', fontWeight: 'bold', marginBottom: '8px', textTransform:'uppercase' }}>License Plate</label>
                                <input placeholder="e.g. ABC-1234" value={newCar.number} onChange={e=>setNewCar({...newCar, number:e.target.value})} required />
                            </div>
                            <div>
                                <label style={{ fontSize: '11px', color: '#71717a', fontWeight: 'bold', marginBottom: '8px', textTransform:'uppercase' }}>Vehicle Photo</label>
                                <div style={{ position: 'relative', border: '2px dashed #27272a', padding: '30px', borderRadius: '12px', textAlign: 'center', cursor: 'pointer', color: '#71717a', overflow: 'hidden' }}>
                                    {newCar.imageUrl ? (
                                        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:'10px' }}>
                                            <img src={newCar.imageUrl} style={{ width:'100%', height:'120px', objectFit:'cover', borderRadius:'8px' }} alt="car" />
                                            <span style={{ fontSize: '12px', color: '#3b82f6', fontWeight: 'bold' }}>Replace Photo</span>
                                        </div>
                                    ) : (
                                        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:'10px' }}>
                                            <Upload size={32} style={{ opacity: 0.3 }}/>
                                            <span style={{ fontSize: '13px' }}>Click to Upload Photo</span>
                                        </div>
                                    )}
                                    <input type="file" accept="image/*" onChange={e=>handleImageUpload(e, (url) => setNewCar({...newCar, imageUrl: url}))} style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }} />
                                </div>
                            </div>
                            <button className="btn btn-primary" style={{ padding: '15px', marginTop: '10px' }}>Save Vehicle</button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}