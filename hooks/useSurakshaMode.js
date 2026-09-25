'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import useAudioRecorder from './useAudioRecorder';

export async function getLocation() {
  const valid = (lat, lon) => typeof lat === 'number' && typeof lon === 'number' &&
    Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180;
  try {
    const position = await new Promise((resolve, reject) => {
      if (!navigator.geolocation) return reject(new Error('Unavailable'));
      navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 5000 });
    });
    const { latitude: lat, longitude: lon } = position.coords;
    if (valid(lat, lon)) return { lat, lon, source: 'gps' };
  } catch { /* Try approximate IP location next. */ }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    const response = await fetch('https://ipapi.co/json/', { signal: controller.signal });
    if (!response.ok) throw new Error('Location lookup failed');
    const data = await response.json();
    if (valid(data.latitude, data.longitude)) return { lat: data.latitude, lon: data.longitude, source: 'ip' };
  } catch { /* Audio monitoring remains available without location. */ }
  finally { clearTimeout(timer); }
  return { lat: null, lon: null, source: 'unavailable' };
}

export default function useSurakshaMode({ onSOSTriggered, demo = false }) {
  const [isActive, setIsActive] = useState(false);
  const [isActivating, setIsActivating] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [voiceStatus, setVoiceStatus] = useState('');
  const [liveTranscript, setLiveTranscript] = useState('');
  const [alertData, setAlertData] = useState(null);
  const [locationSource, setLocationSource] = useState('unavailable');
  const active = useRef(false), starting = useRef(false), generation = useRef(0);
  const location = useRef({ lat: null, lon: null, source: 'unavailable' });
  const request = useRef(null), callback = useRef(onSOSTriggered);
  const pending = useRef([]);
  callback.current = onSOSTriggered;

  const sendAudioChunk = useCallback(async function sendAudioChunk(blob) {
    if (!active.current || demo) return;
    if (blob) {
      pending.current.push({ blob, capturedAt: Date.now() });
      // Keep up to ten seconds of recent audio, not an ever-growing backlog.
      pending.current = pending.current.slice(-5);
    }
    if (request.current) return;
    const batch = pending.current.filter(clip => Date.now() - clip.capturedAt <= 10000);
    pending.current = [];
    if (!batch.length) return;
    const run = generation.current;
    const controller = new AbortController();
    request.current = controller;
    setIsLoading(true);
    setVoiceStatus('Recording captured — sending audio and checking for an SOS…');
    const timer = setTimeout(() => controller.abort(), 90000);
    try {
      const { lat, lon, source } = location.current;
      const form = new FormData();
      batch.forEach((clip, index) => form.append('audio', clip.blob, index === 0 ? 'recording.webm' : `recording-${index}.webm`));
      form.append('lat', lat == null ? '' : String(lat));
      form.append('lon', lon == null ? '' : String(lon));
      // Compatibility with the current backend's required location field.
      form.append('location', lat == null || lon == null ? 'Location unavailable' : `${String(lat)},${String(lon)}`);
      const base = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '');
      const response = await fetch(`${base}/sos/trigger`, {
        method: 'POST', body: form, credentials: 'include', signal: controller.signal,
        // The browser supplies the multipart boundary; do not set Content-Type manually.
      });
      const data = await response.json();
      if (!active.current || generation.current !== run) return;
      if (typeof data.transcript === 'string') setLiveTranscript(data.transcript);
      if (data.isDistress === true) {
        setVoiceStatus(data.sent
          ? data.partialSuccess
            ? 'SOS triggered — some SMS alerts were submitted; others failed.'
            : 'SOS triggered — SMS alerts submitted to your contacts.'
          : 'Distress detected — SMS alerts could not be sent.');
      } else {
        setVoiceStatus(response.ok
          ? 'Recording checked — no SOS triggered. Still listening.'
          : 'Audio check failed — SOS status is unconfirmed. Please check your connection and try again.');
      }
      if (data.isDistress === true) {
        // End capture immediately; rescue/location monitoring has its own lifetime.
        active.current = false;
        pending.current = [];
        stopCapture.current();
        setIsActive(false);
        const result = { ...data, locationSource: source };
        setAlertData(result);
        callback.current?.(result);
      }
      if (!response.ok) console.error(`Voice analysis request failed (${response.status})`);
    } catch (err) {
      if (active.current && generation.current === run) {
        setVoiceStatus('Audio check interrupted — SOS status is unconfirmed. Please check your connection.');
      }
      if (active.current && generation.current === run) console.error('Voice analysis request failed:', err.name);
    } finally {
      clearTimeout(timer);
      if (request.current === controller) {
        request.current = null;
        setIsLoading(false);
        if (active.current && generation.current === run && pending.current.length) {
          // Analyze buffered clips together, in order, in the next single request.
          void sendAudioChunk();
        }
      }
    }
  }, [demo]);
  const { startRecording, stopRecording, isRecording, error } = useAudioRecorder(sendAudioChunk);
  const stopCapture = useRef(stopRecording);
  stopCapture.current = stopRecording;

  const deactivate = useCallback(({ preserveOutput = false } = {}) => {
    generation.current++;
    active.current = false;
    starting.current = false;
    request.current?.abort();
    request.current = null;
    pending.current = [];
    stopRecording();
    setIsActive(false);
    setIsActivating(false);
    setIsLoading(false);
    if (!preserveOutput) {
      setVoiceStatus('');
      setLiveTranscript('');
    } else {
      setVoiceStatus('Microphone off. Any active SOS continues to receive help updates.');
    }
  }, [stopRecording]);

  const activate = useCallback(async () => {
    if (active.current || starting.current) return;
    starting.current = true;
    const run = ++generation.current;
    setIsActivating(true);
    setAlertData(null);
    setVoiceStatus('');
    // Demo can preview the microphone, but never uploads audio or looks up location.
    const result = demo ? { lat: null, lon: null, source: 'demo' } : await getLocation();
    if (generation.current !== run) return;
    location.current = result;
    setLocationSource(result.source);
    const success = await startRecording();
    if (generation.current !== run) return;
    active.current = success;
    starting.current = false;
    setIsActive(success);
    setIsActivating(false);
  }, [demo, startRecording]);

  useEffect(() => {
    if (isActive && !isRecording) deactivate();
  }, [isActive, isRecording, deactivate]);
  useEffect(() => () => {
    generation.current++;
    active.current = false;
    request.current?.abort();
    request.current = null;
    pending.current = [];
  }, [demo]);

  return { isActive, isActivating, isLoading, liveTranscript, alertData, error,
    locationSource, voiceStatus, activate, deactivate };
}
