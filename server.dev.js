// server.dev.js

import { createServer } from 'http';
import express from 'express';
import { WebSocketServer } from 'ws';
import path from 'path';
import { fileURLToPath } from 'url';
import { transcribeAudio } from './speechToText.js';
import fetch from 'node-fetch';
import { synthesizeSpeech } from './textToSpeech.js'; // Same TTS function
import { encodeWAV } from './wavEncoder.js'; // New helper for WAV wrapping

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

app.use(express.static(__dirname));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Each WS connection
wss.on('connection', (ws) => {
  console.log('✅ Dev Client connected');

  const conversation = [
    { role: 'system', content: 'You are a helpful assistant.' },
  ];

  let audioChunks = [];
  let silenceTimer = null;

  ws.on('message', async (message) => {
    if (message instanceof Buffer) {
      console.log('🎙️ Received audio chunk, size=', message.length);
      audioChunks.push(message);

      if (silenceTimer) clearTimeout(silenceTimer);

      silenceTimer = setTimeout(async () => {
        const fullAudio = Buffer.concat(audioChunks);
        audioChunks = [];

        console.log('🛑 No audio in 2s, transcribing...');

        let userText = '';
        try {
          userText = await transcribeAudio(fullAudio);
        } catch (e) {
          console.error('Transcription error:', e);
          ws.send('Error transcribing audio.');
          return;
        }

        console.log('User said:', userText);
        conversation.push({ role: 'user', content: userText });

        const reply = await callOpenAI(conversation);
        conversation.push({ role: 'assistant', content: reply });

        const pcmAudioBuffer = await synthesizeSpeech(reply);

        // 🔥 Convert PCM to WAV for browser testing!
        const wavBuffer = encodeWAV(pcmAudioBuffer, {
          sampleRate: 24000, // OpenAI default sample rate
          channels: 1,
          bitDepth: 16,
        });

        ws.send(wavBuffer); // ✅ Browser can play this!
      }, 2000);
    }
  });

  ws.on('close', () => {
    console.log('❌ Dev Client disconnected');
    if (silenceTimer) clearTimeout(silenceTimer);
  });
});

server.listen(3030, () => {
  console.log('🚀 Dev Server running at http://localhost:3030');
});

// OpenAI Chat
async function callOpenAI(conversation) {
  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: 'gpt-3.5-turbo',
      messages: conversation
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('OpenAI API error:', errorText);
    return "Sorry, I couldn't process that.";
  }

  const data = await response.json();
  return data.choices[0].message.content;
}
