import math
import sqlite3
import os
import json

def get_distance_meters(lat1, lon1, lat2, lon2):
    R = 6371000.0  # Earth radius in meters
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)
    a = (math.sin(delta_phi / 2.0) ** 2 +
         math.cos(phi1) * math.cos(phi2) * (math.sin(delta_lambda / 2.0) ** 2))
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return R * c

def clean_address_string(raw_name: str) -> str:
    if not raw_name:
        return "Unknown location"
    
    parts = [p.strip() for p in raw_name.split(",") if p.strip()]
    ignored_patterns = {
        "zambia", "central province", "copperbelt province", "lusaka province",
        "kapiri mposhi district", "kabwe district", "chibombo district"
    }
    
    clean_parts = []
    for part in parts:
        lower = part.lower()
        if lower in ignored_patterns:
            continue
        if part.isdigit() and len(part) in (4, 5, 6): # Postal codes like 10101
            continue
        if "unnamed" in lower:
            continue
        clean_parts.append(part)
        if len(clean_parts) >= 2:
            break
            
    if not clean_parts:
        return parts[0] if parts else raw_name
    return ", ".join(clean_parts)

def resolve_proximity_landmark(lat: float, lon: float, db_path: str = "places.db"):
    if not os.path.exists(db_path):
        return None
        
    conn = sqlite3.connect(db_path)
    cur = conn.cursor()
    cur.execute("SELECT name, category, latitude, longitude FROM places")
    rows = cur.fetchall()
    conn.close()
    
    best_match = None
    best_dist = float('inf')
    
    for name, cat, p_lat, p_lon in rows:
        d = get_distance_meters(lat, lon, float(p_lat), float(p_lon))
        if d < best_dist:
            best_dist = d
            best_match = (name, cat, float(p_lat), float(p_lon))
            
    if best_match and best_dist <= 350.0:
        name = best_match[0].strip()
        if best_dist <= 35.0:
            return {
                "display_name": name,
                "nearest_landmark": name,
                "distance_m": round(best_dist, 1),
                "is_exact": True
            }
        else:
            return {
                "display_name": f"Near {name}",
                "nearest_landmark": name,
                "distance_m": round(best_dist, 1),
                "is_exact": False
            }
            
    return None

if __name__ == "__main__":
    test_coords = [
        (-14.289055, 28.546598), # Ejembi Boarding Houses
        (-14.289200, 28.546800), # 30m away from Ejembi
        (-14.290000, 28.548000), # 150m away from Ejembi
        (-14.443932, 28.443498), # Medpharm
        (-14.444200, 28.443700), # Near Medpharm
    ]
    
    db_loc = "backend/places.db" if os.path.exists("backend/places.db") else "places.db"
    for lat, lon in test_coords:
        res = resolve_proximity_landmark(lat, lon, db_loc)
        print(f"Coord ({lat}, {lon}) -> Result: {res}")
        
    print("\nTest address cleaning:")
    raw = "Mulungushi University Community Health Center, Great North Road, Kapiri Mposhi District, Central Province, 10101, Zambia"
    print("Raw:   ", raw)
    print("Clean: ", clean_address_string(raw))
