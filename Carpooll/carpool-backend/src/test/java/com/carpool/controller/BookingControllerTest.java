package com.carpool.controller;

import com.carpool.model.Booking;
import com.carpool.model.Ride;
import com.carpool.model.User;
import com.carpool.repository.BookingRepository;
import com.carpool.repository.RideRepository;
import com.carpool.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.context.annotation.Import;
import com.carpool.config.TestMailConfig; 
import jakarta.persistence.EntityManager;

import com.carpool.repository.NotificationRepository;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@Import(TestMailConfig.class)
@AutoConfigureMockMvc
@Transactional
public class BookingControllerTest {
    @Autowired
    private MockMvc mvc;

    @Autowired
    private RideRepository rideRepository;

    @Autowired
    private BookingRepository bookingRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private NotificationRepository notificationRepository;

    @Autowired
    private EntityManager em;

    @Test
    public void hostCanCompleteBooking() throws Exception {
        User host = new User();
        host.setEmail("host@example.com");
        host.setFullname("Host");
        host.setRole("USER");
        userRepository.save(host);

        Ride ride = new Ride();
        ride.setOwnerEmail("host@example.com");
        ride.setDateTime(java.time.LocalDateTime.now().minusMinutes(5).toString());
        rideRepository.save(ride);

        Booking b = new Booking();
        b.setRideId(ride.getId());
        b.setRequesterEmail("pass@example.com");
        b.setStatus(Booking.Status.CONFIRMED);
        bookingRepository.save(b);

        mvc.perform(post("/api/bookings/" + b.getId() + "/complete").requestAttr("email", "host@example.com").contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("COMPLETED"));

        // Clear persistence context so we see DB updates from the controller's transaction
        em.flush();
        em.clear();

        Booking after = bookingRepository.findById(b.getId()).orElse(null);
        assertEquals(Booking.Status.COMPLETED, after.getStatus());
    }

    @Test
    public void requestBookingNotifiesHost() throws Exception {
        User host = new User();
        host.setEmail("host4@example.com");
        host.setFullname("Host4");
        host.setRole("USER");
        userRepository.save(host);

        Ride ride = new Ride();
        ride.setOwnerEmail("host4@example.com");
        ride.setDateTime(java.time.LocalDateTime.now().plusMinutes(10).toString());
        rideRepository.save(ride);

        User passenger = new User();
        passenger.setEmail("p4@example.com");
        passenger.setFullname("P4");
        userRepository.save(passenger);

        Booking payload = new Booking();
        payload.setRideId(ride.getId());
        payload.setSeatsRequested(1);

        mvc.perform(post("/api/bookings/request").requestAttr("email", passenger.getEmail()).contentType(MediaType.APPLICATION_JSON).content("{\"rideId\":"+ride.getId()+",\"seatsRequested\":1}"))
                .andExpect(status().isOk());

        em.flush();
        em.clear();

        // host should have a notification
        User h = userRepository.findByEmail("host4@example.com").orElse(null);
        assertNotNull(h);
        var notes = notificationRepository.findByUserOrderByCreatedAtDesc(h);
        assertFalse(notes.isEmpty());
        assertEquals("New Booking Request", notes.get(0).getTitle());
    }

    @Test
    public void completingBookingNotifiesBoth() throws Exception {
        User host = new User();
        host.setEmail("host5@example.com");
        host.setFullname("Host5");
        host.setRole("USER");
        userRepository.save(host);

        Ride ride = new Ride();
        ride.setOwnerEmail("host5@example.com");
        ride.setDateTime(java.time.LocalDateTime.now().minusMinutes(5).toString());
        rideRepository.save(ride);

        User passenger = new User();
        passenger.setEmail("p5@example.com");
        passenger.setFullname("P5");
        userRepository.save(passenger);

        Booking b = new Booking();
        b.setRideId(ride.getId());
        b.setRequesterId(passenger.getId());
        b.setRequesterEmail(passenger.getEmail());
        b.setStatus(Booking.Status.CONFIRMED);
        bookingRepository.save(b);

        mvc.perform(post("/api/bookings/" + b.getId() + "/complete").requestAttr("email", "host5@example.com").contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("COMPLETED"));

        em.flush();
        em.clear();

        var p = userRepository.findByEmail(passenger.getEmail()).orElse(null);
        var h = userRepository.findByEmail(host.getEmail()).orElse(null);
        assertNotNull(p);
        assertNotNull(h);

        var pn = notificationRepository.findByUserOrderByCreatedAtDesc(p);
        var hn = notificationRepository.findByUserOrderByCreatedAtDesc(h);

        assertFalse(pn.isEmpty());
        assertFalse(hn.isEmpty());

        assertEquals("Ride Completed", pn.get(0).getTitle());
        assertEquals("Ride Completed", hn.get(0).getTitle());
    }

