from fastapi import HTTPException
from typing import List

# The valid state transitions for RideStatus
# Format: { CURRENT_STATE: [VALID_NEXT_STATES] }
VALID_TRANSITIONS = {
    "requested": ["driver_accepted", "cancelled"],
    
    # Legacy accepted -> new flow mapping just in case
    "accepted": ["driver_arrived", "cancelled", "driver_en_route_to_pickup"],
    
    "driver_accepted": ["driver_en_route_to_pickup", "cancelled"],
    "driver_en_route_to_pickup": ["driver_arrived", "cancelled"],
    "driver_arrived": ["passenger_boarding", "cancelled"],
    "passenger_boarding": ["ride_started", "cancelled"],
    "ride_started": ["ride_in_progress"],
    
    # Legacy ongoing -> new flow
    "ongoing": ["completed", "arriving_destination"],
    
    "ride_in_progress": ["arriving_destination"],
    "arriving_destination": ["ride_completed"],
    "ride_completed": ["settlement"],
    "settlement": ["ride_archived"],
    
    # Terminal states
    "ride_archived": [],
    "completed": [],
    "cancelled": []
}

def validate_ride_transition(current_state: str, next_state: str) -> bool:
    """
    Validates if a transition from current_state to next_state is architecturally valid.
    Raises HTTPException if invalid.
    """
    valid_next_states = VALID_TRANSITIONS.get(current_state, [])
    
    if next_state not in valid_next_states:
        raise HTTPException(
            status_code=400, 
            detail=f"Invalid ride state transition from '{current_state}' to '{next_state}'."
        )
    return True

# Active states that mean the ride is still in progress (not terminal)
ACTIVE_RIDE_STATES = [
    "requested",
    "accepted", # legacy
    "driver_accepted",
    "driver_en_route_to_pickup",
    "driver_arrived",
    "passenger_boarding",
    "ride_started",
    "ongoing", # legacy
    "ride_in_progress",
    "arriving_destination",
    "ride_completed", # Waiting for settlement
    "settlement"      # Waiting for archival
]

def get_active_ride_states() -> List[str]:
    return ACTIVE_RIDE_STATES
