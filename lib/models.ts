export interface User {
  _id: string;
  fullName: string;
  emailId: string;
  role?: string;
}
export interface Contact {
  _id: string;
  contacts: string;
  contactNumber: string;
  via: string;
  isActive: boolean;
}
export interface Alert {
  _id: string;
  severity: string;
  summary: string;
  transcript: string;
  confidencePercentage: number;
  createdAt: string;
  sent: Contact[];
  location?: { mapsLink: string };
}
export interface Action {
  _id: string;
  contactId: string;
  reason: string;
  state: string;
}
export interface Session {
  _id: string;
  reference: string;
  status: string;
  summary: string;
  severity: string;
  createdAt: string;
  actions: Action[];
  attempts: {
    _id: string;
    contactId: string;
    status: string;
    kind: string;
    error?: string;
  }[];
  recipients: { contactId: string; label: string; number: string }[];
  events: { _id: string; type: string; text: string; at: string }[];
  acknowledgments: { contactId: string; at: string }[];
}
export const demoContacts: Contact[] = [
  {
    _id: 'demo-1',
    contacts: 'Family',
    contactNumber: 'Demo contact',
    via: 'SMS',
    isActive: true,
  },
  {
    _id: 'demo-2',
    contacts: 'Other Contacts',
    contactNumber: 'Demo contact',
    via: 'SMS',
    isActive: true,
  },
];
export const demoSessions: Session[] = [
  {
    _id: 'demo-session',
    reference: 'DEMO-EXAMPLE',
    status: 'review_required',
    summary:
      'Example: an initial alert has no acknowledgment yet. Review a suggested follow-up.',
    severity: 'medium',
    createdAt: '2026-09-11T08:00:00Z',
    recipients: [
      { contactId: 'demo-1', label: 'Family', number: 'Demo contact' },
    ],
    actions: [
      {
        _id: 'demo-action',
        contactId: 'demo-1',
        reason:
          'No reply received. A short follow-up may help confirm someone has seen the alert.',
        state: 'proposed',
      },
    ],
    attempts: [
      {
        _id: 'demo-attempt',
        contactId: 'demo-1',
        status: 'delivered',
        kind: 'initial',
      },
    ],
    acknowledgments: [],
    events: [
      {
        _id: 'demo-event',
        type: 'agent_note',
        text: 'Demo only: delivery was recorded, but delivery does not mean someone has agreed to help.',
        at: '2026-09-11T08:01:00Z',
      },
    ],
  },
];
export const demoHistory: Alert[] = [
  {
    _id: 'demo-alert',
    severity: 'Medium',
    summary: 'Example safety check while walking home.',
    transcript: 'This is a sample transcript for exploring the interface.',
    confidencePercentage: 78,
    createdAt: '2026-09-11T08:00:00Z',
    sent: [demoContacts[0]],
    location: { mapsLink: 'https://www.google.com/maps?q=22.5726,88.3639' },
  },
];
