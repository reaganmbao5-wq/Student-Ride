import sys
import subprocess
import os

try:
    from PIL import Image
except ImportError:
    subprocess.check_call([sys.executable, "-m", "pip", "install", "Pillow"])
    from PIL import Image

def process_logo(img_path, output_dir):
    try:
        img = Image.open(img_path).convert("RGBA")
    except Exception as e:
        print("Error opening image:", e)
        return

    data = img.getdata()
    new_data = []

    # Chroma-based extraction: Gold has high chroma (difference between max and min RGB)
    # White, grey, black have near zero chroma (R ~= G ~= B)
    for r, g, b, a in data:
        chroma = max(r, g, b) - min(r, g, b)
        
        # Soft threshold mapping for alpha
        if chroma < 15:
            alpha = 0
        elif chroma > 50:
            alpha = 255
        else:
            alpha = int(((chroma - 15) / 35.0) * 255)
            
        # To avoid dark fringes when drawn on transparent backgrounds,
        # we can artificially boost the brightness of semi-transparent transitional pixels
        # Assuming the target color is gold (e.g. 212, 175, 55).
        if alpha > 0 and alpha < 255:
            # Normalize colors towards a generic gold to avoid dark halos from the black background
            new_data.append((212, 175, 55, alpha))
        else:
            new_data.append((r, g, b, alpha))

    img.putdata(new_data)

    # Crop to bounding box of non-transparent pixels
    bbox = img.getbbox()
    if bbox:
        cropped = img.crop(bbox)
        print(f"Cropped image to {cropped.size}")
    else:
        cropped = img
        print("No bounding box found, image might be empty.")

    w, h = cropped.size
    
    # Generate True Alpha Transparent Icons
    size = max(w, h)
    padding = int(size * 0.1) # 10% padding for normal transparent icons
    transparent_size = size + 2 * padding

    transparent_canvas = Image.new("RGBA", (transparent_size, transparent_size), (0, 0, 0, 0))
    offset_x = (transparent_size - w) // 2
    offset_y = (transparent_size - h) // 2
    transparent_canvas.paste(cropped, (offset_x, offset_y), cropped)

    sizes_transparent = {
        16: "favicon-16x16.png",
        32: "favicon-32x32.png",
        48: "favicon-48x48.png",
        192: "logo192.png",
        512: "logo512.png"
    }

    for s, filename in sizes_transparent.items():
        resized = transparent_canvas.resize((s, s), Image.Resampling.LANCZOS)
        resized.save(os.path.join(output_dir, filename))
        print(f"Generated {filename}")

    # Generate favicon.ico
    icon_sizes = [(16,16), (32,32), (48,48)]
    transparent_canvas.save(os.path.join(output_dir, "favicon.ico"), format="ICO", sizes=icon_sizes)
    print("Generated favicon.ico")

    # Generate Maskable Icon (512x512)
    # Maskable icons need to respect the safe zone (central 40% radius, or 80% diameter).
    bg_color = (11, 11, 11, 255) # Deep black #0B0B0B
    
    safe_zone_ratio = 0.70 # 70% to be perfectly safe
    maskable_canvas_size = int(size / safe_zone_ratio)
    maskable_canvas = Image.new("RGBA", (maskable_canvas_size, maskable_canvas_size), bg_color)
    
    m_offset_x = (maskable_canvas_size - w) // 2
    m_offset_y = (maskable_canvas_size - h) // 2
    
    maskable_canvas.paste(cropped, (m_offset_x, m_offset_y), cropped)
    
    maskable_512 = maskable_canvas.resize((512, 512), Image.Resampling.LANCZOS)
    maskable_512.save(os.path.join(output_dir, "maskable512.png"))
    print("Generated maskable512.png")

    apple_180 = maskable_canvas.resize((180, 180), Image.Resampling.LANCZOS)
    apple_180.save(os.path.join(output_dir, "apple-touch-icon.png"))
    print("Generated apple-touch-icon.png")

    print("Icons generated successfully!")

if __name__ == "__main__":
    input_image = r"C:\Users\Reaga\.gemini\antigravity\brain\4710dead-7f84-4bc6-86a9-0362cb817406\mulu_rides_logo_with_text_1771694965403.png"
    output_dir = r"C:\Users\Reaga\OneDrive\Documents\VS Codes\Projects\Student-Ride\frontend\public"
    process_logo(input_image, output_dir)
