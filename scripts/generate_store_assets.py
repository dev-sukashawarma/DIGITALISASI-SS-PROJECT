import os
import shutil
from PIL import Image, ImageDraw, ImageFont, ImageFilter

OUTPUT_DIR = r"d:\MIT\CLAUDE CODE PROJECT\SS DIGITAL PROJECT\playstore-assets"
RES_DIR = r"d:\MIT\CLAUDE CODE PROJECT\SS DIGITAL PROJECT\mobile\customer-app\app\src\main\res"
FONT_DIR = os.path.join(RES_DIR, "font")
DRAWABLE_DIR = os.path.join(RES_DIR, "drawable")
DRAWABLE_NODPI_DIR = os.path.join(RES_DIR, "drawable-nodpi")
CAPTURE_DIR = r"d:\MIT\CLAUDE CODE PROJECT\SS DIGITAL PROJECT\mobile\customer-app"

os.makedirs(OUTPUT_DIR, exist_ok=True)

# Brand colors
COLOR_BROWN = (112, 22, 4)      # #701604
COLOR_ORANGE = (242, 151, 68)   # #F29744
COLOR_INK = (64, 10, 7)         # #400A07
COLOR_CREAM = (255, 247, 237)   # #FFF7ED
COLOR_WHITE = (255, 255, 255)
COLOR_MUTED = (154, 122, 99)    # #9A7A63
COLOR_TINT = (253, 240, 226)    # #FDF0E2
COLOR_BORDER = (241, 221, 201)  # #F1DDC9

font_headline_path = os.path.join(FONT_DIR, "lilita_one.ttf")
font_bold_path = os.path.join(FONT_DIR, "plus_jakarta_sans_bold.ttf")
font_medium_path = os.path.join(FONT_DIR, "plus_jakarta_sans_medium.ttf")

print("Regenerating Play Store Assets with perfected layout...")

# -------------------------------------------------------------
# 1. APP ICON (512x512)
# -------------------------------------------------------------
icon_src = os.path.join(DRAWABLE_DIR, "logo_suka.png")
icon_dst = os.path.join(OUTPUT_DIR, "1_app_icon_512x512.png")
icon_img = Image.open(icon_src).convert("RGBA")
if icon_img.size != (512, 512):
    icon_img = icon_img.resize((512, 512), Image.Resampling.LANCZOS)
icon_img.save(icon_dst, "PNG")
print("1. App Icon:", icon_dst, icon_img.size)

# -------------------------------------------------------------
# 2. FEATURE GRAPHIC (1024x500)
# -------------------------------------------------------------
fg_w, fg_h = 1024, 500
fg = Image.new("RGBA", (fg_w, fg_h), COLOR_BROWN)
fg_draw = ImageDraw.Draw(fg)

# Gradient background
for y in range(fg_h):
    factor = y / fg_h
    r = int(COLOR_BROWN[0] * (1 - factor * 0.25))
    g = int(COLOR_BROWN[1] * (1 - factor * 0.25))
    b = int(COLOR_BROWN[2] * (1 - factor * 0.25))
    fg_draw.line([(0, y), (fg_w, y)], fill=(r, g, b, 255))

# Decorative geometric circles
fg_draw.ellipse([580, -60, 1080, 440], outline=(242, 151, 68, 50), width=3)
fg_draw.ellipse([530, -110, 1130, 490], outline=(255, 247, 237, 25), width=2)
fg_draw.ellipse([-80, 260, 260, 600], outline=(242, 151, 68, 35), width=2)

# Load Chef Illustration - placed cleanly on right
chef_path = os.path.join(DRAWABLE_NODPI_DIR, "ilustrasi_login.png")
if os.path.exists(chef_path):
    chef = Image.open(chef_path).convert("RGBA")
    chef_size = 450
    chef = chef.resize((chef_size, chef_size), Image.Resampling.LANCZOS)
    fg.paste(chef, (560, 25), chef)

# Top Left Logo & Title
logo_small = icon_img.resize((76, 76), Image.Resampling.LANCZOS)
fg.paste(logo_small, (50, 45), logo_small)

font_brand_title = ImageFont.truetype(font_headline_path, 36)
font_brand_sub = ImageFont.truetype(font_bold_path, 19)
font_main_hl = ImageFont.truetype(font_headline_path, 42)
font_desc = ImageFont.truetype(font_medium_path, 20)
font_badge = ImageFont.truetype(font_bold_path, 15)

fg_draw.text((140, 48), "SUKA SHAWARMA", font=font_brand_title, fill=COLOR_CREAM)
fg_draw.text((142, 92), "Besar dan Nikmat", font=font_brand_sub, fill=COLOR_ORANGE)

# Main Hook
fg_draw.text((50, 180), "Pesan Cepat, Tanpa Antre", font=font_main_hl, fill=COLOR_WHITE)
fg_draw.text((50, 240), "Nikmati kelezatan shawarma otentik Timur Tengah.", font=font_desc, fill=(255, 247, 237, 220))
fg_draw.text((50, 272), "Order lebih awal, ambil langsung di outlet terdekat!", font=font_desc, fill=(255, 247, 237, 220))

