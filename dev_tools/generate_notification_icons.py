import os
from PIL import Image, ImageOps

def create_notification_icons():
    # Load source 512x512 logo
    src_path = 'frontend/public/logo512.png'
    if not os.path.exists(src_path):
        src_path = 'frontend/public/logo192.png'
        
    im = Image.open(src_path).convert('RGBA')
    gray = ImageOps.grayscale(im)
    
    # Calculate mask: logo brightness vs dark background
    # Non-black pixels become alpha intensity
    mask = gray.point(lambda p: int(min(255, max(0, (p - 25) * (255 / 160)))))
    
    # Create pure white image with this mask as alpha
    white_img = Image.new('RGBA', im.size, (255, 255, 255, 0))
    white_img.putalpha(mask)
    
    # Crop to tight bounding box of logo emblem
    bbox = mask.getbbox()
    print(f"Emblem bbox: {bbox}")
    cropped = white_img.crop(bbox)
    
    # Add standard Android notification icon padding (15% padding)
    max_dim = max(cropped.width, cropped.height)
    pad = int(max_dim * 0.18)
    target_size = max_dim + (pad * 2)
    
    square = Image.new('RGBA', (target_size, target_size), (255, 255, 255, 0))
    offset_x = (target_size - cropped.width) // 2
    offset_y = (target_size - cropped.height) // 2
    square.paste(cropped, (offset_x, offset_y), cropped)
    
    # Android standard notification density sizes
    densities = {
        'drawable': 48,
        'drawable-mdpi': 24,
        'drawable-hdpi': 36,
        'drawable-xhdpi': 48,
        'drawable-xxhdpi': 72,
        'drawable-xxxhdpi': 96
    }
    
    base_res = 'frontend/android/app/src/main/res'
    
    for folder, size in densities.items():
        dir_path = os.path.join(base_res, folder)
        os.makedirs(dir_path, exist_ok=True)
        
        resized = square.resize((size, size), Image.Resampling.LANCZOS)
        
        # Save as ic_stat_notification.png and ic_stat_icon.png and ic_notification.png
        for filename in ['ic_stat_notification.png', 'ic_stat_icon.png', 'ic_notification.png', 'ic_stat_onesignal_default.png']:
            out_file = os.path.join(dir_path, filename)
            resized.save(out_file, 'PNG')
            print(f"Saved {out_file} ({size}x{size})")

if __name__ == '__main__':
    create_notification_icons()
