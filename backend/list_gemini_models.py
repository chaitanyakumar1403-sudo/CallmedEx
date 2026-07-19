import google.generativeai as genai
from app.config import settings

genai.configure(api_key=settings.GEMINI_API_KEY)
print("Available Gemini Models:")
try:
    for m in genai.list_models():
        print(f"Model: {m.name} | Methods: {m.supported_generation_methods}")
except Exception as e:
    print(f"Failed to list models: {e}")
