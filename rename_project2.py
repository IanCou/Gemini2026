import os

def replace_in_file(path):
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    new_content = content
    # Substring replacements
    new_content = new_content.replace('NEBULA_FS_ROOT', 'NEBULA_FS_ROOT')
    new_content = new_content.replace('NEBULA_ACTIVE_PROJECT_ID', 'NEBULA_ACTIVE_PROJECT_ID')
    new_content = new_content.replace('NEBULA_ROOT', 'NEBULA_ROOT')
    new_content = new_content.replace('nebula', 'nebula')
    new_content = new_content.replace('nebula', 'nebula')
    new_content = new_content.replace('NEBULA', 'NEBULA')
    new_content = new_content.replace('NEBULA', 'NEBULA')
    new_content = new_content.replace('Nebula', 'Nebula')
    
    if new_content != content:
        with open(path, 'w', encoding='utf-8') as f:
            f.write(new_content)
        print(f"Updated {path}")

skip_dirs = {'.git', 'node_modules', 'venv', '.venv', 'target', '__pycache__', 'dist', 'build'}

for root, dirs, files in os.walk('.'):
    dirs[:] = [d for d in dirs if d not in skip_dirs]
    for file in files:
        if file.endswith(('.png', '.jpeg', '.jpg', '.pdf', '.DS_Store', '.pkl')):
            continue
        filepath = os.path.join(root, file)
        try:
            replace_in_file(filepath)
        except Exception as e:
            print(f"Skipping {filepath}: {e}")

