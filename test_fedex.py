import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
import logging
import traceback
from app.services.fedex import FedExService
from app.core.config import settings
import requests

logging.basicConfig(level=logging.INFO)

with open('test_output.txt', 'w') as f:
    f.write("Starting custom FedEx tracking test\n")
    
    old_post = requests.post
    
    def intercept_post(*args, **kwargs):
        req = old_post(*args, **kwargs)
        if "associatedshipments" in args[0]:
            f.write(f"URL: {args[0]}\n")
            f.write(f"Status: {req.status_code}\n")
            f.write(f"Text: {req.text}\n")
        return req
    
    requests.post = intercept_post
    
    try:
        svc = FedExService()
        res = svc.track('888960988286')
        f.write(f"Result: {res}\n")
    except Exception as e:
        f.write(traceback.format_exc())
