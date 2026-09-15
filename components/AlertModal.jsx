'use client';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

const RED = '#f2a0b5',
  NAVY = '#151c30',
  DARK = '#0d1424',
  BORDER = '#ffffff24';
const WHITE = '#eef2ff',
  GRAY = '#aebbd2',
  GREEN = '#88e2c3';
const MONO = "'Segoe UI', Arial, sans-serif";
const SANS = "'Segoe UI', Arial, sans-serif";

export default function AlertModal({ show, alertData, onClose }) {
  const dialog = useRef(null),
    pulse = useRef(null),
    summaryNode = useRef(null);
  const [revealed, setRevealed] = useState(0);
  const summary =
    alertData?.summary || alertData?.error || 'No AI summary returned.';
  useEffect(() => {
    if (!show) return;
    dialog.current?.showModal();
    const reduced = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches;
    setRevealed(reduced ? 4 : 0);
    if (summaryNode.current) summaryNode.current.textContent = '';
    const timers = reduced
      ? []
      : [1, 2, 3, 4].map((step) =>
          setTimeout(() => setRevealed(step), step * 600),
        );
    const animation =
      !reduced &&
      pulse.current?.animate(
        [
          { opacity: 0.4, transform: 'scale(.85)' },
          { opacity: 1, transform: 'scale(1)' },
        ],
        { duration: 900, iterations: Infinity, direction: 'alternate' },
      );
    let interval;
    const typing = setTimeout(
      () => {
        if (reduced) {
          if (summaryNode.current) summaryNode.current.textContent = summary;
          return;
        }
        let index = 0;
        interval = setInterval(() => {
          if (summaryNode.current)
            summaryNode.current.textContent = summary.slice(0, ++index);
          if (index >= summary.length) clearInterval(interval);
        }, 18);
      },
      reduced ? 0 : 2500,
    );
    const element = dialog.current;
    return () => {
      timers.forEach(clearTimeout);
      clearTimeout(typing);
      clearInterval(interval);
      animation?.cancel();
      element?.close();
    };
  }, [show, alertData, summary]);
  if (!show || !alertData) return null;
  const sent = alertData.sent === true && alertData.sentTo?.length > 0;
  const steps = [
    ['Distress detected in audio', !alertData.demo],
    [
      alertData.locationSource === 'gps'
        ? 'GPS location fetched'
        : alertData.locationSource === 'ip'
          ? 'Approximate IP location fetched'
          : 'Location unavailable',
      ['gps', 'ip'].includes(alertData.locationSource),
    ],
    ['AI emergency summary generated', !!alertData.summary && !alertData.demo],
    [
      sent
        ? 'Alert submitted to emergency contacts'
        : 'No successful SMS submission confirmed',
      sent,
    ],
  ];
  const button = {
    padding: '12px 16px',
    background: 'transparent',
    border: `1px solid ${BORDER}`,
    color: WHITE,
    fontFamily: MONO,
    cursor: 'pointer',
  };
  return createPortal(
    <dialog
      ref={dialog}
      aria-labelledby="voice-alert-title"
      aria-describedby="voice-alert-description"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      style={{
        position: 'fixed',
        inset: 0,
        margin: 0,
        width: '100vw',
        height: '100dvh',
        maxWidth: 'none',
        maxHeight: 'none',
        padding: 20,
        border: 0,
        background: 'rgba(0,0,0,.92)',
        color: WHITE,
        zIndex: 1000,
      }}
    >
      <div style={{ minHeight: '100%', display: 'grid', placeItems: 'center' }}>
        <div
          style={{
            width: '100%',
            maxWidth: 520,
            background: NAVY,
            border: `1px solid ${RED}`,
            padding: 'clamp(20px, 5vw, 36px)',
            boxSizing: 'border-box',
          }}
        >
          <div
            ref={pulse}
            aria-hidden="true"
            style={{
              width: 28,
              height: 28,
              borderRadius: '50%',
              background: RED,
              marginBottom: 20,
            }}
          />
          <h2
            id="voice-alert-title"
            style={{
              color: RED,
              fontFamily: SANS,
              letterSpacing: 3,
              fontSize: 28,
              margin: 0,
            }}
          >
            {alertData.demo ? 'SOS PREVIEW' : 'SOS ACTIVATED'}
          </h2>
          <p
            id="voice-alert-description"
            style={{ font: `11px ${MONO}`, color: GRAY, letterSpacing: 1 }}
          >
            {alertData.demo
              ? 'DEMO — NO AUDIO ANALYZED OR ALERTS SENT'
              : sent
                ? 'SMS SUBMITTED — DELIVERY NOT YET CONFIRMED'
                : 'DISTRESS DETECTED — CHECK ALERT STATUS'}
          </p>
          <ol style={{ padding: 0, margin: '28px 0', listStyle: 'none' }}>
            {steps.map(([text, success], index) => (
              <li
                key={text}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  marginTop: 16,
                  font: `12px ${MONO}`,
                  color: revealed > index ? WHITE : GRAY,
                }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    color: revealed > index ? (success ? GREEN : RED) : GRAY,
                  }}
                >
                  {revealed > index ? (success ? '✓' : '!') : '○'}
                </span>
                {text}
              </li>
            ))}
          </ol>
          <div
            style={{
              visibility: revealed === 4 ? 'visible' : 'hidden',
              background: DARK,
              border: '1px solid rgba(0,255,136,.2)',
              padding: 16,
              fontFamily: MONO,
            }}
          >
            <div style={{ fontSize: 9, color: GREEN, letterSpacing: 2 }}>
              {alertData.demo ? 'EXAMPLE SUMMARY' : 'AI GENERATED SUMMARY'}
            </div>
            <p
              aria-label={summary}
              style={{
                color: GREEN,
                fontSize: 12,
                lineHeight: 1.7,
                overflowWrap: 'anywhere',
              }}
            >
              <span aria-hidden="true" ref={summaryNode} />
            </p>
          </div>
          {!!alertData.sentTo?.length && (
            <p style={{ font: `11px ${MONO}`, overflowWrap: 'anywhere' }}>
              Submitted to: {alertData.sentTo.join(', ')}
            </p>
          )}
          {!!alertData.failedTo?.length && (
            <p style={{ font: `11px ${MONO}`, color: RED }}>
              Failed: {alertData.failedTo.join(', ')}
            </p>
          )}
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 12,
              marginTop: 24,
            }}
          >
            <button autoFocus style={button} onClick={onClose}>
              DISMISS
            </button>
            <button
              style={{
                ...button,
                color: sent ? GREEN : GRAY,
                borderColor: sent ? GREEN : BORDER,
              }}
              onClick={onClose}
            >
              {sent ? 'ALERT SUBMITTED ✓' : 'CLOSE STATUS'}
            </button>
          </div>
          <p style={{ font: `11px ${MONO}`, color: GRAY }}>
            Dismissing this status does not stop monitoring or resolve an agent
            session.
          </p>
        </div>
      </div>
    </dialog>,
    document.body,
  );
}
