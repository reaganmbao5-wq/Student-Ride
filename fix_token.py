import re
with open('backend/test_scripts/test_state_machine.py', 'r', encoding='utf-8') as f:
    content = f.read()
content = content.replace('resp.json()["token"]', 'resp.json()["access_token"]')
with open('backend/test_scripts/test_state_machine.py', 'w', encoding='utf-8') as f:
    f.write(content)
