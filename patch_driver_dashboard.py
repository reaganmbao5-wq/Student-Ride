import re

with open('frontend/src/pages/DriverDashboard.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Add new API call handlers
api_handlers = '''  const handleArrived = async () => {
    try { await api.post(/rides//arrived); }
    catch (e) { toast.error("Failed"); }
  };
  const handleEnRoute = async () => {
    try { await api.post(/rides//en_route); }
    catch (e) { toast.error("Failed"); }
  };
  const handleBoarding = async () => {
    try { await api.post(/rides//boarding); }
    catch (e) { toast.error("Failed"); }
  };
  const handleInProgress = async () => {
    try { await api.post(/rides//in_progress); }
    catch (e) { toast.error("Failed"); }
  };
  const handleArriving = async () => {
    try { await api.post(/rides//arriving); }
    catch (e) { toast.error("Failed"); }
  };
'''
content = content.replace("  const handleArrived = async () => {", api_handlers.strip() + "\n  const _ignore_arrived = () => {")

# Update getStatusText
status_text_old = '''    let getStatusText = () => {
      switch(activeRide.status) {
        case 'accepted': return 'Pick up passenger';
        case 'driver_arrived': return 'Wait for passenger';
        case 'ongoing': return 'Drop off passenger';
        default: return '';
      }
    };'''

status_text_new = '''    let getStatusText = () => {
      switch(activeRide.status) {
        case 'accepted':
        case 'driver_accepted': return 'Acceptance confirmed';
        case 'driver_en_route_to_pickup': return 'Drive to pickup';
        case 'driver_arrived': return 'You have arrived';
        case 'passenger_boarding': return 'Passenger is boarding';
        case 'ride_started': return 'Ride has started';
        case 'ongoing':
        case 'ride_in_progress': return 'Drive to destination';
        case 'arriving_destination': return 'Arriving at destination';
        default: return '';
      }
    };'''
content = content.replace(status_text_old, status_text_new)

# Update Actions Group
actions_old = '''                     {/* Actions Group */}
                   <div className="flex flex-col gap-3 pt-2">
                     {activeRide.status === 'accepted' && (
                        <div className="flex gap-2">
                           <button onClick={handleCancelRide} className="w-1/3 py-4 bg-zinc-100 dark:bg-zinc-900 text-red-500 rounded-xl font-bold active:scale-95">
                             Cancel
                           </button>
                           <button onClick={handleArrived} className="w-2/3 py-4 bg-blue-600 text-white rounded-xl font-bold active:scale-95 shadow-lg shadow-blue-600/20">
                             I've Arrived
                           </button>
                        </div>
                     )}
                     
                     {activeRide.status === 'driver_arrived' && (
                        <button onClick={handleStartRide} className="w-full py-4 bg-blue-600 text-white rounded-xl font-bold active:scale-95 shadow-lg shadow-blue-600/20">
                          Start Ride
                        </button>
                     )}

                     {activeRide.status === 'ongoing' && (
                        <button onClick={handleCompleteRide} className="w-full py-4 bg-emerald-500 text-white rounded-xl font-bold active:scale-95 shadow-lg shadow-emerald-500/20">
                          Complete Ride
                        </button>
                     )}
                   </div>'''

actions_new = '''                     {/* Actions Group */}
                   <div className="flex flex-col gap-3 pt-2">
                     {['accepted', 'driver_accepted'].includes(activeRide.status) && (
                        <div className="flex gap-2">
                           <button onClick={handleCancelRide} className="w-1/3 py-4 bg-zinc-100 dark:bg-zinc-900 text-red-500 rounded-xl font-bold active:scale-95">Cancel</button>
                           <button onClick={handleEnRoute} className="w-2/3 py-4 bg-blue-600 text-white rounded-xl font-bold active:scale-95">Start Driving</button>
                        </div>
                     )}
                     
                     {activeRide.status === 'driver_en_route_to_pickup' && (
                        <button onClick={handleArrived} className="w-full py-4 bg-blue-600 text-white rounded-xl font-bold active:scale-95">I've Arrived</button>
                     )}
                     
                     {activeRide.status === 'driver_arrived' && (
                        <button onClick={handleBoarding} className="w-full py-4 bg-purple-600 text-white rounded-xl font-bold active:scale-95">Passenger Boarding</button>
                     )}
                     
                     {activeRide.status === 'passenger_boarding' && (
                        <button onClick={handleStartRide} className="w-full py-4 bg-blue-600 text-white rounded-xl font-bold active:scale-95">Start Ride</button>
                     )}
                     
                     {activeRide.status === 'ride_started' && (
                        <button onClick={handleInProgress} className="w-full py-4 bg-blue-600 text-white rounded-xl font-bold active:scale-95">In Progress</button>
                     )}

                     {['ongoing', 'ride_in_progress'].includes(activeRide.status) && (
                        <button onClick={handleArriving} className="w-full py-4 bg-blue-600 text-white rounded-xl font-bold active:scale-95">Arriving</button>
                     )}
                     
                     {activeRide.status === 'arriving_destination' && (
                        <button onClick={handleCompleteRide} className="w-full py-4 bg-emerald-500 text-white rounded-xl font-bold active:scale-95">Complete Ride</button>
                     )}
                   </div>'''
content = content.replace(actions_old, actions_new)

# Update isArrivedOrStarted
content = content.replace("['driver_arrived', 'ongoing']", "['driver_arrived', 'passenger_boarding', 'ride_started', 'ride_in_progress', 'arriving_destination', 'ongoing']")

with open('frontend/src/pages/DriverDashboard.jsx', 'w', encoding='utf-8') as f:
    f.write(content)
print('Driver Dashboard patched!')
