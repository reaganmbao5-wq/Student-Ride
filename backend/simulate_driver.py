import asyncio; from server import db, RideStatus; from datetime import datetime, timezone; async def main():
  ride = await db.rides.find_one({" status\: \requested\}, sort=[(\created_at\, -1)]);
 if not ride: print(\No ride found\); return;
 driver = await db.drivers.find_one();
 if not driver: print(\No driver found\); return;
 await db.rides.update_one({\_id\: ride[\_id\]}, {\\: {\status\: \accepted\, \driver_id\: driver[\user_id\], \driver\: driver, \accepted_at\: datetime.now(timezone.utc).isoformat()}});
 print(\Ride accepted by\, driver[\name\]);
asyncio.run(main())
