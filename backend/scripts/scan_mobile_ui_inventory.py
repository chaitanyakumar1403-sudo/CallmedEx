import os
import json
import re

mobile_dir = r"c:\Users\chait\OneDrive\Desktop\callmedex\mobile"
app_dir = os.path.join(mobile_dir, "app")
src_dir = os.path.join(mobile_dir, "src")

def scan_files(directory):
    file_list = []
    for root, dirs, files in os.walk(directory):
        for f in files:
            if f.endswith(('.tsx', '.ts', '.js', '.jsx')):
                file_list.append(os.path.join(root, f))
    return file_list

app_files = scan_files(app_dir)
src_files = scan_files(src_dir)

screens = []
for f in app_files:
    rel_path = os.path.relpath(f, app_dir)
    # determine route and role
    is_layout = "_layout" in f
    role = "shared"
    if "(auth)" in rel_path:
        role = "auth"
    elif "(patient)" in rel_path:
        role = "patient"
    elif "(doctor)" in rel_path:
        role = "doctor"
    elif "(nurse)" in rel_path:
        role = "nurse"
    elif "(phlebotomist)" in rel_path:
        role = "phlebotomist"
    elif "(pharmacy)" in rel_path:
        role = "pharmacy"
    elif "(organization)" in rel_path:
        role = "organization"
    elif "(staff)" in rel_path:
        role = "staff"
    elif "(admin)" in rel_path:
        role = "admin"
    
    with open(f, 'r', encoding='utf-8', errors='ignore') as fp:
        content = fp.read()
    
    has_safe_area = "SafeAreaView" in content or "useSafeAreaInsets" in content
    has_keyboard_avoid = "KeyboardAvoidingView" in content or "KeyboardAwareScrollView" in content
    has_scroll = "ScrollView" in content or "FlatList" in content or "SectionList" in content
    has_loading = "ActivityIndicator" in content or "loading" in content.lower()
    has_error = "error" in content.lower()
    has_refresh = "RefreshControl" in content or "onRefresh" in content
    has_theme = "theme" in content or "useTheme" in content or "colors" in content.lower()
    has_a11y = "accessibilityLabel" in content or "accessible" in content
    
    # Check for hardcoded hex colors
    hex_colors = re.findall(r'#[0-9a-fA-F]{3,8}', content)
    
    screens.append({
        "file": rel_path,
        "role": role,
        "is_layout": is_layout,
        "has_safe_area": has_safe_area,
        "has_keyboard_avoid": has_keyboard_avoid,
        "has_scroll": has_scroll,
        "has_loading": has_loading,
        "has_error": has_error,
        "has_refresh": has_refresh,
        "has_theme": has_theme,
        "has_a11y": has_a11y,
        "hex_colors_count": len(hex_colors),
        "lines": len(content.splitlines())
    })

print(f"Total App Routes/Screens Found: {len(screens)}")
print(f"Screens (non-layout): {len([s for s in screens if not s['is_layout']])}")
print(f"Layouts: {len([s for s in screens if s['is_layout']])}")

roles = {}
for s in screens:
    r = s['role']
    roles[r] = roles.get(r, 0) + 1

print("\nBreakdown by Role Group:")
for r, count in sorted(roles.items()):
    print(f"  - {r}: {count} files")

components = [os.path.relpath(f, src_dir) for f in src_files if "components" in f]
print(f"\nComponents Found in src/components ({len(components)}):")
for c in sorted(components):
    print(f"  - {c}")

with open(r"c:\Users\chait\OneDrive\Desktop\callmedex\docs\mobile_screen_inventory_audit.json", "w", encoding="utf-8") as fp:
    json.dump(screens, fp, indent=2)

print("\nAudit summary saved to docs/mobile_screen_inventory_audit.json")
