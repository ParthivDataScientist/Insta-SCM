import json
from app.services.dhl_provider import DHLProvider

result = DHLProvider().track('4323923586')
children = result.get('child_parcels', [])
print(json.dumps(children, indent=2))
print(f'Total children found: {len(children)}')
