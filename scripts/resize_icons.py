import sys
import subprocess
import os

try:
    from PIL import Image
except ImportError:
    subprocess.check_call([sys.executable, "-m", "pip", "install", "Pillow"])
    from PIL import Image

img_path = r"C:\Users\Reaga\.gemini\antigravity\brain\4710dead-7f84-4bc6-86a9-0362cb817406\mulu_rides_logo_final.png"
output_dir = r"C:\Users\Reaga\OneDrive\Documents\VS Codes\Projects\Student-Ride\frontend\public"

sizes = {
    16: "favicon-16x16.png",
    32: "favicon-32x32.png",
    48: "favicon-48x48.png",
    180: "apple-touch-icon.png",
    192: "logo192.png",
    512: "logo512.png"
}

try:
    with Image.open(img_path) as img:
        img = img.convert("RGBA")
        for size, filename in sizes.items():
            resized = img.resize((size, size), Image.Resampling.LANCZOS)
            resized.save(os.path.join(output_dir, filename))
        
        # Create favicon.ico out of 16, 32, 48
        icon_sizes = [(16,16), (32,32), (48,48)]
        img.save(os.path.join(output_dir, "favicon.ico"), format="ICO", sizes=icon_sizes)
    print("Icons generated successfully.")
except Exception as e:
    print("Error:", str(e))
