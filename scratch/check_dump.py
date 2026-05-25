import json
import os

if os.path.exists("data_dump.json"):
    with open("data_dump.json", "r", encoding="utf-8") as f:
        data = json.load(f)
    print("Keys in data_dump.json:", data.keys() if isinstance(data, dict) else "Not a dict")
    if isinstance(data, list):
        print("List length:", len(data))
        print("First item:", data[0])
    elif isinstance(data, dict):
        for k, v in data.items():
            print(f"Key '{k}': type={type(v)}, len={len(v) if hasattr(v, '__len__') else 'N/A'}")
            if hasattr(v, '__len__') and len(v) > 0:
                try:
                    print("  First item:", v[0])
                except Exception:
                    pass
else:
    print("data_dump.json does not exist")
