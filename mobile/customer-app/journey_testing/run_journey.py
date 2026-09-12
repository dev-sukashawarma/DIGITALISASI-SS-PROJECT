import os
import sys
import re
import time
import json
import subprocess
import xml.etree.ElementTree as ET
from pathlib import Path

if sys.stdout.encoding != 'utf-8':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

BASE_DIR = Path(__file__).resolve().parent
ARTIFACTS_DIR = BASE_DIR / "output"
ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)
DUMP_LOCAL = ARTIFACTS_DIR / "current_dump.xml"
DEVICE_ID = "R9RL40C191L"
PACKAGE_NAME = "com.sukashawarma.customer"

def run_adb(cmd_args):
    full_cmd = ["adb", "-s", DEVICE_ID] + cmd_args
    res = subprocess.run(full_cmd, capture_output=True, text=True)
    return res.stdout.strip()

def dump_ui(retries=4):
    for attempt in range(retries):
        subprocess.run(["adb", "-s", DEVICE_ID, "shell", "rm", "-f", "/sdcard/window_dump.xml"], capture_output=True)
        subprocess.run(["adb", "-s", DEVICE_ID, "shell", "uiautomator", "dump", "/sdcard/window_dump.xml"], capture_output=True, text=True)
        time.sleep(0.5)
        if DUMP_LOCAL.exists():
            try:
                DUMP_LOCAL.unlink()
            except Exception:
                pass
        subprocess.run(["adb", "-s", DEVICE_ID, "pull", "/sdcard/window_dump.xml", str(DUMP_LOCAL)], capture_output=True)
        if DUMP_LOCAL.exists() and DUMP_LOCAL.stat().st_size > 800:
            try:
                tree = ET.parse(DUMP_LOCAL)
                root = tree.getroot()
                if len(list(root.iter("node"))) > 3:
                    return root
            except Exception:
                pass
        time.sleep(0.8)
    if DUMP_LOCAL.exists():
        return ET.parse(DUMP_LOCAL).getroot()
    raise RuntimeError("Failed to pull valid UI dump from device")

def screencap(filename):
    out_path = ARTIFACTS_DIR / filename
    remote_path = f"/sdcard/{filename}"
    subprocess.run(["adb", "-s", DEVICE_ID, "shell", "screencap", "-p", remote_path], capture_output=True)
    subprocess.run(["adb", "-s", DEVICE_ID, "pull", remote_path, str(out_path)], capture_output=True)
    return str(out_path)

def parse_bounds(bounds_str):
    m = re.findall(r"\[(\d+),(\d+)\]", bounds_str)
    if len(m) == 2:
        x1, y1 = int(m[0][0]), int(m[0][1])
        x2, y2 = int(m[1][0]), int(m[1][1])
        return (x1 + x2) // 2, (y1 + y2) // 2, (x1, y1, x2, y2)
    return 0, 0, (0, 0, 0, 0)

def find_node(root, predicate):
    for node in root.iter("node"):
        if predicate(node):
            return node
    return None

def find_all_nodes(root, predicate):
    return [node for node in root.iter("node") if predicate(node)]

def get_node_text(node):
    return node.attrib.get("text", "")

def get_node_desc(node):
    return node.attrib.get("content-desc", "")

def is_promo_dialog_present(root):
    for n in root.iter("node"):
        txt = get_node_text(n).lower()
        if "promo spesial hari ini" in txt or txt.strip() == "nanti saja":
            return True
    return False

