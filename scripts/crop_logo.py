import sys
import subprocess

try:
    from PIL import Image, ImageChops
except ImportError:
    subprocess.check_call([sys.executable, "-m", "pip", "install", "Pillow"])
    from PIL import Image, ImageChops

def remove_white_border(img_path, output_path):
    img = Image.open(img_path).convert("RGBA")
    
    data = img.getdata()
    
    new_data = []
    # Make anything close to white completely transparent
    for item in data:
        if item[0] > 240 and item[1] > 240 and item[2] > 240:
            new_data.append((255, 255, 255, 0))
        else:
            new_data.append(item)
            
    img.putdata(new_data)
    
    # Find bounding box of all non-transparent pixels
    bbox = img.getbbox()
    
    if bbox:
        cropped = img.crop(bbox)
        print(f"Cropped image from {img.size} to {cropped.size}")
    else:
        cropped = img
        print("No white border detected or image is entirely white.")

    # Apply #0B0B0B deep black background
    bg_color = (11, 11, 11, 255)

    # Make the cropped image square
    w, h = cropped.size
    size = max(w, h)
    
    padding = int(size * 0.1)
    new_size = size + 2 * padding
    
    square_img = Image.new("RGBA", (new_size, new_size), bg_color)
    
    offset_x = (new_size - w) // 2
    offset_y = (new_size - h) // 2
    
    square_img.paste(cropped, (offset_x, offset_y), cropped)
    
    square_img.save(output_path)
    print("Logo processed and saved to", output_path)

input_image = r"C:\Users\Reaga\.gemini\antigravity\brain\4710dead-7f84-4bc6-86a9-0362cb817406\mulu_rides_logo_with_text_1771694965403.png"
output_image = r"C:\Users\Reaga\.gemini\antigravity\brain\4710dead-7f84-4bc6-86a9-0362cb817406\mulu_rides_logo_final.png"

remove_white_border(input_image, output_image)
