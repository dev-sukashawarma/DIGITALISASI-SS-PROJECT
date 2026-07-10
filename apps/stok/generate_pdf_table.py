import json
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.colors import black, HexColor
import os

def capitalize_unit(unit):
    if not unit:
        return '-'
    unit = unit.lower().strip()
    if unit == 'pack':
        return 'Pack'
    elif unit == 'crt':
        return 'Crt'
    elif unit == 'kompan':
        return 'Kompan'
    elif unit == 'blok':
        return 'Blok'
    elif unit == 'ikat':
        return 'Ikat'
    elif unit == 'lembar':
        return 'Lembar'
    elif unit == 'cm':
        return 'Cm'
    elif unit == 'kg':
        return 'Kg'
    elif unit == 'gram':
        return 'Gram'
    elif unit == 'liter':
        return 'Liter'
    elif unit == 'ml':
        return 'Ml'
    elif unit == 'pcs':
        return 'Pcs'
    elif unit == 'botol':
        return 'Botol'
    elif unit == 'box':
        return 'Box'
    elif unit == 'bal':
        return 'Bal'
    elif unit == 'dus':
        return 'Dus'
    elif unit == 'sachet':
        return 'Sachet'
    else:
        return unit.capitalize()

def create_form():
    pdf_path = os.path.join(os.getcwd(), "Form_Bahan_Baku.pdf")
    page_size = landscape(A4)
    c = canvas.Canvas(pdf_path, pagesize=page_size)
    
    # Options for units
    satuan_options = ['-', 'Pcs', 'Dus', 'Kg', 'Gram', 'Liter', 'Ml', 'Bal', 'Pack', 'Ikat', 'Sachet', 'Box', 'Botol', 'Crt', 'Kompan', 'Blok', 'Lembar', 'Cm']
    
    with open('bahan_baku.json', 'r') as f:
        items = json.load(f)
        
    # Group items by category
    categories = {}
    for item in items:
        cat = item.get('kategori', 'lainnya').upper()
        if cat not in categories:
            categories[cat] = []
        categories[cat].append(item)
        
    width, height = page_size
    margin = 40
    
    y_start = height - margin - 70
    y = y_start
    
    def new_page():
        nonlocal c, y
        c.showPage()
        y = height - margin - 70
        draw_header()
        
    def draw_header():
        c.setFont("Helvetica-Bold", 16)
        c.drawString(margin, height - margin, "FORM PENDATAAN STOK BAHAN BAKU")
        c.setFont("Helvetica-Bold", 10)
        header_y = height - margin - 30
        c.drawString(margin, header_y, "Nama Bahan Baku")
        
        c.drawString(230, header_y, "Satuan 1 (Besar)")
        c.drawString(325, header_y, "Qty 1")
        
        c.drawString(380, header_y, "Satuan 2 (Tengah)")
        c.drawString(475, header_y, "Qty 2")
        
        c.drawString(530, header_y, "Satuan 3 (Kecil)")
        c.drawString(625, header_y, "Qty 3")
        
        c.drawString(680, header_y, "Total Qty Kecil")
        
    draw_header()
    form = c.acroForm
    
    row_height = 25
    field_index = 0
    
    for cat, items_in_cat in categories.items():
        if y < margin + 40:
            new_page()
            
        # Draw category header
        c.setFont("Helvetica-Bold", 12)
        c.setFillColor(HexColor("#333333"))
        c.drawString(margin, y, f"[{cat}]")
        c.setFillColor(black)
        y -= row_height
        
        c.setFont("Helvetica", 10)
        
        for item in items_in_cat:
            if y < margin + 20:
                new_page()
                c.setFont("Helvetica", 10)
                
            name = item['nama']
            val_sat1 = capitalize_unit(item.get('satuan'))
            val_sat3 = capitalize_unit(item.get('satuan_kecil'))
            
            qty1 = '1'
            konversi = item.get('faktor_konversi')
            qty3 = str(konversi) if konversi else ''
            
            # Draw Item Name
            # Crop name if too long
            display_name = name[:28] + ".." if len(name) > 30 else name
            c.drawString(margin + 5, y + 5, display_name)
            
            # --- LEVEL 1 ---
            form.choice(name=f'sat1_{field_index}', tooltip=f'Satuan Besar untuk {name}',
                        value=val_sat1, options=satuan_options,
                        x=230, y=y, width=90, height=18,
                        borderStyle='solid', borderColor=black, forceBorder=True)
            form.textfield(name=f'qty1_{field_index}', tooltip=f'Qty 1 untuk {name}',
                           value=qty1,
                           x=325, y=y, width=45, height=18,
                           borderStyle='solid', borderColor=black, forceBorder=True)
                        
            # --- LEVEL 2 ---
            form.choice(name=f'sat2_{field_index}', tooltip=f'Satuan Tengah untuk {name}',
                        value='-', options=satuan_options,
                        x=380, y=y, width=90, height=18,
                        borderStyle='solid', borderColor=black, forceBorder=True)
            form.textfield(name=f'qty2_{field_index}', tooltip=f'Qty 2 untuk {name}',
                           value='',
                           x=475, y=y, width=45, height=18,
                           borderStyle='solid', borderColor=black, forceBorder=True)
                        
            # --- LEVEL 3 ---
            form.choice(name=f'sat3_{field_index}', tooltip=f'Satuan Kecil untuk {name}',
                        value=val_sat3, options=satuan_options,
                        x=530, y=y, width=90, height=18,
                        borderStyle='solid', borderColor=black, forceBorder=True)
            form.textfield(name=f'qty3_{field_index}', tooltip=f'Qty 3 untuk {name}',
                           value=qty3,
                           x=625, y=y, width=45, height=18,
                           borderStyle='solid', borderColor=black, forceBorder=True)
                           
            # --- TOTAL QTY ---
            # Total Qty (Kecil) field
            form.textfield(name=f'total_qty_{field_index}', tooltip=f'Total Qty Kecil untuk {name}',
                           value='',
                           x=680, y=y, width=90, height=18,
                           borderStyle='solid', borderColor=black, forceBorder=True)
                        
            y -= row_height
            field_index += 1
            
        y -= 10

    c.save()
    print(f"PDF berhasil dibuat di: {pdf_path}")

if __name__ == '__main__':
    create_form()
