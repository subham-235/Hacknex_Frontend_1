'use client';
import { useState } from 'react';
import { Mic, ShieldCheck, Square, LoaderCircle, Radio } from 'lucide-react';
import useSurakshaMode from '@/hooks/useSurakshaMode';
import MicVisualizer from './MicVisualizer';
import LiveTranscript from './LiveTranscript';
import AlertModal from './AlertModal';

const RED = '#d68da8',
  NAVY = '#1a2138',
  DARK = 'radial-gradient(ellipse at 50% 30%, #382742 0%, #11182a 65%)',
  BORDER = '#ffffff1c';
const WHITE = '#eff2ff',
  GRAY = '#adb8cf',
  GREEN = '#85e9c7';
const MONO = "'Segoe UI', Arial, sans-serif";
const SANS = "'Segoe UI', Arial, sans-serif";

export default function VoicePanel({
  demo = false,
  contactCount = 0,
  onSOSTriggered = () => {},
}) {
  const [modalData, setModalData] = useState(null);
  const mode = useSurakshaMode({
    demo,
    onSOSTriggered: (data) => {
      setModalData(data);
      onSOSTriggered(data);
    },
  });
  const label = {
    fontFamily: MONO,
    fontSize: 10,
    letterSpacing: 2,
    color: GRAY,
  };
  const preview = () =>
    setModalData({
      demo: true,
      isDistress: true,
      sent: false,
      sentTo: [],
      locationSource: 'demo',
      summary:
        'Example: a person has asked for help. In live mode, the backend analyzes the audio and attempts to notify their trusted contacts.',
    });
  return (
    <section
      aria-labelledby="voice-mode-title"
      style={{
        background: DARK,
        color: WHITE,
        border: `1px solid ${BORDER}`,
        borderRadius: 18,
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 12,
          padding: '18px 24px',
          borderBottom: `1px solid ${BORDER}`,
        }}
      >
        <span
          style={{
            ...label,
            color: WHITE,
            display: 'flex',
            alignItems: 'center',
            gap: 9,
          }}
        >
          <ShieldCheck size={17} color={RED} /> SURAKSHA / VOICE GUARD
        </span>
        <span
          role="status"
          style={{ ...label, color: mode.isActive ? GREEN : GRAY }}
        >
          {demo ? 'DEMO · ' : ''}
          {mode.isActive
            ? 'MICROPHONE ON'
            : mode.isActivating
              ? 'STARTING'
              : 'STANDBY'}
        </span>
      </div>
      <div
        style={{
          maxWidth: 720,
          margin: '0 auto',
          textAlign: 'center',
          padding: 'clamp(24px, 5vw, 64px) 20px',
        }}
      >
        <p style={{ ...label, color: RED }}>YOUR VOICE IS YOUR SIGNAL</p>
        <h2
          id="voice-mode-title"
          style={{
            fontFamily: SANS,
            fontSize: 'clamp(30px, 5vw, 52px)',
            lineHeight: 1.1,
            letterSpacing: -1,
            color: WHITE,
            margin: '20px 0',
          }}
        >
          Help starts
          <br />
          with being heard.
        </h2>
        <p
          style={{
            color: GRAY,
            fontSize: 14,
            lineHeight: 1.8,
            maxWidth: 490,
            margin: '0 auto',
          }}
        >
          Activate Suraksha Mode to monitor your voice. The backend listens for
          distress in recordings such as “Bachao”, “Help”, “Chhodo”, or “Leave
          me”.
        </p>
        <div
          style={{
            width: 72,
            height: 72,
            borderRadius: '50%',
            display: 'grid',
            placeItems: 'center',
            margin: '32px auto 0',
            border: `1px solid ${mode.isActive ? RED : BORDER}`,
            background: NAVY,
          }}
        >
          <Mic size={28} color={mode.isActive ? RED : GRAY} />
        </div>
        <MicVisualizer isActive={mode.isActive} />
        {!demo && mode.voiceStatus && (
          <div
            role="status"
            aria-live="polite"
            aria-atomic="true"
            style={{
              margin: '20px auto 0', padding: '18px 20px', maxWidth: 500,
              border: `1px solid ${mode.isLoading ? RED : BORDER}`,
              borderRadius: 12, background: NAVY, color: WHITE,
              fontFamily: SANS, fontSize: 16, fontWeight: 600, lineHeight: 1.6,
            }}
          >
            {mode.isLoading
              ? <LoaderCircle className="animate-spin motion-reduce:animate-none" size={24} aria-hidden="true" style={{ margin: '0 auto 8px', color: RED }} />
              : <Radio size={24} aria-hidden="true" style={{ margin: '0 auto 8px', color: GREEN }} />}
            {mode.voiceStatus}
            {mode.isLoading && (
              <p style={{ margin: '6px 0 0', fontSize: 13, fontWeight: 400, color: GRAY }}>
                Keep this page open. We’ll show the result when the check finishes.
              </p>
            )}
          </div>
        )}
        <p
          role="status"
          style={{ ...label, margin: '18px 0 28px', minHeight: 28 }}
        >
          {mode.isActivating
            ? 'GETTING LOCATION & MICROPHONE PERMISSION…'
            : mode.isActive
              ? demo
                ? 'LOCAL MIC PREVIEW · NO AUDIO UPLOADED'
                : mode.isLoading
                  ? 'ANALYZING YOUR RECORDING…'
                  : 'MONITORING · FOUR-SECOND RECORDINGS'
              : 'MICROPHONE OFF · READY WHEN YOU ARE'}
        </p>
        <button
          onClick={() =>
            mode.isActive || mode.isActivating
              ? mode.deactivate()
              : void mode.activate()
          }
          style={{
            width: '100%',
            maxWidth: 400,
            minHeight: 52,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
            padding: '14px 20px',
            border: `1px solid ${RED}`,
            borderRadius: 6,
            background:
              mode.isActive || mode.isActivating ? 'transparent' : RED,
            color: WHITE,
            font: `bold 14px ${SANS}`,
            cursor: 'pointer',
          }}
        >
          {mode.isActive || mode.isActivating ? (
            <Square size={16} />
          ) : (
            <Mic size={17} />
          )}
          {mode.isActivating
            ? 'Cancel activation'
            : mode.isActive
              ? 'Deactivate Suraksha Mode'
              : 'Activate Suraksha Mode'}
        </button>
        {mode.error && (
          <div
            role="alert"
            style={{
              border: `1px solid ${RED}`,
              background: '#261014',
              color: '#ff919a',
              font: `12px ${MONO}`,
              padding: 14,
              marginTop: 18,
            }}
          >
            {mode.error}
          </div>
        )}
        <p
          style={{
            color: GRAY,
            fontSize: 12,
            lineHeight: 1.7,
            margin: '18px auto',
            maxWidth: 500,
          }}
        >
          {demo
            ? 'Demo mode keeps recordings on this page. Sign in for live analysis and automatic alerts.'
            : 'Activating uploads microphone audio automatically and authorizes SMS alerts when the backend detects distress. Monitoring stops when you leave this screen. Keep this page open and your device awake.'}
        </p>
        {!demo && (
          <p style={{ color: GRAY, fontSize: 11, lineHeight: 1.6 }}>
            Uses your device location, with approximate IP location as a
            fallback.
          </p>
        )}
        <div style={{ marginTop: 24 }}>
          <LiveTranscript
            transcript={mode.liveTranscript}
            isActive={mode.isActive}
          />
        </div>
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'center',
            gap: 24,
            marginTop: 28,
            paddingTop: 24,
            borderTop: `1px solid ${BORDER}`,
          }}
        >
          <span style={label}>
            {contactCount} ACTIVE CONTACT{contactCount === 1 ? '' : 'S'}
          </span>
          <span style={label}>
            {mode.isActive
              ? {
                  gps: 'GPS LOCATION',
                  ip: 'APPROXIMATE IP LOCATION',
                  unavailable: 'LOCATION UNAVAILABLE',
                  demo: 'DEMO LOCATION OFF',
                }[mode.locationSource]
              : 'LOCATION CHECK ON ACTIVATION'}
          </span>
        </div>
        {!demo && contactCount === 0 && (
          <p style={{ font: `12px ${MONO}`, color: '#ff919a' }}>
            Add an active trusted contact so the backend has someone to alert.
          </p>
        )}
        {demo && (
          <button
            onClick={preview}
            style={{
              marginTop: 24,
              padding: '10px 16px',
              border: `1px solid ${BORDER}`,
              background: NAVY,
              color: WHITE,
              cursor: 'pointer',
              fontFamily: MONO,
              fontSize: 12,
            }}
          >
            Preview SOS animation
          </button>
        )}
        <p style={{ marginTop: 28, font: `11px ${MONO}`, color: GRAY }}>
          Need immediate help?{' '}
          <a href="tel:112" style={{ color: WHITE }}>
            Call 112
          </a>
          .
        </p>
      </div>
      <AlertModal
        show={!!modalData}
        alertData={modalData}
        onClose={() => setModalData(null)}
      />
    </section>
  );
}
