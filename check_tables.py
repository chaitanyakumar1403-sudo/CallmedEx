import os
import re
from supabase import create_client

# Supabase config
url = "https://wzitgktgksagfdjgnaxz.supabase.co"
key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind6aXRna3Rna3NhZ2ZkamduYXh6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NDA4OTMzNCwiZXhwIjoyMDk5NjY1MzM0fQ.jJFf0K5gYjVeRRHyBbd0B3LWnoe9JG2R6TNrCoZpoiE"
supabase = create_client(url, key)

# Find all table names in codebase
table_names = set()
for root, dirs, files in os.walk('backend/app'):
    for file in files:
        if file.endswith('.py'):
            with open(os.path.join(root, file), 'r', encoding='utf-8') as f:
                content = f.read()
                matches = re.findall(r'supabase\.table\([\'"]([^\'"]+)[\'"]\)', content)
                for match in matches:
                    table_names.add(match)

print(f"Found {len(table_names)} distinct tables referenced in the backend code:")
for t in sorted(table_names):
    print(f" - {t}")

print("\nTesting tables against Supabase database...")
missing_tables = []
for t in sorted(table_names):
    try:
        supabase.table(t).select("*").limit(1).execute()
        print(f"OK: {t} exists")
    except Exception as e:
        err = str(e)
        if "Could not find the table" in err or "relation" in err.lower() and "does not exist" in err.lower():
            print(f"MISSING: {t}")
            missing_tables.append(t)
        else:
            print(f"ERROR: {t} had a different error: {err}")

print("\n--- SUMMARY ---")
if not missing_tables:
    print("All referenced tables exist in Supabase!")
else:
    print("Missing tables that need to be created:")
    for mt in missing_tables:
        print(f" - {mt}")
