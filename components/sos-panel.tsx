'use client';
import { useState, useEffect, useRef } from 'react';
import { Mic, Square, Upload, MapPin, Siren } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { api, useApp } from './app-provider';
import { Field, Confirm, Status } from './shared';
import { ApiError, validateCoordinates } from '@/lib/api.mjs';
interface Result {
  sent?: boolean;
  isDistress?: boolean;
  transcript?: string;
  summary?: string;
  emotion?: string;
  reason?: string;
  severity?: string;
  sentTo?: string[];
  failedTo?: string[];
  agentReference?: string;
  agentTrackingError?: string;
  error?: string;
}
export default function SosPanel() {
  const { demo, contacts, refresh } = useApp();
  const [file, setFile] = useState<File | null>(null),
    [audioUrl, setAudioUrl] = useState(''),
    [recording, setRecording] = useState(false),
    [busy, setBusy] = useState(false),
    [locating, setLocating] = useState(false),
    [error, setError] = useState(''),
    [lat, setLat] = useState(''),
    [lon, setLon] = useState(''),
    [result, setResult] = useState<Result | null>(null),
    [seconds, setSeconds] = useState(0);
  const recorder = useRef<MediaRecorder | null>(null),
    stream = useRef<MediaStream | null>(null),
    mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (recorder.current?.state === 'recording') recorder.current.stop();
      stream.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);
  useEffect(() => {
    if (!file) {
      setAudioUrl('');
      return;
    }
    const url = URL.createObjectURL(file);
    setAudioUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  useEffect(() => {
    if (!recording) return;
    const interval = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(interval);
  }, [recording]);
  useEffect(() => {
    if (seconds >= 60 && recorder.current?.state === 'recording')
      recorder.current.stop();
  }, [seconds]);
  function chooseFile(candidate: File | undefined) {
    if (!candidate) return;
    if (candidate.size > 10 * 1024 * 1024) {
      setError('Use an audio file smaller than 10 MB.');
      return;
    }
    if (
      !candidate.type.includes('webm') &&
      !candidate.name.toLowerCase().endsWith('.webm')
    ) {
      setError(
        'This backend currently supports WebM audio. Please record here or upload a .webm file.',
      );
      return;
    }
    setFile(candidate);
    setResult(null);
    setError('');
  }
  async function record() {
    setError('');
    try {
      if (
        !navigator.mediaDevices?.getUserMedia ||
        typeof MediaRecorder === 'undefined' ||
        !MediaRecorder.isTypeSupported('audio/webm')
      )
        throw new Error(
          'WebM recording is unavailable in this browser. Use Chrome/Edge or upload a WebM audio file.',
        );
      const media = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!mounted.current) {
        media.getTracks().forEach((t) => t.stop());
        return;
      }
      stream.current = media;
      const r = new MediaRecorder(media, { mimeType: 'audio/webm' });
      recorder.current = r;
      const chunks: Blob[] = [];
      r.ondataavailable = (e) => {
        if (e.data.size) chunks.push(e.data);
      };
      r.onstop = () => {
        media.getTracks().forEach((t) => t.stop());
        if (mounted.current) {
          setRecording(false);
          chooseFile(
            new File(chunks, 'sos-recording.webm', { type: 'audio/webm' }),
          );
        }
      };
      r.onerror = () => {
        media.getTracks().forEach((t) => t.stop());
        setRecording(false);
        setError('Recording failed. Try recording again.');
      };
      setSeconds(0);
      setResult(null);
      r.start();
      setRecording(true);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  function locate() {
    setLocating(true);
    setError('');
    if (!navigator.geolocation) {
      setLocating(false);
      setError('Location is unavailable. Enter coordinates below.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setLat(String(p.coords.latitude));
        setLon(String(p.coords.longitude));
        setLocating(false);
      },
      (e) => {
        setError(`${e.message} You can enter coordinates manually.`);
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 15000 },
    );
  }
  async function send() {
    if (!file || !validateCoordinates(lat, lon))
      throw new Error('Add a recording and valid coordinates first.');
    setBusy(true);
    setError('');
    setResult(null);
    try {
      if (demo) {
        setResult({
          sent: false,
          isDistress: true,
          transcript: 'Demo simulation: no audio was uploaded or analyzed.',
          summary:
            'The SOS workflow is ready to explore. In live mode the backend analyzes your audio and may send SMS alerts.',
          severity: 'medium',
          sentTo: [],
          failedTo: [],
          agentReference: 'DEMO-EXAMPLE',
        });
        return;
      }
      const form = new FormData();
      form.append('audio', file);
      form.append('location', `${Number(lat)},${Number(lon)}`);
      const response = await api('/sos/trigger', {
        method: 'POST',
        body: form,
        timeout: 90000,
      });
      setResult(response);
      await refresh();
    } catch (e) {
      if (e instanceof ApiError && e.data?.isDistress) {
        setResult(e.data);
        await refresh();
      } else {
        const message = `${(e as Error).message} Delivery status is unknown. Check alert history before attempting another SOS; do not assume that no SMS was sent.`;
        setError(message);
        throw new Error(message);
      }
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="sos-layout">
      <section>
        <article className="card">
          <p className="eyebrow">01 / YOUR VOICE</p>
          <h2>Tell your circle what is happening.</h2>
          <p>
            Record up to 60 seconds. Your recording is uploaded only after you
            confirm sending.
          </p>
          <div className={`record-area ${recording ? 'is-recording' : ''}`}>
            <div className="mic-circle">
              <Mic size={30} />
            </div>
            <strong>
              {recording
                ? `Recording · ${seconds}s`
                : 'Your voice can start a call for help.'}
            </strong>
            <p>
              {recording
                ? 'Speak clearly. Recording stops at 60 seconds.'
                : 'Record here or choose a WebM audio file (up to 10 MB).'}
            </p>
            <div className="actions">
              {recording ? (
                <Button onClick={() => recorder.current?.stop()}>
                  <Square /> Stop recording
                </Button>
              ) : (
                <Button disabled={busy} onClick={record}>
                  <Mic /> Record audio
                </Button>
              )}
              <label className="upload-button">
                <Upload size={15} /> Upload WebM
                <input
                  type="file"
                  accept="audio/webm,.webm"
                  disabled={busy || recording}
                  onChange={(e) => chooseFile(e.target.files?.[0])}
                />
              </label>
            </div>
          </div>
          {file && (
            <div className="audio-preview">
              <strong>{file.name}</strong>
              {/* User-recorded audio has no transcript until backend analysis completes. */}
              {/* oxlint-disable-next-line jsx-a11y/media-has-caption */}
              <audio
                controls
                aria-label="Preview your SOS recording"
                src={audioUrl}
              />
              <Button
                variant="ghost"
                disabled={busy || recording}
                onClick={() => {
                  setFile(null);
                  setResult(null);
                }}
              >
                Remove recording
              </Button>
            </div>
          )}
        </article>
        <article className="card">
          <div className="section-heading">
            <div>
              <p className="eyebrow">02 / YOUR LOCATION</p>
              <h2>Help your contacts find you.</h2>
            </div>
            <Button
              variant="outline"
              disabled={locating || busy}
              onClick={locate}
            >
              <MapPin />
              {locating ? 'Locating...' : 'Use my location'}
            </Button>
          </div>
          <div className="form-grid">
            <Field label="Latitude">
              <Input
                type="number"
                step="any"
                min={-90}
                max={90}
                value={lat}
                onChange={(e) => setLat(e.target.value)}
                placeholder="e.g. 22.5726"
              />
            </Field>
            <Field label="Longitude">
              <Input
                type="number"
                step="any"
                min={-180}
                max={180}
                value={lon}
                onChange={(e) => setLon(e.target.value)}
                placeholder="e.g. 88.3639"
              />
            </Field>
          </div>
          <p className="fine">
            This location is attached to this SOS. It does not enable continuous
            sharing.
          </p>
        </article>
        {error && (
          <div className="error" role="alert">
            {error}
          </div>
        )}
        {result && (
          <article className="card result" aria-live="polite">
            <h2>
              {demo
                ? 'Demo completed - no SMS sent'
                : result.sent
                  ? 'Alert submitted to SMS provider'
                  : result.isDistress
                    ? 'SMS attempts failed'
                    : 'No distress detected - no SMS sent'}
            </h2>
            {result.severity && <Status value={result.severity} />}
            <p>{result.summary || result.reason || result.error}</p>
            <p>{result.transcript}</p>
            {!demo && (
              <p>
                Submitted: {result.sentTo?.length || 0} · Failed:{' '}
                {result.failedTo?.length || 0}. Submission does not confirm
                delivery.
              </p>
            )}
            {result.agentReference && (
              <p>
                Agent reference: <strong>{result.agentReference}</strong>
              </p>
            )}
            {result.agentTrackingError && (
              <p className="error">
                Agent tracking unavailable: {result.agentTrackingError}
              </p>
            )}
          </article>
        )}
      </section>
      <aside className="card send-review">
        <p className="eyebrow">03 / REVIEW & SEND</p>
        <h2>A signal to your people.</h2>
        <p>{contacts.filter((c) => c.isActive).length} active contact(s)</p>
        {contacts
          .filter((c) => c.isActive)
          .map((c) => (
            <div className="recipient" key={c._id}>
              <span className="avatar">{c.contacts[0]}</span>
              <div>
                <strong>{c.contacts}</strong>
                <small>{c.contactNumber}</small>
              </div>
              <span className="fine">SMS</span>
            </div>
          ))}
        <div className="divider" />
        <p className="fine">
          The backend assesses your recording. If it detects distress, it
          attempts SMS alerts with your location.
        </p>
        {!file ||
        !validateCoordinates(lat, lon) ||
        !contacts.some((c) => c.isActive) ||
        recording ||
        busy ? (
          <Button disabled className="sos-button">
            <Siren />{' '}
            {busy
              ? 'Analyzing and sending...'
              : 'Add audio, location & contacts'}
          </Button>
        ) : (
          <Confirm
            title={
              demo ? 'Simulate this SOS?' : 'Analyze audio and send an SOS?'
            }
            description={
              demo
                ? 'This is a demo. No recording will be uploaded and no contacts will receive a message.'
                : `Your audio and location will be uploaded. If distress is detected, the backend will attempt SMS alerts to ${contacts.filter((c) => c.isActive).length} active contact(s).`
            }
            label={demo ? 'Run demo SOS' : 'Confirm and send SOS'}
            onConfirm={send}
          >
            <Siren /> {demo ? 'Simulate SOS' : 'Review and send SOS'}
          </Confirm>
        )}
        <p className="fine emergency-note">
          Need immediate help? <a href="tel:112">Call 112</a>.
        </p>
      </aside>
    </div>
  );
}
