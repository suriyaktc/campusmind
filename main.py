from flask import Flask, request, jsonify, send_file
from groq import Groq
from gtts import gTTS
from dotenv import load_dotenv
import os
import tempfile
import json

load_dotenv()
app = Flask(__name__)
client = Groq(api_key=os.getenv("GROQ_API_KEY"))

conversation_history = []

def chat_with_ai(user_message, context="general"):
    conversation_history.append({"role": "user", "content": user_message})
    
    system_prompt = """You are CampusMind, an intelligent AI assistant for university students and faculty.
You help with:
- Answering academic doubts in any subject (Math, Physics, Chemistry, CS, etc.)
- Explaining concepts clearly with examples
- Helping with assignments and study tips
- Campus information and guidance
- Timetable and schedule management
- Career and academic advice

Be friendly, encouraging, and concise. Use emojis occasionally to be engaging.
Always give practical, actionable answers. If asked about campus-specific info you don't know, guide them on where to find it."""

    response = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[
            {"role": "system", "content": system_prompt},
            *conversation_history[-10:]
        ],
        max_tokens=600
    )
    
    reply = response.choices[0].message.content
    conversation_history.append({"role": "assistant", "content": reply})
    return reply

@app.route("/")
def home():
    return send_file("index.html")

@app.route("/chat", methods=["POST"])
def chat():
    try:
        data = request.json
        message = data.get("message", "")
        reply = chat_with_ai(message)
        return jsonify({"success": True, "reply": reply})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)})

@app.route("/speak", methods=["POST"])
def speak():
    try:
        data = request.json
        text = data.get("text", "")
        clean = text.replace("*","").replace("#","").replace("_","")
        with tempfile.NamedTemporaryFile(delete=False, suffix=".mp3") as f:
            temp_path = f.name
        tts = gTTS(text=clean, lang="en", slow=False)
        tts.save(temp_path)
        return send_file(temp_path, mimetype="audio/mpeg")
    except Exception as e:
        return jsonify({"success": False, "error": str(e)})

@app.route("/clear", methods=["POST"])
def clear():
    global conversation_history
    conversation_history = []
    return jsonify({"success": True})

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=8000, debug=True)