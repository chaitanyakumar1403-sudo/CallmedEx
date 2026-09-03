import os
import struct
import zlib

def create_png(width, height, r, g, b, output_path):
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    raw_data = bytearray()
    for _ in range(height):
        raw_data.append(0) # filter byte none
        for _ in range(width):
            raw_data.extend([r, g, b, 255])
    
    compressed = zlib.compress(raw_data)
    
    png = bytearray(b'\x89PNG\r\n\x1a\n')
    
    # IHDR
    ihdr = struct.pack('>IIBBBBB', width, height, 8, 6, 0, 0, 0)
    ihdr_crc = zlib.crc32(b'IHDR' + ihdr)
    png.extend(struct.pack('>I', len(ihdr)))
    png.extend(b'IHDR')
    png.extend(ihdr)
    png.extend(struct.pack('>I', ihdr_crc))
    
    # IDAT
    idat_crc = zlib.crc32(b'IDAT' + compressed)
    png.extend(struct.pack('>I', len(compressed)))
    png.extend(b'IDAT')
    png.extend(compressed)
    png.extend(struct.pack('>I', idat_crc))
    
    # IEND
    iend_crc = zlib.crc32(b'IEND')
    png.extend(struct.pack('>I', 0))
    png.extend(b'IEND')
    png.extend(struct.pack('>I', iend_crc))
    
    with open(output_path, 'wb') as fp:
        fp.write(png)
    print(f"Created PNG {output_path}")

assets_dir = r"c:\Users\chait\OneDrive\Desktop\callmedex\mobile\assets"
create_png(64, 64, 10, 37, 64, os.path.join(assets_dir, "favicon.png"))
create_png(192, 192, 10, 37, 64, os.path.join(assets_dir, "icon.png"))
create_png(192, 192, 10, 37, 64, os.path.join(assets_dir, "splash-icon.png"))
create_png(192, 192, 10, 37, 64, os.path.join(assets_dir, "adaptive-icon.png"))
create_png(64, 64, 0, 212, 178, os.path.join(assets_dir, "notification-icon.png"))
