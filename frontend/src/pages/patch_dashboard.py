import sys

file_path = r"c:\Users\Reaga\OneDrive\Documents\VS Codes\Projects\Student-Ride\frontend\src\pages\StudentDashboard.jsx"
with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# Fix 1: driver.current_location initial load
old_fetch = """      setActiveRide(activeRes.data);
      setRecentRides(historyRes.data);"""
new_fetch = """      setActiveRide(activeRes.data);
      if (activeRes.data?.driver?.current_location) {
        setDriverPos(activeRes.data.driver.current_location);
      }
      setRecentRides(historyRes.data);"""
content = content.replace(old_fetch, new_fetch)

# Fix 2: Remove static marker and add debug overlay
old_markers = """    // Markers Logic
    const mapMarkers = [];
    
    // 1. Always show driver car if we have driver location
    if (driverPos) {
       mapMarkers.push({
         lat: driverPos.lat,
         lng: driverPos.lng,
         iconType: 'user', // We actually need a car icon for this. Wait, PlatformMap takes drivers[] prop.
       });
    }

    const driversArray = driverPos ? [{ id: 'driver-1', latitude: driverPos.lat, longitude: driverPos.lng, heading: 0 }] : [];"""
    
new_markers = """    // Debug overlay to verify websocket data
    const debugOverlay = (
      <div style={{ position: 'absolute', top: 10, left: 10, zIndex: 9999, background: 'rgba(255,0,0,0.8)', color: 'white', padding: '10px', borderRadius: '8px', pointerEvents: 'none' }}>
        Live WS Lat: {driverPos?.lat}<br/>
        Live WS Lng: {driverPos?.lng}
      </div>
    );

    // Markers Logic
    const mapMarkers = [];
    
    if (userLocation) {
      mapMarkers.push({
        lat: userLocation.latitude,
        lng: userLocation.longitude,
        iconType: 'user',
        key: 'user-loc'
      });
    }

    const assignedDriverMarker = driverPos ? { 
      id: activeRide?.driver?.user_id || 'driver-1', 
      latitude: driverPos.lat, 
      longitude: driverPos.lng, 
      heading: driverPos.heading || 0 
    } : null;

    const driversArray = assignedDriverMarker ? [assignedDriverMarker] : [];"""
content = content.replace(old_markers, new_markers)

# Fix 3: Render debug overlay
old_render = """    return (
      <Layout>
        <div className="relative w-full h-[calc(100vh-80px)] flex flex-col overflow-hidden bg-gray-50 dark:bg-gray-900">
          
          {/* Top Info Bar */}"""
new_render = """    return (
      <Layout>
        {debugOverlay}
        <div className="relative w-full h-[calc(100vh-80px)] flex flex-col overflow-hidden bg-gray-50 dark:bg-gray-900">
          
          {/* Top Info Bar */}"""
content = content.replace(old_render, new_render)

with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)
print("Updated successfully")
