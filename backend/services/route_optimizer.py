import logging
from typing import List, Dict, Any
import math

logger = logging.getLogger(__name__)

class RouteOptimizer:
    """
    Isolated module responsible for determining the optimal sequence of stops.
    It does NOT mutate database state. It only returns sorted arrays.
    """
    
    @staticmethod
    def _calculate_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
        """Haversine formula approximation for fast heuristic sorting."""
        R = 6371  # Earth radius in km
        dlat = math.radians(lat2 - lat1)
        dlon = math.radians(lon2 - lon1)
        a = math.sin(dlat/2) * math.sin(dlat/2) + \
            math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * \
            math.sin(dlon/2) * math.sin(dlon/2)
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
        return R * c

    @staticmethod
    def optimize_queue(driver_lat: float, driver_lng: float, stops: List[Dict[str, Any]], onboard_student_ids: set = None) -> List[Dict[str, Any]]:
        """
        Lightweight heuristic: Closest logical stop first.
        Rules:
        - A DROPOFF for a specific student cannot happen before their PICKUP.
        - Prioritize closest valid stop to the driver's current simulated position.
        """
        if not stops:
            return []

        pending_stops = [s for s in stops if s.get("status") == "pending"]
        completed_stops = [s for s in stops if s.get("status") != "pending"]
        
        # Track which passengers are currently onboard to ensure dropoff logic
        onboard_students = set(onboard_student_ids) if onboard_student_ids else set()
        
        optimized_pending = []
        current_lat = driver_lat
        current_lng = driver_lng
        
        while pending_stops:
            best_stop = None
            best_distance = float('inf')
            
            for stop in pending_stops:
                # Ensure we don't drop off someone we haven't picked up
                if stop["stop_type"] == "dropoff" and stop["student_id"] not in onboard_students:
                    # Check if their pickup is already completed
                    has_been_picked_up = any(
                        s["student_id"] == stop["student_id"] and s["stop_type"] == "pickup" and s["status"] in ["completed", "arrived"]
                        for s in stops
                    )
                    if not has_been_picked_up:
                        continue # Cannot drop off yet
                
                dist = RouteOptimizer._calculate_distance(
                    current_lat, current_lng,
                    stop["coordinates"]["lat"], stop["coordinates"]["lng"]
                )
                
                if dist < best_distance:
                    best_distance = dist
                    best_stop = stop
            
            if not best_stop:
                # Fallback if logic traps itself (shouldn't happen with valid inputs)
                best_stop = pending_stops[0]
                
            # Process the chosen stop
            optimized_pending.append(best_stop)
            pending_stops.remove(best_stop)
            
            # Update simulated position
            current_lat = best_stop["coordinates"]["lat"]
            current_lng = best_stop["coordinates"]["lng"]
            
            # If it was a pickup, the student is now onboard for future calculations
            if best_stop["stop_type"] == "pickup":
                onboard_students.add(best_stop["student_id"])
                
        # Reassign sequence numbers
        for i, stop in enumerate(completed_stops + optimized_pending):
            stop["sequence"] = i + 1
            
        return completed_stops + optimized_pending

    @staticmethod
    def check_directional_overlap(
        driver_lat: float, driver_lng: float,
        current_dest_lat: float, current_dest_lng: float,
        new_pickup_lat: float, new_pickup_lng: float,
        new_dest_lat: float, new_dest_lng: float
    ) -> bool:
        """
        Calculates if the new ride request overlaps sufficiently with the driver's current trajectory.
        Returns True if compatible, False if heading opposite directions.
        """
        # Very basic vector dot-product approximation for phase 1
        # Vector A: Driver -> Current Dest
        vA_lat = current_dest_lat - driver_lat
        vA_lng = current_dest_lng - driver_lng
        
        # Vector B: New Pickup -> New Dest
        vB_lat = new_dest_lat - new_pickup_lat
        vB_lng = new_dest_lng - new_pickup_lng
        
        # Normalize
        magA = math.sqrt(vA_lat**2 + vA_lng**2)
        magB = math.sqrt(vB_lat**2 + vB_lng**2)
        
        if magA == 0 or magB == 0:
            return True # Not enough movement to determine direction
            
        # Dot product
        dot = (vA_lat * vB_lat) + (vA_lng * vB_lng)
        cos_theta = dot / (magA * magB)
        
        # Allow if angle is within ~60 degrees (cos(60) = 0.5)
        return cos_theta >= 0.5
