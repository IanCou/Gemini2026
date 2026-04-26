import os
import re

def replace_in_file(path):
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    new_content = content
    # Nebula -> Nebula
    new_content = re.sub(r'\bSift\b', 'Nebula', new_content)
    new_content = re.sub(r'\bsift\b', 'nebula', new_content)
    new_content = re.sub(r'\bSIFT\b', 'NEBULA', new_content)
    
    # nebula / nebula -> nebula
    new_content = re.sub(r'\bNEBULA\b', 'NEBULA', new_content)
    new_content = re.sub(r'\bNebulas\b', 'Nebula', new_content)
    new_content = re.sub(r'\bnebula\b', 'nebula', new_content)
    new_content = re.sub(r'\bNEBULA\b', 'NEBULA', new_content)
    new_content = re.sub(r'\bNebula\b', 'Nebula', new_content)
    new_content = re.sub(r'\bnebula\b', 'nebula', new_content)
    
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

