import re
with open('backend/test_scripts/test_state_machine.py', 'r', encoding='utf-8') as f:
    content = f.read()

replacement = '''
        from motor.motor_asyncio import AsyncIOMotorClient
        import os
        from dotenv import load_dotenv
        load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))
        mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
        db_client = AsyncIOMotorClient(mongo_url)
        db = db_client[os.environ.get('DB_NAME', 'mulungushi_rides')]
'''

content = content.replace('''
        from motor.motor_asyncio import AsyncIOMotorClient
        db_client = AsyncIOMotorClient("mongodb://localhost:27017")
        db = db_client["student_ride"]
'''.strip(), replacement.strip())

with open('backend/test_scripts/test_state_machine.py', 'w', encoding='utf-8') as f:
    f.write(content)