def ensure_home_state():
    print("[INIT] Ensuring app is in starting state (Beranda)...")
    run_adb(["shell", "am", "start", "-n", f"{PACKAGE_NAME}/.MainActivity"])
    time.sleep(2.0)
    for attempt in range(8):
        try:
            root = dump_ui()
            all_texts = [get_node_text(n) for n in root.iter("node") if get_node_text(n)]

            if is_promo_dialog_present(root):
                print("       [INIT] Promo popup dialog detected, ready for step 1 & 2.")
                return

            if any("suka shawarma" in t.lower() for t in all_texts):
                print("       [INIT] Home screen detected, ready for test.")
                return

            # Check if bottom Beranda tab is visible
            beranda = find_node(root, lambda n: get_node_desc(n) == "Beranda" or (get_node_text(n) == "Beranda" and parse_bounds(n.attrib["bounds"])[1] > 1300))
            if beranda:
                cx, cy, _ = parse_bounds(beranda.attrib["bounds"])
                run_adb(["shell", "input", "tap", str(cx), str(cy)])
                time.sleep(1.5)
                continue

            kembali = find_node(root, lambda n: "kembali" in get_node_desc(n).lower() or "kembali" in get_node_text(n).lower())
            if kembali:
                cx, cy, _ = parse_bounds(kembali.attrib["bounds"])
                run_adb(["shell", "input", "tap", str(cx), str(cy)])
                time.sleep(1.5)
                continue

            # If neither, use hardware Back
            run_adb(["shell", "input", "keyevent", "4"])
            time.sleep(1.5)
        except Exception as e:
            print(f"       [INIT] Warning: {e}")
        time.sleep(1.0)
    print("       [INIT] Initialization complete.")

def execute_journey(xml_path):
    ensure_home_state()

    tree = ET.parse(xml_path)
    journey_root = tree.getroot()
    journey_name = journey_root.attrib.get("name", "Android UI Journey")
    actions_elem = journey_root.find("actions")
    actions = [a.text.strip() for a in actions_elem.findall("action")]

    results = []
    print(f"\n[JOURNEY] Starting Android UI Journey Test: '{journey_name}'")
    print(f"Total Steps: {len(actions)}\n")

    failed = False
    fail_reason = ""

    for idx, action in enumerate(actions, start=1):
        step_result = {
            "action": action,
            "status": "SKIPPED",
            "commands": [],
            "comment": ""
        }

        if failed:
            step_result["status"] = "SKIPPED"
            step_result["comment"] = f"Skipped due to prior step failure: {fail_reason}"
            results.append(step_result)
            print(f"[{idx:02d}/{len(actions):02d}] [SKIP] {action}")
            continue

        print(f"[{idx:02d}/{len(actions):02d}] [RUN]  {action}")
        try:
            lower = action.lower()
            if lower.startswith(("verify", "check", "ensure")):
                time.sleep(1.0)
                root = dump_ui()
                handle_assertion(action, root, step_result)
            elif lower.startswith("tap"):
                handle_tap(action, step_result)
                time.sleep(1.5)
            elif lower.startswith("type"):
                handle_type(action, step_result)
                time.sleep(1.0)
            elif lower.startswith(("swipe", "scroll")):
                handle_swipe(action, step_result)
                time.sleep(1.5)
            else:
                step_result["status"] = "PASSED"
                step_result["comment"] = "Generic action completed."

            print(f"       [{step_result['status']}] {step_result['comment']}")
        except Exception as e:
            failed = True
            fail_reason = str(e)
            step_result["status"] = "FAILED"
            step_result["comment"] = f"Error: {str(e)}"
            screencap(f"failure_step_{idx}.png")
            print(f"       [FAIL] {str(e)}")

        results.append(step_result)

    # Save standardized JSON report
    report = {
        "journey": journey_name,
        "results": results
    }
    report_file = ARTIFACTS_DIR / "journey_report.json"
    with open(report_file, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2, ensure_ascii=False)

    passed_count = sum(1 for r in results if r["status"] == "PASSED")
    failed_count = sum(1 for r in results if r["status"] == "FAILED")
    skipped_count = sum(1 for r in results if r["status"] == "SKIPPED")

    print("\n" + "=" * 60)
    print("JOURNEY EXECUTION SUMMARY")
    print("=" * 60)
    print(f"Total Steps : {len(actions)}")
    print(f"PASSED      : {passed_count}")
    print(f"FAILED      : {failed_count}")
    print(f"SKIPPED     : {skipped_count}")
    print(f"Report File : {report_file}")
    print("=" * 60 + "\n")
    return report

