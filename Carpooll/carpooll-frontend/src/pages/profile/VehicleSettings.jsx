import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { apiGet, apiPost, apiPut, apiDelete } from '../../api/api';
import Modal from "../../components/Modal";


export default function VehicleSettings({ user }){
    const [cars, setCars] = useState([]);
    const [loading, setLoading] = useState(true);
    const [adding, setAdding] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [showModal, setShowModal] = useState(false);
    const [form, setForm] = useState({ name:'', number:'', imageUrl: ''});
    const [showHistoryModal, setShowHistoryModal] = useState(false);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [vehicleHistoryRides, setVehicleHistoryRides] = useState([]);
    const [historyCar, setHistoryCar] = useState(null);
    const [showPassengersModal, setShowPassengersModal] = useState(false);
    const [passengersForRide, setPassengersForRide] = useState([]);
    const [selectedRideForDetails, setSelectedRideForDetails] = useState(null);

    useEffect(()=>{
        if (!user) return;
        fetchCars();
    }, [user]);

    function fetchCars(){
        setLoading(true);
        apiGet(`/api/users/${user.id}/cars`)
            .then(setCars)
            .catch(err=>{console.error(err); setCars([]);})
            .finally(()=>setLoading(false));
    }

    function toBase64(file){
        return new Promise((res, rej)=>{
            const reader = new FileReader();
            reader.onload = ()=>res(reader.result);
            reader.onerror = rej;
            reader.readAsDataURL(file);
        });
    }

    async function handleImage(e){
        const f = e.target.files?.[0];
        if (!f) return;
        try { const b64 = await toBase64(f); setForm({...form, imageUrl: b64}); } catch(e){console.error(e);}    
    }

    function editCar(car){
        setEditingId(car.id);
        setForm({ name: car.name || '', number: car.number || '', imageUrl: car.imageUrl || '' });
        setShowModal(true);
    }

    function cancelEdit(){
        setEditingId(null);
        setForm({ name:'', number:'', imageUrl: ''});
        setShowModal(false);
    }

    async function addCar(){
        setAdding(true);
        try{
            const payload = { name: form.name, number: form.number, imageUrl: form.imageUrl };
            // require all fields
            if (!form.name || !form.number || !form.imageUrl) {
                alert('Please fill all fields (name, number and image)');
                setAdding(false);
                return;
            }
            if (editingId) {
                await apiPut(`/api/users/${user.id}/cars/${editingId}`, payload);
                setEditingId(null);
            } else {
                await apiPost(`/api/users/${user.id}/cars`, payload);
            }
            setForm({ name:'', number:'', imageUrl: ''});
            setShowModal(false);
            fetchCars();
        }catch(err){ console.error(err); alert(err.message || 'Failed'); }
        finally{ setAdding(false); }
    }

    async function delCar(id){
        if (!confirm('Delete this car?')) return;
        try{
            await apiDelete(`/api/users/${user.id}/cars/${id}`);
            fetchCars();
        }catch(err){ console.error(err); alert(err.message || 'Failed'); }
    }

    async function openCarHistory(car){
        setHistoryCar(car);
        setShowHistoryModal(true);
        setHistoryLoading(true);
        try{
            // Endpoint may vary; try a reasonable path
            const rides = await apiGet(`/api/users/${user.id}/cars/${car.id}/rides`);
            if (rides && rides.length) {
                setVehicleHistoryRides(rides);
            } else {
                // fallback to hosted rides
                const hosted = await apiGet('/api/rides/hosted');
                const matches = (hosted||[]).filter(r => (
                    r.vehicleId === car.id ||
                    (r.vehicle && (r.vehicle.id === car.id || r.vehicle.number === car.number || (r.vehicle.name && car.name && r.vehicle.name.toLowerCase().includes(car.name.toLowerCase())))) ||
                    r.vehicleNumber === car.number ||
                    (r.vehicleName && car.name && r.vehicleName.toLowerCase().includes(car.name.toLowerCase()))
                ));
                setVehicleHistoryRides(matches);
            }
        }catch(err){
            console.error(err);
            // fallback: fetch hosted rides and filter by vehicle id
            try{
                const hosted = await apiGet('/api/rides/hosted');
                const matches = (hosted||[]).filter(r => (
                    r.vehicleId === car.id ||
                    (r.vehicle && (r.vehicle.id === car.id || r.vehicle.number === car.number || (r.vehicle.name && car.name && r.vehicle.name.toLowerCase().includes(car.name.toLowerCase())))) ||
                    r.vehicleNumber === car.number ||
                    (r.vehicleName && car.name && r.vehicleName.toLowerCase().includes(car.name.toLowerCase()))
                ));
                setVehicleHistoryRides(matches);
            }catch(e){ setVehicleHistoryRides([]); }
        }finally{ setHistoryLoading(false); }
    }

    async function openPassengers(ride){
        setSelectedRideForDetails(ride);
        setShowPassengersModal(true);
        try{
            const bookings = await apiGet(`/api/rides/${ride.id}/bookings`);
            setPassengersForRide(bookings || []);
        }catch(err){
            console.error(err);
            // fallback to bookings for host and filter by rideId
            try{
                const all = await apiGet('/api/bookings/for-host');
                setPassengersForRide((all||[]).filter(b=>b.rideId===ride.id));
            }catch(e){ setPassengersForRide([]); }
        }
    }

    const [ratingPassenger, setRatingPassenger] = useState(null);
    const [ratingLoading, setRatingLoading] = useState(false);
    const [ratingStars, setRatingStars] = useState(0);
    const [ratingNote, setRatingNote] = useState('');
    // locally track ratings submitted in this session to immediately disable Rate buttons
    const [submittedRatings, setSubmittedRatings] = useState({});

    async function submitPassengerRating(booking){
        if (ratingStars < 1) return alert('Select stars');
        if (!booking) return alert('Invalid booking');
        setRatingLoading(true);
        try{
            await apiPost('/api/ratings/submit', {
                bookingId: booking.id,
                stars: ratingStars,
                review: ratingNote
            });
            alert('Rating submitted');
            // mark locally as rated so UI disables immediately
            setSubmittedRatings(prev => ({ ...prev, [booking.id]: { stars: ratingStars, review: ratingNote } }));
            setRatingPassenger(null);
            setRatingStars(0);
            setRatingNote('');
            try{ window.dispatchEvent(new CustomEvent('rating:updated', { detail: { bookingId: booking.id, rideId: booking.rideId } })); }catch(e){}
        }catch(err){ console.error('Passenger rating error:', err); const msg = (err && err.message && err.message !== 'Internal Server Error') ? err.message : 'Rating failed: you may have already rated this booking.'; alert(msg); }
        finally{ setRatingLoading(false); }
    }

    return (
        <div className="p-6 max-w-3xl mx-auto">
            <div className="card">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-2xl font-bold">Vehicle Settings</h2>
                    <div className="text-sm text-gray-400">Manage your saved vehicles</div>
                </div>

                <div className="mb-6 flex items-center justify-between">
                    <div>
                        {editingId && <div className="text-sm text-gray-400">Editing: <b>{form.name || '—'}</b></div>}
                    </div>
                    <div className="flex gap-2">
                        <button onClick={()=>{ setEditingId(null); setForm({ name:'', number:'', imageUrl: ''}); setShowModal(true); }} className="btn btn-primary btn-md">Add Car</button>
                    </div>
                </div>

                {/* Add/Edit modal (now rendered via portal Modal component) */}
                <Modal show={showModal} onClose={()=>{ setShowModal(false); cancelEdit(); }} maxWidth={520}>
                    <div className="modal-header">
                        <h3>{editingId ? 'Edit Car' : 'Add Car'}</h3>
                        <button onClick={()=>{ setShowModal(false); cancelEdit(); }} style={{background:'none', border:'none', color:'white', cursor:'pointer'}}><X/></button>
                    </div>

                    <div className="mb-4">
                        <input placeholder="Car Name" value={form.name} onChange={e=>setForm({...form, name: e.target.value})} className="input" />
                        <input placeholder="Number" value={form.number} onChange={e=>setForm({...form, number: e.target.value})} className="input mt-3" />

                        <div className="mt-3">
                            <label className="btn btn-secondary btn-md cursor-pointer inline-flex items-center gap-3">
                                {form.imageUrl ? 'Change Image' : 'Add Image'}
                                <input type="file" accept="image/*" onChange={handleImage} style={{ display: 'none' }} />
                            </label>
                        </div>

                        {form.imageUrl && <div className="mt-3"><img src={form.imageUrl} alt="preview" style={{ width:'100%', height:160, objectFit:'cover', borderRadius:8 }} /></div>}
                    </div>

                    <div className="flex gap-3">
                        <button onClick={addCar} disabled={adding} className="btn btn-primary btn-md">{adding ? (editingId ? 'Saving...' : 'Adding...') : (editingId ? 'Save Changes' : 'Add Car')}</button>
                        <button onClick={()=>{ setShowModal(false); cancelEdit(); }} className="btn btn-secondary btn-md">Cancel</button>
                    </div>
                </Modal>

                <div>
                    <h3 className="text-lg font-semibold mb-3">Saved Cars</h3>
                    {loading ? <div>Loading...</div> : (
                        <div className="cars-grid">
                            {cars.length === 0 && <div className="empty-state">No cars saved yet.</div>}
                            {cars.map(c => (
                                <div key={c.id} className="card car-card" style={{ padding: 0, overflow: 'hidden', borderRadius: 12 }}>
                                    <div style={{ position: 'relative' }}>
                                        {c.imageUrl ? <img src={c.imageUrl} alt="car" style={{ width:'100%', height:160, objectFit:'cover' }} /> : <div style={{ width:'100%', height:160, background:'#0f1724' }} />}
                                        <div style={{ position: 'absolute', right: 12, top: 12, display: 'flex', gap: 8 }}>
                                            <button onClick={()=>openCarHistory(c)} className="btn btn-secondary btn-sm" style={{ background: 'rgba(255,255,255,0.06)', color: 'white', border: '1px solid rgba(255,255,255,0.06)', padding: '6px 10px' }}>History</button>
                                        </div>
                                    </div>
                                    <div style={{ padding: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                        <div>
                                            <div className="font-medium" style={{ fontSize: 15, color: 'white' }}>{c.name}</div>
                                            <div className="text-sm text-gray-400">{c.number}</div>
                                        </div>
                                        <div className="flex gap-2">
                                            <button onClick={()=>editCar(c)} className="btn btn-secondary btn-md">Edit</button>
                                            <button onClick={()=>delCar(c.id)} className="btn btn-danger btn-md">Delete</button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Vehicle History Modal */}
                {showHistoryModal && (
                    <Modal show={showHistoryModal} onClose={() => { setShowHistoryModal(false); setVehicleHistoryRides([]); setHistoryCar(null); }} maxWidth={900}>
                        <div style={{ padding: 8 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                                <h3 style={{ margin:0 }}>{historyCar ? `${historyCar.name} — Ride History` : 'Ride History'}</h3>
                                <button onClick={() => { setShowHistoryModal(false); setVehicleHistoryRides([]); setHistoryCar(null); }} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer' }}><X/></button>
                            </div>
                            {historyLoading ? <div style={{ padding: 40, textAlign: 'center' }}>Loading...</div> : (
                                <div style={{ display: 'grid', gap: 12 }}>
                                    {vehicleHistoryRides.length === 0 ? <div className="empty-state">No rides found for this vehicle.</div> : vehicleHistoryRides.map(r => (
                                        <div key={r.id} style={{ background: '#0b0b0b', padding: 12, borderRadius: 10, border: '1px solid rgba(255,255,255,0.04)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <div>
                                                <div style={{ fontWeight: 800 }}>{r.fromLocation} → {r.toLocation}</div>
                                                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{r.dateTime ? new Date(r.dateTime).toLocaleString() : '-'}{r.estimatedCompletionDateTime ? <span style={{ color: 'var(--text-muted)', marginLeft: 8 }}>Est: {new Date(r.estimatedCompletionDateTime).toLocaleString()}</span> : null}</div>
                                            </div>
                                            <div style={{ display: 'flex', gap: 8 }}>
                                                    <button onClick={() => openPassengers(r)} className="btn btn-secondary">Passengers</button>
                                                    <button onClick={() => openPassengers(r)} className="btn btn-primary">Details</button>
                                                </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </Modal>
                )}

                {/* Passengers Modal */}
                {showPassengersModal && selectedRideForDetails && (
                    <Modal show={showPassengersModal} onClose={() => { setShowPassengersModal(false); setPassengersForRide([]); setSelectedRideForDetails(null); }} maxWidth={900}>
                        <div style={{ padding: 12 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                                <h3 style={{ margin:0 }}>{selectedRideForDetails.fromLocation} → {selectedRideForDetails.toLocation}</h3>
                                <button onClick={() => { setShowPassengersModal(false); setPassengersForRide([]); setSelectedRideForDetails(null); }} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer' }}><X/></button>
                            </div>

                            {/* Driver contact summary (also visible to passengers) */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 12, color: 'var(--text-muted)', fontSize: 13 }}>
                                <div>
                                    <div style={{ fontWeight: 700, color: 'white' }}>Driver</div>
                                    <div>{selectedRideForDetails.driverName || selectedRideForDetails.ownerName || '—'}</div>
                                </div>
                                <div>
                                    <div style={{ fontWeight: 700, color: 'white' }}>Contact</div>
                                    <div>{selectedRideForDetails.ownerPhone || selectedRideForDetails.driverPhone || selectedRideForDetails.ownerEmail || '-'}</div>
                                </div>
                                {selectedRideForDetails.vehicleNumber ? (
                                    <div>
                                        <div style={{ fontWeight: 700, color: 'white' }}>Vehicle</div>
                                        <div>{selectedRideForDetails.vehicleNumber}</div>
                                    </div>
                                ) : null}
                            </div>
                            <div style={{ overflowX: 'auto' }}>
                                <table className="table" style={{ minWidth: 700 }}>
                                    <thead>
                                        <tr>
                                            <th>Passenger</th>
                                            <th>Contact</th>
                                            <th>Seats</th>
                                            <th>Payment</th>
                                            <th>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {passengersForRide.map(b => (
                                            <tr key={b.id}>
                                                <td>{b.requesterName}</td>
                                                <td className="muted">{b.requesterPhone || b.requesterEmail || '-'}</td>
                                                <td>{b.seatsRequested}</td>
                                                <td className="muted">
                                                    {b.amountPaid !== undefined && b.amountPaid !== null ? (
                                                        `₹${b.amountPaid}`
                                                    ) : (selectedRideForDetails && selectedRideForDetails.price ? (
                                                        `₹${(selectedRideForDetails.price * (b.seatsRequested || 1)).toFixed(2)}`
                                                    ) : (b.transactionId ? 'Yes' : '—'))}
                                                </td>
                                                <td>
                                                    <div style={{ display: 'flex', gap: 8 }}>
                                                        {selectedRideForDetails && (selectedRideForDetails.estimatedCompletionDateTime ? new Date(selectedRideForDetails.estimatedCompletionDateTime) < new Date() : (selectedRideForDetails.dateTime && new Date(selectedRideForDetails.dateTime) < new Date())) ? (
                                                            submittedRatings[b.id] ? (
                                                                <button className="btn btn-secondary btn-sm" disabled>Rated {submittedRatings[b.id].stars} ★</button>
                                                            ) : (
                                                                <button onClick={() => setRatingPassenger(b)} className="btn btn-secondary btn-sm">Rate</button>
                                                            )
                                                        ) : null}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {/* Rating drawer */}
                            {ratingPassenger && (
                                <div style={{ marginTop: 12, background: '#071024', padding: 12, borderRadius: 8 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <div>
                                            <div style={{ fontWeight: 800 }}>Rate {ratingPassenger.requesterName}</div>
                                            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{ratingPassenger.requesterEmail || ratingPassenger.requesterPhone}</div>
                                        </div>
                                        <div style={{ display: 'flex', gap: 8 }}>
                                            {[1,2,3,4,5].map(n=> (
                                                <button key={n} onClick={() => setRatingStars(n)} style={{ fontSize: 18, background: 'none', border: 'none', cursor: 'pointer', color: n<=ratingStars ? '#facc15' : '#444' }}>{'★'}</button>
                                            ))}
                                        </div>
                                    </div>
                                    <textarea placeholder="Feedback (optional)" value={ratingNote} onChange={e => setRatingNote(e.target.value)} style={{ width: '100%', marginTop: 10, padding: 8, borderRadius: 8, background: '#000', color: 'white' }} />
                                    <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                                        <button onClick={() => submitPassengerRating(ratingPassenger)} className="btn btn-primary" disabled={ratingLoading}>{ratingLoading ? 'Submitting...' : 'Submit Rating'}</button>
                                        <button onClick={() => setRatingPassenger(null)} className="btn btn-secondary">Cancel</button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </Modal>
                )}
            </div>
        </div>
    );
}

// Vehicle History Modal + Passengers Modal (rendered outside main return via portal Modal)
// The Modal component is already imported and used above for add/edit.
// We'll add the modal markup by appending to file exports using React portal invocation inside component is tricky,
// but the simplest approach is to render conditionally within this component above. For clarity we've implemented
// the state and handlers earlier — React will render those when toggled.

