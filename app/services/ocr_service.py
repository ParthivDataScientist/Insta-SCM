import google.generativeai as genai
from PIL import Image
import json
import re
import logging

logger = logging.getLogger(__name__)

def extract_ocr_data(image_path: str, api_key: str) -> dict:
    """
    Uses Gemini 1.5 Flash Vision capabilities to extract:
    - Invoice Number (EXPI-V-... or SI-VA-...)
    - Box index (from '3 OF 4', 'Box 3', etc.)
    - Weight value display from the scale
    """
    if not api_key:
        raise ValueError("GEMINI_API_KEY is not configured in the environment.")

    logger.info("Initializing Gemini Vision OCR for image: %s", image_path)
    genai.configure(api_key=api_key)

    try:
        img = Image.open(image_path)
    except Exception as e:
        logger.error("Failed to load image file %s: %s", image_path, str(e))
        raise ValueError(f"Could not load image: {str(e)}")

    prompt = """
    You are an AI assistant designed for cargo weighing scale OCR validation.
    Analyze the image. It contains a package/box on a weighing scale machine.
    
    Tasks:
    1. Locate the shipping label or markings on the box. Identify the Invoice Number (starts with 'EXPI' or 'SI-VA', e.g., 'EXPI-V-2627-0292' or 'SI-VA-2627-003').
    2. Extract the box index (e.g. from '3 OF 4', '3 of 4', 'Piece 3', or 'BOX 3', extract the integer '3').
    3. Locate the digital LED/LCD display of the weighing scale and extract the weight value shown (e.g., '21.120' or '21.12'). Return it as a decimal number.

    Return the results ONLY in a clean, raw JSON format with these exact keys:
    {
      "invoice_number": "EXPI-V-2627-0292",
      "box_number": 3,
      "weight": 21.12
    }
    Do NOT wrap the output in markdown block, DO NOT add extra formatting or conversations. Return ONLY the JSON object.
    """

    try:
        model = genai.GenerativeModel('gemini-1.5-flash')
        response = model.generate_content([prompt, img])
        text = response.text.strip()
        logger.debug("Raw Gemini response: %s", text)

        # Sanitize response to isolate JSON
        json_match = re.search(r'\{.*\}', text, re.DOTALL)
        if json_match:
            text = json_match.group(0)

        data = json.loads(text)
        
        # Validate keys and types
        invoice_number = data.get("invoice_number", "")
        box_number = data.get("box_number", 1)
        weight = data.get("weight", 0.0)

        # Convert types if necessary
        if isinstance(box_number, str):
            box_match = re.search(r'\d+', box_number)
            box_number = int(box_match.group(0)) if box_match else 1
        else:
            box_number = int(box_number)

        try:
            weight = float(weight)
        except (ValueError, TypeError):
            weight = 0.0

        return {
            "invoice_number": str(invoice_number).strip().upper(),
            "box_number": box_number,
            "weight": weight,
            "success": True
        }

    except Exception as e:
        logger.exception("Gemini OCR extraction failed: %s", str(e))
        return {
            "invoice_number": None,
            "box_number": 1,
            "weight": 0.0,
            "success": False,
            "error": str(e)
        }
