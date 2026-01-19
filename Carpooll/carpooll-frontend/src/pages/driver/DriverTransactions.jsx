import { useEffect, useState } from "react";
import { apiGet } from "../../api/api";
import { Search, Calendar, Filter, Download } from "lucide-react";

const DriverTransactions = () => {
  const [transactions, setTransactions] = useState([]);
  const [filteredTransactions, setFilteredTransactions] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [searchDate, setSearchDate] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 8; // change to 10/15 if you want

useEffect(() => {
  fetchTransactions();
}, []);

  useEffect(() => {
  filterTransactions();
  setCurrentPage(1); // reset page on filter change
}, [transactions, searchDate, statusFilter, typeFilter]);


  const fetchTransactions = async () => {
    try {
      setLoading(true);
      setError("");
      const user = JSON.parse(localStorage.getItem("user"));
      const userEmail = user?.email;
      const userRole = user?.role;

      if (!userEmail) {
        setError("Please login again.");
        setLoading(false);
        return;
      }

      let allTransactions = [];

      // Fetch driver transactions (money received) - Try for all users, not just DRIVER role
      // Anyone who has hosted rides can receive payments
      // Fetch driver transactions (money received)
try {
  const queryParams = new URLSearchParams({ driverEmail: userEmail }).toString();
  const driverData = await apiGet(`/api/driver/transactions?${queryParams}`);
  console.log("Driver transactions response:", driverData);
  
  if (driverData && Array.isArray(driverData) && driverData.length > 0) {
    // Fetch all bookings for the host to get rideId for each transaction
    const hostBookings = await apiGet("/api/bookings/for-host") || [];
    console.log("Host bookings:", hostBookings.length);
    
    // Create a map of transactionId to booking (to get rideId)
    const bookingMap = new Map();
    hostBookings.forEach(booking => {
      if (booking.transactionId) {
        bookingMap.set(booking.transactionId, booking);
      }
    });
    
    console.log("Booking map size:", bookingMap.size);
    console.log("Driver transaction IDs:", driverData.map(tx => tx.transactionId));

    // Fetch ride details for each transaction to get journey date
    const driverTxs = await Promise.all(
      driverData.map(async (tx) => {
        try {
          // Find the booking for this transaction to get rideId
          const booking = bookingMap.get(tx.transactionId);
          console.log(`Transaction ${tx.transactionId} -> Booking:`, booking ? `Found (rideId: ${booking.rideId})` : "Not found");
          
          if (booking && booking.rideId) {
            // Fetch ride details to get journey date
            const ride = await apiGet(`/api/rides/${booking.rideId}`);
            console.log(`Ride ${booking.rideId} dateTime:`, ride?.dateTime);
            return {
              ...tx,
              amount: Number(tx.amount ?? tx.netAmount ?? tx.creditedAmount ?? tx.value ?? 0),
              type: "credited",
              status: "success",
              role: "driver",
              journeyDate: ride?.dateTime || null,
              // set a canonical date so filtering works consistently across views
              date: booking.paymentCompletedAt || booking.confirmedAt || booking.requestedAt || ride?.dateTime || tx.paymentCompletedAt || tx.date || tx.createdAt || null
            };
          } else {
            console.warn("No booking found for transaction:", tx.transactionId);
            return {
              ...tx,
              amount: Number(tx.amount ?? tx.netAmount ?? tx.creditedAmount ?? tx.value ?? 0),
              type: "credited",
              status: "success",
              role: "driver",
              journeyDate: null,
              date: tx.paymentCompletedAt || tx.date || tx.createdAt || null
            };
          }
        } catch (err) {
          console.error("Error fetching ride for driver transaction:", tx.transactionId, err);
          return {
            ...tx,
            amount: Number(tx.amount ?? tx.netAmount ?? tx.creditedAmount ?? tx.value ?? 0),
            type: "credited",
            status: "success",
            role: "driver",
            journeyDate: null,
            date: tx.paymentCompletedAt || tx.date || tx.createdAt || null
          };
        }
      })
    );
    
    allTransactions = allTransactions.concat(driverTxs);
    console.log("Added driver transactions:", driverTxs.length);
    console.log("Driver transactions with journey dates:", driverTxs.filter(tx => tx.journeyDate).length);
  }
} catch (err) {
  console.error("Error fetching driver transactions:", err);
}

// Fetch passenger transactions (money paid)
try {
  const bookings = await apiGet("/api/bookings/my") || [];
  console.log("Passenger bookings:", bookings.length);
  
  const passengerTransactions = bookings
    .filter(booking => 
      booking.transactionId || 
      booking.status === "CONFIRMED" || 
      booking.status === "PAID" || 
      booking.status === "REJECTED"
    )
    .map(async (booking) => {
      try {
        const ride = await apiGet(`/api/rides/${booking.rideId}`);
        return {
          bookingId: booking.id,
          transactionId: booking.transactionId || "N/A",
          passengerName: booking.requesterName || user.fullname,
          source: ride?.fromLocation || "N/A",
          destination: ride?.toLocation || "N/A",
          date: booking.paymentCompletedAt || booking.requestedAt || booking.confirmedAt,
          journeyDate: ride?.dateTime || null,
          seats: booking.seatsRequested || 0,
          amount: (function(){ const seats = booking.seatsRequested || 1; const base = (ride?.price || 0) * seats; const gst = base * 0.02; const platformFee = 20 * seats; return +(base + gst + platformFee); })(),
          status: booking.status === "CONFIRMED" ? "success" : 
                 booking.status === "REJECTED" ? "failed" : 
                 booking.status === "PAID" ? "success" : "pending",
          type: "debited",
          role: "passenger"
        };
      } catch (err) {
        console.error("Error fetching ride for booking:", booking.id, err);
        return null;
      }
    });

  const resolvedPassenger = await Promise.all(passengerTransactions);
  const validPassengerTxs = resolvedPassenger.filter(tx => tx !== null);
  allTransactions = allTransactions.concat(validPassengerTxs);
  console.log("Added passenger transactions:", validPassengerTxs.length);
} catch (err) {
  console.error("Error fetching passenger transactions:", err);
}

console.log("Total transactions:", allTransactions.length);

      console.log("Total transactions:", allTransactions.length);
      console.log("Driver transactions:", allTransactions.filter(tx => tx.type === "credited").length);
      console.log("Passenger transactions:", allTransactions.filter(tx => tx.type === "debited").length);

      // Sort by date (newest first)
      allTransactions.sort((a, b) => {
        const dateA = new Date(a.date || 0);
        const dateB = new Date(b.date || 0);
        return dateB - dateA;
      });

      setTransactions(allTransactions);
    } catch (err) {
      console.error("Transaction fetch error:", err);
      setError(err.message || "Failed to load transaction history");
    } finally {
      setLoading(false);
    }
  };

  const filterTransactions = () => {
  let filtered = [...transactions]; // 🔴 REQUIRED FIX

  if (searchDate) {
    filtered = filtered.filter(tx => {
      if (!tx.date) return false;
      return new Date(tx.date).toISOString().split("T")[0] === searchDate;
    });
  }

  if (statusFilter !== "all") {
    filtered = filtered.filter(tx =>
      (tx.status || "success").toLowerCase() === statusFilter
    );
  }

  if (typeFilter !== "all") {
    filtered = filtered.filter(tx =>
      (tx.type || "credited").toLowerCase() === typeFilter
    );
  }

  setFilteredTransactions(filtered);
};

const totalPages = Math.ceil(filteredTransactions.length / ITEMS_PER_PAGE);

const paginatedTransactions = filteredTransactions.slice(
  (currentPage - 1) * ITEMS_PER_PAGE,
  currentPage * ITEMS_PER_PAGE
);

  const formatDate = (date) => {
    if (!date) return "N/A";
    try {
      const d = new Date(date);
      if (isNaN(d.getTime())) return "N/A";
      return d.toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (e) {
      return "N/A";
    }
  };
  const formatDateOnly = (date) => {
    if (!date) return "N/A";
    try {
      const d = new Date(date);
      if (isNaN(d.getTime())) return "N/A";
      return d.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      });
    } catch (e) {
      return "N/A";
    }
  };
  

  const getStatusBadge = (status) => {
    const statusLower = (status || "success").toLowerCase();
    if (statusLower === "success" || statusLower === "confirmed" || statusLower === "paid") {
      return <span style={{
        background: "rgba(16, 185, 129, 0.2)",
        color: "#10b981",
        padding: "4px 12px",
        borderRadius: "12px",
        fontSize: "11px",
        fontWeight: "bold"
      }}>✓ {statusLower === "paid" ? "Paid" : "Success"}</span>;
    } else if (statusLower === "failed" || statusLower === "rejected") {
      return <span style={{
        background: "rgba(239, 68, 68, 0.2)",
        color: "#ef4444",
        padding: "4px 12px",
        borderRadius: "12px",
        fontSize: "11px",
        fontWeight: "bold"
      }}>✗ Failed</span>;
    } else if (statusLower === "pending") {
      return <span style={{
        background: "rgba(245, 158, 11, 0.2)",
        color: "#f59e0b",
        padding: "4px 12px",
        borderRadius: "12px",
        fontSize: "11px",
        fontWeight: "bold"
      }}>⏳ Pending</span>;
    }
    return <span style={{
      background: "rgba(107, 114, 128, 0.2)",
      color: "var(--text-muted)",
      padding: "4px 12px",
      borderRadius: "12px",
      fontSize: "11px",
      fontWeight: "bold"
    }}>Unknown</span>;
  };

  const getTypeBadge = (type) => {
    const typeLower = (type || "credited").toLowerCase();
    if (typeLower === "credited" || typeLower === "credit") {
      return <span style={{
        background: "rgba(16, 185, 129, 0.2)",
        color: "#10b981",
        padding: "4px 12px",
        borderRadius: "12px",
        fontSize: "11px",
        fontWeight: "bold"
      }}>+ Received</span>;
    } else if (typeLower === "debited" || typeLower === "debit") {
      return <span style={{
        background: "rgba(239, 68, 68, 0.2)",
        color: "#ef4444",
        padding: "4px 12px",
        borderRadius: "12px",
        fontSize: "11px",
        fontWeight: "bold"
      }}>- Paid</span>;
    }
    return <span style={{
      background: "rgba(107, 114, 128, 0.2)",
      color: "var(--text-muted)",
      padding: "4px 12px",
      borderRadius: "12px",
      fontSize: "11px",
      fontWeight: "bold"
    }}>Other</span>;
  };

  return (
    <div style={{
  padding: "40px",
  color: "var(--text)",
  minHeight: "100vh",
  background: "var(--bg)"
}}>

      <div style={{ maxWidth: "1400px", margin: "0 auto" }}>
        {/* Header */}
        <div style={{ marginBottom: "30px" }}>
          <h1 style={{ fontSize: "32px", fontWeight: "bold", marginBottom: "10px", color: "var(--text)" }}>
            💳 Transaction History
          </h1>
          <p style={{ color: "var(--text-muted)", fontSize: "14px" }}>
            View and filter all your payment transactions
          </p>
        </div>

        {/* Filters */}
        <div style={{
          background: "var(--card-bg)",
          padding: "24px",
          borderRadius: "16px",
          marginBottom: "24px",
          border: "1px solid var(--border)"
        }}>
          <div style={{ display: "flex", gap: "16px", flexWrap: "wrap", alignItems: "end" }}>
            <div style={{ flex: "1", minWidth: "200px" }}>
              <label style={{ 
                display: "block", 
                fontSize: "12px", 
                fontWeight: "bold", 
                color: "var(--text-muted)", 
                marginBottom: "8px",
                textTransform: "uppercase",
                letterSpacing: "0.5px"
              }}>
                <Calendar size={14} style={{ display: "inline", marginRight: "6px" }} />
                Filter by Date
              </label>
              <input
                type="date"
                value={searchDate}
                onChange={(e) => setSearchDate(e.target.value)}
                style={{
                  width: "100%",
                  padding: "12px",
                  background: "var(--input-bg)",
                  border: "1px solid var(--border)",
                  borderRadius: "8px",
                  color: "var(--text)",
                  fontSize: "14px"
                }}
              />
            </div>

            <div style={{ flex: "1", minWidth: "200px" }}>
              <label style={{ 
                display: "block", 
                fontSize: "12px", 
                fontWeight: "bold", 
                color: "var(--text-muted)", 
                marginBottom: "8px",
                textTransform: "uppercase",
                letterSpacing: "0.5px"
              }}>
                <Filter size={14} style={{ display: "inline", marginRight: "6px" }} />
                Status
              </label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                style={{
                  width: "100%",
                  padding: "12px",
                  background: "var(--input-bg)",
                  border: "1px solid var(--border)",
                  borderRadius: "8px",
                  color: "var(--text)",
                  fontSize: "14px"
                }}
              >
                <option value="all">All Status</option>
                <option value="success">Success/Paid</option>
                <option value="failed">Failed</option>
                <option value="pending">Pending</option>
              </select>
            </div>

            <div style={{ flex: "1", minWidth: "200px" }}>
              <label style={{ 
                display: "block", 
                fontSize: "12px", 
                fontWeight: "bold", 
                color: "var(--text-muted)", 
                marginBottom: "8px",
                textTransform: "uppercase",
                letterSpacing: "0.5px"
              }}>
                Type
              </label>
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                style={{
                  width: "100%",
                  padding: "12px",
                  background: "var(--input-bg)",
                  border: "1px solid var(--border)",
                  borderRadius: "8px",
                  color: "var(--text)",
                  fontSize: "14px"
                }}
              >
                <option value="all">All Types</option>
                <option value="credited">Received</option>
                <option value="debited">Paid</option>
              </select>
            </div>

            <button
              onClick={() => {
                setSearchDate("");
                setStatusFilter("all");
                setTypeFilter("all");
              }}
              style={{
                padding: "12px 24px",
                background: "var(--bg-secondary)",
                border: "1px solid var(--border)",
                borderRadius: "8px",
                color: "var(--text)",
                fontSize: "14px",
                fontWeight: "bold",
                cursor: "pointer",
                whiteSpace: "nowrap"
              }}
            >
              Clear Filters
            </button>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div style={{
            background: "rgba(239, 68, 68, 0.1)",
            border: "1px solid rgba(239, 68, 68, 0.3)",
            padding: "16px",
            borderRadius: "12px",
            marginBottom: "20px",
            color: "#ef4444"
          }}>
            {error}
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div style={{ textAlign: "center", padding: "60px", color: "#9ca3af" }}>
            <div style={{ fontSize: "18px" }}>Loading transactions...</div>
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && filteredTransactions.length === 0 && (
          <div style={{
            textAlign: "center",
            padding: "60px",
            background: "var(--card-bg)",
            borderRadius: "16px",
            border: "1px solid var(--border)"
          }}>
            <p style={{ color: "var(--text-muted)", fontSize: "16px" }}>No transactions found</p>
            {(searchDate || statusFilter !== "all" || typeFilter !== "all") && (
              <button
                onClick={() => {
                  setSearchDate("");
                  setStatusFilter("all");
                  setTypeFilter("all");
                }}
                style={{
                  marginTop: "16px",
                  padding: "10px 20px",
                  background: "#3b82f6",
                  border: "none",
                  borderRadius: "8px",
                  color: "white",
                  fontSize: "14px",
                  fontWeight: "bold",
                  cursor: "pointer"
                }}
              >
                Clear Filters
              </button>
            )}
          </div>
        )}

        {/* Transactions Table */}
        {!loading && !error && filteredTransactions.length > 0 && (
          <div style={{
            background: "var(--card-bg)",
            borderRadius: "16px",
            border: "1px solid var(--border)",
            overflow: "hidden"
          }}>
            <div style={{
              overflowX: "auto"
            }}>
              <table style={{
                width: "100%",
                borderCollapse: "collapse"
              }}>
                <thead>
                  <tr style={{
                    background: "var(--card-bg)",
                    borderBottom: "2px solid var(--border)"
                  }}>
                    <th style={{
                      padding: "16px",
                      textAlign: "left",
                      fontSize: "12px",
                      fontWeight: "bold",
                      color: "var(--text-muted)",
                      textTransform: "uppercase",
                      letterSpacing: "0.5px"
                    }}>Date & Time</th>
                    <th style={{
  padding: "16px",
  textAlign: "left",
  fontSize: "12px",
  fontWeight: "bold",
  color: "var(--text-muted)",
  textTransform: "uppercase",
  letterSpacing: "0.5px"
}}>Journey Date</th>
                    <th style={{
                      padding: "16px",
                      textAlign: "left",
                      fontSize: "12px",
                      fontWeight: "bold",
                      color: "var(--text-muted)",
                      textTransform: "uppercase",
                      letterSpacing: "0.5px"
                    }}>Transaction ID</th>
                    <th style={{
                      padding: "16px",
                      textAlign: "left",
                      fontSize: "12px",
                      fontWeight: "bold",
                      color: "var(--text-muted)",
                      textTransform: "uppercase",
                      letterSpacing: "0.5px"
                    }}>Passenger/Driver</th>
                    <th style={{
                      padding: "16px",
                      textAlign: "left",
                      fontSize: "12px",
                      fontWeight: "bold",
                      color: "var(--text-muted)",
                      textTransform: "uppercase",
                      letterSpacing: "0.5px"
                    }}>Route</th>
                    <th style={{
                      padding: "16px",
                      textAlign: "left",
                      fontSize: "12px",
                      fontWeight: "bold",
                      color: "var(--text-muted)",
                      textTransform: "uppercase",
                      letterSpacing: "0.5px"
                    }}>Seats</th>
                    <th style={{
                      padding: "16px",
                      textAlign: "right",
                      fontSize: "12px",
                      fontWeight: "bold",
                      color: "var(--text-muted)",
                      textTransform: "uppercase",
                      letterSpacing: "0.5px"
                    }}>Amount</th>
                    <th style={{
                      padding: "16px",
                      textAlign: "center",
                      fontSize: "12px",
                      fontWeight: "bold",
                      color: "var(--text-muted)",
                      textTransform: "uppercase",
                      letterSpacing: "0.5px"
                    }}>Status</th>
                    <th style={{
                      padding: "16px",
                      textAlign: "center",
                      fontSize: "12px",
                      fontWeight: "bold",
                      color: "var(--text-muted)",
                      textTransform: "uppercase",
                      letterSpacing: "0.5px"
                    }}>Type</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedTransactions.map((tx, index) => (
                    <tr
                      key={tx.transactionId || tx.bookingId || index}
                      style={{
                        borderBottom: "1px solid var(--border)",
                        transition: "background 0.2s"
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = "var(--row-hover)"}
                      onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                    >
                      <td style={{ padding: "16px", color: "var(--text)", fontSize: "14px" }}>
                        {formatDate(tx.date)}
                      </td>
                      <td style={{ padding: "16px", color: "var(--text)", fontSize: "14px" }}>
  {formatDateOnly(tx.journeyDate)}
</td>
                      <td style={{ padding: "16px", color: "var(--text)", fontSize: "13px", fontFamily: "monospace" }}>
                        {tx.transactionId || "N/A"}
                      </td>
                      <td style={{ padding: "16px", color: "var(--text)", fontSize: "14px" }}>
                        {tx.passengerName || "N/A"}
                      </td>
                      <td style={{ padding: "16px", color: "var(--text)", fontSize: "14px" }}>
                        <div>{tx.source || "N/A"}</div>
                        <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>→ {tx.destination || "N/A"}</div>
                      </td>
                      <td style={{ padding: "16px", color: "var(--text)", fontSize: "14px", textAlign: "center" }}>
                        {tx.seats || 0}
                      </td>
                      <td style={{ 
                        padding: "16px", 
                        color: tx.type === "debited" ? "#ef4444" : "#10b981", 
                        fontSize: "16px", 
                        fontWeight: "bold", 
                        textAlign: "right" 
                      }}>
                        {tx.type === "debited" ? "-" : "+"}₹{Number(tx.amount || 0).toFixed(2)}
                      </td>
                      <td style={{ padding: "16px", textAlign: "center" }}>
                        {getStatusBadge(tx.status || "success")}
                      </td>
                      <td style={{ padding: "16px", textAlign: "center" }}>
                        {getTypeBadge(tx.type || "credited")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
{/* Pagination */}
{totalPages > 1 && (
  <div style={{
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    gap: "10px",
    padding: "20px",
    background: "var(--card-bg)",
    borderTop: "1px solid var(--border)"
  }}>
    <button
      disabled={currentPage === 1}
      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
      style={{
        padding: "8px 14px",
        borderRadius: "8px",
        border: "1px solid var(--border)",
        background: currentPage === 1 ? "var(--bg-secondary)" : "var(--border)",
        color: "var(--text)",
        cursor: currentPage === 1 ? "not-allowed" : "pointer"
      }}
    >
      ◀ Prev
    </button>

    {Array.from({ length: totalPages }).map((_, i) => (
      <button
        key={i}
        onClick={() => setCurrentPage(i + 1)}
        style={{
          padding: "8px 14px",
          borderRadius: "8px",
          border: "1px solid var(--border)",
          background: currentPage === i + 1 ? "#3b82f6" : "var(--bg-secondary)",
          color: "var(--text)",
          fontWeight: "bold",
          cursor: "pointer"
        }}
      >
        {i + 1}
      </button>
    ))}

    <button
      disabled={currentPage === totalPages}
      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
      style={{
        padding: "8px 14px",
        borderRadius: "8px",
        border: "1px solid var(--border)",
        background: currentPage === totalPages ? "var(--bg-secondary)" : "var(--border)",
        color: "var(--text)",
        cursor: currentPage === totalPages ? "not-allowed" : "pointer"
      }}
    >
      Next ▶
    </button>
  </div>
)}

        {/* Summary */}
        {!loading && !error && filteredTransactions.length > 0 && (
          <div style={{
            marginTop: "24px",
            padding: "20px",
            background: "var(--card-bg)",
            borderRadius: "16px",
            border: "1px solid var(--border)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "16px"
          }}>
            <div>
              <div style={{ fontSize: "12px", color: "#9ca3af", marginBottom: "4px" }}>Total Transactions</div>
              <div style={{ fontSize: "24px", fontWeight: "bold", color: "var(--text)" }}>
                {filteredTransactions.length}
              </div>
            </div>
            <div>
            <div style={{ fontSize: "12px", color: "#9ca3af", marginBottom: "4px" }}>Total Received (All time)</div>
  <div style={{ fontSize: "24px", fontWeight: "bold", color: "#10b981" }}>
    ₹{(transactions.filter(tx => (tx.type === "credited" || (tx.role || '').toLowerCase() === 'driver')).reduce((sum, tx) => sum + (Number(tx.amount ?? tx.netAmount ?? tx.creditedAmount ?? tx.value ?? 0) || 0), 0)).toFixed(2)}
  </div>
</div>
<div>
  <div style={{ fontSize: "12px", color: "#9ca3af", marginBottom: "4px" }}>Total Paid</div>
  <div style={{ fontSize: "24px", fontWeight: "bold", color: "#ef4444" }}>
    ₹{filteredTransactions
      .filter(tx => tx.type === "debited")
      .reduce((sum, tx) => sum + (tx.amount || 0), 0)
      .toFixed(2)}
  </div>
</div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DriverTransactions;