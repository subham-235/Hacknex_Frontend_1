'use client';
import { useApp } from './app-provider';
import VoicePanel from './VoicePanel';

export default function SosPanel() {
  const { demo, contacts, refresh } = useApp();
  return <VoicePanel key={demo ? 'demo' : 'live'} demo={demo}
    contactCount={contacts.filter(contact => contact.isActive).length}
    onSOSTriggered={() => void refresh()} />;
}
