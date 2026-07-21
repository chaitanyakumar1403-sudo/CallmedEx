import os
import glob
import re

def main():
    routers_dir = "backend/app/routers"
    files = glob.glob(os.path.join(routers_dir, "*.py"))
    
    # regex to find .select("...") where the string contains '(' and ')'
    select_pattern = re.compile(r'\.select\((["\'].*?\(.*?\).*?["\'])\)')
    table_pattern = re.compile(r'\.table\((["\'](.*?)["\'])\)')
    
    print("Found potential Foreign Key joins in Supabase queries:")
    
    for file in files:
        with open(file, 'r', encoding='utf-8') as f:
            lines = f.readlines()
            for i, line in enumerate(lines):
                if ".select(" in line and "(" in line.split(".select(")[1]:
                    # Let's extract the full query block roughly
                    # Just print the line for manual review
                    if not line.strip().startswith("#"):
                        # Extract table name if it's on the same line or previous line
                        table_name = "unknown_table"
                        for j in range(max(0, i-3), i+1):
                            match = table_pattern.search(lines[j])
                            if match:
                                table_name = match.group(2)
                                break
                        
                        # Extract select string
                        match = select_pattern.search(line)
                        select_str = match.group(1) if match else line.strip()
                        
                        print(f"[{os.path.basename(file)}:{i+1}] Table: {table_name} -> Select: {select_str}")

if __name__ == "__main__":
    main()
