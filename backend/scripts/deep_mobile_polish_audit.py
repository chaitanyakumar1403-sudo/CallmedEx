import os
import re

mobile_dir = r"c:\Users\chait\OneDrive\Desktop\callmedex\mobile"
app_dir = os.path.join(mobile_dir, "app")
src_dir = os.path.join(mobile_dir, "src")

report = {
    "total_screens": 0,
    "screens": [],
    "fixes_needed": []
}

for root, dirs, files in os.walk(app_dir):
    for f in files:
        if f.endswith('.tsx'):
            full_path = os.path.join(root, f)
            rel_path = os.path.relpath(full_path, app_dir)
            with open(full_path, 'r', encoding='utf-8', errors='ignore') as fp:
                code = fp.read()
            
            report["total_screens"] += 1
            
            # Check 1: static hardcoded border colors in styles that break dark mode
            static_borders = re.findall(r'border(?:Bottom|Top|Left|Right)?Color:\s*[\'"]#(?:E2E8F0|CBD5E1|F1F5F9)[\'"]', code)
            
            # Check 2: small padding touchables
            small_touchables = re.findall(r'padding:\s*[0-4]\b', code)
            
            # Check 3: Missing accessibility labels on custom icon-only touchables
            
            # Check 4: Inputs missing keyboardType for email/phone/numbers
            missing_keyboard = False
            if ("phone" in code.lower() or "mobile" in code.lower()) and "keyboardType" not in code and "Input" in code:
                missing_keyboard = True

            screen_info = {
                "file": rel_path,
                "lines": len(code.splitlines()),
                "static_borders": len(static_borders),
                "small_touchables": len(small_touchables),
                "missing_keyboard": missing_keyboard
            }
            report["screens"].append(screen_info)
            
            if len(static_borders) > 0 or len(small_touchables) > 0 or missing_keyboard:
                report["fixes_needed"].append(screen_info)

print(f"Total screens inspected: {report['total_screens']}")
print(f"Screens with minor polish opportunities: {len(report['fixes_needed'])}")
for fix in report["fixes_needed"]:
    print(f"  - {fix['file']}: static_borders={fix['static_borders']}, small_touchables={fix['small_touchables']}, missing_keyboard={fix['missing_keyboard']}")
