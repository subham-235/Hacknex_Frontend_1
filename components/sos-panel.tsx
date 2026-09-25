'use client';
import { useApp } from './app-provider';
import VoicePanel from './VoicePanel';
import VictimHelpStatus from './victim-help-status';
import { usePageVisible } from './workspace-pages';

export default function SosPanel() {
  const { demo, contacts, refresh } = useApp();
  const visible = usePageVisible();
  return <><VictimHelpStatus /><VoicePanel key={demo ? 'demo' : 'live'} demo={demo} visible={visible}
    contactCount={contacts.filter(contact => contact.isActive).length}
    onSOSTriggered={() => void refresh()} /></>;
}
