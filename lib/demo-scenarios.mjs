export const scenarios = [
  {
    id: 'rescue',
    tag: 'THE RESCUE',
    title: 'Rescue in action',
    description:
      'An SOS becomes a coordinated rescue. Follow a helper all the way to the person in need.',
    takeaway: 'Help is more than an alert. It is a confirmed arrival.',
    evidence:
      'You just saw discovery, acceptance, live proximity, explicit arrival and incident resolution.',
    steps: [
      {
        action: 'reset',
        title: 'Set the scene',
        detail:
          'A clean, isolated demo is ready. No real emergency has been created.',
      },
      {
        action: 'emergency',
        title: 'The SOS reaches nearby help',
        detail:
          'The backend opens a search area around the person and creates a responder request.',
      },
      {
        action: 'accept',
        title: 'A responder says “I’m coming”',
        detail:
          'Help is now accepted. The responder is assigned and their approach can be tracked.',
      },
      {
        action: 'victim-300',
        title: 'The person changes location',
        detail:
          'The victim moves 300 metres. The backend recentres the emergency area and recalculates the responder’s distance from the new position.',
      },
      {
        action: 'responder-500',
        title: '500 metres away',
        detail:
          'A simulated GPS update moves the helper closer. The backend recalculates distance.',
      },
      {
        action: 'responder-250',
        title: '250 metres away',
        detail:
          'The gap is closing. The live map and distance reflect the saved location.',
      },
      {
        action: 'responder-80',
        title: 'Help is nearby',
        detail:
          'The helper is approximately 80 metres away. Proximity is not yet arrival.',
      },
      {
        action: 'responder-15',
        title: 'Inside the arrival area',
        detail:
          'GPS places the helper about 15 metres away. The incident remains open.',
      },
      {
        action: 'confirm-arrival',
        title: 'Arrival is confirmed',
        detail:
          'The responder explicitly confirms arrival. The person still controls closing the SOS.',
      },
      {
        action: 'resolve',
        title: 'The person marks themselves safe',
        detail:
          'The incident is resolved through the backend. This completes the rescue story.',
      },
    ],
  },
  {
    id: 'journey',
    tag: 'EARLY DETECTION',
    title: 'A journey goes off route',
    description:
      'Follow a route deviation through a safety check and an unanswered deadline. Try checking in safely, or continue to a simulated automatic SOS.',
    takeaway: 'An unanswered safety check becomes an automatic SOS.',
    evidence:
      'The production deadline and duplicate-send checks ran against isolated demo records. One simulated contact alert was accepted; no real SMS was sent.',
    steps: [
      {
        action: 'reset',
        title: 'Start a fresh story',
        detail:
          'Previous demo records are cleared. Real incidents are unaffected.',
      },
      {
        action: 'start',
        title: 'Define the safe journey',
        detail:
          'The map displays the planned route, its safe corridor and the destination.',
      },
      {
        action: 'safe',
        title: 'Travel along the planned route',
        detail:
          'Simulated positions advance along the corridor while journey monitoring stays active.',
      },
      {
        action: 'deviation',
        title: 'Ask: are you safe?',
        detail:
          'Sustained deviation starts a live 10-second countdown. Confirm safety now, or wait for an automatic simulated SOS.',
        pauseAfter: true,
      },
      {
        action: 'checkin-wait',
        title: 'The check-in remains unanswered',
        detail:
          'Five seconds remain. You can still confirm safety before the countdown ends.',
      },
      {
        action: 'checkin-timeout',
        title: 'Automatically trigger SOS',
        detail:
          'The 10-second deadline has passed. The backend creates one demo SOS and records simulated SMS acceptance, using the last known location.',
      },
    ],
  },
  {
    id: 'search',
    tag: 'ESCALATION',
    title: 'No helper nearby',
    description:
      'When the first search finds no available helper, the system expands the search and tries again.',
    takeaway: 'The search adapts when the first attempt is not enough.',
    evidence:
      'The simulation advances the acceptance timeout, expands the radius and coordinates the newly reached helper.',
    steps: [
      {
        action: 'reset',
        title: 'Set the scene',
        detail: 'A fresh demo makes this search easy to follow.',
      },
      {
        action: 'no-responder',
        title: 'No helper in the first search area',
        detail:
          'The demo responder starts beyond the initial radius. Help is not falsely marked as confirmed.',
      },
      {
        action: 'expand',
        title: 'Widen the search',
        detail:
          'The simulation advances the timeout. The backend expands its search radius.',
      },
      {
        action: 'accept',
        title: 'A newly reached helper accepts',
        detail:
          'The responder accepts the request and becomes the assigned helper.',
      },
      {
        action: 'responder-80',
        title: 'The helper approaches',
        detail:
          'The saved GPS update brings the responder about 80 metres from the person.',
      },
      {
        action: 'responder-15',
        title: 'Reach the arrival area',
        detail:
          'A close location is visible, but the system still requires an explicit arrival confirmation.',
      },
      {
        action: 'confirm-arrival',
        title: 'Confirm arrival',
        detail:
          'The responder confirms they have reached the person. The SOS remains open for the owner.',
      },
      {
        action: 'resolve',
        title: 'Close the incident',
        detail:
          'The person marks themselves safe and the backend resolves the incident.',
      },
    ],
  },
];
