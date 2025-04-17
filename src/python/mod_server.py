import asyncio
import websockets
import requests
import io
from webrtcvad import Vad
from pydub import AudioSegment
import numpy as np

# Configuration (hardcoded for POC)
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
if not OPENAI_API_KEY:
    raise ValueError("OPENAI_API_KEY not set in .env file")
WS_HOST = "195.250.31.206"
WS_PORT = 3030
OPENAI_STT_URL = "https://api.openai.com/v1/audio/transcriptions"
OPENAI_TTS_URL = "https://api.openai.com/v1/audio/speech"
OPENAI_CHAT_URL = "https://api.openai.com/v1/chat/completions"
HEADERS = {"Authorization": f"Bearer {OPENAI_API_KEY}"}

# Initialize VAD (aggressive mode for telephony)
vad = Vad(3)

# Conversation state
conversation = []
current_seq_num = 0

async def process_audio(audio_data: bytes) -> str:
    """Transcribe audio using OpenAI STT."""
    try:
        # Convert to PCM 16kHz, mono WAV
        audio = AudioSegment.from_file(io.BytesIO(audio_data), format="raw", frame_rate=16000, channels=1, sample_width=2)
        audio = audio.set_frame_rate(16000).set_channels(1)
        wav_buffer = io.BytesIO()
        audio.export(wav_buffer, format="wav")
        wav_buffer.seek(0)

        # Call OpenAI STT
        files = {"file": ("audio.wav", wav_buffer, "audio/wav")}
        data = {"model": "whisper-1"}
        response = requests.post(OPENAI_STT_URL, headers=HEADERS, files=files, data=data, timeout=10)
        response.raise_for_status()
        return response.text.strip()
    except Exception as e:
        print(f"STT error: {e}")
        return ""

async def infer_response(text: str) -> str:
    """Get response from OpenAI chat completions."""
    try:
        # Simple prompt with last user message
        payload = {
            "model": "gpt-3.5-turbo",
            "messages": [{"role": "user", "content": text}],
            "max_tokens": 100
        }
        response = requests.post(OPENAI_CHAT_URL, headers=HEADERS, json=payload, timeout=10)
        response.raise_for_status()
        return response.json()["choices"][0]["message"]["content"]
    except Exception as e:
        print(f"Inference error: {e}")
        return "Sorry, I couldn't process that."

async def generate_speech(text: str) -> bytes:
    """Generate speech using OpenAI TTS."""
    try:
        payload = {
            "model": "tts-1",
            "voice": "alloy",
            "input": text,
            "response_format": "mp3"
        }
        response = requests.post(OPENAI_TTS_URL, headers=HEADERS, json=payload, timeout=10)
        response.raise_for_status()
        
        # Convert MP3 to PCM 16kHz WAV
        audio = AudioSegment.from_file(io.BytesIO(response.content), format="mp3")
        audio = audio.set_frame_rate(16000).set_channels(1)
        wav_buffer = io.BytesIO()
        audio.export(wav_buffer, format="wav")
        return wav_buffer.getvalue()
    except Exception as e:
        print(f"TTS error: {e}")
        return b""

async def handle_client(websocket, path):
    """Handle WebSocket client connection with silence detection."""
    global current_seq_num
    print(f"Client connected: {path}")
    audio_buffer = bytearray()
    silence_counter = 0

    try:
        while True:
            # Receive audio chunk (expect PCM 16kHz, mono)
            chunk = await websocket.recv()
            audio_buffer.extend(chunk)

            # Process 30ms chunks (480 bytes at 16kHz) for VAD
            while len(audio_buffer) >= 480:
                frame = audio_buffer[:480]
                is_speech = vad.is_speech(frame, 16000)
                audio_buffer = audio_buffer[480:]

                if is_speech:
                    silence_counter = 0
                else:
                    silence_counter += 1

                # Trigger STT after 500ms silence (16 frames)
                if silence_counter >= 16 and len(audio_buffer) > 0:
                    transcript = await process_audio(bytes(audio_buffer))
                    if transcript:
                        current_seq_num += 1
                        conversation.append({"entity": "user", "message": transcript, "seq_num": current_seq_num})
                        print(f"User: {transcript} (Seq: {current_seq_num})")

                        # Get inference response
                        response = await infer_response(transcript)
                        current_seq_num += 1
                        conversation.append({"entity": "model", "message": response, "seq_num": current_seq_num})
                        print(f"Bot: {response} (Seq: {current_seq_num})")

                        # Generate and send speech
                        audio_response = await generate_speech(response)
                        await websocket.send(audio_response)

                    audio_buffer = bytearray()  # Reset buffer
                    silence_counter = 0
    except websockets.exceptions.ConnectionClosed:
        print("Client disconnected")
    except Exception as e:
        print(f"Client error: {e}")

async def main():
    """Start WebSocket server."""
    # Start WS server (no SSL)
    server = await websockets.serve(
        handle_client,
        WS_HOST,
        WS_PORT
    )
    print(f"WebSocket server running at ws://{WS_HOST}:{WS_PORT}")
    await server.wait_closed()

if __name__ == "__main__":
    asyncio.run(main())