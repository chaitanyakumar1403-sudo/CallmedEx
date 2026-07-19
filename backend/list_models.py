from groq import Groq

client = Groq(api_key="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")
for m in client.models.list().data:
    print(m.id)
