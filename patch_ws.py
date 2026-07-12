import re

SERVER_PY_PATH = r"backend/server.py"

with open(SERVER_PY_PATH, "r", encoding="utf-8") as f:
    lines = f.readlines()

new_lines = []
for i, line in enumerate(lines):
    new_lines.append(line)
    if 'await manager.send_personal_message({' in line:
        if i + 1 < len(lines) and 'ride_mode' not in lines[i+1]:
            # To be safe, let's inject a safe fallback if ride is not defined in scope
            new_lines.append('        "ride_mode": ride.get("ride_mode", RideMode.PRIVATE.value) if "ride" in locals() else (target_ride.get("ride_mode", RideMode.PRIVATE.value) if "target_ride" in locals() else RideMode.PRIVATE.value),\n')

with open(SERVER_PY_PATH, "w", encoding="utf-8") as f:
    f.writelines(new_lines)

print("Patched server.py successfully.")
