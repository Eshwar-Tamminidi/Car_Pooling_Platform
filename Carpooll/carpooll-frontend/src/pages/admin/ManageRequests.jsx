/* src/pages/admin/ManageRequests.jsx */
import React, { useEffect, useState } from "react";
import { apiGet, apiPost } from "../../api/api";

export default function ManageRequests({ user }) {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const data = await apiGet("/api/bookings/for-host");
      setRequests(data || []);
    } catch (err) {
      console.error(err);
    } finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  async function decide(id, action) {
    try {
      await apiPost(`/api/bookings/${id}/decide?action=${action}`, {});
      load();
    } catch (err) { console.error(err); }
  }

  return (
    <div style={{ padding: 20 }}>
      <h3>Requests for your hosted rides</h3>
      {loading ? <div>Loading...</div> : (
        <div>
          {requests.length === 0 && <div>No requests.</div>}
          {requests.map(r => (
            <div key={r.id} style={{ border: "1px solid #ddd", padding: 10, marginBottom: 8 }}>
              <div><strong>Ride:</strong> {r.rideId}</div>
              <div><strong>Requester:</strong> {r.requesterName} ({r.requesterEmail})</div>
              <div><strong>Seats:</strong> {r.seatsRequested} | <strong>Status:</strong> {r.status}</div>
              {r.status === "PENDING" && (
                <div style={{ marginTop: 8 }}>
                  <button onClick={() => decide(r.id, "accept")}>Accept</button>
                  <button onClick={() => decide(r.id, "reject")} style={{ marginLeft: 8 }}>Reject</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
