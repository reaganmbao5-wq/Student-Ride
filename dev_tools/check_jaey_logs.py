import os
from pymongo import MongoClient
from dotenv import load_dotenv

load_dotenv('backend/.env')
client = MongoClient(os.environ.get('MONGO_URL'))
db = client['mulungushi_rides']

logs = list(db.notification_logs.find({'user_id': '8daef3de-5564-4e86-8cf1-79fa423e2153'}).sort('_id', -1).limit(10))
print(f"Total Dispatches to JaeyV (ID: 8daef3de-5564-4e86-8cf1-79fa423e2153): {len(logs)}")
for l in logs:
    sent_via = l.get('sent_via', 'Unknown')
    msg_type = l.get('type', 'Unknown')
    title = l.get('title', 'Unknown')
    created = l.get('created_at', 'Unknown')
    print(f"- [{sent_via}] Type: {msg_type} | Title: {title} | At: {created}")