# Feature Badges
badges = ["Order Ahead", "QRIS Otomatis", "Promo Eksklusif"]
bx = 50
for b in badges:
    bbox = font_badge.getbbox(b)
    bw = bbox[2] - bbox[0] + 26
    bh = bbox[3] - bbox[1] + 16
    fg_draw.rounded_rectangle([bx, 350, bx + bw, 350 + bh], radius=bh // 2, fill=(242, 151, 68, 50), outline=COLOR_ORANGE, width=1)
    fg_draw.text((bx + 13, 357), b, font=font_badge, fill=COLOR_CREAM)
    bx += bw + 14

fg_dst = os.path.join(OUTPUT_DIR, "2_feature_graphic_1024x500.png")
fg.convert("RGB").save(fg_dst, "PNG")
print("2. Feature Graphic:", fg_dst, fg.size)

# -------------------------------------------------------------
# 3. PHONE SCREENSHOTS (1080x1920, 9:16 Aspect Ratio)
# -------------------------------------------------------------
screenshots_meta = [
    {
        "file": "screen_outlet.png",
        "title": "Pesan Mudah Tanpa Antre",
        "subtitle": "Order menu shawarma favoritmu & ambil langsung",
        "out": "3_screenshot_1_beranda_1080x1920.png"
    },
    {
        "file": "screen_menu_top2.png",
        "title": "Menu Lengkap Daging Otentik",
        "subtitle": "Shawarma sapi, ayam, dan aneka minuman segar",
        "out": "4_screenshot_2_katalog_1080x1920.png"
    },
    {
        "file": "screen_item_detail.png",
        "title": "Pilih Porsi & Ekstra Topping",
        "subtitle": "Kustomisasi ukuran dan topping lezat sesuai selera",
        "out": "5_screenshot_3_detail_1080x1920.png"
    },
    {
        "file": "screen_cart.png",
        "title": "Pembayaran Instan QRIS",
        "subtitle": "Bayar otomatis dan aman dari semua bank serta e-wallet",
        "out": "6_screenshot_4_keranjang_1080x1920.png"
    }
]

sc_w, sc_h = 1080, 1920
font_sc_title = ImageFont.truetype(font_headline_path, 54)
font_sc_sub = ImageFont.truetype(font_medium_path, 25)
font_sc_tag = ImageFont.truetype(font_bold_path, 17)

for idx, meta in enumerate(screenshots_meta):
    src_file = os.path.join(CAPTURE_DIR, meta["file"])
    if not os.path.exists(src_file):
        continue
    
    canvas = Image.new("RGBA", (sc_w, sc_h), COLOR_CREAM)
    draw = ImageDraw.Draw(canvas)
    
    # Styled header background
    header_h = 320
    for y in range(header_h):
        f = y / header_h
        r = int(COLOR_BROWN[0] * (1 - f * 0.15))
        g = int(COLOR_BROWN[1] * (1 - f * 0.15))
        b = int(COLOR_BROWN[2] * (1 - f * 0.15))
        draw.line([(0, y), (sc_w, y)], fill=(r, g, b, 255))
    
    # Tag
    tag_text = "SUKA SHAWARMA APP"
    tb = font_sc_tag.getbbox(tag_text)
    tw_tag = tb[2] - tb[0]
    draw.text(((sc_w - tw_tag) // 2, 50), tag_text, font=font_sc_tag, fill=(255, 247, 237, 180))
    
    # Title
    t_bbox = font_sc_title.getbbox(meta["title"])
    tw = t_bbox[2] - t_bbox[0]
    draw.text(((sc_w - tw) // 2, 95), meta["title"], font=font_sc_title, fill=COLOR_CREAM)
    
    # Subtitle
    s_bbox = font_sc_sub.getbbox(meta["subtitle"])
    sw = s_bbox[2] - s_bbox[0]
    draw.text(((sc_w - sw) // 2, 170), meta["subtitle"], font=font_sc_sub, fill=COLOR_ORANGE)
    
    # Process screen capture: crop status bar (top 68px) and gesture pill (bottom 36px)
    raw = Image.open(src_file).convert("RGBA")
    w_raw, h_raw = raw.size
    cropped = raw.crop((0, 68, w_raw, h_raw - 36))
    
    # Scale to fit inside canvas with full bottom visibility
    target_pw = 740
    target_ph = int(target_pw * (cropped.height / cropped.width))
    scaled = cropped.resize((target_pw, target_ph), Image.Resampling.LANCZOS)
    
    frame_x = (sc_w - target_pw) // 2
    frame_y = 250
    
    # Phone Drop Shadow
    shadow = Image.new("RGBA", (target_pw + 40, target_ph + 40), (0, 0, 0, 0))
    s_draw = ImageDraw.Draw(shadow)
    s_draw.rounded_rectangle([10, 10, target_pw + 30, target_ph + 30], radius=36, fill=(0, 0, 0, 90))
    shadow = shadow.filter(ImageFilter.GaussianBlur(14))
    canvas.paste(shadow, (frame_x - 20, frame_y - 10), shadow)
    
    # Rounded Mask
    mask = Image.new("L", (target_pw, target_ph), 0)
    m_draw = ImageDraw.Draw(mask)
    m_draw.rounded_rectangle([0, 0, target_pw, target_ph], radius=32, fill=255)
    canvas.paste(scaled, (frame_x, frame_y), mask)
    
    # Bezel border
    border = Image.new("RGBA", (target_pw, target_ph), (0, 0, 0, 0))
    b_draw = ImageDraw.Draw(border)
    b_draw.rounded_rectangle([0, 0, target_pw, target_ph], radius=32, outline=(64, 10, 7, 200), width=3)
    canvas.paste(border, (frame_x, frame_y), border)
    
    out_dst = os.path.join(OUTPUT_DIR, meta["out"])
    canvas.convert("RGB").save(out_dst, "PNG")
    print(f"Screenshot {idx+1}:", out_dst, canvas.size)

print("All assets perfectly regenerated!")
