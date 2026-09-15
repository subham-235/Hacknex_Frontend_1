'use client';
import { ShieldCheck, Users, Mic, Bot, ArrowUpRight } from 'lucide-react';
import { ContainerScroll } from '@/components/ui/container-scroll-animation';
import { Button } from '@/components/ui/button';

export function HeroScrollDemo({
  onNavigate,
}: {
  onNavigate: (view: string) => void;
}) {
  return (
    <section aria-labelledby="scroll-preview-title" className="safety-scroll">
      <ContainerScroll
        titleComponent={
          <>
            <p className="eyebrow">MADE FOR YOUR EVERYDAY</p>
            <h2 id="scroll-preview-title">
              A little preparation.
              <br />
              <span>A lot more peace of mind.</span>
            </h2>
          </>
        }
      >
        <div className="connection-preview">
          <div className="connection-heading">
            <ShieldCheck />
            <span>YOUR SAFETY, CONNECTED</span>
          </div>
          <h3>
            One circle.
            <br />
            So many ways to care.
          </h3>
          <div className="connection-steps">
            {[
              {
                Icon: Users,
                label: 'Your people',
                text: 'Choose the contacts you trust.',
                view: 'Trusted contacts',
              },
              {
                Icon: Mic,
                label: 'Your voice',
                text: 'Review and activate voice guard.',
                view: 'Emergency SOS',
              },
              {
                Icon: Bot,
                label: 'Your next step',
                text: 'Stay in control of follow-ups.',
                view: 'Safety agent',
              },
            ].map(({ Icon, label, text, view }) => (
              <button key={label} onClick={() => onNavigate(view)}>
                <Icon />
                <strong>{label}</strong>
                <span>{text}</span>
                <ArrowUpRight size={15} />
              </button>
            ))}
          </div>
          <Button onClick={() => onNavigate('Trusted contacts')}>
            Build your safety circle <ArrowUpRight />
          </Button>
        </div>
      </ContainerScroll>
    </section>
  );
}
