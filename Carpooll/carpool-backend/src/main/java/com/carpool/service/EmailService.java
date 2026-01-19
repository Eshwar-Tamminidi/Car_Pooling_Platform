package com.carpool.service;

import jakarta.mail.MessagingException;
import jakarta.mail.internet.MimeMessage;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import com.carpool.model.Booking;
import com.carpool.model.Ride;
import com.carpool.model.User; // used for host notifications



@Service
public class EmailService {

    private final JavaMailSender mailSender;
    private final com.carpool.repository.UserRepository userRepository;

    public EmailService(JavaMailSender mailSender, com.carpool.repository.UserRepository userRepository) {
        this.mailSender = mailSender;
        this.userRepository = userRepository;
    }

    // ✅ Keep this for text mails (forgot password etc.)
    public void sendSimpleEmail(String to, String subject, String body) {
        SimpleMailMessage message = new SimpleMailMessage();
        message.setTo(to);
        message.setSubject(subject);
        message.setText(body);
        mailSender.send(message);
    }

    // ✅ NEW: Professional HTML welcome email
    @Async
    public void sendWelcomeEmail(String to, String name, boolean needsApproval) throws MessagingException {

        String loginLink = "http://localhost:5173/login"; // change when deployed
        String subject = "Welcome to VeloCity 🚗";

        String approvalText = needsApproval
                ? "<p style='color:#e67e22;'><b>Note:</b> Your admin account requires approval before login.</p>"
                : "<p>You can log in immediately and start using the platform.</p>";

        String html = """
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>Welcome to VeloCity</title>
        </head>
        <body style="margin:0; padding:0; background-color:#f4f6f8; font-family:Arial, sans-serif;">
            <div style="max-width:600px; margin:40px auto; background:#ffffff; border-radius:10px; overflow:hidden; box-shadow:0 0 10px rgba(0,0,0,0.08);">
                
                <div style="background:#0d6efd; color:white; padding:20px; text-align:center;">
                    <h1 style="margin:0;">🚗 VeloCity</h1>
                    <p style="margin:5px 0 0;">Smart Carpool Platform</p>
                </div>

                <div style="padding:30px; color:#333;">
                    <h2>Hi %s 👋</h2>
                    
                    <p>Your VeloCity account has been created successfully 🎉</p>
                    %s

                    <div style="text-align:center; margin:30px 0;">
                        <a href="%s" 
                           style="background:#0d6efd; color:white; padding:14px 28px; 
                                  text-decoration:none; border-radius:6px; font-size:16px; display:inline-block;">
                            Login to VeloCity
                        </a>
                    </div>

                    <p style="font-size:14px; color:#666;">
                        If you did not create this account, please contact our support immediately.
                    </p>

                    <p>Welcome aboard,<br><b>Team VeloCity</b></p>
                </div>

                <div style="background:#f1f3f5; text-align:center; padding:12px; font-size:12px; color:#777;">
                    © 2026 VeloCity. All rights reserved.
                </div>

            </div>
        </body>
        </html>
        """.formatted(name, approvalText, loginLink);

        MimeMessage message = mailSender.createMimeMessage();
        MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");

        helper.setTo(to);
        helper.setSubject(subject);
        helper.setText(html, true); // true = HTML

        mailSender.send(message);
    }
    @Async
    public void sendRideConfirmedEmail(Booking booking, Ride ride) {
        try {
            if (booking.getRequesterEmail() == null || booking.getRequesterEmail().isBlank()) {
                // No recipient, skip sending
                return;
            }

            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");

            helper.setTo(booking.getRequesterEmail());
            helper.setSubject("✅ Ride Confirmed – Your trip is booked!");

            String html = """
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; background:#f4f6f8; padding:20px; }
            .card { max-width:600px; margin:auto; background:white; border-radius:10px; overflow:hidden; box-shadow:0 4px 10px rgba(0,0,0,0.08); }
            .header { background:#0d6efd; color:white; padding:20px; text-align:center; }
            .content { padding:20px; color:#333; }
            .ride-box { background:#f1f5f9; padding:15px; border-radius:8px; margin:15px 0; }
            .btn { display:inline-block; padding:12px 20px; background:#0d6efd; color:white; text-decoration:none; border-radius:6px; margin-top:15px; }
            .footer { text-align:center; font-size:12px; color:#777; padding:15px; }
          </style>
        </head>
        <body>
          <div class="card">
            <div class="header">
              <h2>🚗 Ride Confirmed!</h2>
              <p>Your booking is successfully confirmed</p>
            </div>

            <div class="content">
              <p>Hi <b>%s</b>,</p>
              <p>Your seat has been successfully booked. Here are your ride details:</p>

              <div class="ride-box">
                <p><b>Ride ID:</b> %d</p>
                <p><b>Seats Booked:</b> %d</p>
                <p><b>Status:</b> CONFIRMED</p>
                <p><b>Confirmed At:</b> %s</p>
              </div>

              <p>Please be on time and carry any required identification.</p>

              <a class="btn" href="http://localhost:3000/my-rides">View My Bookings</a>
            </div>

            <div class="footer">
              <p>Thank you for choosing our carpool service.</p>
              <p>Safe travels 🚀</p>
            </div>
          </div>
        </body>
        </html>
        """.formatted(
                    booking.getRequesterName(),
                    booking.getRideId(),
                    booking.getSeatsRequested(),
                    booking.getConfirmedAt()
            );

            helper.setText(html, true);
            mailSender.send(message);

        } catch (Exception e) {
            System.err.println("Ride confirmation email failed: " + e.getMessage());
        }
    }
    @Async
    public void sendInvoiceEmail(Booking booking, Ride ride) {
        try {
            System.out.println("✅ INVOICE EMAIL TRIGGERED for " + booking.getRequesterEmail());
            int seats = booking.getSeatsRequested();

            double baseFare = ride.getPrice() * seats;
            double platformFee = baseFare * 0.05; // 5% platform fee
            double subtotal = baseFare + platformFee;
            // Tax policy: CGST 1.8% + SGST 1.8% = 3.6% total on subtotal
            double cgst = subtotal * 0.018; // 1.8%
            double sgst = subtotal * 0.018; // 1.8%
            double gstTotal = cgst + sgst; // 3.6% total
            double total = subtotal + gstTotal;

            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");

            helper.setTo(booking.getRequesterEmail());
            helper.setSubject("🧾 VeloCity Invoice – Payment Successful");

            String html = """
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#f4f6f8;font-family:Arial,sans-serif;">
<div style="max-width:650px;margin:30px auto;background:#ffffff;border-radius:10px;overflow:hidden;box-shadow:0 4px 10px rgba(0,0,0,0.08);">

  <div style="background:#0d6efd;color:white;padding:22px;text-align:center;">
    <h2 style="margin:0;">🧾 Payment Invoice</h2>
    <p style="margin:6px 0 0;">VeloCity Carpool Platform</p>
  </div>

  <div style="padding:25px;color:#333;">
    <p><b>Invoice To:</b> %s</p>
    <p><b>Email:</b> %s</p>
    <p><b>Transaction ID:</b> %s</p>
    <p><b>Booking ID:</b> %d</p>

    <hr style="margin:20px 0;">

    <h3>Fare Breakdown</h3>

    <table style="width:100%%;border-collapse:collapse;">
      <tr>
        <td>Base Fare (%d seat%s)</td>
        <td style="text-align:right;">₹%.2f</td>
      </tr>
      <tr>
        <td>Platform Fee (5%%)</td>
        <td style="text-align:right;">₹%.2f</td>
      </tr>
      <tr>
        <td>CGST (1.8%%)</td>
        <td style="text-align:right;">₹%.2f</td>
      </tr>
      <tr>
        <td>SGST (1.8%%)</td>
        <td style="text-align:right;">₹%.2f</td>
      </tr>
      <tr>
        <td colspan="2"><hr></td>
      </tr>
      <tr style="font-size:18px;">
        <td><b>Total Paid</b></td>
        <td style="text-align:right;"><b>₹%.2f</b></td>
      </tr>
    </table>

    <p style="margin-top:20px; color:#333;"><b>Note:</b> 5% from the amount will be taken as a platform fees from driver and passanger to maintain the platform significantly.</p>

    <p style="margin-top:20px;">
      Payment Status: <b style="color:green;">SUCCESS</b><br>
      Confirmed At: %s
    </p>

    <div style="text-align:center;margin:30px 0;">
      <a href="http://localhost:3000/my-rides"
         style="background:#0d6efd;color:white;padding:12px 26px;text-decoration:none;border-radius:6px;">
        View My Bookings
      </a>
    </div>

    <p style="font-size:13px;color:#777;">
      This is a system generated invoice. For any support, contact VeloCity helpdesk.
    </p>
  </div>

  <div style="background:#f1f3f5;text-align:center;padding:12px;font-size:12px;color:#777;">
    © 2026 VeloCity
  </div>

</div>
</body>
</html>
""".formatted(
                    booking.getRequesterName(),
                    booking.getRequesterEmail(),
                    booking.getTransactionId(),
                    booking.getId(),
                    seats, seats > 1 ? "s" : "",
                    baseFare,
                    platformFee,
                    cgst,
                    sgst,
                    total,
                    booking.getConfirmedAt());

            helper.setText(html, true);
            mailSender.send(message);

        } catch (Exception e) {
            System.err.println("Invoice email failed: " + e.getMessage());
        }
    }

