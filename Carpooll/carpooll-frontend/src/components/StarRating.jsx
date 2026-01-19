import React, { useState } from "react";

export default function StarRating({ rating, setRating }) {
  const [hover, setHover] = useState(0);

  return (
    <div style={{ fontSize: "32px", margin: "12px 0" }}>
      {[1, 2, 3, 4, 5].map((star) => (
        <span
          key={star}
          onClick={() => setRating(star)}
          onMouseEnter={() => setHover(star)}
          onMouseLeave={() => setHover(0)}
          style={{
            cursor: "pointer",
            color: star <= (hover || rating) ? "#fbbf24" : "#4b5563",
            transition: "transform 0.15s ease",
            marginRight: "6px",
            transform: star <= (hover || rating) ? "scale(1.15)" : "scale(1)",
          }}
        >
          ★
        </span>
      ))}
    </div>
  );
}
