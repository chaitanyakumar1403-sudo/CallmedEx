from PIL import Image

def remove_white_bg(img_path, out_path, tolerance=240):
    img = Image.open(img_path)
    img = img.convert("RGBA")
    datas = img.getdata()
    
    newData = []
    for item in datas:
        # If the pixel is roughly white, make it transparent
        if item[0] > tolerance and item[1] > tolerance and item[2] > tolerance:
            newData.append((255, 255, 255, 0))
        else:
            newData.append(item)
            
    img.putdata(newData)
    img.save(out_path, "PNG")

remove_white_bg("logo.jpg", "logo.png")