    @Async
    public void sendPassengerPaidEmail(Booking booking, Ride ride) {
        try {
            String driverEmail = ride.getOwnerEmail();
            if (driverEmail == null || driverEmail.isBlank()) {
                // No driver email configured; skip sending
                return;
            }

            int seats = booking.getSeatsRequested() > 0 ? booking.getSeatsRequested() : 1;
            double base = ride.getPrice() * seats;
            double platformFee = base * 0.05; // 5%
            double subtotal = base + platformFee;
            // CGST 1.8% + SGST 1.8% = 3.6% total on subtotal
            double cgst = subtotal * 0.018; // 1.8%
            double sgst = subtotal * 0.018; // 1.8%
            double gstTotal = cgst + sgst; // 3.6% total
            double total = subtotal + gstTotal;
            double netToDriver = base - platformFee; // driver receives base minus platform fee

            // try to fetch driver phone if available
            String driverPhone = userRepository.findByEmail(driverEmail).map(u -> u.getPhone()).orElse("—");

            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");

            helper.setTo(driverEmail);
            helper.setSubject("💳 Passenger Paid – VeloCity");

            String html = """
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#f4f6f8;font-family:Arial,sans-serif;">
<div style="max-width:600px;margin:30px auto;background:#ffffff;border-radius:10px;overflow:hidden;box-shadow:0 4px 10px rgba(0,0,0,0.08);">
  <div style="background:#0d6efd;color:white;padding:20px;text-align:center;">
    <h2 style="margin:0;">💳 Passenger Payment Received</h2>
    <p>Passenger <b>%s</b> has paid for Booking <b>%d</b>.</p>
  </div>
  <div style="padding:20px;color:#333;">
    <p><b>Payment Summary</b></p>
    <p>Amount paid by passenger (Total): <b>₹%.2f</b></p>
    <p>Platform fee (5%%): <b>₹%.2f</b></p>
    <p>CGST (1.8%%): ₹%.2f &nbsp; SGST (1.8%%): ₹%.2f &nbsp; <b>Total GST: ₹%.2f</b></p>
    <p style="margin-top:8px;"><b>Amount credited to driver: ₹%.2f</b></p>

    <hr style="border:none;border-top:1px solid #eee;margin:12px 0;" />

    <p><b>Driver details</b></p>
    <p>Name: %s</p>
    <p>Email: %s</p>
    <p>Phone: %s</p>
    <p>Vehicle: %s</p>

    <div style="text-align:center;margin:20px 0;">
      <a href="http://localhost:3000/hosted" style="background:#0d6efd;color:white;padding:12px 20px;text-decoration:none;border-radius:6px;display:inline-block;">View Bookings</a>
    </div>

    <p style="font-size:13px;color:#777;margin-top:18px;">– Team VeloCity</p>
  </div>
</div>
</body>
</html>
""".formatted(
                    booking.getRequesterName(),
                    booking.getId(),
                    total,
                    platformFee,
                    cgst,
                    sgst,
                    gstTotal,
                    netToDriver,
                    ride.getDriverName() == null ? "N/A" : ride.getDriverName(),
                    driverEmail,
                    driverPhone,
                    ride.getVehicleNumber() == null ? "—" : ride.getVehicleNumber()
            );

            helper.setText(html, true);
            mailSender.send(message);
        } catch (Exception e) {
            System.err.println("sendPassengerPaidEmail failed: " + e.getMessage());
        }
    }    @Async
    public void sendBookingAcceptedEmail(Booking booking, Ride ride) {
        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");

            helper.setTo(booking.getRequesterEmail());
            helper.setSubject("✅ Ride Request Accepted – VeloCity");

            String html = """
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#f4f6f8;font-family:Arial,sans-serif;">
<div style="max-width:600px;margin:30px auto;background:#ffffff;border-radius:10px;overflow:hidden;box-shadow:0 4px 10px rgba(0,0,0,0.08);">

  <div style="background:#16a34a;color:white;padding:20px;text-align:center;">
    <h2 style="margin:0;">✅ Ride Accepted</h2>
    <p>Your request has been approved by the driver</p>
  </div>

  <div style="padding:24px;color:#333;">
    <p>Hi <b>%s</b>,</p>

    <p>Good news 🎉 Your ride request has been <b>accepted</b>.</p>

    <div style="background:#f1f5f9;padding:14px;border-radius:8px;">
      <p><b>Ride ID:</b> %d</p>
      <p><b>Seats:</b> %d</p>
      <p><b>Status:</b> ACCEPTED</p>
    </div>

    <div style="text-align:center;margin:25px 0;">
      <a href="http://localhost:3000/my-rides"
         style="background:#0d6efd;color:white;padding:12px 24px;text-decoration:none;border-radius:6px;">
        View My Rides
      </a>
    </div>

    <p>We wish you a safe and pleasant journey 🚗</p>
    <p><b>– Team VeloCity</b></p>
  </div>

</div>
</body>
</html>
""".formatted(
                    booking.getRequesterName(),
                    booking.getRideId(),
                    booking.getSeatsRequested()
            );

            helper.setText(html, true);
            mailSender.send(message);

        } catch (Exception e) {
            System.err.println("Accepted email failed");
            e.printStackTrace();
        }
    }
    @Async
    public void sendBookingRejectedEmail(Booking booking, Ride ride) {
        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");

            helper.setTo(booking.getRequesterEmail());
            helper.setSubject("❌ Ride Request Rejected – VeloCity");

            String html = """
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#f4f6f8;font-family:Arial,sans-serif;">
<div style="max-width:600px;margin:30px auto;background:#ffffff;border-radius:10px;overflow:hidden;box-shadow:0 4px 10px rgba(0,0,0,0.08);">

  <div style="background:#dc2626;color:white;padding:20px;text-align:center;">
    <h2 style="margin:0;">❌ Ride Rejected</h2>
    <p>Your ride request was not approved</p>
  </div>

  <div style="padding:24px;color:#333;">
    <p>Hi <b>%s</b>,</p>

    <p>Unfortunately, the driver has <b>rejected</b> your ride request.</p>

    <div style="background:#f1f5f9;padding:14px;border-radius:8px;">
      <p><b>Ride ID:</b> %d</p>
      <p><b>Seats:</b> %d</p>
      <p><b>Status:</b> REJECTED</p>
    </div>

    <p style="margin-top:18px;">
      Don’t worry — you can explore other rides and book again anytime.
    </p>

    <div style="text-align:center;margin:25px 0;">
      <a href="http://localhost:3000/rides"
         style="background:#0d6efd;color:white;padding:12px 24px;text-decoration:none;border-radius:6px;">
        Find Other Rides
      </a>
    </div>

    <p><b>– Team VeloCity</b></p>
  </div>

</div>
</body>
</html>
""".formatted(
                    booking.getRequesterName(),
                    booking.getRideId(),
                    booking.getSeatsRequested()
            );

            helper.setText(html, true);
            mailSender.send(message);

        } catch (Exception e) {
            System.err.println("Rejected email failed");
            e.printStackTrace();
        }
    }

    // --------------------- ADDITIONAL EMAILS FOR NOTIFICATIONS ---------------------

    @Async
    public void sendRideHostedEmail(Ride ride, User host) {
        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");

            helper.setTo(host.getEmail());
            helper.setSubject("🎉 Your ride is live — VeloCity");

            String html = """
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#f4f6f8;font-family:Arial,sans-serif;">
<div style="max-width:600px;margin:30px auto;background:#ffffff;border-radius:10px;overflow:hidden;box-shadow:0 4px 10px rgba(0,0,0,0.08);">
  <div style="background:#0d6efd;color:white;padding:20px;text-align:center;">
    <h2 style="margin:0;">🎉 Your ride is live!</h2>
    <p>Your ride (ID: %d) is now visible to passengers.</p>
  </div>
  <div style="padding:20px;color:#333;">
    <p>Hi <b>%s</b>,</p>
    <p>Your ride has been published. Share it with friends or check your hosted rides to manage bookings.</p>
    <a href="http://localhost:3000/my-rides" style="background:#0d6efd;color:white;padding:12px 20px;text-decoration:none;border-radius:6px;display:inline-block;margin-top:12px;">View Hosted Rides</a>
    <p style="font-size:13px;color:#777;margin-top:18px;">– Team VeloCity</p>
  </div>
</div>
</body>
</html>
""".formatted(ride.getId(), host.getFullname());

            helper.setText(html, true);
            mailSender.send(message);
        } catch (Exception e) {
            System.err.println("sendRideHostedEmail failed: " + e.getMessage());
        }
    }

    @Async
    public void sendBookingRequestedToHostEmail(Booking booking, Ride ride) {
        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");
            helper.setTo(ride.getOwnerEmail());
            helper.setSubject("📬 New Booking Request – VeloCity");

            String html = """
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#f4f6f8;font-family:Arial,sans-serif;">
<div style="max-width:600px;margin:30px auto;background:#ffffff;border-radius:10px;overflow:hidden;box-shadow:0 4px 10px rgba(0,0,0,0.08);">
  <div style="background:#0d6efd;color:white;padding:20px;text-align:center;">
    <h2 style="margin:0;">📬 New Booking Request</h2>
    <p>You have a new booking request for ride %d</p>
  </div>
  <div style="padding:20px;color:#333;">
    <p>Passenger: <b>%s</b> (%s)</p>
    <p>Seats requested: %d</p>
    <a href="http://localhost:3000/hosted" style="background:#0d6efd;color:white;padding:12px 20px;text-decoration:none;border-radius:6px;display:inline-block;margin-top:12px;">Review Requests</a>
    <p style="font-size:13px;color:#777;margin-top:18px;">– Team VeloCity</p>
  </div>
</div>
</body>
</html>
""".formatted(booking.getRideId(), booking.getRequesterName(), booking.getRequesterEmail(), booking.getSeatsRequested());

            helper.setText(html, true);
            mailSender.send(message);
        } catch (Exception e) {
            System.err.println("sendBookingRequestedToHostEmail failed: " + e.getMessage());
        }
    }

    @Async
    public void sendRatingRequestEmails(Booking booking, Ride ride) {
        try {
            // Passenger email
            if (booking.getRequesterEmail() != null && !booking.getRequesterEmail().isBlank()) {
                MimeMessage pMsg = mailSender.createMimeMessage();
                MimeMessageHelper pHelper = new MimeMessageHelper(pMsg, true, "UTF-8");
                pHelper.setTo(booking.getRequesterEmail());
                pHelper.setSubject("⭐ Please rate your recent ride – VeloCity");
                String passengerName = booking.getRequesterName() == null ? "" : booking.getRequesterName();
                String pHtml = """
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#f4f6f8;font-family:Arial,sans-serif;">
<div style="max-width:600px;margin:30px auto;background:#ffffff;border-radius:10px;overflow:hidden;box-shadow:0 4px 10px rgba(0,0,0,0.08);">
  <div style="background:#0d6efd;color:white;padding:20px;text-align:center;">
    <h2 style="margin:0;">⭐ Please rate your ride</h2>
  </div>
  <div style="padding:20px;color:#333;">
    <p>Hi <b>%s</b>,</p>
    <p>Your ride (ID: %d) is now completed. Please take a moment to rate your driver and share feedback.</p>
    <a href="http://localhost:3000/my-rides" style="background:#0d6efd;color:white;padding:12px 20px;text-decoration:none;border-radius:6px;display:inline-block;margin-top:12px;">Rate Now</a>
    <p style="font-size:13px;color:#777;margin-top:18px;">– Team VeloCity</p>
  </div>
</div>
</body>
</html>
""".formatted(passengerName, booking.getRideId());
                pHelper.setText(pHtml, true);
                mailSender.send(pMsg);
            }

            // Driver email
            if (ride.getOwnerEmail() != null && !ride.getOwnerEmail().isBlank()) {
                MimeMessage dMsg = mailSender.createMimeMessage();
                MimeMessageHelper dHelper = new MimeMessageHelper(dMsg, true, "UTF-8");
                dHelper.setTo(ride.getOwnerEmail());
                dHelper.setSubject("⭐ Please rate your passenger – VeloCity");
                String dHtml = """
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#f4f6f8;font-family:Arial,sans-serif;">
<div style="max-width:600px;margin:30px auto;background:#ffffff;border-radius:10px;overflow:hidden;box-shadow:0 4px 10px rgba(0,0,0,0.08);">
  <div style="background:#0d6efd;color:white;padding:20px;text-align:center;">
    <h2 style="margin:0;">⭐ Please rate your passenger</h2>
  </div>
  <div style="padding:20px;color:#333;">
    <p>Your ride (ID: %d) is now completed. Please rate your passengers.</p>
    <a href="http://localhost:3000/hosted" style="background:#0d6efd;color:white;padding:12px 20px;text-decoration:none;border-radius:6px;display:inline-block;margin-top:12px;">Rate Passengers</a>
    <p style="font-size:13px;color:#777;margin-top:18px;">– Team VeloCity</p>
  </div>
</div>
</body>
</html>
""".formatted(booking.getRideId());
                dHelper.setText(dHtml, true);
                mailSender.send(dMsg);
            }

        } catch (Exception e) {
            System.err.println("sendRatingRequestEmails failed: " + e.getMessage());
        }
    }



}
