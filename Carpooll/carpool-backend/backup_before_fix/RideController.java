package com.carpool.controller;

import com.carpool.model.Ride;
import com.carpool.repository.RideRepository;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/rides")
@CrossOrigin(origins = "*")
public class RideController {
    private final RideRepository rideRepository;
    public RideController(RideRepository rideRepository){
        this.rideRepository = rideRepository;
    }

    @GetMapping
    public List<Ride> listAll(){ return rideRepository.findAll(); }

    @PostMapping
    public Ride create(@RequestBody Ride r){ return rideRepository.save(r); }

    @GetMapping("/{id}")
    public Ride get(@PathVariable Long id){ return rideRepository.findById(id).orElse(null); }
}
