"""Quick local test – sends a synthetic receipt image to the API."""
import io
import json
import sys

try:
    from PIL import Image, ImageDraw, ImageFont
    import requests
except ImportError:
    print("Install Pillow and requests:  pip install Pillow requests")
    sys.exit(1)


def make_receipt_image() -> bytes:
    """Generate a synthetic receipt image with printed text."""
    img = Image.new("RGB", (400, 600), "white")
    draw = ImageDraw.Draw(img)
    try:
        font = ImageFont.truetype("arial.ttf", 18)
        font_lg = ImageFont.truetype("arial.ttf", 24)
    except OSError:
        font = ImageFont.load_default()
        font_lg = font

    y = 20
    lines = [
        ("WALMART SUPERCENTER", font_lg),
        ("123 Main St, Anytown, USA", font),
        ("Tel: 555-123-4567", font),
        ("", font),
        ("Date: 01/15/2025", font),
        ("", font),
        ("Milk 2%                   $3.49", font),
        ("Bread Wheat               $2.99", font),
        ("Eggs Large 12ct           $4.29", font),
        ("Bananas                   $1.59", font),
        ("Chicken Breast            $7.99", font),
        ("", font),
        ("SUBTOTAL                 $20.35", font),
        ("TAX                       $1.63", font),
        ("TOTAL                    $21.98", font),
        ("", font),
        ("VISA ****1234", font),
        ("THANK YOU FOR SHOPPING", font),
    ]
    for text, f in lines:
        draw.text((20, y), text, fill="black", font=f)
        y += 28

    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=90)
    return buf.getvalue()


def main():
    url = "http://localhost:8000/api/v1/receipt/process"
    headers = {"X-API-Key": "test123"}
    image_bytes = make_receipt_image()

    print(f"Sending {len(image_bytes):,} byte synthetic receipt …")
    resp = requests.post(
        url,
        headers=headers,
        files={"file": ("receipt.jpg", image_bytes, "image/jpeg")},
        params={"ocr_engine": "tesseract"},
        timeout=120,
    )

    print(f"Status: {resp.status_code}")
    data = resp.json()
    print(json.dumps(data, indent=2))

    if resp.status_code == 200:
        d = data.get("data", {})
        print("\n=== Extracted Fields ===")
        print(f"  Merchant : {d.get('merchant_name')}")
        print(f"  Date     : {d.get('receipt_date')}")
        print(f"  Total    : ${d.get('total_amount')}")
        print(f"  Tax      : ${d.get('tax_amount')}")
        print(f"  Items    : {len(d.get('line_items', []))}")
        for item in d.get("line_items", []):
            print(f"    - {item['name']:30s}  qty={item['quantity']}  ${item['total']:.2f}")
        print(f"  Confidence: {d.get('confidence_score')}")


if __name__ == "__main__":
    main()
