from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4
from reportlab.lib.colors import black
import os

def create_form():
    pdf_path = os.path.join(os.getcwd(), "Form_Bahan_Baku.pdf")
    c = canvas.Canvas(pdf_path, pagesize=A4)
    c.setFont("Helvetica-Bold", 16)
    
    # Title
    c.drawString(200, 800, "FORM DATA BAHAN BAKU")
    
    c.setFont("Helvetica", 12)
    form = c.acroForm
    
    # Options for units
    satuan_options = ['Pcs', 'Dus', 'Kg', 'Gram', 'Liter', 'Ml', 'Bal', 'Pak', 'Ikat', 'Sachet', 'Box', 'Botol', 'Crt', 'Kompan', 'Blok']
    
    # Options for Bahan Baku from database (only active items)
    bahan_baku_list = ["AYAM","BAWANG","CENGKEH","CUP + TUTUP","DUS PACKING","ES BATU","FOIL","GARAM","GAS 3Kg","JINTEN","KAYU MANIS","KEJU","KENTANG","KERTAS STRUK","KETUMBAR","KULIT 25","KULIT 28","KULIT 32","KUNYIT","LETTUCE","MAYONES","MIE","MINYAK SAYUR","PAPER WRAP","PLASTIK BESAR","PLASTIK KECIL","PLASTIK MERAH","PLASTIK VACUM","POLYBAG","POWDER MIX","SABUN","SAOS CABE","SAOS SAMYANG","SAOS TOMAT","SAPI","SARUNG TANGAN BENI","SASA","STIKER","TEPUNG","TUM"]
    
    # Bahan Baku Input (Dropdown now)
    c.drawString(50, 750, "Nama Bahan Baku :")
    form.choice(name='bahan_baku', tooltip='Pilih Bahan Baku',
                value='AYAM', options=bahan_baku_list,
                x=200, y=745, width=250, height=20,
                borderStyle='solid', borderColor=black, forceBorder=True)
    
    # Satuan 1 (Besar)
    c.drawString(50, 700, "Satuan Level 1 (Besar) :")
    form.choice(name='satuan_besar', tooltip='Pilih Satuan Besar',
                value='Dus', options=satuan_options,
                x=200, y=695, width=150, height=20,
                borderStyle='solid', borderColor=black, forceBorder=True)
                
    # Satuan 2 (Tengah)
    c.drawString(50, 650, "Satuan Level 2 (Tengah) :")
    form.choice(name='satuan_tengah', tooltip='Pilih Satuan Tengah',
                value='Pak', options=satuan_options,
                x=200, y=645, width=150, height=20,
                borderStyle='solid', borderColor=black, forceBorder=True)
                
    # Satuan 3 (Kecil)
    c.drawString(50, 600, "Satuan Level 3 (Kecil) :")
    form.choice(name='satuan_kecil', tooltip='Pilih Satuan Kecil',
                value='Pcs', options=satuan_options,
                x=200, y=595, width=150, height=20,
                borderStyle='solid', borderColor=black, forceBorder=True)
    
    # Keterangan
    c.drawString(50, 550, "Keterangan :")
    form.textfield(name='keterangan', tooltip='Masukkan Keterangan (Opsional)',
                   x=200, y=545, borderStyle='solid',
                   borderColor=black, fillColor=None, 
                   width=300, height=20,
                   textColor=black, forceBorder=True)

    c.save()
    print(f"PDF berhasil dibuat di: {pdf_path}")

if __name__ == '__main__':
    create_form()
