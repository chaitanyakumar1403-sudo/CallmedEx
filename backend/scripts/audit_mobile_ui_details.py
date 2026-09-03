import os
import re

mobile_app = r"c:\Users\chait\OneDrive\Desktop\callmedex\mobile\app"
mobile_src = r"c:\Users\chait\OneDrive\Desktop\callmedex\mobile\src"

issues = []

for root, dirs, files in os.walk(mobile_app):
    for f in files:
        if f.endswith('.tsx'):
            path = os.path.join(root, f)
            rel = os.path.relpath(path, mobile_app)
            with open(path, 'r', encoding='utf-8', errors='ignore') as fp:
                lines = fp.readlines()
                content = "".join(lines)
            
            # Check 1: Input without keyboardType for numeric/phone/email
            if "phone" in content.lower() or "mobile" in content.lower():
                if "Input" in content and "keyboardType" not in content and "phone-pad" not in content and "number-pad" not in content:
                    issues.append({
                        "file": rel,
                        "type": "KeyboardType",
                        "severity": "P2",
                        "message": "Phone/mobile input may be missing keyboardType='phone-pad'"
                    })
            
            # Check 2: ScrollView missing contentContainerStyle paddingBottom
            if "ScrollView" in content and "contentContainerStyle" not in content and "contentContainer" not in content:
                issues.append({
                    "file": rel,
                    "type": "ScrollViewClipping",
                    "severity": "P2",
                    "message": "ScrollView without contentContainerStyle may clip bottom actions"
                })
            
            # Check 3: Missing accessibilityLabel on TouchableOpacity with only icons/short text
            touchables = re.findall(r'<TouchableOpacity[^>]*>', content)
            for t in touchables:
                if "onPress" in t and "accessibilityLabel" not in t and "accessible" not in t:
                    # check if it's an icon button or generic
                    pass

            # Check 4: Hardcoded raw hex colors that might break dark/light mode
            # Find colors like #FFFFFF, #000000, #F8FAFC in styles
            hardcoded_hex = re.findall(r'color:\s*[\'"]#([0-9a-fA-F]{3,6})[\'"]', content)
            hardcoded_bg = re.findall(r'backgroundColor:\s*[\'"]#([0-9a-fA-F]{3,6})[\'"]', content)
            if len(hardcoded_hex) > 5 or len(hardcoded_bg) > 5:
                issues.append({
                    "file": rel,
                    "type": "ThemeColorHardcoding",
                    "severity": "P2",
                    "message": f"Contains {len(hardcoded_hex)} hardcoded text colors and {len(hardcoded_bg)} bg colors"
                })

            # Check 5: TouchableOpacity without hitSlop or min dimensions on small elements
            if "padding: 4" in content or "padding: 2" in content:
                issues.append({
                    "file": rel,
                    "type": "TouchTargetSize",
                    "severity": "P2",
                    "message": "Found small padding (<8px) which may cause undersized touch target"
                })

print(f"Total potential UI issues flagged: {len(issues)}")
for iss in issues[:30]:
    print(f"[{iss['severity']}] {iss['file']}: {iss['type']} -> {iss['message']}")
