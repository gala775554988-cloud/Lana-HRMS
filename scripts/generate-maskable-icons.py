#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Lana HRMS - High-Precision Maskable & Standard Icon Generator
--------------------------------------------------------------
Generates all standard icon sizes and maskable safe-zone padded icons from IMG_3810.png
without any outer border clipping or quality degradation across iOS, Android, and Web.
"""

import os
from PIL import Image, ImageOps

INPUT_IMAGE = "/home/user/uploads/IMG_3810.png"
OUTPUT_PUBLIC = "/home/user/Lana-HRMS/public"
OUTPUT_ICONS = "/home/user/Lana-HRMS/public/icons"

os.makedirs(OUTPUT_PUBLIC, exist_ok=True)
os.makedirs(OUTPUT_ICONS, exist_ok=True)

def generate_icons():
    if not os.path.exists(INPUT_IMAGE):
        print(f"❌ Error: Input image {INPUT_IMAGE} not found!")
        return

    # Load input image
    original = Image.open(INPUT_IMAGE).convert("RGBA")
    w, h = original.size
    print(f"🖼️ Loaded original image: {w}x{h}")

    # Helper: create standard icon with transparent or white background
    def save_resized(img, size, dest_path, bg_color=None):
        if bg_color:
            canvas = Image.new("RGBA", (size, size), bg_color)
            # Scale to fit while maintaining aspect ratio
            img_copy = img.copy()
            img_copy.thumbnail((size, size), Image.Resampling.LANCZOS)
            offset = ((size - img_copy.width) // 2, (size - img_copy.height) // 2)
            canvas.paste(img_copy, offset, img_copy)
            canvas.convert("RGB").save(dest_path, quality=95)
        else:
            img_copy = img.copy()
            img_copy = img_copy.resize((size, size), Image.Resampling.LANCZOS)
            img_copy.save(dest_path, quality=95)
        print(f"✅ Generated: {os.path.relpath(dest_path, '/home/user/Lana-HRMS')}")

    # Helper: create maskable icon (padded to ~78% so safe zone never clips the round border)
    def save_maskable(img, size, dest_path, bg_color=(255, 255, 255, 255)):
        canvas = Image.new("RGBA", (size, size), bg_color)
        safe_size = int(size * 0.78)
        img_copy = img.copy()
        img_copy.thumbnail((safe_size, safe_size), Image.Resampling.LANCZOS)
        offset = ((size - img_copy.width) // 2, (size - img_copy.height) // 2)
        canvas.paste(img_copy, offset, img_copy)
        canvas.convert("RGB").save(dest_path, quality=95)
        print(f"🛡️ Generated Maskable: {os.path.relpath(dest_path, '/home/user/Lana-HRMS')} (Safe Zone ~78%)")

    # 1. 16x16 & 32x32 (favicon.png & favicon.ico)
    save_resized(original, 32, os.path.join(OUTPUT_PUBLIC, "favicon.png"))
    
    # Generate multi-res favicon.ico (16x16 and 32x32)
    ico_16 = original.resize((16, 16), Image.Resampling.LANCZOS)
    ico_32 = original.resize((32, 32), Image.Resampling.LANCZOS)
    ico_32.save(os.path.join(OUTPUT_PUBLIC, "favicon.ico"), format="ICO", sizes=[(16, 16), (32, 32)])
    print(f"✅ Generated: public/favicon.ico (Multi-res 16x16 & 32x32)")

    # 2. 180x180 (apple-touch-icon.png) - white background padding for iOS rounded corners
    save_resized(original, 180, os.path.join(OUTPUT_ICONS, "apple-touch-icon.png"), bg_color=(255, 255, 255, 255))
    save_resized(original, 180, os.path.join(OUTPUT_PUBLIC, "apple-touch-icon.png"), bg_color=(255, 255, 255, 255))

    # 3. 192x192 standard (icon-192.png & icon-192x192.png)
    save_resized(original, 192, os.path.join(OUTPUT_ICONS, "icon-192.png"))
    save_resized(original, 192, os.path.join(OUTPUT_ICONS, "icon-192x192.png"))

    # 4. 512x512 standard (icon-512.png & icon-512x512.png)
    save_resized(original, 512, os.path.join(OUTPUT_ICONS, "icon-512.png"))
    save_resized(original, 512, os.path.join(OUTPUT_ICONS, "icon-512x512.png"))

    # 5. Maskable versions (maskable-192x192.png, maskable-512x512.png, icon-192-maskable.png, icon-512-maskable.png)
    save_maskable(original, 192, os.path.join(OUTPUT_ICONS, "maskable-192x192.png"))
    save_maskable(original, 192, os.path.join(OUTPUT_ICONS, "icon-192-maskable.png"))
    save_maskable(original, 512, os.path.join(OUTPUT_ICONS, "maskable-512x512.png"))
    save_maskable(original, 512, os.path.join(OUTPUT_ICONS, "icon-512-maskable.png"))

    print("\n🚀 All standard and maskable icon variants processed successfully without any clipping!")

if __name__ == "__main__":
    generate_icons()
