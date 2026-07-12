import re
with open('backend/test_scripts/test_state_machine.py', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace('print("ERROR completing ride:", resp.json())', 'print("ERROR completing ride:", resp.status_code, resp.text)')

with open('backend/test_scripts/test_state_machine.py', 'w', encoding='utf-8') as f:
    f.write(content)