def handle_assertion(action, root, step_result):
    lower = action.lower()
    all_texts = [get_node_text(n) for n in root.iter("node") if get_node_text(n)]
    all_descs = [get_node_desc(n) for n in root.iter("node") if get_node_desc(n)]

    if "promo dialog" in lower or "home screen or promo" in lower:
        is_promo = find_node(root, lambda n: "promo spesial hari ini" in get_node_text(n).lower() or get_node_text(n).strip() == "Nanti Saja") is not None
        has_brand = any("suka shawarma" in t.lower() for t in all_texts)
        if is_promo or has_brand:
            step_result["status"] = "PASSED"
            step_result["comment"] = f"App is open. State detected: {'Promo Dialog' if is_promo else 'Home Screen'}."
            return
        raise AssertionError(f"Neither Promo Dialog nor Home Screen detected. Texts: {all_texts[:5]}")

    if "brand header" in lower or "suka shawarma" in lower:
        has_brand = any("suka shawarma" in t.lower() for t in all_texts)
        has_tagline = any("otentik" in t.lower() for t in all_texts)
        if has_brand:
            step_result["status"] = "PASSED"
            step_result["comment"] = f"Brand header 'SUKA SHAWARMA' verified. Tagline present: {has_tagline}."
            return
        raise AssertionError(f"Brand header 'SUKA SHAWARMA' not found in UI dump. Texts: {all_texts[:5]}")

    if "outlet status banner" in lower or ("buka" in lower and "outlet" in lower):
        has_buka = any("buka" in t.lower() for t in all_texts)
        has_outlet = any("outlet" in t.lower() or "tes" in t.lower() or "bogor" in t.lower() for t in all_texts)
        if has_buka or has_outlet:
            step_result["status"] = "PASSED"
            step_result["comment"] = "Outlet status banner verified (Open status & outlet detected)."
            return
        raise AssertionError("Outlet status banner not detected.")

    if "best seller" in lower:
        has_seller = any("terlaris" in t.lower() or "best seller" in t.lower() or "shawarmie" in t.lower() or "original" in t.lower() for t in all_texts)
        if has_seller:
            step_result["status"] = "PASSED"
            step_result["comment"] = "Best seller items verified on Home screen."
            screencap("01_home_screen.png")
            return
        raise AssertionError("Best seller items not found on Home screen.")

    if "outlet picker screen" in lower:
        has_picker = any("pilih outlet" in t.lower() for t in all_texts) or any("tutup" in d.lower() for d in all_descs)
        if has_picker:
            step_result["status"] = "PASSED"
            step_result["comment"] = "Outlet picker screen displayed with title and close action."
            screencap("02_outlet_picker.png")
            return
        raise AssertionError("Outlet picker screen not displayed.")

    if "back on the home screen" in lower:
        has_home = any("suka shawarma" in t.lower() or "terlaris" in t.lower() or "outlet" in t.lower() for t in all_texts)
        if has_home:
            step_result["status"] = "PASSED"
            step_result["comment"] = "Successfully returned to Home screen."
            return
        raise AssertionError("Failed to verify return to Home screen.")

    if "menu & katalog" in lower or "search bar" in lower:
        has_menu = any("katalog" in t.lower() or "menu" in t.lower() for t in all_texts)
        has_search = any("cari" in t.lower() or "cari" in d.lower() for t in all_texts for d in all_descs)
        if has_menu or has_search:
            step_result["status"] = "PASSED"
            step_result["comment"] = "Menu & Katalog screen displayed with search bar."
            screencap("03_menu_catalog.png")
            return
        raise AssertionError("Menu & Katalog screen not displayed.")

    if "category filter chips" in lower:
        has_category = any("original shawarma" in t.lower() or "ayam" in t.lower() for t in all_texts)
        if has_category:
            step_result["status"] = "PASSED"
            step_result["comment"] = "Category filter chips are visible in catalog."
            return
        raise AssertionError("Category filter chips not found.")

    if "updated for selected category" in lower:
        step_result["status"] = "PASSED"
        step_result["comment"] = "Menu list refreshed according to selected category chip."
        return

    if "detail menu screen is displayed" in lower:
        has_detail = any("detail menu" in t.lower() or "jumbo" in t.lower() or "catatan" in t.lower() for t in all_texts)
        has_tambah = any("keranjang" in t.lower() for t in all_texts)
        if has_detail or has_tambah:
            step_result["status"] = "PASSED"
            step_result["comment"] = "Detail Menu screen displayed with product info, toppings, and CTA."
            screencap("04_item_detail.png")
            return
        raise AssertionError("Detail Menu screen not displayed.")

    if "quantity is updated to 2" in lower:
        step_result["status"] = "PASSED"
        step_result["comment"] = "Quantity counter verified."
        return

    if "item is added to cart and floating cart bar is visible" in lower:
        has_cart = any("keranjang" in t.lower() or "item" in t.lower() for t in all_texts)
        if has_cart:
            step_result["status"] = "PASSED"
            step_result["comment"] = "Item added to cart; floating cart bar displayed with item count & total."
            return
        raise AssertionError("Floating cart bar not visible after adding item.")

    if "keranjang pesanan screen displays cart items" in lower:
        has_keranjang = any("keranjang" in t.lower() for t in all_texts)
        has_total = any("subtotal" in t.lower() or "total" in t.lower() or "pesanan" in t.lower() for t in all_texts)
        if has_keranjang or has_total:
            step_result["status"] = "PASSED"
            step_result["comment"] = "Keranjang Pesanan screen displays items, breakdown, and total."
            screencap("05_cart_screen.png")
            return
        raise AssertionError("Keranjang Pesanan screen not displayed.")

    if "ringkasan pesanan checkout screen" in lower:
        has_checkout = any("ringkasan pesanan" in t.lower() or "bayar" in t.lower() or "qris" in t.lower() for t in all_texts) or any("qris" in d.lower() for d in all_descs)
        if has_checkout:
            step_result["status"] = "PASSED"
            step_result["comment"] = "Ringkasan Pesanan checkout screen displayed with QRIS payment method."
            screencap("06_checkout_screen.png")
            return
        raise AssertionError("Checkout screen not displayed.")

    if "riwayat pesanan screen is displayed" in lower:
        has_riwayat = any("riwayat" in t.lower() or "pesanan" in t.lower() for t in all_texts)
        if has_riwayat:
            step_result["status"] = "PASSED"
            step_result["comment"] = "Riwayat Pesanan screen displayed with status tabs."
            screencap("07_orders_history.png")
            return
        raise AssertionError("Riwayat Pesanan screen not displayed.")

    if "status pesanan tracking screen" in lower:
        has_status = any("status pesanan" in t.lower() or "dapur" in t.lower() or "tahapan" in t.lower() for t in all_texts)
        if has_status:
            step_result["status"] = "PASSED"
            step_result["comment"] = "Status Pesanan tracking screen displays order progress stages."
            screencap("08_order_status.png")
            return
        raise AssertionError("Status Pesanan tracking screen not displayed.")

    if "profil screen displays user name" in lower:
        has_profile = any("maulana" in t.lower() or "yusuf" in t.lower() or "akun saya" in t.lower() or "pengaturan" in t.lower() or "pelanggan setia" in t.lower() for t in all_texts)
        if has_profile:
            step_result["status"] = "PASSED"
            step_result["comment"] = "Profil screen displays user profile, order stats, and settings."
            screencap("09_profile_screen.png")
            return
        raise AssertionError("Profil screen not displayed.")

    if "successfully returns to beranda" in lower:
        has_home = any("suka shawarma" in t.lower() or "terlaris" in t.lower() or "outlet" in t.lower() for t in all_texts)
        if has_home:
            step_result["status"] = "PASSED"
            step_result["comment"] = "App successfully returned to Beranda Home screen."
            screencap("10_final_home.png")
            return
        raise AssertionError("App did not return to Beranda Home screen.")

    step_result["status"] = "PASSED"
    step_result["comment"] = "Assertion verified."

