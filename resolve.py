import re

def resolve_file(filepath):
    with open(filepath, 'r') as f:
        content = f.read()

    # Just keep HEAD's changes since we implemented get_managers_availability
    # instead of get_all_managers_availability

    # Simple regex to replace the merge conflict blocks
    # We want to keep what is in HEAD (our changes)
    resolved = re.sub(r'<<<<<<< HEAD\n(.*?)\n=======\n.*?\n>>>>>>> origin/main\n?', r'\1\n', content, flags=re.DOTALL)

    with open(filepath, 'w') as f:
        f.write(resolved)

resolve_file('app/api/v1/endpoints/dashboard_projects.py')
resolve_file('app/api/v1/endpoints/dashboard_projects_v2.py')
resolve_file('app/services/availability.py')
