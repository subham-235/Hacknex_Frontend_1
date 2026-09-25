'use client';
import { useState, type ReactNode } from 'react';
import { ArrowUpRight, ShieldCheck, Users, Fingerprint } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { api, useApp } from './app-provider';
import { SafetyOrbit } from './safety-orbit';
import { usePageVisible } from './workspace-pages';
export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}
export function Status({ value }: { value: string }) {
  return (
    <span className={`status status-${value}`}>
      {value.replaceAll('_', ' ')}
    </span>
  );
}
export function Empty({ title, text }: { title: string; text: string }) {
  return (
    <div className="empty">
      <h2>{title}</h2>
      <p>{text}</p>
    </div>
  );
}
export function Confirm({
  title,
  description,
  label = 'Confirm',
  onConfirm,
  children,
}: {
  title: string;
  description: string;
  label?: string;
  onConfirm: () => Promise<void>;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const visible = usePageVisible();
  return (
    <>
      <Button
        variant="outline"
        onClick={() => {
          setOpen(true);
          setError('');
        }}
      >
        {children}
      </Button>
      <Dialog
        open={open && visible}
        onOpenChange={(value) => {
          if (!busy) setOpen(value);
        }}
      >
        <DialogContent showCloseButton={!busy}>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <div className="actions">
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await onConfirm();
                  setOpen(false);
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              {busy ? 'Working...' : label}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
export function Auth() {
  const { signIn, setDemo } = useApp();
  const [register, setRegister] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  return (
    <section className="auth-grid auth-editorial">
      <div className="auth-story">
        <div className="auth-story-top"><ShieldCheck size={25} /><span>YOUR EVERYDAY SAFETY COMPANION</span><span>01 /</span></div>
        <h2>
          Go a little
          <br />
          further.<br /><em>Stay a little<br />closer.</em>
        </h2>
        <p>
          Your people, your journeys, your peace of mind.
          One space to keep it all connected.
        </p>
        <SafetyOrbit />
        <div className="auth-story-bottom"><Users size={19} /><span>Built around the people<br /><strong>who have your back.</strong></span><span className="auth-story-arrow">↗</span></div>
      </div>
      <form
        className="card auth-form"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError('');
          const form = new FormData(e.currentTarget);
          try {
            const data = await api(
              register ? '/user/register' : '/user/login',
              { method: 'POST', body: Object.fromEntries(form) },
            );
            signIn(data.user);
          } catch (err) {
            setError((err as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="auth-form-mark"><Fingerprint size={27} /><span>YOUR PERSONAL SPACE</span></div>
        <p className="eyebrow">{register ? 'A GOOD PLACE TO BEGIN' : 'GOOD TO HAVE YOU HERE'}</p>
        <h2>{register ? 'Your circle starts here.' : 'Make yourself at home.'}</h2>
        <p>
          {register
            ? 'Start with your account details.'
            : 'Sign in and pick up right where you left off.'}
        </p>
        {register && (
          <Field label="Full name">
            <Input
              name="fullName"
              required
              minLength={3}
              maxLength={25}
              autoComplete="name"
            />
          </Field>
        )}
        <Field label="Email address">
          <Input name="emailId" type="email" placeholder="you@example.com" required autoComplete="email" />
        </Field>
        <Field label="Password">
          <Input
            name="password"
            type="password"
            placeholder={register ? 'Create a strong password' : 'Enter your password'}
            required
            minLength={register ? 8 : 1}
            autoComplete={register ? 'new-password' : 'current-password'}
          />
        </Field>
        {register && (
          <p className="fine">
            Use at least 8 characters, including uppercase, lowercase, a number,
            and a symbol.
          </p>
        )}
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <Button type="submit" disabled={busy}>
          {busy ? 'Connecting...' : register ? 'Create account' : 'Sign in'}
          <ArrowUpRight size={18} />
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => {
            setRegister(!register);
            setError('');
          }}
        >
          {register
            ? 'Already have an account? Sign in'
            : 'New here? Create an account'}
        </Button>
        <div className="auth-alternative"><span />OR TAKE A LOOK AROUND<span /></div>
        <Button type="button" variant="outline" onClick={() => setDemo(true)}>
          Explore the demo <ArrowUpRight size={16} />
        </Button>
        <p className="fine">
          Take a look around with sample data. No alerts are sent.
        </p>
      </form>
    </section>
  );
}
