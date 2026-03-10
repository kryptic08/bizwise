"""
Download the CNN model files from the receipt-scanner repository.

Run this script to download:
1. CNN model: optimized_character_tensorflow.pb
2. CRNN model: shadownet checkpoint files

Usage:
    python download_models.py
"""
import os
import urllib.request
import shutil

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
CNN_MODEL_DIR = os.path.join(SCRIPT_DIR, 'cnn', 'saved-model')
CRNN_MODEL_DIR = os.path.join(SCRIPT_DIR, 'crnn', 'shadownet')

CNN_MODEL_URLS = [
    ('https://raw.githubusercontent.com/billstark/receipt-scanner/master/CNNModel/saved-model/optimized_character_tensorflow.pb',
     'optimized_character_tensorflow.pb'),
]

CRNN_MODEL_URLS = [
    ('https://raw.githubusercontent.com/billstark/receipt-scanner/master/CRNNModel/shadownet/shadownet_2018-04-19-14-32-11.ckpt-9999.data-00000-of-00001',
     'shadownet_2018-04-19-14-32-11.ckpt-9999.data-00000-of-00001'),
    ('https://raw.githubusercontent.com/billstark/receipt-scanner/master/CRNNModel/shadownet/shadownet_2018-04-19-14-32-11.ckpt-9999.index',
     'shadownet_2018-04-19-14-32-11.ckpt-9999.index'),
    ('https://raw.githubusercontent.com/billstark/receipt-scanner/master/CRNNModel/shadownet/shadownet_2018-04-19-14-32-11.ckpt-9999.meta',
     'shadownet_2018-04-19-14-32-11.ckpt-9999.meta'),
]

def download_files(urls, dest_dir):
    os.makedirs(dest_dir, exist_ok=True)
    
    for url, filename in urls:
        filepath = os.path.join(dest_dir, filename)
        print(f'Downloading {filename}...')
        try:
            urllib.request.urlretrieve(url, filepath)
            print(f'  Saved to {filepath}')
        except Exception as e:
            print(f'  Error downloading {filename}: {e}')

def main():
    print('Downloading CNN model files...')
    download_files(CNN_MODEL_URLS, CNN_MODEL_DIR)
    
    print('\nDownloading CRNN model files...')
    download_files(CRNN_MODEL_URLS, CRNN_MODEL_DIR)
    
    print('\nDone! Model files downloaded.')

if __name__ == '__main__':
    main()
