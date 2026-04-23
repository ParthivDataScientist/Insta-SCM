import sys
with open('app/services/dhl_provider.py', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace('    "WC": "With Delivery Courier",\n}', '    "WC": "With Delivery Courier",\n    "OK": "Delivered",\n}')

content = content.replace('        if code == "WC":\n            return "Out for Delivery"\n\n        # Exception first', '        if code == "WC":\n            return "Out for Delivery"\n        if code == "OK":\n            return "Delivered"\n\n        # Exception first')

with open('app/services/dhl_provider.py', 'w', encoding='utf-8', newline='\n') as f:
    f.write(content)
print('Done!')
