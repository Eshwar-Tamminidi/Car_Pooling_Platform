export function computeFare(ride = {}, seats = 1) {
    const s = seats || 1;
    const base = (ride.price || 0) * s;
    const platformFee = Number((base * 0.05).toFixed(2)); // 5%
    const subtotal = Number((base + platformFee).toFixed(2));
    // GST: CGST 1.8% + SGST 1.8% => total 3.6%
    const gstTotal = Number((subtotal * 0.036).toFixed(2)); // 3.6% on subtotal
    const cgst = Number((subtotal * 0.018).toFixed(2));
    const sgst = Number((subtotal * 0.018).toFixed(2));
    const total = Number((subtotal + gstTotal).toFixed(2));

    return { base, platformFee, subtotal, gstTotal, cgst, sgst, total };
}
