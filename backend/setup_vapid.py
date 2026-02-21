import json
import subprocess
import os

try:
    output = subprocess.check_output("npx -y web-push generate-vapid-keys --json", shell=True).decode('utf-8')
    keys = json.loads(output)

    # Update backend .env
    with open(".env", "a") as f:
        f.write("\n# Web Push\n")
        f.write(f"VAPID_PUBLIC_KEY={keys['publicKey']}\n")
        f.write(f"VAPID_PRIVATE_KEY={keys['privateKey']}\n")
        f.write("VAPID_SUBJECT=mailto:reaganmbao5@gmail.com\n")

    # Update frontend .env
    with open("../frontend/.env", "a") as f:
        f.write(f"\nREACT_APP_VAPID_PUBLIC_KEY={keys['publicKey']}\n")

    print("VAPID keys generated and stored successfully!")
except Exception as e:
    print(f"Error generating keys: {e}")
