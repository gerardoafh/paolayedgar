from pathlib import Path
import base64, re, io
from PIL import Image

root = Path(__file__).parent
page = root / 'index.html'
html = page.read_text(encoding='utf-8-sig')
assets = root / 'assets'
assets.mkdir(exist_ok=True)
count = 0
def photo(match):
    global count
    count += 1
    image = Image.open(io.BytesIO(base64.b64decode(match.group(1)))).convert('RGB')
    image.thumbnail((1800, 1800))
    name = f'foto-{count}.webp'
    image.save(assets / name, 'WEBP', quality=88, method=6)
    return f'src="assets/{name}"'
html = re.sub(r'src="data:image/(?:png|jpeg);base64,([^"]+)"', photo, html)
page.write_text(html, encoding='utf-8')
print(f'{count} fotos optimizadas; HTML: {page.stat().st_size} bytes')
