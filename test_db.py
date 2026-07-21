import os
from supabase import create_client

url = "https://wzitgktgksagfdjgnaxz.supabase.co"
key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind6aXRna3Rna3NhZ2ZkamduYXh6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NDA4OTMzNCwiZXhwIjoyMDk5NjY1MzM0fQ.jJFf0K5gYjVeRRHyBbd0B3LWnoe9JG2R6TNrCoZpoiE"
supabase = create_client(url, key)

try:
    print("Testing organization_packages...")
    res = supabase.table("organization_packages").select("*").limit(1).execute()
    print(res)
except Exception as e:
    print("Error querying packages:", e)

try:
    print("Testing organization_timings...")
    res = supabase.table("organization_timings").select("*").limit(1).execute()
    print(res)
except Exception as e:
    print("Error querying timings:", e)
