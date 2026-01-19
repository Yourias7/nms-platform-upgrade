# This script writes a small sample PNG (10x10) to static/img/marker-thumb.png
import base64
from pathlib import Path

b64 = (
    'iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAIUlEQVQoU2NkYGBg+M+ABYwMDAwMDAxwA0MDAwAAANxA9QJv6sUAAAAAElFTkSuQmCC'
)
img = base64.b64decode(b64)
out = Path(__file__).parent.parent / 'static' / 'img' / 'marker-thumb.png'
out.parent.mkdir(parents=True, exist_ok=True)
with open(out, 'wb') as f:
    f.write(img)
print('Wrote', out)
