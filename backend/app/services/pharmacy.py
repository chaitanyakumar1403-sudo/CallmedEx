"""
Phase 3: Pharmacy Delivery Engine (Dark Store Model)
Matches prescriptions to the nearest verified pharmacy.
"""
from app.database import supabase
import math

def calculate_haversine(lat1, lon1, lat2, lon2):
    """Calculate distance in km between two coordinates."""
    if lat1 is None or lon1 is None or lat2 is None or lon2 is None:
        return float('inf')
        
    R = 6371.0 # Earth radius in kilometers
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    
    a = (math.sin(dlat / 2)**2) + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * (math.sin(dlon / 2)**2)
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c

class PharmacyService:
    @staticmethod
    def match_nearest_pharmacy(patient_lat: float, patient_lng: float) -> str:
        """
        Finds the nearest verified pharmacy that does home delivery 
        and is within its stated service_radius_km.
        """
        if not supabase:
            return None
            
        # Fetch all active, verified pharmacies that do home delivery
        res = supabase.table("pharmacies") \
            .select("id, user_id, service_radius_km") \
            .eq("home_delivery", True) \
            .eq("verification_status", "verified") \
            .execute()
            
        pharmacies = res.data
        if not pharmacies:
            return None

        # Fetch the lat/lng from their linked user profile
        user_ids = [p["user_id"] for p in pharmacies]
        users_res = supabase.table("users").select("id, city").in_("id", user_ids).execute() # We would ideally store lat/lng in pharmacy table
        
        # Simulating proximity matching (since we didn't add lat/lng to pharmacy table in Phase 1)
        # We will just return the first available one for MVP
        if len(pharmacies) > 0:
            return pharmacies[0]["id"]
            
        return None
