// src/profile/Transactions.jsx
import React, { useEffect, useState } from 'react';
import { apiGet } from '../../api/api';
import DriverTransactions from '../driver/DriverTransactions.jsx';
import '../../Styles/transactions.css'; // ✅ Scoped CSS ONLY for this page

export default function Transactions({ user }) {
  // If user is driver, render the DriverTransactions component
  if (user?.role === 'DRIVER') {
    return <DriverTransactions user={user} />;
  }

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => { fetchData(); }, []);

  async function fetchData() {
    setLoading(true);
    setError(null);
    try {
      const my = await apiGet('/api/bookings/my');
      const txs = await Promise.all((my || []).map(async b => {
        try {
          const ride = b.rideId ? await apiGet(`/api/rides/${b.rideId}`) : null;
          const seats = Number(b.seatsRequested || 1);
          const base = Number(ride.price || 0) * seats;
          const gst = base * 0.02;
          const platformFee = 20 * seats;
          const amount = Number((base + gst + platformFee).toFixed(2));

          return {
            id: b.id,
            date: b.paymentCompletedAt || b.confirmedAt || b.requestedAt || null,
            amount,
            tx: b.transactionId || 'N/A',
            requesterName: b.requesterName || user?.fullname || 'Passenger',
            source: ride?.fromLocation || '-',
            destination: ride?.toLocation || '-',
            seats: b.seatsRequested || 1,
            status: (b.status || '').toUpperCase() || 'UNKNOWN',
            type: 'debited'
          };
        } catch {
          return {
            id: b.id,
            date: b.requestedAt || null,
            amount: 0,
            tx: b.transactionId || 'N/A',
            requesterName: user?.fullname || 'Passenger',
            source: '-',
            destination: '-',
            seats: b.seatsRequested || 1,
            status: 'UNKNOWN',
            type: 'debited'
          };
        }
      }));

      txs.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
      setItems(txs);
    } catch (err) {
      setError(err.message || 'Unable to load transactions');
    } finally {
      setLoading(false);
    }
  }

  const statusClass = (s) => {
    if (!s) return 'status-pending';
    const l = s.toLowerCase();
    if (l.includes('conf') || l.includes('paid') || l.includes('success')) return 'status-success';
    if (l.includes('rej') || l.includes('fail')) return 'status-failed';
    return 'status-pending';
  };

  const fmtDate = (d) => d ? new Date(d).toLocaleString() : '-';
  const fmtCurrency = (a) => `₹${Number(a).toFixed(0)}`;

  return (
    <div className="transactions-page p-6 max-w-5xl mx-auto">
      <div className="header-row">
        <h2>Transactions</h2>
        <p className="subtext">All your payment activity</p>
      </div>

      {loading && <div className="empty-state">Loading transactions...</div>}
      {error && <div className="empty-state">{error}</div>}
      {!loading && !error && items.length === 0 && (
        <div className="empty-state">No transactions found.</div>
      )}

      {!loading && items.length > 0 && (
        <div className="card table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Type</th>
                <th>Person</th>
                <th>Route</th>
                <th>Seats</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Transaction ID</th>
              </tr>
            </thead>
            <tbody>
              {items.map(it => (
                <tr key={it.id}>
                  <td className="muted">{fmtDate(it.date)}</td>
                  <td>
                    <span className={`tx-pill ${it.type === 'debited' ? 'tx-debit' : 'tx-credit'}`}>
                      {it.type === 'debited' ? '- Paid' : '+ Received'}
                    </span>
                  </td>
                  <td>{it.requesterName}</td>
                  <td className="muted">{it.source} → {it.destination}</td>
                  <td>{it.seats}</td>
                  <td className={it.type === 'debited' ? 'amount-debit' : 'amount-credit'}>
                    {it.type === 'debited' ? '-' : '+'}{fmtCurrency(it.amount)}
                  </td>
                  <td>
                    <span className={`badge ${statusClass(it.status)}`}>{it.status}</span>
                  </td>
                  <td className="muted">{it.tx}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
