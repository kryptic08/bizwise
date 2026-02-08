"""
Test script for receipt processing API
"""
import requests
import sys
from pathlib import Path

# API Configuration
API_URL = "http://localhost:8000/api/v1/receipt/process"
API_KEY = "your-secret-api-key-here"  # Update this


def test_receipt_processing(image_path: str):
    """Test the receipt processing endpoint"""
    
    print(f"Testing receipt processing with: {image_path}")
    print("-" * 60)
    
    # Check if file exists
    if not Path(image_path).exists():
        print(f"❌ Error: File not found: {image_path}")
        return
    
    # Prepare the request
    with open(image_path, 'rb') as f:
        files = {'file': ('receipt.jpg', f, 'image/jpeg')}
        headers = {'X-API-Key': API_KEY}
        
        try:
            # Make the request
            print("📤 Sending request...")
            response = requests.post(API_URL, files=files, headers=headers, timeout=30)
            
            # Check response
            if response.status_code == 200:
                print("✅ Success!")
                result = response.json()
                
                print(f"\n📊 Results:")
                print(f"Processing Time: {result['processing_time_ms']}ms")
                print(f"\n🏪 Merchant: {result['data']['merchant_name']}")
                print(f"📅 Date: {result['data']['receipt_date']}")
                print(f"💰 Total: ${result['data']['total_amount']}")
                print(f"💵 Tax: ${result['data']['tax_amount']}")
                print(f"📈 Confidence: {result['data']['confidence_score']:.2%}")
                
                if result['data']['line_items']:
                    print(f"\n🛒 Line Items ({len(result['data']['line_items'])}):")
                    for item in result['data']['line_items']:
                        print(f"  - {item['name']}: {item['quantity']}x ${item['price']} = ${item['total']}")
                
                print(f"\n📝 Raw Text (first 200 chars):")
                print(result['data']['raw_text'][:200] + "...")
                
            else:
                print(f"❌ Error {response.status_code}")
                print(response.text)
                
        except requests.exceptions.Timeout:
            print("❌ Request timeout (server might be waking up)")
        except requests.exceptions.ConnectionError:
            print("❌ Connection error (is the server running?)")
        except Exception as e:
            print(f"❌ Error: {e}")


def test_health():
    """Test the health endpoint"""
    try:
        response = requests.get("http://localhost:8000/health")
        if response.status_code == 200:
            print("✅ Health check passed")
            print(response.json())
        else:
            print(f"❌ Health check failed: {response.status_code}")
    except:
        print("❌ Server not reachable")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python test_api.py <image_path>")
        print("\nTesting health endpoint only...")
        test_health()
    else:
        test_receipt_processing(sys.argv[1])
