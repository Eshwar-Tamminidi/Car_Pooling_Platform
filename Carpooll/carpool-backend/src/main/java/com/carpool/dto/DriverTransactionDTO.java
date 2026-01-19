package com.carpool.dto;

import java.time.LocalDateTime;

public class DriverTransactionDTO {

    private Long bookingId;
    private String passengerName;
    private String source;
    private String destination;
    private LocalDateTime date;
    private int seats;
    private double grossFare; // base fare (ride.price * seats)
    private double platformFee;
    private double cgst;
    private double sgst;
    private double netAmount; // amount driver receives after platform fee
    private String transactionId;

    public DriverTransactionDTO(
            Long bookingId,
            String passengerName,
            String source,
            String destination,
            LocalDateTime date,
            int seats,
            double grossFare,
            double platformFee,
            double cgst,
            double sgst,
            double netAmount,
            String transactionId
    ) {
        this.bookingId = bookingId;
        this.passengerName = passengerName;
        this.source = source;
        this.destination = destination;
        this.date = date;
        this.seats = seats;
        this.grossFare = grossFare;
        this.platformFee = platformFee;
        this.cgst = cgst;
        this.sgst = sgst;
        this.netAmount = netAmount;
        this.transactionId = transactionId;
    }

    public Long getBookingId() { return bookingId; }
    public String getPassengerName() { return passengerName; }
    public String getSource() { return source; }
    public String getDestination() { return destination; }
    public LocalDateTime getDate() { return date; }
    public int getSeats() { return seats; }
    public double getGrossFare() { return grossFare; }
    public double getPlatformFee() { return platformFee; }
    public double getCgst() { return cgst; }
    public double getSgst() { return sgst; }
    public double getNetAmount() { return netAmount; }
    public String getTransactionId() { return transactionId; }
}
