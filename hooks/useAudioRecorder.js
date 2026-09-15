'use client';
import { useCallback, useEffect, useRef, useState } from 'react';

export default function useAudioRecorder(onChunkReady) {
  const [isRecording, setIsRecording] = useState(false);
  const [error, setError] = useState('');
  const callback = useRef(onChunkReady);
  callback.current = onChunkReady;
  const current = useRef({ generation: 0, stream: null, recorder: null, timer: null, starting: false });
  const mounted = useRef(true);

  const stopRecording = useCallback(() => {
    const state = current.current;
    state.generation++;
    state.starting = false;
    clearTimeout(state.timer);
    if (state.recorder && state.recorder.state !== 'inactive') state.recorder.stop();
    state.stream?.getTracks().forEach(track => track.stop());
    state.stream = null;
    state.recorder = null;
    if (mounted.current) setIsRecording(false);
  }, []);

  const startRecording = useCallback(async () => {
    const state = current.current;
    if (state.starting || state.stream) return false;
    state.starting = true;
    const generation = ++state.generation;
    setError('');
    try {
      if (typeof MediaRecorder === 'undefined' || !navigator.mediaDevices?.getUserMedia ||
          !MediaRecorder.isTypeSupported('audio/webm')) {
        throw new Error('Please use Chrome or Edge for voice detection');
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, sampleRate: 16000 },
      });
      if (!mounted.current || generation !== state.generation) {
        stream.getTracks().forEach(track => track.stop());
        return false;
      }
      state.stream = stream;
      const fail = (message) => {
        if (generation !== state.generation) return;
        stopRecording();
        setError(message);
      };
      stream.getAudioTracks().forEach(track => track.addEventListener('ended', () => {
        fail('Microphone disconnected. Reconnect it and activate Suraksha Mode again.');
      }));
      const recordSegment = () => {
        if (generation !== state.generation) return;
        const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
        state.recorder = recorder;
        const parts = [];
        recorder.ondataavailable = event => {
          if (event.data.size) parts.push(event.data);
        };
        recorder.onerror = () => fail('Microphone error: recording failed. Please activate again.');
        recorder.onstop = () => {
          if (generation !== state.generation) return;
          const blob = new Blob(parts, { type: 'audio/webm' });
          // Restart on the same live stream. Each upload includes its own WebM header.
          try { recordSegment(); } catch (err) { fail(`Microphone error: ${err.message}`); return; }
          // This filters tiny payloads, not acoustic silence; AI decides what was heard.
          if (blob.size > 500) Promise.resolve().then(() => {
            if (generation === state.generation) return callback.current(blob);
          }).catch(() => console.error('Audio chunk callback failed'));
        };
        recorder.start(4000);
        state.timer = setTimeout(() => {
          if (generation === state.generation && recorder.state === 'recording') recorder.stop();
        }, 4000);
      };
      recordSegment();
      state.starting = false;
      setIsRecording(true);
      return true;
    } catch (err) {
      if (generation !== state.generation || !mounted.current) return false;
      stopRecording();
      setError(err.name === 'NotAllowedError'
        ? 'Microphone permission denied. Please allow mic access in browser settings.'
        : err.name === 'NotFoundError'
          ? 'No microphone found on this device.'
          : err.message === 'Please use Chrome or Edge for voice detection'
            ? err.message : `Microphone error: ${err.message}`);
      return false;
    }
  }, [stopRecording]);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; stopRecording(); };
  }, [stopRecording]);
  return { startRecording, stopRecording, isRecording, error };
}
