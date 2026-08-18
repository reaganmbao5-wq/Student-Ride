import subprocess

def main():
    print("=========================================================================================================")
    print("CHRONOLOGICAL COMMIT LINEAGE AFTER c6ba644 ('fix(auth): swap exit animation...')")
    print("=========================================================================================================\n")

    my_pricing_commits = {
        '7a534ab': 'Implemented 3.5x private multiplier, 10% commission add-on, flipped debt wallet with K500 limit',
        '88859c1': 'Normalized default commission rate to 0.10 and imported Body in server.py',
        'c404a70': 'Added comprehensive pricing test suite script (dev_tools/verify_comprehensive_pricing.py)',
        '5181e24': 'Merge SYNCHRONIZATION into Mapbox branch',
        '0965e16': 'Imported TrendingUp icon in AdminDashboard.jsx to fix red screen error',
        '00fb9e5': 'Bound driver max_commission_owed_limit dynamically from backend settings',
        'a2b0e19': 'Replaced OSRM with Mapbox Directions API v5 & upgraded search bar with Mapbox Geocoding v5',
        '2e0c563': 'Merged Mapbox Directions API engine swap to Mapbox branch',
        '5b976ce': 'Mapbox Directions API engine swap commit',
        '821ffef': 'Added 4-character minimum length guard to protect Mapbox Geocoding API quota',
        '231d3c5': 'Resolved merge conflict on Mapbox branch for quota guard',
        '5ceaba5': 'Populated duration_min, duration, and eta_text in fare estimate payload and frontend card',
        '6027f71': 'Merged ETA fix to Mapbox branch'
    }

    log_output = subprocess.check_output(['git', 'log', '--oneline', '--reverse', 'c6ba644..Mapbox'], text=True).strip().split('\n')

    print(f"{'COMMIT':<10} | {'AUTHOR / RESPONSIBILITY':<32} | {'COMMIT MESSAGE'}")
    print("-" * 110)

    for line in log_output:
        if not line:
            continue
        parts = line.split()
        h = parts[0]
        msg = " ".join(parts[1:])

        is_mine = any(h.startswith(k) or k.startswith(h) for k in my_pricing_commits.keys())
        resp = "[Antigravity Assistant (Pricing Session)]" if is_mine else "[User / Parallel Map Session]"

        print(f"{h:<10} | {resp:<32} | {msg}")

if __name__ == '__main__':
    main()
