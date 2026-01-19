// src/pages/admin/AdminDashboard.jsx
import React, { useEffect, useState } from "react";
import { apiGet, apiPost, apiDelete } from "../../api/api";
import { Users, Shield, Car, LayoutDashboard, UserCheck, X, Calendar, Search, CreditCard, TrendingUp, TrendingDown, AlertCircle } from "lucide-react";


// --- CUSTOM SVG CHARTS (Standard CSS) ---
const SimplePieChart = ({ data, colors, onSliceClick }) => {
    const total = data.reduce((acc, val) => acc + val.value, 0);
    if (total === 0) return <div style={{width:'100%', height:'100%', borderRadius:'50%', border:'4px solid #333'}}></div>;
    
    let cumulativeAngle = 0;
    return (
        <svg viewBox="0 0 100 100" style={{width:'100%', height:'100%', transform:'rotate(-90deg)'}}>
            {data.map((slice, i) => {
                const angle = (slice.value / total) * 360;
                const x1 = 50 + 50 * Math.cos((Math.PI * cumulativeAngle) / 180);
                const y1 = 50 + 50 * Math.sin((Math.PI * cumulativeAngle) / 180);
                const x2 = 50 + 50 * Math.cos((Math.PI * (cumulativeAngle + angle)) / 180);
                const y2 = 50 + 50 * Math.sin((Math.PI * (cumulativeAngle + angle)) / 180);
                const largeArc = angle > 180 ? 1 : 0;
                const pathData = total === slice.value ? `CX 50 CY 50 R 50` : `M 50 50 L ${x1} ${y1} A 50 50 0 ${largeArc} 1 ${x2} ${y2} Z`;
                cumulativeAngle += angle;
                return (
                    <path
                        key={i}
                        d={pathData}
                        fill={colors[i]}
                        stroke="var(--border)"
                        strokeWidth="2"
                        style={{ cursor: onSliceClick ? 'pointer' : 'default' }}
                        onClick={() => onSliceClick && onSliceClick(slice.label || slice.value)}
                    />
                );
            })}
            <circle cx="50" cy="50" r="30" fill="var(--card-bg)" />
        </svg>
    );
};

const SimpleBarChart = ({ data, onBarClick }) => {
    const max = Math.max(...data.map(d => d.value)) || 1;
    return (
        <div style={{display:'flex', alignItems:'flex-end', justifyContent:'space-between', height:'200px', gap:'10px', paddingTop:'20px'}}>
            {data.map((d, i) => (
                <div key={i} title={`${d.label}: ${d.value} rides`} onClick={() => onBarClick && onBarClick(d, i)} style={{cursor: onBarClick ? 'pointer' : 'default', display:'flex', flexDirection:'column', alignItems:'center', width:'100%', height:'100%', justifyContent:'flex-end'}}>
                    <div style={{width:'100%', background:'rgba(59, 130, 246, 0.2)', borderRadius:'8px 8px 0 0', position:'relative', flexGrow: 1, display:'flex', alignItems:'flex-end'}}>
                        <div style={{width:'100%', background:'#3b82f6', borderRadius:'8px 8px 0 0', height: `${(d.value / max) * 100}%`, minHeight:'4px', transition:'height 0.5s ease'}}></div>
                        <div style={{position:'absolute', top:'-25px', left:'50%', transform:'translateX(-50%)', fontSize:'12px', color:'var(--text)'}}>{d.value}</div>
                    </div>
                    <span style={{fontSize:'10px', color:'var(--text-muted)', marginTop:'8px', fontWeight:'bold', textTransform:'uppercase'}}>{d.label}</span>
                </div>
            ))}
        </div>
    );
};

