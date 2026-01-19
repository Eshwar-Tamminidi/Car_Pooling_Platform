// src/pages/admin/Users.jsx
import React, { useEffect, useState } from "react";
import { apiGet } from "../../api/api";

/**
 * Users list (admin)
 * - Fetches GET /api/users
 * - Allows search
 * - Click user to view details (GET /api/users/{id})
 */
export default function Users({ user }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(null);
  const [error, setError] = useState(null);
  const [sortKey, setSortKey] = useState("fullname");

  useEffect(() => {
    if (!user || user.role !== "ADMIN") {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    apiGet("/api/users")
      .then(data => {
        setUsers(data || []);
      })
      .catch(err => {
        console.error(err);
        setError(err.message || "Failed to fetch users");
      })
      .finally(() => setLoading(false));
  }, [user]);

  async function viewDetails(id) {
    setSelected({ loading: true });
    try {
      const data = await apiGet(`/api/users/${id}`);
      setSelected({ loading: false, data });
    } catch (err) {
      console.error(err);
      setSelected({ loading: false, error: err.message || "Failed" });
    }
  }

  const filtered = users
    .filter(u => {
      const q = query.trim().toLowerCase();
      if (!q) return true;
      return (u.fullname || "").toLowerCase().includes(q) ||
             (u.email || "").toLowerCase().includes(q) ||
             (u.role || "").toLowerCase().includes(q);
    })
    .sort((a, b) => {
      const aV = (a[sortKey] || "").toString().toLowerCase();
      const bV = (b[sortKey] || "").toString().toLowerCase();
      return aV.localeCompare(bV);
    });

  if (!user || user.role !== "ADMIN") {
    return (
      <div style={{ padding: 20 }}>
        <h2>Users</h2>
        <p><strong>Unauthorized:</strong> only admins can view users.</p>
      </div>
    );
  }

  return (
    <div style={{ padding: 20 }}>
      <h2>All Users</h2>

      {loading ? <p>Loading users...</p> : null}
      {error && <div style={{ color: "crimson" }}>{error}</div>}

      <div style={{ display: "flex", gap: 12, marginTop: 12, marginBottom: 12, alignItems: "center" }}>
        <input
          placeholder="Search by name, email or role"
          value={query}
          onChange={e => setQuery(e.target.value)}
          style={{ flex: 1, padding: 8 }}
        />

        <label>
          Sort by:
          <select value={sortKey} onChange={e => setSortKey(e.target.value)} style={{ marginLeft: 8 }}>
            <option value="fullname">Name</option>
            <option value="email">Email</option>
            <option value="role">Role</option>
          </select>
        </label>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 16 }}>
        <div>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ textAlign: "left", borderBottom: "1px solid #eee" }}>
                <th style={{ padding: 8 }}>Name</th>
                <th style={{ padding: 8 }}>Email</th>
                <th style={{ padding: 8 }}>Phone</th>
                <th style={{ padding: 8 }}>Role</th>
                <th style={{ padding: 8 }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(u => (
                <tr key={u.id} style={{ borderBottom: "1px solid #fafafa" }}>
                  <td style={{ padding: 8 }}>{u.fullname}</td>
                  <td style={{ padding: 8 }}>{u.email}</td>
                  <td style={{ padding: 8 }}>{u.phone || "-"}</td>
                  <td style={{ padding: 8 }}>{u.role}</td>
                  <td style={{ padding: 8 }}>
                    <button onClick={() => viewDetails(u.id)}>View</button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ padding: 12 }}>No users found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div style={{ border: "1px solid #eee", borderRadius: 8, padding: 12 }}>
          <h4>User details</h4>
          {!selected && <div>Click a user to view details</div>}
          {selected && selected.loading && <div>Loading...</div>}
          {selected && selected.error && <div style={{ color: "crimson" }}>{selected.error}</div>}
          {selected && selected.data && (
            <div>
              <div style={{ marginBottom: 8 }}>
                <strong>Name:</strong> {selected.data.fullname}
              </div>
              <div style={{ marginBottom: 8 }}>
                <strong>Email:</strong> {selected.data.email}
              </div>
              <div style={{ marginBottom: 8 }}>
                <strong>Phone:</strong> {selected.data.phone || "-"}
              </div>
              <div style={{ marginBottom: 8 }}>
                <strong>Role:</strong> {selected.data.role}
              </div>
              <div style={{ marginTop: 12 }}>
                <em>More admin actions (edit/delete/promote) can go here.</em>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
