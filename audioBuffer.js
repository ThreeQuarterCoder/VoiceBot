let audioChunks = [];
let isProcessing = false;

export function bufferAudioChunk(chunk) {
  audioChunks.push(chunk);
}

export function getBufferedAudio() {
  if (audioChunks.length === 0 || isProcessing) return null;

  // Combine all chunks into one Buffer
  const completeBuffer = Buffer.concat(audioChunks);
  
  // Let's say we process when we have ~100 KB of audio
  if (completeBuffer.length > 100 * 1024) {
    isProcessing = true;
    audioChunks = []; // reset buffer
    return completeBuffer;
  }

  return null;
}

export function resetProcessingFlag() {
  isProcessing = false;
}
