import numpy as np
import cv2
import os
from receipt_scanner.line_seg import cut_lines
from receipt_scanner.output_text import output_text

SCRIPT_PATH = os.path.dirname(os.path.abspath(__file__))


def process_image(image_path, ocr_func=None):
    """
    Process a receipt image and extract text.
    
    Args:
        image_path: Path to the receipt image
        ocr_func: Optional OCR function that takes an image and returns text.
                  If not provided, uses basic template matching.
    
    Returns:
        Extracted text from the receipt
    """
    assert os.path.exists(image_path), 'No such image exists'
    
    img = cv2.imread(image_path)
    
    labelled, lines, box_list = cut_lines(img)
    
    if ocr_func is None:
        text_list = _default_ocr(lines)
    else:
        text_list = [ocr_func(line) for line in lines]
    
    out_text = output_text(text_list, box_list)
    
    return out_text


def _default_ocr(lines):
    """
    Default OCR using pytesseract or easyocr.
    """
    try:
        import pytesseract
        text_list = []
        for line in lines:
            gray = cv2.cvtColor(line, cv2.COLOR_BGR2GRAY)
            text = pytesseract.image_to_string(gray)
            text_list.append(text.strip())
        return text_list
    except Exception:
        pass
    
    try:
        import easyocr
        reader = easyocr.Reader(['en'])
        text_list = []
        for line in lines:
            result = reader.readtext(line, detail=0)
            text_list.append(' '.join(result))
        return text_list
    except ImportError:
        return ['[OCR not available]' for _ in lines]


def process_image_from_bytes(image_bytes, ocr_func=None):
    """
    Process a receipt image from bytes.
    
    Args:
        image_bytes: Image data as bytes
        ocr_func: Optional OCR function
    
    Returns:
        Extracted text from the receipt
    """
    nparr = np.frombuffer(image_bytes, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    
    labelled, lines, box_list = cut_lines(img)
    
    if ocr_func is None:
        text_list = _default_ocr(lines)
    else:
        text_list = [ocr_func(line) for line in lines]
    
    out_text = output_text(text_list, box_list)
    
    return out_text
