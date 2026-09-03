import os
import re

mobile_app = r"c:\Users\chait\OneDrive\Desktop\callmedex\mobile\app"

modified = []

for root, dirs, files in os.walk(mobile_app):
    for f in files:
        if f.endswith('.tsx'):
            full_path = os.path.join(root, f)
            with open(full_path, 'r', encoding='utf-8') as fp:
                content = fp.read()
            
            orig = content
            # Remove static borderTopColor: '#E2E8F0' or borderBottomColor: '#E2E8F0' in StyleSheet.create
            # if the component passes dynamic { borderTopColor: themeColors.border }
            new_content = re.sub(r',\s*borderBottomColor:\s*[\'"]#E2E8F0[\'"]', '', content)
            new_content = re.sub(r',\s*borderTopColor:\s*[\'"]#E2E8F0[\'"]', '', new_content)
            new_content = re.sub(r'borderBottomColor:\s*[\'"]#E2E8F0[\'"],?\s*', '', new_content)
            new_content = re.sub(r'borderTopColor:\s*[\'"]#E2E8F0[\'"],?\s*', '', new_content)
            
            if new_content != orig:
                with open(full_path, 'w', encoding='utf-8') as fp:
                    fp.write(new_content)
                modified.append(os.path.relpath(full_path, mobile_app))

print(f"Cleaned static border colors in {len(modified)} files:")
for m in modified:
    print(f"  - {m}")
