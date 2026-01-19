import React, { useEffect, useState } from 'react';
import { apiGet, apiPost } from '../../api/api';
import Modal from '../../components/Modal';
import jsPDF from 'jspdf';

export default function History({ user }){
    const [tab, setTab] = useState('travel');
    const [travels, setTravels] = useState([]);
    const [driven, setDriven] = useState([]);
    const [loading, setLoading] = useState(false);
    const [page, setPage] = useState(1);
    const pageSize = 8;
    const [detailsModal, setDetailsModal] = useState(false);
    const [selectedDetail, setSelectedDetail] = useState(null);
    const [drivenPage, setDrivenPage] = useState(1);

    // Rating states
    const [ratingBooking, setRatingBooking] = useState(null);
    const [ratingStars, setRatingStars] = useState(0);
    const [ratingNote, setRatingNote] = useState('');
    const [ratingLoading, setRatingLoading] = useState(false);
    const [submittedRatings, setSubmittedRatings] = useState({});

    // Payment details modal
    const [paymentModalOpen, setPaymentModalOpen] = useState(false);
    const [paymentBooking, setPaymentBooking] = useState(null);
    const [paymentRide, setPaymentRide] = useState(null);

    const statusBadge = (s) => {
        const st = (s || '').toLowerCase();
        if (st.includes('conf') || st.includes('paid') || st.includes('success')) return <span className="badge status-success">{s}</span>;
        if (st.includes('rej') || st.includes('fail') || st.includes('rejected')) return <span className="badge status-failed">{s}</span>;
        return <span className="badge status-pending">{s}</span>;
    }

    useEffect(()=>{ if (user) fetchTravel(); }, [user]);

    async function fetchTravel(){
        setLoading(true);
        try{
            const t = await apiGet('/api/bookings/my');
            setTravels(t || []);
            const d = await apiGet('/api/bookings/for-host');
            const drivenRaw = d || [];
            // enrich driven bookings with ride details when possible
            const enriched = await Promise.all(drivenRaw.map(async b => {
                try{
                    if (b.rideDetails) return b;
                    if (!b.rideId) return b;
                    const ride = await apiGet(`/api/rides/${b.rideId}`);
                    return { ...b, rideDetails: ride };
                }catch(err){ return b; }
            }));

            // Group bookings by rideId so we show one entry per ride
            const byRide = {};
            enriched.forEach(b => {
                const id = b.rideId || (b.rideDetails && b.rideDetails.id) || `booking_${b.id}`;
                if (!byRide[id]) byRide[id] = { rideId: id, rideDetails: b.rideDetails || null, bookings: [] };
                byRide[id].bookings.push(b);
            });

            const drivenEntries = Object.values(byRide).map(entry => {
                // compute total amount received for this ride
                const ridePrice = entry.rideDetails?.price || 0;
                const total = entry.bookings.reduce((s, bk) => {
                    if (bk.amountPaid) return s + Number(bk.amountPaid);
                    return s + (ridePrice * (bk.seatsRequested || 1));
                }, 0);
                return { ...entry, totalAmountReceived: total };
            });

            setDriven(drivenEntries);
        }catch(err){ console.error(err); }
        finally{ setLoading(false); }
    }

    return (
        <div className="p-6 max-w-4xl mx-auto">
            <div className="card">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-2xl font-bold">Travel History</h2>
                    <div className="flex gap-3 history-controls">
                        <button onClick={()=>setTab('travel')} className={`btn ${tab==='travel' ? 'btn-primary btn-sm' : 'btn-secondary btn-sm'}`}>Travel history</button>
                        <button onClick={()=>setTab('driven')} className={`btn ${tab==='driven' ? 'btn-primary btn-sm' : 'btn-secondary btn-sm'}`}>Driven History</button>
                    </div>
                </div>

                {loading ? <div className="empty-state">Loading...</div> : (
                    <div>
                        {tab === 'travel' && (
                            <div>
                                {travels.length === 0 ? <div className="empty-state">No travel history yet.</div> : (
                                    <div>
                                        <div className="table-wrapper">
                                            <table className="table">
                                                <thead>
                                                    <tr>
                                                        <th>Booking ID</th>
                                                        <th>Ride ID</th>
                                                        <th>Seats</th>
                                                        <th>Status</th>
                                                        <th>Requested At</th>
                                                        <th>Payment Completed</th>
                                                        <th>Transaction</th>
                                                        <th>Actions</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {travels.slice((page-1)*pageSize, page*pageSize).map(b => (
                                                        <tr key={b.id}>
                                                            <td>{b.id}</td>
                                                            <td>{b.rideId}</td>
                                                            <td>{b.seatsRequested}</td>
                                                            <td>{statusBadge(b.status)}</td>
                                                            <td className="muted">{b.requestedAt ? new Date(b.requestedAt).toLocaleString() : '-'}</td>
                                                            <td className="muted">{b.paymentCompletedAt ? new Date(b.paymentCompletedAt).toLocaleString() : '-'}</td>
                                                            <td className="muted">{b.transactionId || '-'}</td>
                                                            <td style={{ minWidth: 240 }}>
                                                                <div style={{ display: 'flex', gap: 8 }}>
                                                                    <button className="btn btn-secondary btn-sm" onClick={() => window.open(`/ride/${b.rideId}`, '_blank')}>Route</button>

                                                                    {b.status === 'COMPLETED' && (
                                                                        <>
                                                                            <button className="btn btn-secondary btn-sm" onClick={async () => {
                                                                                try{
                                                                                    const ride = b.rideDetails || (b.rideId ? await apiGet(`/api/rides/${b.rideId}`) : null);
                                                                                    setPaymentBooking(b);
                                                                                    setPaymentRide(ride);
                                                                                    setPaymentModalOpen(true);
                                                                                }catch(err){ console.error(err); alert('Unable to load payment details'); }
                                                                            }}>Payment details</button>

                                                                            {submittedRatings[b.id] ? (
                                                                                <button className="btn btn-secondary btn-sm" disabled>Rated {submittedRatings[b.id].stars} ★</button>
                                                                            ) : (
                                                                                <button className="btn btn-primary btn-sm" onClick={() => setRatingBooking(b)}>Rate</button>
                                                                            )}
                                                                        </>
                                                                    )}
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>

                                        {/* Pagination controls */}
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
                                            <div style={{ color: 'var(--text-muted)' }}>Showing {(page-1)*pageSize+1} - {Math.min(page*pageSize, travels.length)} of {travels.length}</div>
                                            <div style={{ display: 'flex', gap: 8 }}>
                                                <button className="btn btn-secondary btn-sm" onClick={() => setPage(p => Math.max(1, p-1))} disabled={page===1}>Prev</button>
                                                <button className="btn btn-secondary btn-sm" onClick={() => setPage(p => (p*pageSize < travels.length ? p+1 : p))} disabled={page*pageSize >= travels.length}>Next</button>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {tab === 'driven' && (
                            <div>
                                {driven.length === 0 ? <div className="empty-state">No driven history yet.</div> : (
                                    <div>
                                        <div style={{ display: 'grid', gap: 10 }}>
                                            {driven.slice((drivenPage-1)*pageSize, drivenPage*pageSize).map(entry => (
                                                <div key={entry.rideId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 12, borderRadius: 10, background: 'var(--card-bg)', border: '1px solid var(--border)' }}>
                                                    <div>
                                                        <div style={{ fontWeight: 800 }}>{(entry.rideDetails?.fromLocation || (entry.bookings[0] && (entry.bookings[0].fromLocation)) || '—')} → {(entry.rideDetails?.toLocation || (entry.bookings[0] && entry.bookings[0].toLocation) || '—')}</div>
                                                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{entry.rideDetails?.dateTime ? new Date(entry.rideDetails.dateTime).toLocaleString() : ((entry.bookings[0] && entry.bookings[0].requestedAt) ? new Date(entry.bookings[0].requestedAt).toLocaleString() : '-')}{entry.rideDetails?.estimatedCompletionDateTime ? <div style={{ color:'#9ca3af', marginTop:4 }}>Est: {new Date(entry.rideDetails.estimatedCompletionDateTime).toLocaleString()}</div> : null}</div>
                                                        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>{(entry.rideDetails?.vehicleName || (entry.bookings[0] && entry.bookings[0].vehicleName) || 'Vehicle: —')} • {(entry.rideDetails?.vehicleNumber || (entry.bookings[0] && entry.bookings[0].vehicleNumber) || '—')}</div>
                                                    </div>
                                                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                                        <div style={{ textAlign: 'right', marginRight: 6 }}>
                                                            <div style={{ fontWeight: 800 }}>₹{entry.totalAmountReceived}</div>
                                                            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{entry.bookings.length} booking(s)</div>
                                                        </div>
                                                        <button className="btn btn-secondary" onClick={async () => {
                                                            try{
                                                                const ride = entry.rideDetails || (entry.rideId ? await apiGet(`/api/rides/${entry.rideId}`) : null);
                                                                let bookings = entry.bookings || [];
                                                                if (entry.rideId && (!bookings || bookings.length === 0)) {
                                                                    try{ bookings = await apiGet(`/api/rides/${entry.rideId}/bookings`); }catch(e){
                                                                        const all = await apiGet('/api/bookings/for-host');
                                                                        bookings = (all||[]).filter(x => x.rideId === entry.rideId);
                                                                    }
                                                                }
                                                                // compute per-passenger amount consistently
                                                                const ridePrice = ride?.price || 0;
                                                                const normalizedBookings = (bookings||[]).map(bk => ({
                                                                    ...bk,
                                                                    computedAmount: bk.amountPaid ? Number(bk.amountPaid) : (ridePrice * (bk.seatsRequested || 1))
                                                                }));
                                                                const total = normalizedBookings.reduce((s, bk) => s + (bk.computedAmount || 0), 0);
                                                                setSelectedDetail({ ride, bookings: normalizedBookings, booking: entry.bookings[0], totalAmount: total });
                                                                setDetailsModal(true);
                                                            }catch(err){
                                                                console.error('detail fetch error', err);
                                                                setSelectedDetail({ ride: entry.rideDetails || null, bookings: entry.bookings || [], totalAmount: (entry.totalAmountReceived || 0) });
                                                                setDetailsModal(true);
                                                            }
                                                        }}>View Details</button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>

                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
                                            <div style={{ color: 'var(--text-muted)' }}>Showing {(drivenPage-1)*pageSize+1} - {Math.min(drivenPage*pageSize, driven.length)} of {driven.length}</div>
                                            <div style={{ display: 'flex', gap: 8 }}>
                                                <button className="btn btn-secondary btn-sm" onClick={() => setDrivenPage(p => Math.max(1, p-1))} disabled={drivenPage===1}>Prev</button>
                                                <button className="btn btn-secondary btn-sm" onClick={() => setDrivenPage(p => (p*pageSize < driven.length ? p+1 : p))} disabled={drivenPage*pageSize >= driven.length}>Next</button>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {/* Details Modal for driven history (use portal Modal for correct centering) */}
                <Modal show={detailsModal && !!selectedDetail} onClose={() => { setDetailsModal(false); setSelectedDetail(null); }} maxWidth={900}>
                    {selectedDetail && (
                        <div style={{ background: '#09090b', padding: 8 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <h3 style={{ margin: 0 }}>{selectedDetail.ride?.fromLocation} → {selectedDetail.ride?.toLocation}</h3>
                                <button className="btn btn-secondary" onClick={() => { setDetailsModal(false); setSelectedDetail(null); }}>Close</button>
                            </div>

                            <div style={{ marginTop: 12 }}>
                                <h4 style={{ marginBottom: 8 }}>Passengers</h4>
                                <div style={{ overflowX: 'auto' }}>
                                    <table className="table" style={{ minWidth: 700 }}>
                                        <thead>
                                            <tr>
                                                <th>Passenger</th>
                                                <th>Contact</th>
                                                <th>Seats</th>
                                                <th>Amount</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {(selectedDetail.bookings||[]).map(b => (
                                                <tr key={b.id}>
                                                    <td>{b.requesterName}</td>
                                                    <td className="muted">{b.requesterPhone || b.requesterEmail || '-'}</td>
                                                    <td>{b.seatsRequested}</td>
                                                    <td className="muted">₹{b.computedAmount != null ? b.computedAmount : (b.amountPaid || '-')}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>

                                <h4 style={{ marginTop: 18 }}>Payment Summary</h4>
                                <div style={{ padding: 12, background: '#071024', borderRadius: 8 }}>
                                    <div>Total bookings: {(selectedDetail.bookings||[]).length}</div>
                                    <div style={{ marginTop: 6 }}>
                                        Total amount received: ₹{selectedDetail.totalAmount != null ? selectedDetail.totalAmount : (selectedDetail.bookings||[]).reduce((s, bk) => s + ((bk.amountPaid || 0)), 0)}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </Modal>

                {/* --- PAYMENT DETAILS (for individual booking) --- */}
                {paymentModalOpen && paymentBooking && (
                    <Modal show onClose={() => { setPaymentModalOpen(false); setPaymentBooking(null); setPaymentRide(null); }} maxWidth={600}>
                        <div style={{ padding: 20 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <h3 style={{ margin: 0 }}>Payment details</h3>
                                <button className="btn btn-secondary" onClick={() => { setPaymentModalOpen(false); setPaymentBooking(null); setPaymentRide(null); }}>Close</button>
                            </div>

                            <div style={{ marginTop: 12 }}>
                                <div style={{ fontWeight: 800 }}>{paymentRide?.fromLocation} → {paymentRide?.toLocation}</div>
                                <div style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 6 }}>
                                    Amount: ₹{(paymentRide?.price || 0) * (paymentBooking?.seatsRequested || 1)}
                                </div>
                                <div style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 6 }}>Transaction: {paymentBooking.transactionId || '—'}</div>
                                <div style={{ marginTop: 10 }}>
                                    <button className="btn btn-secondary" onClick={() => {
                                        try{
                                            const fare = require('../../utils/paymentUtils').computeFare(paymentRide || {}, paymentBooking?.seatsRequested || 1);
                                            const doc = new jsPDF();
                                            let y = 30;
                                            doc.setFontSize(16);
                                            doc.text('Invoice', 20, 20);
                                            doc.setFontSize(12);
                                            doc.text(`Invoice #: ${paymentBooking.transactionId || paymentBooking.id}`, 20, y); y += 10;
                                            doc.text(`Passenger: ${paymentBooking.requesterName || paymentBooking.requesterEmail || 'Passenger'}`, 20, y); y += 10;
                                            doc.text(`Seats: ${paymentBooking.seatsRequested || 1}`, 20, y); y += 12;

                                            doc.text(`Base fare: ₹${fare.base.toFixed(2)}`, 20, y); y += 8;
                                            doc.text(`Platform fee (5%): ₹${fare.platformFee.toFixed(2)}`, 20, y); y += 8;
                                            doc.text(`CGST (1.8%): ₹${fare.cgst.toFixed(2)}`, 20, y); y += 8;
                                            doc.text(`SGST (1.8%): ₹${fare.sgst.toFixed(2)}`, 20, y); y += 8;
                                            doc.setFont('helvetica', 'bold');
                                            doc.text(`Total Paid: ₹${fare.total.toFixed(2)}`, 20, y); y += 10;

                                            // Platform fee note for passenger
                                            doc.setFont('helvetica', 'normal');
                                            const note = "5% from the amount will be taken as a platform fees from driver and passanger to maintain the platform significantly.";
                                            const noteLines = doc.splitTextToSize(note, 170);
                                            doc.text(noteLines, 20, y); y += noteLines.length * 6;

                                            doc.save(`Invoice_${paymentBooking.transactionId || paymentBooking.id}.pdf`);
                                        }catch(err){ console.error(err); alert('Unable to generate invoice'); }
                                    }}>Download Invoice</button>
                                </div>
                            </div>
                        </div>
                    </Modal>
                )}

                {/* --- RATING MODAL FOR TRAVELS --- */}
                {ratingBooking && (
                    <Modal show onClose={() => setRatingBooking(null)} maxWidth={600}>
                        <div style={{ padding: 20 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <h3 style={{ margin: 0 }}>Rate your driver</h3>
                                <button className="btn btn-secondary" onClick={() => setRatingBooking(null)}>Close</button>
                            </div>

                            <div style={{ marginTop: 12 }}>
                                <div style={{ fontWeight: 800 }}>{ratingBooking.rideDetails?.fromLocation} → {ratingBooking.rideDetails?.toLocation}</div>
                                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>{ratingBooking.rideDetails?.dateTime ? new Date(ratingBooking.rideDetails.dateTime).toLocaleString() : ''}</div>

                                <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                                    {[1,2,3,4,5].map(n => (
                                        <button key={n} onClick={() => setRatingStars(n)} style={{ fontSize: 20, background: 'none', border: 'none', color: n <= ratingStars ? '#facc15' : '#444' }}>{'★'}</button>
                                    ))}
                                </div>

                                <textarea placeholder="Feedback (optional)" value={ratingNote} onChange={e => setRatingNote(e.target.value)} style={{ width: '100%', minHeight: 80, marginTop: 12, padding: 10 }} />

                                <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                                    <button className="btn btn-secondary" onClick={() => setRatingBooking(null)}>Cancel</button>
                                    <button className="btn btn-primary" disabled={ratingLoading} onClick={async () => {
                                        if (ratingStars < 1) return alert('Select stars');
                                        setRatingLoading(true);
                                        try{
                                            await apiPost('/api/ratings/submit', { bookingId: ratingBooking.id, stars: ratingStars, review: ratingNote });
                                            setSubmittedRatings(prev => ({ ...prev, [ratingBooking.id]: { stars: ratingStars, review: ratingNote } }));
                                            setRatingBooking(null); setRatingStars(0); setRatingNote('');
                                            await fetchTravel();
                                            try{ window.dispatchEvent(new CustomEvent('rating:updated', { detail: { bookingId: ratingBooking.id, rideId: ratingBooking.rideId || ratingBooking.rideDetails?.id } })); }catch(e){}
                                            alert('Rating submitted');
                                        }catch(err){ console.error(err); alert((err && err.message) ? err.message : 'Rating failed'); }
                                        finally{ setRatingLoading(false); }
                                    }}>{ratingLoading ? 'Submitting...' : 'Submit'}</button>
                                </div>
                            </div>
                        </div>
                    </Modal>
                )}
            </div>
        </div>
    );
}
