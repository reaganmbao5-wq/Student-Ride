import sys
import os
import asyncio

# Ensure backend import path
backend_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'backend')
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from server import db, calculate_ride_fare, RideMode

async def run_comprehensive_tests():
    print("======================================================================")
    print("COMPREHENSIVE PRICING & WALLET DEBT ENGINE TEST SUITE")
    print("======================================================================\n")
    
    # 1. Reset MongoDB settings to standard calibrated values
    new_settings = {
        'base_fare': 15.0,
        'per_km_rate': 1.40,
        'per_minute_rate': 0.10,
        'surge_multiplier': 1.0,
        'minimum_fare': 15.0,
        'commission_rate': 0.10,
        'private_multiplier': 3.5,
        'max_commission_owed_limit': 500.0
    }
    await db.pricing_settings.delete_many({})
    await db.pricing_settings.insert_one(new_settings)
    
    test_cases = [
        {'name': '0.5 km Ultra-Short Campus Shuttle', 'dist': 0.5, 'dur': 3.0},
        {'name': '1.5 km Campus Main Gate to Hostels', 'dist': 1.5, 'dur': 4.0},
        {'name': '2.5 km Campus Main Gate to Far Farms', 'dist': 2.5, 'dur': 6.0},
        {'name': '5.0 km Suburb Trip (Main Gate to Kasanda)', 'dist': 5.0, 'dur': 10.0},
        {'name': '10.0 km Mid-Distance Trip (Campus to Highridge)', 'dist': 10.0, 'dur': 15.0},
        {'name': '15.0 km Long Suburb Trip (Campus to Prospect)', 'dist': 15.0, 'dur': 20.0},
        {'name': '23.0 km Town Highway Corridor (Main Gate to Kobil)', 'dist': 23.0, 'dur': 25.0},
        {'name': '30.0 km Outskirts Trip (Campus to Industrial Zone)', 'dist': 30.0, 'dur': 32.0},
    ]

    dummy_pickup = {'lat': -14.294646, 'lng': 28.549662}
    dummy_dropoff = {'lat': -14.441372, 'lng': 28.449307}

    header = f"{'ROUTE / DISTANCE':<48} | {'MODE':<8} | {'DRIVER BASE':<11} | {'COMMISSION':<10} | {'STUDENT TOTAL'}"
    print(header)
    print('-' * len(header))

    for tc in test_cases:
        shared = await calculate_ride_fare(dummy_pickup, dummy_dropoff, tc['dist'], tc['dur'], RideMode.SHARED)
        private = await calculate_ride_fare(dummy_pickup, dummy_dropoff, tc['dist'], tc['dur'], RideMode.PRIVATE)
        
        shared_str = f"K{shared['driver_earning']:.2f}"
        shared_comm = f"K{shared['commission']:.2f}"
        shared_tot = f"K{shared['fare']:.2f}"
        
        priv_str = f"K{private['driver_earning']:.2f}"
        priv_comm = f"K{private['commission']:.2f}"
        priv_tot = f"K{private['fare']:.2f}"
        
        dist_info = f"({tc['dist']} km, {int(tc['dur'])} min)"
        
        print(f"{tc['name']:<48} | Shared   | {shared_str:<11} | {shared_comm:<10} | {shared_tot}")
        print(f"{dist_info:<48} | Private  | {priv_str:<11} | {priv_comm:<10} | {priv_tot}")
        print('-' * len(header))

if __name__ == '__main__':
    asyncio.run(run_comprehensive_tests())
