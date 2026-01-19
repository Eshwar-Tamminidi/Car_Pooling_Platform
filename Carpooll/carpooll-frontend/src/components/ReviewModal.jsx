import React, { useState } from "react";
import StarRating from "./StarRating";
import { apiGet, apiPost } from "../api/api";
console.log("REVIEW MODAL LOADED");


export default function ReviewModal({ bookingId, onClose, onSuccess }) {
  const [rating, setRating] = useState(0);
  const [review, setReview] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submitReview() {
    if (rating === 0) {
      setError("Please select a rating");
      return;
    }

    try {
      setLoading(true);
      setError("");

      await apiPost("/api/ratings/submit", {
        bookingId,
        stars: rating,
        review,
      });

      // Notify other components to refresh rating aggregates
      try{
        // Try to find the rideId for this booking so we can include it in the event detail
        let rideId = null;
        try{
          const mine = await apiGet('/api/bookings/my');
          const found = (mine || []).find(b => b && b.id === bookingId);
          if (found) rideId = found.rideId || found.rideDetails?.id;
        } catch(e) {/* ignore */}
        if (!rideId) {
          try{
            const host = await apiGet('/api/bookings/for-host');
            const found = (host || []).find(b => b && b.id === bookingId);
            if (found) rideId = found.rideId || found.rideDetails?.id;
          } catch(e) {/* ignore */}
        }
        window.dispatchEvent(new CustomEvent('rating:updated', { detail: { bookingId, rideId } }));
      }catch(e){}

      onSuccess();
      onClose();
    } catch (err) {
      setError(err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="review-modal">
      <h2 className="review-title">Rate Your Ride</h2>

      <StarRating rating={rating} setRating={setRating} />

      <textarea
        className="review-textarea"
        placeholder="Write your experience (optional)"
        value={review}
        onChange={(e) => setReview(e.target.value)}
      />

      {error && <p className="review-error">{error}</p>}

      <div className="review-actions">
        <button className="btn-cancel" onClick={onClose}>
          Cancel
        </button>

        <button
          className="btn-submit"
          onClick={submitReview}
          disabled={loading}
        >
          {loading ? "Submitting..." : "Submit"}
        </button>
      </div>
    </div>
  );
}