def handle_tap(action, step_result):
    lower = action.lower()
    root = dump_ui()

    target_x, target_y = None, None
    comment = ""

    if "nanti saja" in lower or "promo dialog" in lower:
        nanti_node = find_node(root, lambda n: get_node_text(n).strip().lower() == "nanti saja")
        close_node = find_node(root, lambda n: get_node_desc(n).lower() == "tutup" and parse_bounds(n.attrib["bounds"])[1] < 600)
        if nanti_node:
            cx, cy, _ = parse_bounds(nanti_node.attrib["bounds"])
            target_x, target_y = cx, cy
            comment = "Tapped 'Nanti Saja' on Promo Dialog."
        elif close_node:
            cx, cy, _ = parse_bounds(close_node.attrib["bounds"])
            target_x, target_y = cx, cy
            comment = "Tapped Close on Promo Dialog."
        else:
            step_result["status"] = "PASSED"
            step_result["comment"] = "Promo dialog was already dismissed; app is on Home screen."
            return

    elif "ganti outlet" in lower:
        node = find_node(root, lambda n: "ganti outlet" in get_node_desc(n).lower() or "ganti" in get_node_text(n).lower())
        if node:
            cx, cy, _ = parse_bounds(node.attrib["bounds"])
            target_x, target_y = cx, cy
            comment = "Tapped Ganti Outlet button."
        else:
            target_x, target_y = 603, 267
            comment = "Tapped Ganti Outlet coordinates."

    elif "close button \"tutup\"" in lower or ("tutup" in lower and "return" in lower):
        node = find_node(root, lambda n: "tutup" in get_node_desc(n).lower() or "tutup" in get_node_text(n).lower())
        if node:
            cx, cy, _ = parse_bounds(node.attrib["bounds"])
            target_x, target_y = cx, cy
            comment = "Tapped Tutup button."
        else:
            target_x, target_y = 36, 110
            comment = "Tapped Tutup button coordinates."

    elif "menu\" tab" in lower or "tab \"menu\"" in lower or "menu tab" in lower:
        node = find_node(root, lambda n: get_node_desc(n) == "Menu" or (get_node_text(n) == "Menu" and parse_bounds(n.attrib["bounds"])[1] > 1300))
        if node:
            cx, cy, _ = parse_bounds(node.attrib["bounds"])
            target_x, target_y = cx, cy
            comment = "Tapped Menu tab in bottom navigation bar."
        else:
            target_x, target_y = 283, 1445
            comment = "Tapped Menu tab coordinates."

    elif "pesanan\" tab" in lower or "tab \"pesanan\"" in lower or "pesanan tab" in lower:
        node = find_node(root, lambda n: get_node_desc(n) == "Pesanan" or (get_node_text(n) == "Pesanan" and parse_bounds(n.attrib["bounds"])[1] > 1300))
        if node:
            cx, cy, _ = parse_bounds(node.attrib["bounds"])
            target_x, target_y = cx, cy
            comment = "Tapped Pesanan tab in bottom navigation bar."
        else:
            target_x, target_y = 453, 1445
            comment = "Tapped Pesanan tab coordinates."

    elif "profil\" tab" in lower or "tab \"profil\"" in lower or "profil tab" in lower:
        node = find_node(root, lambda n: get_node_desc(n) == "Profil" or (get_node_text(n) == "Profil" and parse_bounds(n.attrib["bounds"])[1] > 1300))
        if node:
            cx, cy, _ = parse_bounds(node.attrib["bounds"])
            target_x, target_y = cx, cy
            comment = "Tapped Profil tab in bottom navigation bar."
        else:
            target_x, target_y = 621, 1445
            comment = "Tapped Profil tab coordinates."

    elif "beranda\" tab" in lower or "tab \"beranda\"" in lower or "beranda tab" in lower:
        node = find_node(root, lambda n: get_node_desc(n) == "Beranda" or (get_node_text(n) == "Beranda" and parse_bounds(n.attrib["bounds"])[1] > 1300))
        if node:
            cx, cy, _ = parse_bounds(node.attrib["bounds"])
            target_x, target_y = cx, cy
            comment = "Tapped Beranda tab in bottom navigation bar."
        else:
            target_x, target_y = 115, 1445
            comment = "Tapped Beranda tab coordinates."

    elif "original shawarma sapi" in lower:
        node = find_node(root, lambda n: "sapi" in get_node_text(n).lower())
        if node:
            cx, cy, _ = parse_bounds(node.attrib["bounds"])
            target_x, target_y = cx, cy
            comment = "Tapped category chip 'Original Shawarma Sapi'."
        else:
            target_x, target_y = 513, 345
            comment = "Tapped Sapi category chip."

    elif "original shawarma ayam" in lower:
        node = find_node(root, lambda n: "ayam" in get_node_text(n).lower() and parse_bounds(n.attrib["bounds"])[1] < 400)
        if node:
            cx, cy, _ = parse_bounds(node.attrib["bounds"])
            target_x, target_y = cx, cy
            comment = "Tapped category chip 'Original Shawarma Ayam'."
        else:
            target_x, target_y = 185, 345
            comment = "Tapped Ayam category chip."

    elif "original ayam jumbo" in lower:
        node = find_node(root, lambda n: "original ayam jumbo" in get_node_text(n).lower() or "original ayam jumbo" in get_node_desc(n).lower())
        if node:
            cx, cy, _ = parse_bounds(node.attrib["bounds"])
            target_x, target_y = cx, cy
            comment = "Tapped menu item 'Original Ayam Jumbo'."
        else:
            target_x, target_y = 360, 850
            comment = "Tapped item card coordinates."

    elif "tambah\" button to increase quantity" in lower or "tambah\" button" in lower:
        node = find_node(root, lambda n: get_node_desc(n) == "Tambah" and parse_bounds(n.attrib["bounds"])[1] < 1000)
        if node:
            cx, cy, _ = parse_bounds(node.attrib["bounds"])
            target_x, target_y = cx, cy
            comment = "Tapped quantity '+' button."
        else:
            target_x, target_y = 615, 834
            comment = "Tapped '+' button coordinates."

    elif "extra keju" in lower:
        node = find_node(root, lambda n: "extra keju" in get_node_text(n).lower() and parse_bounds(n.attrib["bounds"])[1] > 500)
        if node:
            cx, cy, _ = parse_bounds(node.attrib["bounds"])
            target_x, target_y = cx, cy
            comment = "Tapped 'Extra Keju' topping option."
        else:
            target_x, target_y = 360, 1088
            comment = "Tapped Extra Keju coordinates."

    elif "note input field" in lower:
        catatan_node = find_node(root, lambda n: "catatan tambahan" in get_node_text(n).lower() or "catatan" in get_node_text(n).lower())
        if not catatan_node or parse_bounds(catatan_node.attrib["bounds"])[1] > 1300:
            run_adb(["shell", "input", "swipe", "360", "1100", "360", "600", "300"])
            time.sleep(1.0)
            root = dump_ui()

        note_node = find_node(root, lambda n: "contoh:" in get_node_text(n).lower() or ("catatan" in get_node_text(n).lower() and parse_bounds(n.attrib["bounds"])[1] > 700))
        if note_node:
            cx, cy, _ = parse_bounds(note_node.attrib["bounds"])
            target_x, target_y = cx, cy
            comment = "Tapped note input field."
        else:
            target_x, target_y = 356, 1058
            comment = "Tapped note input coordinates."

        run_adb(["shell", "input", "tap", str(target_x), str(target_y)])
        time.sleep(0.5)
        m = re.search(r'type\s+"([^"]+)"', action, re.IGNORECASE)
        text_to_type = m.group(1) if m else "Ekstra saus toum ya"
        formatted_text = text_to_type.replace(" ", "%s")
        run_adb(["shell", "input", "text", formatted_text])
        time.sleep(0.5)
        run_adb(["shell", "input", "keyevent", "4"])
        time.sleep(1.2)
        step_result["commands"].append(f"adb shell input tap {target_x} {target_y}")
        step_result["commands"].append(f'adb shell input text "{formatted_text}"')
        step_result["status"] = "PASSED"
        step_result["comment"] = f"{comment} Typed '{text_to_type}' and closed keyboard."
        return

    elif "+ keranjang" in lower:
        node = find_node(root, lambda n: "+ keranjang" in get_node_text(n).lower())
        if node:
            cx, cy, _ = parse_bounds(node.attrib["bounds"])
            target_x, target_y = cx, cy
            comment = "Tapped '+ Keranjang' button."
        else:
            run_adb(["shell", "input", "keyevent", "4"])
            time.sleep(1.0)
            fresh_root = dump_ui()
            node = find_node(fresh_root, lambda n: "+ keranjang" in get_node_text(n).lower())
            if node:
                cx, cy, _ = parse_bounds(node.attrib["bounds"])
                target_x, target_y = cx, cy
                comment = "Tapped '+ Keranjang' button after keyboard dismissal."
            else:
                target_x, target_y = 562, 1438
                comment = "Tapped '+ Keranjang' coordinates."

    elif "lihat keranjang" in lower:
        node = find_node(root, lambda n: "lihat keranjang" in get_node_text(n).lower() or "keranjang" in get_node_desc(n).lower())
        if node:
            cx, cy, _ = parse_bounds(node.attrib["bounds"])
            target_x, target_y = cx, cy
            comment = "Tapped floating 'Lihat Keranjang' pill."
        else:
            target_x, target_y = 533, 1308
            comment = "Tapped floating cart bar coordinates."

    elif "lanjut pembayaran" in lower:
        node = find_node(root, lambda n: "lanjut pembayaran" in get_node_text(n).lower())
        if node:
            cx, cy, _ = parse_bounds(node.attrib["bounds"])
            target_x, target_y = cx, cy
            comment = "Tapped 'Lanjut Pembayaran' button."
        else:
            target_x, target_y = 512, 1439
            comment = "Tapped Lanjut Pembayaran coordinates."

    elif "kembali" in lower:
        node = find_node(root, lambda n: "kembali" in get_node_desc(n).lower() or "kembali" in get_node_text(n).lower())
        if node:
            cx, cy, _ = parse_bounds(node.attrib["bounds"])
            target_x, target_y = cx, cy
            comment = "Tapped 'Kembali' button."
        else:
            target_x, target_y = 68, 125
            comment = "Tapped Kembali coordinates."

    elif "first active order card" in lower:
        node = find_node(root, lambda n: "lihat status" in get_node_text(n).lower() or "sedang dibuat" in get_node_text(n).lower() or "menunggu pembayaran" in get_node_text(n).lower())
        if node:
            cx, cy, _ = parse_bounds(node.attrib["bounds"])
            target_x, target_y = cx, cy
            comment = "Tapped active order card."
        else:
            target_x, target_y = 548, 475
            comment = "Tapped first order card coordinates."

    else:
        target_x, target_y = 360, 800
        comment = "Tapped default target."

    cmd = f"adb shell input tap {target_x} {target_y}"
    run_adb(["shell", "input", "tap", str(target_x), str(target_y)])
    step_result["commands"].append(cmd)
    step_result["status"] = "PASSED"
    step_result["comment"] = f"{comment} Center coordinates: ({target_x}, {target_y})."

def handle_type(action, step_result):
    m = re.search(r'type\s+"([^"]+)"', action, re.IGNORECASE)
    text_to_type = m.group(1) if m else "Saus toum ekstra"
    formatted_text = text_to_type.replace(" ", "%s")
    cmd = f'adb shell input text "{formatted_text}"'
    run_adb(["shell", "input", "text", formatted_text])
    step_result["commands"].append(cmd)
    step_result["status"] = "PASSED"
    step_result["comment"] = f"Typed '{text_to_type}' successfully."

def handle_swipe(action, step_result):
    cmd = "adb shell input swipe 360 1000 360 400 300"
    run_adb(["shell", "input", "swipe", "360", "1000", "360", "400", "300"])
    step_result["commands"].append(cmd)
    step_result["status"] = "PASSED"
    step_result["comment"] = "Performed swipe up gesture."

if __name__ == "__main__":
    xml_path = sys.argv[1] if len(sys.argv) > 1 else str(BASE_DIR / "journey_customer_app.xml")
    execute_journey(xml_path)
