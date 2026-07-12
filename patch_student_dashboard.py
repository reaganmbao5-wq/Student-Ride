import re
with open('frontend/src/pages/StudentDashboard.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace("['driver_arrived', 'ongoing']", "['driver_arrived', 'passenger_boarding', 'ride_started', 'ride_in_progress', 'arriving_destination', 'ongoing']")
content = content.replace("activeRide.status === 'accepted'", "activeRide.status in ['accepted', 'driver_accepted', 'driver_en_route_to_pickup']")
content = content.replace("activeRide.status === 'ongoing'", "activeRide.status in ['ongoing', 'ride_started', 'ride_in_progress', 'arriving_destination']")
content = content.replace("['requested', 'accepted', 'driver_arrived']", "['requested', 'accepted', 'driver_accepted', 'driver_en_route_to_pickup', 'driver_arrived', 'passenger_boarding']")
content = content.replace("['accepted', 'driver_arrived', 'ongoing']", "['accepted', 'driver_accepted', 'driver_en_route_to_pickup', 'driver_arrived', 'passenger_boarding', 'ride_started', 'ride_in_progress', 'arriving_destination', 'ongoing']")

with open('frontend/src/pages/StudentDashboard.jsx', 'w', encoding='utf-8') as f:
    f.write(content)
print('Student Dashboard patched!')