export default function AdminDashboard({ user }) {
    const [activeTab, setActiveTab] = useState("dashboard");
    const [users, setUsers] = useState([]);
    const [rides, setRides] = useState([]);
    const [bookings, setBookings] = useState([]);
    const [loading, setLoading] = useState(false);
    
    // Search states
    const [searchUsers, setSearchUsers] = useState("");
    const [searchTeam, setSearchTeam] = useState("");
    const [searchDrivers, setSearchDrivers] = useState("");
    const [searchRidesDriver, setSearchRidesDriver] = useState("");
    // Date range filter for Rides (applies to both Upcoming & Completed tables)
    const [ridesFilterStart, setRidesFilterStart] = useState('');
    const [ridesFilterEnd, setRidesFilterEnd] = useState('');
    
    // Driver modal states
    const [driverRidesModal, setDriverRidesModal] = useState(null);
    const [driverModalView, setDriverModalView] = useState("history"); // "history" or "upcoming"
    
    // Modals
    const [promoteModal, setPromoteModal] = useState(null);

    // User travel modal (upcoming / completed journeys)
    const [userJourneysModal, setUserJourneysModal] = useState(null);
    const [userJourneysView, setUserJourneysView] = useState('upcoming'); // 'upcoming' | 'history' 

    // Transactions / searches
    const [transactionsView, setTransactionsView] = useState('pending'); // 'pending' | 'failed' | 'successful'
    const [searchTransactions, setSearchTransactions] = useState('');
    // Sorting controls for admin lists
    const [driversSort, setDriversSort] = useState('none'); // 'none' | 'desc' | 'asc'
    const [usersSort, setUsersSort] = useState('none');
    // Pagination state for transactions and rides
    const [transactionsPage, setTransactionsPage] = useState(1);
    const [transactionsPageSize] = useState(10);
    const [ridesPageSize] = useState(10);
    const [upcomingPage, setUpcomingPage] = useState(1);
    const [completedPage, setCompletedPage] = useState(1);

    // Dashboard stat modal (click cards to open details)
    // Possible values: null | 'passengers' | 'drivers' | 'rides' | 'bookings' | 'day'
    const [statModal, setStatModal] = useState(null);
    const [chartFilter, setChartFilter] = useState(null);
    function openStatModal(type) { setStatModal(type); }
    function closeStatModal() { setStatModal(null); setChartFilter(null); }

    // Chart click handlers
    function handlePieClick(label) {
        if (!label) return;
        const lower = String(label).toLowerCase();
        if (lower.includes('pass')) openStatModal('passengers');
        else openStatModal('drivers');
    }
    function handleBarClick(data, index) {
        // data is the bar entry; prefer data.dayIndex if present (0=Sun..6=Sat)
        const dayIndex = data && data.dayIndex !== undefined ? data.dayIndex : index;
        setChartFilter({ type: 'day', dayIndex });
        openStatModal('day');
    }

    useEffect(() => { loadData(); }, []);

    // --- Revenue computation helpers (Gross, Platform fees, GST, Net to drivers)
    function moneyFmt(n) { return `Rs ${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`; }

    function computeBookingAmounts(b) {
        const seats = Number(b.seatsRequested || 1);
        const ride = rides.find(r => r.id === b.rideId) || {};
        // Prefer ride.price when available to compute base; otherwise try amountPaid fallback
        let base = 0;
        if (ride.price !== undefined && ride.price !== null) base = Number(ride.price) * seats;
        else if (b.amountPaid !== undefined && b.amountPaid !== null) {
            // fallback: assume amountPaid includes platform fees and gst; remove platformFees first
            base = Math.max(0, Number(b.amountPaid) - 20 * seats);
        }
        const platformFees = 20 * seats;
        const gst = Number(((base + platformFees) * 0.02).toFixed(2));
        const total = Number((base + platformFees + gst).toFixed(2));
        return { base, platformFees, gst, total };
    }

    function sumForPeriod(startDate, endDate) {
        const okStatuses = ['PAID','CONFIRMED','COMPLETED'];
        let gross = 0, platform = 0, gst = 0, total = 0;
        bookings.forEach(b => {
            // determine booking date: prefer paymentCompletedAt > confirmedAt > requestedAt
            const dt = new Date(b.paymentCompletedAt || b.confirmedAt || b.requestedAt || 0);
            if (isNaN(dt)) return;
            if (dt >= startDate && dt <= endDate && okStatuses.includes((b.status||'').toUpperCase())) {
                const amounts = computeBookingAmounts(b);
                gross += amounts.base;
                platform += amounts.platformFees;
                gst += amounts.gst;
                total += amounts.total;
            }
        });
        return { gross: Number(gross.toFixed(2)), platform: Number(platform.toFixed(2)), gst: Number(gst.toFixed(2)), total: Number(total.toFixed(2)) };
    }

    async function loadData() {
        setLoading(true);
        try {
            const [uData, rData, bData] = await Promise.all([ 
                apiGet("/api/admin/users"), apiGet("/api/admin/rides"), apiGet("/api/admin/bookings") 
            ]);
            setUsers(uData || []); setRides(rData || []); setBookings(bData || []);
        } catch (err) { console.error(err); } finally { setLoading(false); }
    }

    // --- LOGIC FOR REAL-TIME STATS ---

    // 1. Filter Lists for display
    const requests = users.filter(u => (u.role && u.role.toUpperCase().includes("ADMIN")) && !u.approved);
    // Updated team filter to include ASSISTANT
    const team = users.filter(u => (u.role && (u.role.toUpperCase().includes("ADMIN") || u.role.toUpperCase().includes("MANAGER") || u.role.toUpperCase().includes("ASSISTANT"))) && u.approved);
    const driversList = users.filter(u => rides.some(r => r.ownerEmail === u.email));
    const regularUsers = users.filter(u => u.role === "USER" && !rides.some(r => r.ownerEmail === u.email));

    // 2. Dashboard Logic: Exclude Admins from general stats
    const nonAdminUsers = users.filter(u => !['ADMIN', 'MANAGER', 'ASSISTANT'].includes(u.role?.toUpperCase()));
    
    // Identify Drivers vs Passengers within non-admin users
    const driverEmails = new Set(rides.map(r => r.ownerEmail));
    const activeDriversCount = nonAdminUsers.filter(u => driverEmails.has(u.email)).length;
    const passengerCount = nonAdminUsers.length - activeDriversCount;

    // 3. Real-time Weekly Activity Calculation (Current Week Only)
    // Map: 0=Sun, 1=Mon, ..., 6=Sat
    const dayCounts = [0, 0, 0, 0, 0, 0, 0];
    
    // Get start of current week (Sunday)
    const now = new Date();
    const currentDay = now.getDay(); // 0-6
    const diff = now.getDate() - currentDay;
    const startOfWeek = new Date(now.setDate(diff));
    startOfWeek.setHours(0, 0, 0, 0);
    
    // End of week (Saturday)
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);

    rides.forEach(r => {
        if(r.dateTime) {
            const d = new Date(r.dateTime);
            // Only count if within current week window
            if(!isNaN(d) && d >= startOfWeek && d <= endOfWeek) {
                dayCounts[d.getDay()]++;
            }
        }
    });
    bookings.forEach(b => {
        if(b.requestedAt) {
            const d = new Date(b.requestedAt);
            if(!isNaN(d) && d >= startOfWeek && d <= endOfWeek) {
                dayCounts[d.getDay()]++;
            }
        }
    });

    // Chart Data (Mon - Sun) - combined activity (bookings + rides)
    const activityStats = [
        { label: 'Mon', value: dayCounts[1] },
        { label: 'Tue', value: dayCounts[2] },
        { label: 'Wed', value: dayCounts[3] },
        { label: 'Thu', value: dayCounts[4] },
        { label: 'Fri', value: dayCounts[5] },
        { label: 'Sat', value: dayCounts[6] },
        { label: 'Sun', value: dayCounts[0] }
    ];

    // Ride-only counts for the bar chart (show only rides occurring on each weekday in the current week)
    // We compute counts for each weekday (0=Sun..6=Sat) but store them in a data array ordered Mon..Sun
    // and attach the canonical dayIndex (0..6) so clicks map correctly to actual weekdays.
    const weekdayNames = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    const countsByDay = [0,0,0,0,0,0,0];
    rides.forEach(r => {
        if (!r || !r.dateTime) return;
        const d = new Date(r.dateTime);
        if (isNaN(d)) return;
        // Only count rides within the current week window
        if (d >= startOfWeek && d <= endOfWeek) {
            countsByDay[d.getDay()] = (countsByDay[d.getDay()] || 0) + 1;
        }
    });

    // Build the bar data ordered Mono..Sun (index 0 => Mon, ... 6 => Sun)
    const ridesBarData = [1,2,3,4,5,6,0].map((dayIndex) => ({ label: weekdayNames[dayIndex], value: countsByDay[dayIndex] || 0, dayIndex }));

    // Pie Chart Data (Only Passengers & Drivers)
    const roleStats = [
        { label: 'Passengers', value: passengerCount },
        { label: 'Drivers', value: activeDriversCount }
    ];

    // Transaction groupings
    const pendingPayments = bookings.filter(b => b.status === 'PENDING' || b.status === 'ACCEPTED');
    const failedPayments = bookings.filter(b => b.status === 'REJECTED');
    const successfulPayments = bookings.filter(b => ['PAID','CONFIRMED','COMPLETED'].includes(b.status));

    // Rides lists for Admin -> Upcoming & Completed (filtered by estimated completion when available)
    const getRideEnd = (r) => (r && (r.estimatedCompletionDateTime || r.dateTime));
    const upcomingRidesList = rides.filter(r => getRideEnd(r) && new Date(getRideEnd(r)) >= now).sort((a,b) => new Date(getRideEnd(b)) - new Date(getRideEnd(a)));
    const completedRidesList = rides.filter(r => getRideEnd(r) && new Date(getRideEnd(r)) < now).sort((a,b) => new Date(getRideEnd(b)) - new Date(getRideEnd(a)));

    async function handleAccept(id) { try { await apiPost(`/api/admin/approve/${id}`, {}); await loadData(); setActiveTab('team'); } catch(e){} }
    async function handleDelete(id) { if(!confirm("Are you sure?")) return; try { await apiDelete(`/api/admin/user/${id}`); await loadData(); } catch(e){} }
    async function handlePromote(newRole) { if(!promoteModal) return; try { await apiPost(`/api/admin/promote/${promoteModal.id}`, { role: newRole }); await loadData(); setPromoteModal(null); } catch(e){} }

    // Helper to get rides for a driver (history = past rides, upcoming = future rides)
    function getDriverRides(driverEmail, view = 'history') {
        const driverRides = rides.filter(r => r.ownerEmail === driverEmail);
        const nowDt = new Date();
        if (view === 'history') {
            // past rides (completed by date)
            return driverRides.filter(r => r.dateTime && new Date(r.dateTime) < nowDt).sort((a,b) => new Date(b.dateTime) - new Date(a.dateTime));
        } else {
            // upcoming rides (not yet started)
            return driverRides.filter(r => !r.dateTime || new Date(r.dateTime) >= nowDt).sort((a,b) => new Date(b.dateTime) - new Date(a.dateTime));
        }
    }

    // Helper to get journeys for a user (join bookings with rides)
    function getUserJourneys(userEmail, view = 'upcoming') {
        const userBookings = bookings.filter(b => (b.requesterEmail || '').toLowerCase() === (userEmail || '').toLowerCase());
        const nowDt = new Date();
        const withRide = userBookings.map(b => ({ booking: b, ride: rides.find(r => r.id === b.rideId) }));
        if (view === 'history') {
            // Only include bookings that still have an associated ride and are completed by date
            return withRide.filter(x => x.ride && x.ride.dateTime && new Date(x.ride.dateTime) < nowDt)
                           .sort((a,b) => new Date(b.ride?.dateTime || 0) - new Date(a.ride?.dateTime || 0));
        } else {
            // Upcoming: exclude bookings with no associated ride (these produced rows with N/A)
            return withRide.filter(x => x.ride && (!x.ride.dateTime || new Date(x.ride.dateTime) >= nowDt))
                           .sort((a,b) => new Date(b.ride?.dateTime || 0) - new Date(a.ride?.dateTime || 0));
        }
    }

    // Robust seats helper (supports multiple possible fields and string values)
    function totalSeatsForRide(r) {
        if (!r) return 0;
        // Common field names used across datasets
        const candidates = [
            r.totalSeats, r.total_seats, r.initialSeats, r.initial_seats, r.capacity,
            r.carSeats, r.carCapacity, r.maxSeats, r.max_seats,
            r.seatsAvailable, r.seats, r.seats_total, r.remainingSeats, r.seatsRemaining
        ];
        const found = candidates.find(v => v !== undefined && v !== null);
        const num = Number(found ?? 0);
        const result = isNaN(num) ? 0 : Math.max(0, Math.floor(num));
        if (result === 0) {
            // helpful debug in console to find problematic rides during dev — safe to remove later
            try { console.warn('Ride seats unknown or zero for ride:', r.id || r, r); } catch(e){}
        }
        return result;
    }

    // Count bookings for a user that no longer have a linked ride (used to explain hidden rows)
    function countUserBookingsWithoutRide(userEmail) {
        return bookings.filter(b => (b.requesterEmail || '').toLowerCase() === (userEmail || '').toLowerCase() && !rides.find(r => r.id === b.rideId)).length;
    }

    // Compute the "initial" seats a driver advertised for a ride. We reconstruct it from
    // reported remaining seats and booking history (confirmed seats). Falls back to
    // booked/confirmed sums when necessary. Returns 0 if not derivable.
    function initialSeatsForRide(r) {
        if (!r) return 0;
        const reportedRemaining = totalSeatsForRide(r); // may be current remaining seats
        const seatsBooked = bookings.filter(b => b.rideId === r.id && b.status !== 'REJECTED').reduce((s, b) => s + (b.seatsRequested || 0), 0);
        const seatsConfirmed = bookings.filter(b => b.rideId === r.id && ['CONFIRMED','COMPLETED'].includes(b.status)).reduce((s, b) => s + (b.seatsRequested || 0), 0);

        let initial = Math.max(0, reportedRemaining + seatsConfirmed);
        if (initial === 0 && seatsBooked > 0) initial = seatsBooked;
        if (initial === 0 && seatsConfirmed > 0) initial = seatsConfirmed;

        if (initial === 0) {
            try { console.warn('Initial seats unknown for ride', r.id || r, { reportedRemaining, seatsBooked, seatsConfirmed }); } catch (e) {}
        }
        return initial;
    }

    // --- Pagination helper and computed lists ---
    const paginate = (arr, page = 1, size = 10) => {
        if (!Array.isArray(arr)) return [];
        const start = (Math.max(1, page) - 1) * size;
        return arr.slice(start, start + size);
    };

    // Build filtered & paginated bookings for Transactions
    const filteredBookings = bookings
        .filter(b => {
            if (transactionsView === 'pending') return b.status === 'PENDING' || b.status === 'ACCEPTED';
            if (transactionsView === 'failed') return b.status === 'REJECTED';
            return ['PAID','CONFIRMED','COMPLETED'].includes(b.status);
        })
        .filter(b => {
            if (!searchTransactions) return true;
            const s = searchTransactions.toLowerCase();
            const ride = rides.find(r => r.id === b.rideId) || {};
            const driverName = (ride.driverName || '').toLowerCase();
            const passenger = (b.requesterName || '').toLowerCase();
            return driverName.includes(s) || passenger.includes(s);
        });

    const totalTransactions = filteredBookings.length;
    const transactionsPages = Math.max(1, Math.ceil(totalTransactions / transactionsPageSize));
    const pagedBookings = paginate(filteredBookings, transactionsPage, transactionsPageSize);

    // Build filtered & paginated upcoming/completed rides lists
    const filteredUpcoming = upcomingRidesList.filter(r => {
        if (searchRidesDriver && !(r.driverName || '').toLowerCase().includes(searchRidesDriver.toLowerCase())) return false;
        const rd = r.dateTime ? new Date(r.dateTime) : null;
        if (ridesFilterStart) { const s = new Date(ridesFilterStart); s.setHours(0,0,0,0); if (!rd || rd < s) return false; }
        if (ridesFilterEnd) { const e = new Date(ridesFilterEnd); e.setHours(23,59,59,999); if (!rd || rd > e) return false; }
        return true;
    });
    const totalUpcoming = filteredUpcoming.length;
    const upcomingPages = Math.max(1, Math.ceil(totalUpcoming / ridesPageSize));
    const pagedUpcoming = paginate(filteredUpcoming, upcomingPage, ridesPageSize);

    const filteredCompleted = completedRidesList.filter(r => {
        if (searchRidesDriver && !(r.driverName || '').toLowerCase().includes(searchRidesDriver.toLowerCase())) return false;
        const rd = r.dateTime ? new Date(r.dateTime) : null;
        if (ridesFilterStart) { const s = new Date(ridesFilterStart); s.setHours(0,0,0,0); if (!rd || rd < s) return false; }
        if (ridesFilterEnd) { const e = new Date(ridesFilterEnd); e.setHours(23,59,59,999); if (!rd || rd > e) return false; }
        return true;
    });
    const totalCompleted = filteredCompleted.length;
    const completedPages = Math.max(1, Math.ceil(totalCompleted / ridesPageSize));
    const pagedCompleted = paginate(filteredCompleted, completedPage, ridesPageSize);

    return (
        <div className="container" style={{maxWidth: '1200px', padding:'30px 20px'}}>
            <h2 className="text-3xl font-bold mb-8 flex items-center gap-3" style={{color: 'var(--text)'}}>
                <div style={{width:48, height:48, borderRadius:10, background: '#10b981', display:'flex', alignItems:'center', justifyContent:'center'}}>
                    <Shield size={24} color="#fff" />
                </div>
                Admin Portal
            </h2>

            {/* --- TAB NAVIGATION --- */}
            <div style={{display:'flex', gap:'10px', marginBottom:'30px', overflowX:'auto', paddingBottom:'5px', position: 'sticky', top: 0, zIndex: 60, background: 'transparent'}}>
                {[
                    { id: 'dashboard', icon: LayoutDashboard, label: 'Dashboard' },
                    { id: 'requests', icon: UserCheck, label: `Requests (${requests.length})` },
                    { id: 'drivers', icon: Car, label: `Drivers (${driversList.length})` },
                    { id: 'team', icon: Shield, label: `Team (${team.length})` },
                    { id: 'users', icon: Users, label: `Users (${regularUsers.length})` },
                    { id: 'transactions', icon: CreditCard, label: `Transactions (${bookings.length})` },
                    { id: 'rides', icon: Calendar, label: 'Rides' },
                ].map(tab => (
                    <button 
                        key={tab.id}
                        onClick={()=>setActiveTab(tab.id)} 
                        className="btn"
                        style={{
                            background: activeTab === tab.id ? '#3b82f6' : 'rgba(255,255,255,0.05)',
                            color: activeTab === tab.id ? '#fff' : 'var(--text)',
                            border: 'none',
                            borderRadius: '8px',
                            padding: '10px 20px',
                            display: 'flex', alignItems: 'center', gap: '8px',
                            cursor: 'pointer'
                        }}
                    >
                        <tab.icon size={16}/> {tab.label}
                    </button>
                ))}
            </div>
            

            {/* --- DASHBOARD VISUALS --- */}
            {activeTab === 'dashboard' && (
                <div className="animate-fade">
                    {/* Stats Cards Row */}
                    <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(220px, 1fr))', gap:'20px', marginBottom:'30px'}}>
                        {[
                            { id: 'passengers', label: 'Passengers', value: passengerCount, icon: Users, color: '#3b82f6' },
                            { id: 'drivers', label: 'Active Drivers', value: activeDriversCount, icon: Car, color: '#10b981' },
                            { id: 'rides', label: 'Total Rides', value: rides.length, icon: Calendar, color: '#8b5cf6' },
                            { id: 'bookings', label: 'Total Bookings', value: bookings.length, icon: UserCheck, color: '#f59e0b' },
                        ].map((stat, i) => (
                            <div key={i} className="card" onClick={() => openStatModal(stat.id)} title={`View ${stat.label}`} style={{padding:'20px', display:'flex', justifyContent:'space-between', alignItems:'flex-start', borderLeft:`4px solid ${stat.color}`, cursor: 'pointer'}}>
                                <div>
                                    <div style={{fontSize:'12px', fontWeight:'bold', color:'var(--text-muted)', textTransform:'uppercase'}}>{stat.label}</div>
                                    <div style={{fontSize:'32px', fontWeight:'800', color:'var(--text)', marginTop:'5px'}}>{stat.value}</div>
                                </div>
                                <stat.icon size={28} color={stat.color} />
                            </div>
                        ))}
                        {/* Revenue cards: Today / Month / Year (show gross and platform fees) */}
                        {(() => {
                            const todayStart = new Date(); todayStart.setHours(0,0,0,0);
                            const todayEnd = new Date(); todayEnd.setHours(23,59,59,999);
                            const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0,0,0,0);
                            const monthEnd = new Date(monthStart); monthEnd.setMonth(monthStart.getMonth() + 1); monthEnd.setMilliseconds(-1);
                            const yearStart = new Date(new Date().getFullYear(), 0, 1); yearStart.setHours(0,0,0,0);
                            const yearEnd = new Date(new Date().getFullYear(), 11, 31); yearEnd.setHours(23,59,59,999);
                            const today = sumForPeriod(todayStart, todayEnd);
                            const month = sumForPeriod(monthStart, monthEnd);
                            const year = sumForPeriod(yearStart, yearEnd);
                            const revCards = [
                                { id: 'rev_today', label: 'Platform Revenue Today', data: today, color: '#06b6d4' },
                                { id: 'rev_month', label: 'Platform Revenue (This Month)', data: month, color: '#7c3aed' },
                                { id: 'rev_year', label: `Platform Revenue (YTD ${new Date().getFullYear()})`, data: year, color: '#059669' }
                            ];
                            return revCards.map((c, idx) => (
                                <div key={c.id} className="card" title={c.label} style={{padding:'14px', borderLeft:`4px solid ${c.color}`}}>
                                    <div style={{fontSize:'11px', color:'var(--text-muted)', fontWeight:'700', textTransform:'uppercase', marginBottom:6}}>{c.label}</div>
                                    <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                                        <div>
                                            <div style={{fontSize:'18px', fontWeight:'900', color:'var(--text)'}}>{moneyFmt(c.data.platform)}</div>
                                            <div style={{fontSize:'12px', color:'var(--text-muted)'}}>GST: {moneyFmt(c.data.gst)}</div>
                                        </div>
                                        <div style={{fontSize:24, fontWeight:900, color:c.color}}>{/* icon placeholder */}</div>
                                    </div>
                                </div>
                            ));
                        })()}
                    </div>

                    {/* Charts Row */}
                    <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(400px, 1fr))', gap:'20px'}}>
                        {/* Bar Chart (Rides only) */}
                        <div className="card">
                            <h3 style={{fontSize:'18px', fontWeight:'bold', color:'var(--text)', marginBottom:'10px'}}>
                                Weekly Rides <span style={{fontSize:'12px', fontWeight:'normal', color:'var(--text-muted)'}}>(Current Week)</span>
                            </h3>
                            <SimpleBarChart data={ridesBarData} onBarClick={handleBarClick} />
                        </div>
                        {/* Pie Chart (Distribution - No Admins) */}
                        <div className="card" style={{display:'flex', flexDirection:'column', alignItems:'center'}}>
                            <h3 style={{fontSize:'18px', fontWeight:'bold', color:'var(--text)', marginBottom:'20px'}}>User Distribution</h3>
                            <div style={{width:'200px', height:'200px', position:'relative'}}>
                                <SimplePieChart data={roleStats} colors={['#3b82f6', '#10b981']} onSliceClick={handlePieClick} />
                                <div style={{position:'absolute', inset:0, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', pointerEvents:'none'}}>
                                    <span style={{fontSize:'32px', fontWeight:'bold', color:'var(--text)'}}>{nonAdminUsers.length}</span>
                                    <span style={{fontSize:'10px', color:'var(--text-muted)'}}>USERS</span>
                                </div>
                            </div>
                            <div style={{display:'flex', gap:'15px', marginTop:'20px'}}>
                                {roleStats.map((s,i) => (
                                    <div key={i} style={{display:'flex', alignItems:'center', gap:'5px', fontSize:'12px', color:'var(--text-muted)'}}>
                                        <div style={{width:'8px', height:'8px', borderRadius:'50%', background:['#3b82f6', '#10b981'][i]}}></div>
                                        {s.label}: {s.value}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}
            

            {/* --- COMMON GRID LAYOUT STYLE --- */}
            {/* I am using a consistent inline grid style for all list sections to ensure side-by-side layout */}
            
            {/* --- REQUESTS SECTION --- */}
            {activeTab === 'requests' && (
                <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px'}}>
                    {requests.map(u => (
                        <div key={u.id} className="card" style={{position:'relative', overflow:'hidden', borderLeft:'4px solid #f59e0b'}}>
                            <div style={{position:'absolute', top:10, right:10, color:'#f59e0b'}}><UserCheck/></div>
                            <h3 style={{margin:'0 0 5px 0', color:'var(--text)'}}>{u.fullname}</h3>
                            <p style={{margin:'0 0 15px 0', color:'var(--text-muted)', fontSize:'14px'}}>{u.email}</p>
                            <div style={{display:'flex', gap:'10px'}}>
                                <button onClick={()=>handleAccept(u.id)} className="btn btn-success" style={{flex:1}}>Approve</button>
                                <button onClick={()=>handleDelete(u.id)} className="btn btn-danger" style={{flex:1}}>Reject</button>
                            </div>
                        </div>
                    ))}
                    {requests.length === 0 && <div style={{color:'gray', gridColumn:'1/-1', textAlign:'center'}}>No pending requests.</div>}
                </div>
            )}
            

            {/* --- DRIVERS SECTION --- */}
            {activeTab === 'drivers' && (
                <div>
                    <div style={{display:'flex', gap:'10px', marginBottom:'15px', alignItems:'center'}}>
                        <div style={{flex:1, position:'relative'}}>
                            <input value={searchDrivers} onChange={e => setSearchDrivers(e.target.value)} placeholder="Search drivers by name..." style={{width:'100%', padding:'8px 12px', borderRadius:'6px', background:'var(--input-bg)', border:'1px solid var(--border)', color:'var(--text)'}} />
                            <Search size={14} style={{position:'absolute', right:10, top:'50%', transform:'translateY(-50%)', color:'var(--text-muted)'}} />
                        </div>
                    </div>
                    <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px'}}>
                        <div style={{gridColumn: '1 / -1', display:'flex', justifyContent:'flex-end', gap:8, marginBottom:6}}>
                            <button className="btn" onClick={() => setDriversSort('desc')} style={{background: driversSort === 'desc' ? 'var(--primary)' : 'var(--input-bg)', color: driversSort === 'desc' ? 'white' : 'var(--text)'}}>Top → Low</button>
                            <button className="btn" onClick={() => setDriversSort('asc')} style={{background: driversSort === 'asc' ? 'var(--primary)' : 'var(--input-bg)', color: driversSort === 'asc' ? 'white' : 'var(--text)'}}>Low → Top</button>
                            <button className="btn" onClick={() => setDriversSort('none')} style={{background: driversSort === 'none' ? 'var(--primary)' : 'var(--input-bg)', color: driversSort === 'none' ? 'white' : 'var(--text)'}}>Clear</button>
                        </div>
                        {(() => {
                            const filtered = driversList.filter(u => u.fullname.toLowerCase().includes(searchDrivers.toLowerCase()));
                            const sorted = driversSort === 'none' ? filtered : [...filtered].sort((a,b) => (driversSort === 'desc' ? (Number(b.averageRating||0) - Number(a.averageRating||0)) : (Number(a.averageRating||0) - Number(b.averageRating||0))));
                            if (sorted.length === 0) return <div style={{color:'gray', gridColumn:'1/-1', textAlign:'center'}}>No drivers found.</div>;
                            return sorted.map(u => (
                                <div key={u.id} className="card" style={{borderLeft:'4px solid #3b82f6'}}>
                                    <div style={{display:'flex', justifyContent:'space-between', alignItems:'start'}}>
                                        <div>
                                            <h3 style={{margin:'0 0 5px 0', color:'var(--text)'}}>{u.fullname}</h3>
                                            <p style={{margin:'0 0 6px 0', color:'var(--text-muted)', fontSize:'14px'}}>{u.email}</p>
                                            <div style={{fontSize:12, color:'#f59e0b'}}>Rating: {u.averageRating ?? '—'} {u.ratingCount ? `(${u.ratingCount})` : ''} ★</div>
                                        </div>
                                        <Car color="var(--primary)"/>
                                    </div>
                                    <div style={{display:'flex', gap:'10px', marginTop:'12px'}}>
                                        <button onClick={() => { setDriverModalView('history'); setDriverRidesModal(u); }} className="btn btn-secondary" style={{flex:1, color: 'var(--text)'}}>History</button>
                                        <button onClick={() => { setDriverModalView('upcoming'); setDriverRidesModal(u); }} className="btn btn-primary" style={{flex:1}}>Upcoming</button>
                                    </div>
                                </div>
                            ));
                        })()}
                    </div>
                </div>
            )}

            {/* --- TEAM SECTION --- */}
            {activeTab === 'team' && (
                <div>
                    <div style={{display:'flex', gap:'10px', marginBottom:'15px', alignItems:'center'}}>
                        <div style={{flex:1, position:'relative'}}>
                            <input value={searchTeam} onChange={e => setSearchTeam(e.target.value)} placeholder="Search team by name..." style={{width:'100%', padding:'8px 12px', borderRadius:'6px', background:'var(--input-bg)', border:'1px solid var(--border)', color:'var(--text)'}} />
                            <Search size={14} style={{position:'absolute', right:10, top:'50%', transform:'translateY(-50%)', color:'var(--text-muted)'}} />
                        </div>
                    </div>
                    <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px'}}>
                        {team.filter(u => u.fullname.toLowerCase().includes(searchTeam.toLowerCase())).map(u => (
                            <div key={u.id} className="card" style={{borderLeft:'4px solid #8b5cf6'}}>
                                <h3 style={{margin:'0 0 5px 0', color:'var(--text)'}}>{u.fullname}</h3>
                                <span style={{background:'rgba(139, 92, 246, 0.2)', color:'var(--primary)', padding:'2px 8px', borderRadius:'4px', fontSize:'12px', fontWeight:'bold'}}>{u.role}</span>
                                <div style={{display:'flex', gap:'10px', marginTop:'15px'}}>
                                    <button onClick={()=>setPromoteModal(u)} className="btn btn-primary" style={{flex:1}}>Edit Role</button>
                                    <button onClick={()=>handleDelete(u.id)} className="btn btn-danger" style={{flex:1}}>Remove</button>
                                </div>
                            </div>
                        ))}
                        {team.filter(u => u.fullname.toLowerCase().includes(searchTeam.toLowerCase())).length === 0 && (
                            <div style={{color:'gray', gridColumn:'1/-1', textAlign:'center'}}>No team members found.</div>
                        )}
                    </div>
                </div>
            )}

            {/* --- USERS SECTION --- */}
            {activeTab === 'users' && (
                <div>
                    <div style={{display:'flex', gap:'10px', marginBottom:'15px', alignItems:'center'}}>
                        <div style={{flex:1, position:'relative'}}>
                            <input value={searchUsers} onChange={e => setSearchUsers(e.target.value)} placeholder="Search users by name..." style={{width:'100%', padding:'8px 12px', borderRadius:'6px', background:'var(--input-bg)', border:'1px solid var(--border)', color:'var(--text)'}} />
                            <Search size={14} style={{position:'absolute', right:10, top:'50%', transform:'translateY(-50%)', color:'var(--text-muted)'}} />
                        </div>
                    </div>
                    <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px'}}>
                        <div style={{gridColumn: '1 / -1', display:'flex', justifyContent:'flex-end', gap:8, marginBottom:6}}>
                            <button className="btn" onClick={() => setUsersSort('desc')} style={{background: usersSort === 'desc' ? 'var(--primary)' : 'var(--input-bg)', color: usersSort === 'desc' ? 'white' : 'var(--text)'}}>Top → Low</button>
                            <button className="btn" onClick={() => setUsersSort('asc')} style={{background: usersSort === 'asc' ? 'var(--primary)' : 'var(--input-bg)', color: usersSort === 'asc' ? 'white' : 'var(--text)'}}>Low → Top</button>
                            <button className="btn" onClick={() => setUsersSort('none')} style={{background: usersSort === 'none' ? 'var(--primary)' : 'var(--input-bg)', color: usersSort === 'none' ? 'white' : 'var(--text)'}}>Clear</button>
                        </div>
                        {(() => {
                            const filtered = regularUsers.filter(u => u.fullname.toLowerCase().includes(searchUsers.toLowerCase()));
                            const sorted = usersSort === 'none' ? filtered : [...filtered].sort((a,b) => (usersSort === 'desc' ? (Number(b.averageRating||0) - Number(a.averageRating||0)) : (Number(a.averageRating||0) - Number(b.averageRating||0))));
                            if (sorted.length === 0) return <div style={{color:'gray', gridColumn:'1/-1', textAlign:'center'}}>No users found.</div>;
                            return sorted.map(u => (
                                <div key={u.id} className="card">
                                    <div style={{display:'flex', justifyContent:'space-between', alignItems:'start'}}>
                                        <div>
                                            <h3 style={{margin:'0 0 5px 0', color:'var(--text)'}}>{u.fullname}</h3>
                                            <p style={{margin:'0 0 6px 0', color:'var(--text-muted)', fontSize:'14px'}}>{u.email}</p>
                                            <div style={{fontSize:12, color:'#f59e0b'}}>Rating: {u.averageRating ?? '—'} {u.ratingCount ? `(${u.ratingCount})` : ''} ★</div>
                                        </div>
                                        <Users color="var(--text-muted)"/>
                                    </div>
                                    <div style={{display:'flex', gap:'10px'}}>
                                        <button onClick={() => { setUserJourneysView('upcoming'); setUserJourneysModal(u); }} className="btn btn-secondary" style={{flex:1}}>Travel Details</button>
                                        <button onClick={()=>handleDelete(u.id)} className="btn btn-danger" style={{flex:1}}>Delete Account</button>
                                    </div>
                                </div>
                            ));
                        })()}
                    </div>
                </div>
            )}

            {/* --- TRANSACTIONS SECTION --- */}
            {activeTab === 'transactions' && (
                <div className="card" style={{padding:'20px'}}>
                    <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'15px'}}>
                        <div style={{display:'flex', gap:'8px'}}>
                            <button onClick={() => setTransactionsView('pending')} className="btn" style={{background: transactionsView === 'pending' ? 'var(--primary)' : 'var(--input-bg)', color: transactionsView === 'pending' ? 'white' : 'var(--text)'}}>Pending ({pendingPayments.length})</button>
                            <button onClick={() => setTransactionsView('failed')} className="btn" style={{background: transactionsView === 'failed' ? 'var(--danger)' : 'var(--input-bg)', color: transactionsView === 'failed' ? 'white' : 'var(--text)'}}>Failed ({failedPayments.length})</button>
                            <button onClick={() => setTransactionsView('successful')} className="btn" style={{background: transactionsView === 'successful' ? 'var(--success)' : 'var(--input-bg)', color: transactionsView === 'successful' ? 'white' : 'var(--text)'}}>Successful ({successfulPayments.length})</button>
                        </div>
                        <div style={{width:'260px', position:'relative'}}>
                            <input value={searchTransactions} onChange={e => setSearchTransactions(e.target.value)} placeholder="Search passenger or driver..." style={{width:'100%', padding:'8px 12px', borderRadius:'6px', background:'var(--input-bg)', border:'1px solid var(--border)', color:'var(--text)'}} />
                            <Search size={14} style={{position:'absolute', right:10, top:'50%', transform:'translateY(-50%)', color:'var(--text-muted)'}} />
                        </div>
                    </div>
                    <div style={{maxHeight:'60vh', overflowY:'auto'}}>
                        <table style={{width:'100%', borderCollapse:'collapse', tableLayout: 'fixed'}}>
                            <thead>
                                <tr style={{borderBottom:'1px solid var(--border)', color:'var(--text-muted)'}}>
                                    <th style={{padding:'10px', width:'160px', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>Date</th>
                                    <th style={{padding:'10px', width:'220px', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>Passenger</th>
                                    <th style={{padding:'10px', width:'220px', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>Driver</th>
                                    <th style={{padding:'10px', width:'260px', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>Route</th>
                                    <th style={{padding:'10px', width:'100px', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>Amount</th>
                                    <th style={{padding:'10px', width:'120px', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {pagedBookings.map(b => {
                                    const ride = rides.find(r => r.id === b.rideId) || {};
                                    return (
                                        <tr key={b.id} style={{borderBottom:'1px solid #333'}}>
                                            <td style={{padding:'10px', color:'var(--text-muted)'}}>{new Date(b.paymentCompletedAt || b.requestedAt || b.confirmedAt || b.requestedAt).toLocaleString()}</td>
                                            <td style={{padding:'10px', color:'var(--text)'}}>{b.requesterName || b.requesterEmail}</td>
                                            <td style={{padding:'10px', color:'var(--text)'}}>{ride.driverName || (rides.find(r=>r.ownerEmail===ride.ownerEmail)?.driverName) || 'N/A'}</td>
                                            <td style={{padding:'10px', fontWeight:'bold', color:'var(--primary)'}}>{ride.fromLocation} ➔ {ride.toLocation}</td>
                                            <td style={{padding:'10px', color:'var(--success)', fontWeight:'bold'}}>₹{ride.price ? (ride.price * (b.seatsRequested||1)) : 'N/A'}</td>
                                            <td style={{padding:'10px', color:'var(--text-muted)'}}>{b.status}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                    {/* Transactions pagination controls */}
                    <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginTop: 12}}>
                        <div style={{color:'var(--text-muted)', fontSize:12}}>Showing {(transactionsPage - 1) * transactionsPageSize + 1} - {Math.min(transactionsPage * transactionsPageSize, totalTransactions)} of {totalTransactions}</div>
                        <div style={{display:'flex', gap:8}}>
                            <button className="btn" onClick={() => setTransactionsPage(Math.max(1, transactionsPage - 1))} disabled={transactionsPage <= 1}>Prev</button>
                            <button className="btn" onClick={() => setTransactionsPage(Math.min(transactionsPages, transactionsPage + 1))} disabled={transactionsPage >= transactionsPages}>Next</button>
                        </div>
                    </div>
                </div>
            )}

            {/* --- RIDES SECTION --- */}
            {activeTab === 'rides' && (
                <div style={{display:'grid', gridTemplateColumns:'1fr', gap:'20px'}}>
                    <div className="card" style={{padding:'20px'}}>
                        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'15px'}}>
                            <h3 style={{margin:0, color:'var(--text)'}}>Upcoming Rides</h3>
                            <div style={{display:'flex', gap:'10px', alignItems:'center'}}>
                                <div style={{position:'relative'}}>
                                    <input value={searchRidesDriver} onChange={e => setSearchRidesDriver(e.target.value)} placeholder="Filter by driver name..." style={{padding:'8px 12px', borderRadius:'6px', background:'var(--input-bg)', border:'1px solid var(--border)', color:'var(--text)'}} />
                                    <Search size={14} style={{position:'absolute', right:10, top:'50%', transform:'translateY(-50%)', color:'var(--text-muted)'}} />
                                </div>
                                <div style={{display:'flex', gap:'8px', alignItems:'center'}}>
                                    <input type="date" value={ridesFilterStart} onChange={e => setRidesFilterStart(e.target.value)} title="Start date" style={{padding:'6px 8px', borderRadius:'6px', background:'rgba(255,255,255,0.03)', border:'1px solid #333', color:'white'}} />
                                    <input type="date" value={ridesFilterEnd} onChange={e => setRidesFilterEnd(e.target.value)} title="End date" style={{padding:'6px 8px', borderRadius:'6px', background:'rgba(255,255,255,0.03)', border:'1px solid #333', color:'white'}} />
                                    <button className="btn" onClick={() => { setRidesFilterStart(''); setRidesFilterEnd(''); }} style={{padding:'6px 10px'}}>Clear</button>
                                </div>
                            </div>
                        </div>
                        <div style={{maxHeight:'45vh', overflowY:'auto'}}>
                            <table style={{width:'100%', borderCollapse:'collapse'}}>
                                <thead>
                                    <tr style={{borderBottom:'1px solid var(--border)', color:'var(--text-muted)'}}>
                                        <th style={{padding:'10px'}}>Date</th>
                                        <th style={{padding:'10px'}}>Driver</th>
                                        <th style={{padding:'10px'}}>Route</th>
                                        <th style={{padding:'10px'}}>Total Seats</th>
                                        <th style={{padding:'10px'}}>Seats Booked</th>
                                        <th style={{padding:'10px'}}>Seats Unbooked</th>
                                        <th style={{padding:'10px'}}>Price</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {pagedUpcoming.map(r => { 
                                        // seatsBooked: all non-rejected reservations
                                        const seatsBooked = bookings.filter(b => b.rideId === r.id && b.status !== 'REJECTED').reduce((s, b) => s + (b.seatsRequested || 0), 0);
                                        // seatsConfirmed: those already confirmed/completed (seats deducted from remaining count)
                                        const seatsConfirmed = bookings.filter(b => b.rideId === r.id && ['CONFIRMED','COMPLETED'].includes(b.status)).reduce((s, b) => s + (b.seatsRequested || 0), 0);
                                        const reportedRemaining = totalSeatsForRide(r); // likely current remaining seats
                                        // initial seats = reported remaining + confirmed seats (if reportedRemaining is remaining), but fallback to booked totals if missing
                                        let initialSeats = Math.max(0, reportedRemaining + seatsConfirmed);
                                        if (initialSeats === 0 && seatsBooked > 0) initialSeats = seatsBooked;
                                        if (initialSeats === 0 && seatsConfirmed > 0) initialSeats = seatsConfirmed;

                                        const unbooked = Math.max(0, initialSeats - seatsBooked);
                                        const overbooked = seatsBooked - initialSeats > 0 ? seatsBooked - initialSeats : 0;
                                        if (overbooked > 0) { try { console.warn('Ride overbooked', r.id || r, { initialSeats, seatsBooked, seatsConfirmed }); } catch(e){} }
                                        return (
                                        <tr key={r.id} style={{borderBottom:'1px solid var(--border)'}}>
                                            <td style={{padding:'10px', color:'var(--text-muted)'}}>{r.dateTime ? new Date(r.dateTime).toLocaleString() : 'N/A'}</td>
                                            <td style={{padding:'10px'}}>{r.driverName}</td>
                                            <td style={{padding:'10px', fontWeight:'bold', color:'var(--primary)'}}>{r.fromLocation} ➔ {r.toLocation}</td>
                                            <td style={{padding:'10px'}} title={initialSeats > 0 ? `${initialSeats} seats` : 'Initial seats unknown'}>{initialSeats > 0 ? initialSeats : 'N/A'}</td>
                                            <td style={{padding:'10px', color: overbooked > 0 ? '#f87171' : undefined, fontWeight: overbooked > 0 ? 'bold' : undefined}} title={overbooked > 0 ? `Overbooked by ${overbooked} seats` : undefined}>
                                                {seatsBooked}{overbooked > 0 ? ` (overbooked ${overbooked})` : ''}{overbooked > 0 && <AlertCircle size={14} style={{marginLeft:6, verticalAlign:'middle', color:'#f87171'}}/>}
                                            </td>
                                            <td style={{padding:'10px'}}>{unbooked}</td>
                                            <td style={{padding:'10px', color:'var(--success)'}}>₹{r.price}</td>
                                        </tr>
                                    )})}  
                                </tbody>
                            </table>
                        </div>
                        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:12}}>
                            <div style={{color:'var(--text-muted)', fontSize:12}}>Showing {(upcomingPage - 1) * ridesPageSize + 1} - {Math.min(upcomingPage * ridesPageSize, totalUpcoming)} of {totalUpcoming}</div>
                            <div style={{display:'flex', gap:8}}>
                                <button className="btn" onClick={() => setUpcomingPage(Math.max(1, upcomingPage - 1))} disabled={upcomingPage <= 1}>Prev</button>
                                <button className="btn" onClick={() => setUpcomingPage(Math.min(upcomingPages, upcomingPage + 1))} disabled={upcomingPage >= upcomingPages}>Next</button>
                            </div>
                        </div>
                    </div>

                    <div className="card" style={{padding:'20px'}}>
                        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'15px'}}>
                            <h3 style={{margin:0, color:'var(--text)'}}>Completed Rides</h3>
                            <div style={{display:'flex', gap:'10px', alignItems:'center'}}>
                                <div style={{position:'relative'}}>
                                    <input value={searchRidesDriver} onChange={e => setSearchRidesDriver(e.target.value)} placeholder="Filter by driver name..." style={{padding:'8px 12px', borderRadius:'6px', background:'var(--input-bg)', border:'1px solid var(--border)', color:'var(--text)'}} />
                                    <Search size={14} style={{position:'absolute', right:10, top:'50%', transform:'translateY(-50%)', color:'var(--text-muted)'}} />
                                </div>
                                <div style={{display:'flex', gap:'8px', alignItems:'center'}}>
                                    <input type="date" value={ridesFilterStart} onChange={e => setRidesFilterStart(e.target.value)} title="Start date" style={{padding:'6px 8px', borderRadius:'6px', background:'rgba(255,255,255,0.03)', border:'1px solid #333', color:'white'}} />
                                    <input type="date" value={ridesFilterEnd} onChange={e => setRidesFilterEnd(e.target.value)} title="End date" style={{padding:'6px 8px', borderRadius:'6px', background:'rgba(255,255,255,0.03)', border:'1px solid #333', color:'white'}} />
                                    <button className="btn" onClick={() => { setRidesFilterStart(''); setRidesFilterEnd(''); }} style={{padding:'6px 10px'}}>Clear</button>
                                </div>
                            </div>
                        </div>
                        <div style={{maxHeight:'45vh', overflowY:'auto'}}>
                            <table style={{width:'100%', borderCollapse:'collapse'}}>
                                <thead>
                                    <tr style={{borderBottom:'1px solid var(--border)', color:'var(--text-muted)'}}>
                                        <th style={{padding:'10px'}}>Completed On</th>
                                        <th style={{padding:'10px'}}>Driver</th>
                                        <th style={{padding:'10px'}}>Route</th>
                                        <th style={{padding:'10px'}}>Total Seats</th>
                                        <th style={{padding:'10px'}}>Seats Booked</th>
                                        <th style={{padding:'10px'}}>Seats Unbooked</th>
                                        <th style={{padding:'10px'}}>Price</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {pagedCompleted.map(r => { 
                                        const seatsBooked = bookings.filter(b => b.rideId === r.id && b.status !== 'REJECTED').reduce((s, b) => s + (b.seatsRequested || 0), 0);
                                        const seatsConfirmed = bookings.filter(b => b.rideId === r.id && ['CONFIRMED','COMPLETED'].includes(b.status)).reduce((s, b) => s + (b.seatsRequested || 0), 0);
                                        const reportedRemaining = totalSeatsForRide(r);

                                        let initialSeats = Math.max(0, reportedRemaining + seatsConfirmed);
                                        if (initialSeats === 0 && seatsBooked > 0) initialSeats = seatsBooked;
                                        if (initialSeats === 0 && seatsConfirmed > 0) initialSeats = seatsConfirmed;

                                        const unbooked = Math.max(0, initialSeats - seatsBooked);
                                        const overbooked = seatsBooked - initialSeats > 0 ? seatsBooked - initialSeats : 0;
                                        if (overbooked > 0) { try { console.warn('Ride overbooked', r.id || r, { initialSeats, seatsBooked, seatsConfirmed }); } catch(e){} }

                                        return (
                                        <tr key={r.id} style={{borderBottom:'1px solid var(--border)'}}>
                                            <td style={{padding:'10px', color:'var(--text-muted)'}}>{r.dateTime ? new Date(r.dateTime).toLocaleString() : 'N/A'}</td>
                                            <td style={{padding:'10px'}}>{r.driverName}</td>
                                            <td style={{padding:'10px', fontWeight:'bold', color:'var(--primary)'}}>{r.fromLocation} ➔ {r.toLocation}</td>
                                            <td style={{padding:'10px'}} title={initialSeats > 0 ? `${initialSeats} seats` : 'Initial seats unknown'}>{initialSeats > 0 ? initialSeats : 'N/A'}</td>
                                            <td style={{padding:'10px', color: overbooked > 0 ? '#f87171' : undefined, fontWeight: overbooked > 0 ? 'bold' : undefined}} title={overbooked > 0 ? `Overbooked by ${overbooked} seats` : undefined}>
                                                {seatsBooked}{overbooked > 0 ? ` (overbooked ${overbooked})` : ''}{overbooked > 0 && <AlertCircle size={14} style={{marginLeft:6, verticalAlign:'middle', color:'#f87171'}}/>}
                                            </td>
                                            <td style={{padding:'10px'}}>{unbooked}</td>
                                            <td style={{padding:'10px', color:'var(--success)'}}>₹{r.price}</td>
                                        </tr>
                                    )})} 
                                </tbody>
                            </table>
                        </div>
                        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:12}}>
                            <div style={{color:'var(--text-muted)', fontSize:12}}>Showing {(completedPage - 1) * ridesPageSize + 1} - {Math.min(completedPage * ridesPageSize, totalCompleted)} of {totalCompleted}</div>
                            <div style={{display:'flex', gap:8}}>
                                <button className="btn" onClick={() => setCompletedPage(Math.max(1, completedPage - 1))} disabled={completedPage <= 1}>Prev</button>
                                <button className="btn" onClick={() => setCompletedPage(Math.min(completedPages, completedPage + 1))} disabled={completedPage >= completedPages}>Next</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* --- MODALS --- */}
            {promoteModal && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'20px'}}>
                            <h3>Manage Role</h3>
                            <button onClick={()=>setPromoteModal(null)} style={{background:'none', border:'none', color:'var(--text)', cursor:'pointer'}}><X/></button>
                        </div>
                        <p style={{color:'var(--text-muted)', marginBottom:'20px'}}>Select new role for <b>{promoteModal.fullname}</b>:</p>
                        <div style={{display:'flex', flexDirection:'column', gap:'10px'}}>
                            <button onClick={()=>handlePromote('MANAGER')} className="btn btn-primary">Manager</button>
                            <button onClick={()=>handlePromote('ASSISTANT')} className="btn btn-secondary">Assistant</button>
                            <button onClick={()=>handlePromote('USER')} className="btn btn-danger">Demote to User</button>
                        </div>
                    </div>
                </div>
            )}

            {/* User Journeys Modal */}
            {userJourneysModal && (
                <div className="modal-overlay">
                    <div className="modal-content" style={{maxWidth:'800px'}}>
                        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'20px', paddingBottom:'15px', borderBottom:'1px solid #333'}}>
                            <h3>{userJourneysModal.fullname}'s {userJourneysView === 'history' ? 'Completed Journeys' : 'Upcoming Journeys'}</h3>
                            <button onClick={()=>setUserJourneysModal(null)} style={{background:'none', border:'none', color:'var(--text)', cursor:'pointer'}}><X/></button>
                        </div>
                        <div style={{display:'flex', gap:'10px', marginBottom:'20px'}}>
                            <button
                                onClick={() => setUserJourneysView('history')}
                                style={{
                                    padding: '8px 16px',
                                    background: userJourneysView === 'history' ? '#3b82f6' : 'rgba(255,255,255,0.05)',
                                    color: userJourneysView === 'history' ? '#fff' : 'var(--text)',
                                    border: 'none',
                                    borderRadius: '6px',
                                    cursor: 'pointer'
                                }}
                            >
                                Completed
                            </button>
                            <button
                                onClick={() => setUserJourneysView('upcoming')}
                                style={{
                                    padding: '8px 16px',
                                    background: userJourneysView === 'upcoming' ? '#3b82f6' : 'rgba(255,255,255,0.05)',
                                    color: userJourneysView === 'upcoming' ? '#fff' : 'var(--text)',
                                    border: 'none',
                                    borderRadius: '6px',
                                    cursor: 'pointer'
                                }}
                            >
                                Upcoming
                            </button>
                        </div>
                        {/* Show note when some bookings were hidden because their ride has been removed */}
                        {countUserBookingsWithoutRide(userJourneysModal.email) > 0 && (
                            <div style={{color:'#f59e0b', marginBottom:'10px'}}>
                                Note: {countUserBookingsWithoutRide(userJourneysModal.email)} booking(s) refer to removed rides and are hidden.
                            </div>
                        )}
                        <div style={{maxHeight:'60vh', overflowY:'auto'}}>
                            <table style={{width:'100%', borderCollapse:'collapse', textAlign:'left', tableLayout: 'fixed'}}>
                                <thead>
                                    <tr style={{borderBottom:'1px solid #444', color:'#9ca3af'}}>
                                        <th style={{padding:'10px', width:'160px', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>Date</th>
                                        <th style={{padding:'10px', width:'260px', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>Route</th>
                                        <th style={{padding:'10px', width:'180px', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>Driver</th>
                                        <th style={{padding:'10px', width:'80px', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>Seats</th>
                                        <th style={{padding:'10px', width:'100px', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>Price</th>
                                        <th style={{padding:'10px', width:'120px', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {getUserJourneys(userJourneysModal.email, userJourneysView).length === 0 ? (
                                        <tr>
                                            <td colSpan="6" style={{textAlign:'center', padding:'30px', color:'gray'}}>
                                                No {userJourneysView === 'history' ? 'completed' : 'upcoming'} journeys.
                                            </td>
                                        </tr>
                                    ) : (
                                        getUserJourneys(userJourneysModal.email, userJourneysView).map(({booking, ride}) => (
                                            <tr key={booking.id} style={{borderBottom:'1px solid #333'}}>
                                                <td style={{padding:'10px', color:'var(--text-muted)'}}>{ride && ride.dateTime ? new Date(ride.dateTime).toLocaleString() : (booking.requestedAt ? new Date(booking.requestedAt).toLocaleString() : 'N/A')}</td>
                                                <td style={{padding:'10px', fontWeight:'bold', color:'#3b82f6'}}>{ride ? `${ride.fromLocation} ➔ ${ride.toLocation}` : 'Ride details not available'}</td>
                                                <td style={{padding:'10px'}}>{ride?.driverName || 'N/A'}</td>
                                                <td style={{padding:'10px'}}>{booking.seatsRequested}</td>
                                                <td style={{padding:'10px', color:'var(--success)'}}>₹{ride ? ride.price * (booking.seatsRequested || 1) : 'N/A'}</td>
                                                
                                                <td style={{padding:'10px', color:'var(--text-muted)'}}>{booking.status}{booking.transactionId ? ` • ${booking.transactionId}` : ''}</td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

           {driverRidesModal && (
                <div className="modal-overlay">
                    <div className="modal-content" style={{maxWidth:'800px'}}>
                        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'20px', paddingBottom:'15px', borderBottom:'1px solid #333'}}>
                            <h3>{driverRidesModal.fullname}'s {driverModalView === 'history' ? 'Ride History' : 'Upcoming Rides'}</h3>
                            <button onClick={()=>setDriverRidesModal(null)} style={{background:'none', border:'none', color:'var(--text)', cursor:'pointer'}}><X/></button>
                        </div>
                        <div style={{display:'flex', gap:'10px', marginBottom:'20px'}}>
                            <button
                                onClick={() => setDriverModalView('history')}
                                style={{
                                    padding: '8px 16px',
                                    background: driverModalView === 'history' ? '#3b82f6' : 'rgba(255,255,255,0.05)',
                                    color: driverModalView === 'history' ? '#fff' : 'var(--text)',
                                    border: 'none',
                                    borderRadius: '6px',
                                    cursor: 'pointer'
                                }}
                            >
                                History
                            </button>
                            <button
                                onClick={() => setDriverModalView('upcoming')}
                                style={{
                                    padding: '8px 16px',
                                    background: driverModalView === 'upcoming' ? '#3b82f6' : 'rgba(255,255,255,0.05)',
                                    color: driverModalView === 'upcoming' ? '#fff' : 'var(--text)',
                                    border: 'none',
                                    borderRadius: '6px',
                                    cursor: 'pointer'
                                }}
                            >
                                Upcoming
                            </button>
                        </div>
                        <div style={{maxHeight:'60vh', overflowY:'auto'}}>
                            <table style={{width:'100%', borderCollapse:'collapse', textAlign:'left', tableLayout: 'fixed'}}>
                                <thead>
                                    <tr style={{borderBottom:'1px solid #444', color:'#9ca3af'}}>
                                        <th style={{padding:'10px', width:'160px', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>Date</th>
                                        <th style={{padding:'10px', width:'260px', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>Route</th>
                                        <th style={{padding:'10px', width:'160px', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>Vehicle</th>
                                        <th style={{padding:'10px', width:'100px', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>Price</th>
                                        <th style={{padding:'10px', width:'80px', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>Seats</th>
                                    </tr>
                                </thead>
                                <tbody>
                                {getDriverRides(driverRidesModal.email, driverModalView).length === 0 ? (
                                        <tr>
                                            <td colSpan="5" style={{textAlign:'center', padding:'30px', color:'gray'}}>
                                                No {driverModalView === 'history' ? 'past' : 'upcoming'} rides.
                                            </td>
                                        </tr>
                                    ) : (
                                        getDriverRides(driverRidesModal.email, driverModalView).map(ride => {
                                            const initialSeats = initialSeatsForRide(ride);
                                            return (
                                                <tr key={ride.id} style={{borderBottom:'1px solid #333'}}>
                                                    <td style={{padding:'10px', color:'var(--text-muted)'}}>
                                                        {new Date(ride.dateTime).toLocaleString()}
                                                    </td>
                                                    <td style={{padding:'10px', fontWeight:'bold', color:'var(--primary)'}}>
                                                        {ride.fromLocation} ➔ {ride.toLocation}
                                                    </td>
                                                    <td style={{padding:'10px'}}>{ride.carName}</td>
                                                    <td style={{padding:'10px', color:'var(--success)', fontWeight:'bold'}}>₹{ride.price}</td>
                                                    <td style={{padding:'10px', color:'#ccc'}} title={initialSeats > 0 ? `${initialSeats} seats` : 'Initial seats unknown'}>{initialSeats > 0 ? initialSeats : 'N/A'}</td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* STAT DETAILS MODAL (opened when clicking a dashboard card) */}
            {statModal && (
                <div className="modal-overlay">
                    <div className="modal-content" style={{maxWidth:'900px'}}>
                        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'20px', paddingBottom:'10px', borderBottom:'1px solid #333'}}>
                            <h3 style={{textTransform:'capitalize'}}>{statModal === 'rides' ? 'Rides' : statModal}</h3>
                            <button onClick={closeStatModal} style={{background:'none', border:'none', color:'var(--text)', cursor:'pointer'}}><X/></button>
                        </div>
                        <div style={{maxHeight:'70vh', overflowY:'auto'}}>
                            {statModal === 'passengers' && (
                                <table style={{width:'100%', borderCollapse:'collapse', tableLayout: 'fixed'}}>
                                    <thead>
                                        <tr style={{color:'#9ca3af', borderBottom:'1px solid #444'}}>
                                            <th style={{padding:'10px', width:'320px', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>Name</th>
                                            <th style={{padding:'10px', width:'420px', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>Email</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {regularUsers.map(u => (
                                            <tr key={u.id}><td style={{padding:'10px', color:'var(--text)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>{u.fullname}</td><td style={{padding:'10px', color:'var(--text-muted)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>{u.email}</td></tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}

                            {statModal === 'drivers' && (
                                <table style={{width:'100%', borderCollapse:'collapse', tableLayout: 'fixed'}}>
                                    <thead>
                                        <tr style={{color:'#9ca3af', borderBottom:'1px solid #444'}}>
                                            <th style={{padding:'10px', width:'260px', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>Driver</th>
                                            <th style={{padding:'10px', width:'260px', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>Email</th>
                                            <th style={{padding:'10px', width:'120px', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>Rides</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {driversList.map(u => (
                                            <tr key={u.id}><td style={{padding:'10px', color:'var(--text)'}}>{u.fullname}</td><td style={{padding:'10px', color:'var(--text-muted)'}}>{u.email}</td><td style={{padding:'10px'}}><button className="btn" onClick={() => { setDriverRidesModal(u); closeStatModal(); }}>Open</button></td></tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}

                            {statModal === 'rides' && (
                                <div>
                                    <h4 style={{color:'var(--text-muted)', fontSize:'12px', marginTop:0}}>Upcoming</h4>
                                    <table style={{width:'100%', borderCollapse:'collapse', marginBottom:'20px', tableLayout: 'fixed'}}>
                                        <thead>
                                            <tr style={{color:'var(--text-muted)', borderBottom:'1px solid var(--border)'}}>
                                                <th style={{padding:'10px', width:'160px', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>Date</th>
                                                <th style={{padding:'10px', width:'260px', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>Route</th>
                                                <th style={{padding:'10px', width:'120px', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>Seats</th>
                                                <th style={{padding:'10px', width:'100px', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>Price</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {upcomingRidesList.map(r => (
                                                <tr key={r.id}><td style={{padding:'10px', color:'var(--text-muted)'}}>{new Date(r.dateTime).toLocaleString()}</td><td style={{padding:'10px', color:'var(--primary)'}}>{r.fromLocation} ➔ {r.toLocation}</td><td style={{padding:'10px'}}>{initialSeatsForRide(r) || 'N/A'}</td><td style={{padding:'10px', color:'var(--success)'}}>₹{r.price}</td></tr>
                                            ))}
                                        </tbody>
                                    </table>

                                    <h4 style={{color:'var(--text-muted)', fontSize:'12px', marginTop:0}}>Completed</h4>
                                    <table style={{width:'100%', borderCollapse:'collapse'}}>
                                        <thead>
                                            <tr style={{color:'var(--text-muted)', borderBottom:'1px solid var(--border)'}}><th style={{padding:'10px'}}>Date</th><th style={{padding:'10px'}}>Route</th><th style={{padding:'10px'}}>Seats</th><th style={{padding:'10px'}}>Price</th></tr>
                                        </thead>
                                        <tbody>
                                            {completedRidesList.map(r => (
                                                <tr key={r.id}><td style={{padding:'10px', color:'var(--text-muted)'}}>{new Date(r.dateTime).toLocaleString()}</td><td style={{padding:'10px', color:'var(--primary)'}}>{r.fromLocation} ➔ {r.toLocation}</td><td style={{padding:'10px'}}>{initialSeatsForRide(r) || 'N/A'}</td><td style={{padding:'10px', color:'var(--success)'}}>₹{r.price}</td></tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}

                            {statModal === 'day' && chartFilter && chartFilter.type === 'day' && (
                                <div>
                                    <h4 style={{color:'var(--text-muted)', fontSize:'12px', marginTop:0}}>Rides on {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][chartFilter.dayIndex]}</h4>
                                    <div style={{display:'flex', flexDirection:'column', gap:'14px'}}>
                                        {(() => {
                                            const dayStart = new Date(startOfWeek); dayStart.setDate(startOfWeek.getDate() + chartFilter.dayIndex); dayStart.setHours(0,0,0,0);
                                            const dayEnd = new Date(dayStart); dayEnd.setHours(23,59,59,999);
                                            const ridesOnDay = rides
                                                .filter(r => r.dateTime && new Date(r.dateTime) >= dayStart && new Date(r.dateTime) <= dayEnd)
                                                .sort((a,b) => new Date(a.dateTime) - new Date(b.dateTime));
                                            if (!ridesOnDay.length) return <div style={{padding:'20px', color:'gray'}}>No rides on this day.</div>;

                                            return ridesOnDay.map(r => {
                                                const rideBookings = bookings.filter(b => b.rideId === r.id).sort((a,b) => new Date(a.requestedAt || 0) - new Date(b.requestedAt || 0));
                                                const seatsBooked = rideBookings.filter(b => b.status !== 'REJECTED').reduce((s,b) => s + (b.seatsRequested || 0), 0);
                                                const initial = initialSeatsForRide(r) || 'N/A';
                                                return (
                                                    <div key={r.id} style={{border:'1px solid #2c2c2c', borderRadius:'8px', padding:'12px'}}>
                                                        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'8px'}}>
                                                            <div>
                                                                <div style={{color:'#ccc', fontSize:'12px'}}>{new Date(r.dateTime).toLocaleString()}</div>
                                                                <div style={{fontWeight:'bold', color:'#3b82f6', marginTop:'6px'}}>{r.fromLocation} ➔ {r.toLocation}</div>
                                                                <div style={{color:'var(--text-muted)', fontSize:'12px', marginTop:'6px'}}>Driver: {r.driverName || 'N/A'}</div>
                                                            </div>
                                                            <div style={{textAlign:'right'}}>
                                                                <div style={{color:'var(--text-muted)', fontSize:'12px'}}>Seats: <strong style={{color:'var(--text)'}}>{initial}</strong></div>
                                                                <div style={{color:'var(--text-muted)', fontSize:'12px', marginTop:'6px'}}>Booked: <strong style={{color:'var(--text)'}}>{seatsBooked}</strong></div>
                                                                <div style={{color:'#10b981', fontWeight:'bold', marginTop:'6px'}}>₹{r.price}</div>
                                                            </div>
                                                        </div>

                                                        <div style={{marginTop:'8px'}}>
                                                            <div style={{fontSize:'12px', color:'var(--text-muted)', marginBottom:'8px'}}>Bookings</div>
                                                            {rideBookings.length === 0 ? (
                                                                <div style={{padding:'8px', color:'gray'}}>No bookings for this ride.</div>
                                                            ) : (
                                                                <table style={{width:'100%', borderCollapse:'collapse', tableLayout:'fixed'}}>
                                                                    <thead>
                                                                        <tr style={{color:'#9ca3af', borderBottom:'1px solid #444'}}>
                                                                            <th style={{padding:'8px', width:'260px'}}>Passenger</th>
                                                                            <th style={{padding:'8px', width:'80px'}}>Seats</th>
                                                                            <th style={{padding:'8px', width:'140px'}}>Requested At</th>
                                                                            <th style={{padding:'8px', width:'160px'}}>Status</th>
                                                                            <th style={{padding:'8px', width:'140px', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>Txn</th>
                                                                        </tr>
                                                                    </thead>
                                                                    <tbody>
                                                                        {rideBookings.map(b => (
                                                                            <tr key={b.id} style={{borderBottom:'1px solid #2b2b2b'}}>
                                                                                <td style={{padding:'8px', color:'var(--text)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>{b.requesterName || b.requesterEmail}</td>
                                                                                <td style={{padding:'8px'}}>{b.seatsRequested || 0}</td>
                                                                                <td style={{padding:'8px', color:'var(--text-muted)'}}>{b.requestedAt ? new Date(b.requestedAt).toLocaleString() : 'N/A'}</td>
                                                                                <td style={{padding:'8px', color:'var(--text-muted)'}}>{b.status}</td>
                                                                                <td style={{padding:'8px', color:'var(--text-muted)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}} title={b.transactionId || '—'}>{b.transactionId || '—'}</td>
                                                                            </tr>
                                                                        ))}
                                                                    </tbody>
                                                                </table>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            });
                                        })()}
                                    </div>
                                </div>
                            )}

                            {statModal === 'bookings' && (
                                <table style={{width:'100%', borderCollapse:'collapse', tableLayout: 'fixed'}}>
                                    <thead>
                                        <tr style={{color:'#9ca3af', borderBottom:'1px solid #444'}}>
                                            <th style={{padding:'10px', width:'220px', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>Passenger</th>
                                            <th style={{padding:'10px', width:'260px', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>Ride</th>
                                            <th style={{padding:'10px', width:'80px', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>Seats</th>
                                            <th style={{padding:'10px', width:'120px', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>Status</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {bookings.map(b => (
                                            <tr key={b.id}><td style={{padding:'10px', color:'var(--text)'}}>{b.requesterName || b.requesterEmail}</td><td style={{padding:'10px', color:'var(--text-muted)'}}>{(rides.find(r=>r.id===b.rideId)?.fromLocation || 'N/A')} ➔ {(rides.find(r=>r.id===b.rideId)?.toLocation || 'N/A')}</td><td style={{padding:'10px'}}>{b.seatsRequested}</td><td style={{padding:'10px'}}>{b.status}</td></tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </div>
                </div>
            )}
            
        </div>
    );
}