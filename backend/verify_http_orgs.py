import urllib.request, json

req = urllib.request.Request('http://localhost:8000/api/providers/search/organizations?exclude_diagnostic=true')
with urllib.request.urlopen(req) as res:
    data = json.loads(res.read().decode())

orgs = data.get("organizations", [])
print(f"Count of organizations: {len(orgs)}")
for o in orgs:
    print(f"Name: {o.get('organization_name')}")
    print(f"User ID: {o.get('user_id')}")
    print(f"Address: {o.get('address')}")
    print(f"Branches count: {len(o.get('branches', []))}")
    for b in o.get('branches', []):
        print(f"  Branch [{b.get('id')}]: {b.get('name')} | Address: {b.get('address')}")
    print(f"Doctors count: {len(o.get('linked_doctors', []))}")
    for d in o.get('linked_doctors', []):
        print(f"  Doc: {d.get('name')} ({d.get('specialization')}) | Fee: Rs.{d.get('consultation_fee')}")
        print(f"    Assigned branches: {d.get('assigned_branches')}")
        print(f"    Branch shifts: {d.get('branch_shifts')}")
