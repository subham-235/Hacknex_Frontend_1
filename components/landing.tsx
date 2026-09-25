'use client';
import { motion } from 'framer-motion';
import { ArrowUpRight, ArrowDown, ShieldCheck, Mic, Users, Route, MoveUpRight, Radio, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SafetyOrbit } from './safety-orbit';

const features = [
  { icon: Mic, number: '01', title: 'A voice that reaches further.', text: 'Activate voice monitoring. When distress is detected, Suraksha attempts to alert your trusted contacts with your location.', tag: 'VOICE SOS' },
  { icon: Users, number: '02', title: 'Your people. Within reach.', text: 'Keep your trusted circle in one place. Secure response links let contacts tell you whether they can help.', tag: 'TRUSTED CIRCLE' },
  { icon: Route, number: '03', title: 'From here to home.', text: 'Follow your journey, check in when plans change, and stay connected to the people looking out for you.', tag: 'SAFETY JOURNEYS' },
];
export default function Landing({ onEnter, onSignIn }: { onEnter: () => void; onSignIn: () => void }) {
  return <div className="landing">
    <a className="landing-skip" href="#landing-content" onClick={e => { e.preventDefault(); document.getElementById('landing-content')?.focus(); }}>Skip to content</a>
    <nav className="landing-nav" aria-label="Website navigation">
      <a href="#home" className="landing-brand"><ShieldCheck /> suraksha<span>®</span></a>
      <div className="landing-nav-links"><a href="#why-suraksha" onClick={e => { e.preventDefault(); document.getElementById('why-suraksha')?.scrollIntoView({ behavior: 'smooth' }); }}>The idea</a><a href="#how-it-works" onClick={e => { e.preventDefault(); document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' }); }}>How it works</a></div>
      <Button className="landing-login" onClick={onSignIn}>Your workspace <ArrowUpRight /></Button>
    </nav>
    <main id="landing-content" tabIndex={-1}>
      <section className="landing-hero">
        <motion.div className="landing-hero-copy" initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .7 }}>
          <div className="landing-hero-meta"><p className="landing-eyebrow"><span /> SAFETY THAT STAYS WITH YOU.</p><span>01 / 04</span></div>
          <h1>Move freely.<br /><em>Stay connected.</em></h1>
          <p className="landing-intro">Suraksha brings voice-led alerts, live journeys, and the people you trust into one calm, private safety space.</p>
          <div className="landing-hero-actions"><Button onClick={onSignIn}>Open your workspace <ArrowUpRight /></Button><button onClick={onEnter} className="landing-text-button">Explore the demo <MoveUpRight size={17} /></button></div>
          <div className="landing-trust-row" aria-label="Suraksha highlights">
            <span><Mic size={15} /><strong>Voice-led</strong><small>SOS monitoring</small></span>
            <span><MapPin size={15} /><strong>Location-aware</strong><small>Safety journeys</small></span>
            <span><Users size={15} /><strong>People-first</strong><small>Trusted contacts</small></span>
          </div>
        </motion.div>
        <motion.div className="landing-art" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 1 }}>
          <div className="landing-art-top"><span>YOUR SAFETY NETWORK</span><span>LIVE / READY</span></div>
          <div className="landing-art-status"><Radio size={13} /><span>Connection active</span></div>
          <SafetyOrbit />
          <div className="landing-art-card"><span><Users size={17} /></span><div><small>TRUSTED CIRCLE</small><strong>Your people stay within reach.</strong></div></div>
          <div className="landing-art-caption"><span>One signal.<br /><strong>A circle of support.</strong></span><span className="landing-coordinate">22.57° N<br />88.36° E<br /><small>CONNECTED SPACE</small></span></div>
        </motion.div>
      </section>
      <div className="landing-strip"><span>Built around real life</span><span><b>01</b> Voice-led alerts</span><span><b>02</b> People you trust</span><span><b>03</b> Thoughtful follow-ups</span><ArrowDown size={20} /></div>
      <section className="landing-features" id="why-suraksha">
        <div className="landing-section-heading"><p className="landing-eyebrow">01 / A LITTLE MORE CONFIDENCE</p><h2>Life moves.<br /><em>Your circle moves with you.</em></h2><p>Safety is personal. Staying connected should feel that way too.</p></div>
        <div className="landing-feature-grid">{features.map(({ icon: Icon, number, title, text, tag }, i) => <motion.article key={number} initial={{ opacity: 0, y: 25 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: .2 }} transition={{ duration: .5, delay: i * .09 }}><div className="landing-feature-top"><Icon strokeWidth={1.4} /><span>{number}</span></div><p className="landing-eyebrow">{tag}</p><h3>{title}</h3><p>{text}</p><button onClick={onEnter} aria-label={`Explore ${tag.toLowerCase()}`}><ArrowUpRight /></button></motion.article>)}</div>
      </section>
      <section className="landing-process" id="how-it-works"><div><p className="landing-eyebrow">02 / SIMPLE BY DESIGN</p><h2>A little preparation.<br /><em>A meaningful connection.</em></h2><Button onClick={onEnter}>See it in action <ArrowUpRight /></Button></div><ol>{[['Build your circle', 'Add the people you would want to hear from when it matters.'], ['Choose how you connect', 'Turn on voice monitoring or start a safety journey when you need it.'], ['Keep each other in the loop', 'Follow responses, review updates, and close your SOS when you are safe.']].map(([title, description], i) => <li key={title}><span>0{i + 1}</span><div><h3>{title}</h3><p>{description}</p></div></li>)}</ol></section>
      <section className="landing-end"><p className="landing-eyebrow">GO LIVE YOUR LIFE.</p><h2>We all need<br /><em>our people.</em></h2><Button onClick={onSignIn}>Keep yours close <ArrowUpRight /></Button><p>Suraksha supports connection. In immediate danger, call <a href="tel:112">112</a>.</p></section>
    </main>
    <footer className="landing-footer"><a href="#home" className="landing-brand"><ShieldCheck /> suraksha<span>®</span></a><span>Your safety, connected.</span><button onClick={onEnter}>Open workspace <ArrowUpRight size={16} /></button></footer>
  </div>;
}
