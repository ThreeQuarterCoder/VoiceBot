



// server.js
import { createServer } from 'http';
import express from 'express';
import { WebSocketServer } from 'ws';
import path from 'path';
import { fileURLToPath } from 'url';
import { transcribeAudio } from './speechToText.js'; // STT
import fetch from 'node-fetch'; // For OpenAI
import { synthesizeSpeech } from './textToSpeech.js'; // ✅ New import
import { sendToVoiceBot } from './voiceBot.js'; // 🎯 Uses new full pipeline
import dotenv from 'dotenv';
dotenv.config();


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

app.use(express.static(__dirname));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Each WS connection gets a conversation array AND an audio buffer
wss.on('connection', (ws) => {
  console.log('✅ Client connected');

  // For conversation context
  const conversation = [
    { role: 'system', content: 'You are a helpful assistant.' },
  ];

  // For buffering audio
  let audioChunks = [];
  let silenceTimer = null;

  ws.on('message', async (message) => {
    // If it's binary, it's part of the user's audio chunk
    if (message instanceof Buffer) {
      await sendToVoiceBot(message, (replyOrWav) => {
        if (Buffer.isBuffer(replyOrWav)) {
          console.log('Sending WAV audio buffer back to client...');
          ws.send(replyOrWav);
        } else if (typeof replyOrWav === 'string') {
          console.log('Sending text error/info:', replyOrWav);
          ws.send(replyOrWav);
        }
      });
    }
    
    
    if (message instanceof Buffer) {
      console.log('🔊 Received audio chunk, size=', message.length);
      audioChunks.push(message);

      // Clear the old timer
      if (silenceTimer) {
        clearTimeout(silenceTimer);
      }

      // Set a new timer for 2s. If no audio arrives in that time,
      // we'll assume the user finished speaking
      silenceTimer = setTimeout(async () => {
        // Combine all chunks
        const fullAudio = Buffer.concat(audioChunks);
        audioChunks = []; // reset

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

        // Get AI reply
        const reply = await callOpenAI(conversation);
        conversation.push({ role: 'assistant', content: reply });

           // ✅ Convert reply text to audio buffer
         const audioBuffer = await synthesizeSpeech(reply);

          // ✅ Send audio buffer to telephony over WebSocket
          ws.send(audioBuffer);


      }, 2000);

    } 
    
    
    else {
      // If it's text from client, treat it as a user message too
      const textMsg = message.toString();
      console.log('💬 Text from client:', textMsg);
      conversation.push({ role: 'user', content: textMsg });

      const reply = await callOpenAI(conversation);
      conversation.push({ role: 'assistant', content: reply });

      ws.send(reply);
    }
  });

  ws.on('close', () => {
    console.log('❌ Client disconnected');
    // Cleanup if needed
    if (silenceTimer) clearTimeout(silenceTimer);
  });
});

server.listen(3030, () => {
  console.log('🚀 Server on http://localhost:3030');
});

// Use your existing or any method to call the Chat API
async function callOpenAI(conversation) {
  const OPENAI_API_KEY = process.env.OPENAI_API_KEY; // must be set
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
  // The AI reply text is here:
  return data.choices[0].message.content;
}