    @Test
    public void hostCanCompleteRideBookings() throws Exception {
        User host = new User();
        host.setEmail("host2@example.com");
        host.setFullname("Host2");
        host.setRole("USER");
        userRepository.save(host);

        Ride ride = new Ride();
        ride.setOwnerEmail("host2@example.com");
        ride.setDateTime(java.time.LocalDateTime.now().minusMinutes(5).toString());
        rideRepository.save(ride);

        Booking b1 = new Booking();
        b1.setRideId(ride.getId()); b1.setRequesterEmail("p1@example.com"); b1.setStatus(Booking.Status.CONFIRMED); bookingRepository.save(b1);
        Booking b2 = new Booking();
        b2.setRideId(ride.getId()); b2.setRequesterEmail("p2@example.com"); b2.setStatus(Booking.Status.CONFIRMED); bookingRepository.save(b2);
        Booking b3 = new Booking();
        b3.setRideId(ride.getId()); b3.setRequesterEmail("p3@example.com"); b3.setStatus(Booking.Status.PENDING); bookingRepository.save(b3);

        mvc.perform(post("/api/rides/" + ride.getId() + "/complete").requestAttr("email", "host2@example.com").contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.updated").value(2));

        // Ensure we see DB updates performed by controller
        em.flush();
        em.clear();

        Booking after1 = bookingRepository.findById(b1.getId()).orElse(null);
        Booking after2 = bookingRepository.findById(b2.getId()).orElse(null);
        Booking after3 = bookingRepository.findById(b3.getId()).orElse(null);
        assertEquals(Booking.Status.COMPLETED, after1.getStatus());
        assertEquals(Booking.Status.COMPLETED, after2.getStatus());
        assertEquals(Booking.Status.PENDING, after3.getStatus());
    }

    @Test
    public void hostCanCompleteBookingWithMissingRequesterEmail() throws Exception {
        User host = new User();
        host.setEmail("host-missing@example.com");
        host.setFullname("HostMissing");
        host.setRole("USER");
        userRepository.save(host);

        Ride ride = new Ride();
        ride.setOwnerEmail("host-missing@example.com");
        ride.setDateTime(java.time.LocalDateTime.now().minusMinutes(5).toString());
        rideRepository.save(ride);

        Booking b = new Booking();
        b.setRideId(ride.getId());
        b.setRequesterEmail(null); // missing email
        b.setStatus(Booking.Status.CONFIRMED);
        bookingRepository.save(b);

        mvc.perform(post("/api/bookings/" + b.getId() + "/complete").requestAttr("email", "host-missing@example.com").contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("COMPLETED"));

        em.flush();
        em.clear();

        Booking after = bookingRepository.findById(b.getId()).orElse(null);
        assertEquals(Booking.Status.COMPLETED, after.getStatus());
    }

    @Test
    public void paymentSuccessNotifiesDriverAndPassenger() throws Exception {
        User host = new User(); host.setEmail("driver-pay@example.com"); host.setFullname("DriverPay"); host.setRole("USER"); userRepository.save(host);
        User passenger = new User(); passenger.setEmail("p-pay@example.com"); passenger.setFullname("PayPassenger"); passenger.setRole("USER"); userRepository.save(passenger);

        Ride ride = new Ride(); ride.setOwnerEmail(host.getEmail()); ride.setPrice(100.0); ride.setSeatsAvailable(3); ride.setDateTime(java.time.LocalDateTime.now().plusHours(1).toString()); rideRepository.save(ride);

        Booking b = new Booking(); b.setRideId(ride.getId()); b.setRequesterId(passenger.getId()); b.setRequesterEmail(passenger.getEmail()); b.setSeatsRequested(1); b.setStatus(Booking.Status.PENDING); bookingRepository.save(b);

        mvc.perform(post("/api/bookings/" + b.getId() + "/verify-payment").requestAttr("email", passenger.getEmail()).contentType(MediaType.APPLICATION_JSON).content("{\"transactionId\":\"pi_12345\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("CONFIRMED"));

        em.flush(); em.clear();

        var pNotes = notificationRepository.findByUserOrderByCreatedAtDesc(passenger);
        var hNotes = notificationRepository.findByUserOrderByCreatedAtDesc(host);
        assertFalse(pNotes.isEmpty());
        assertFalse(hNotes.isEmpty());
        assertEquals("Payment Successful", pNotes.get(0).getTitle());
        assertEquals("Passenger Paid", hNotes.get(0).getTitle());
    }

    @Test
    public void paymentInvalidTxNotifiesPassenger() throws Exception {
        User passenger = new User(); passenger.setEmail("p-pay2@example.com"); passenger.setFullname("PayPassenger2"); passenger.setRole("USER"); userRepository.save(passenger);
        Ride ride = new Ride(); ride.setOwnerEmail("driver2@example.com"); ride.setPrice(50.0); ride.setDateTime(java.time.LocalDateTime.now().plusHours(1).toString()); rideRepository.save(ride);
        Booking b = new Booking(); b.setRideId(ride.getId()); b.setRequesterId(passenger.getId()); b.setRequesterEmail(passenger.getEmail()); b.setSeatsRequested(1); b.setStatus(Booking.Status.PENDING); bookingRepository.save(b);

        mvc.perform(post("/api/bookings/" + b.getId() + "/verify-payment").requestAttr("email", passenger.getEmail()).contentType(MediaType.APPLICATION_JSON).content("{\"transactionId\":\"invalid_tx\"}"))
                .andExpect(status().isBadRequest());

        em.flush(); em.clear();
        var pNotes = notificationRepository.findByUserOrderByCreatedAtDesc(passenger);
        assertFalse(pNotes.isEmpty());
        assertEquals("Payment Failed", pNotes.get(0).getTitle());
    }


}
