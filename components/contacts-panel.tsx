'use client';
import { useState } from 'react';
import { Plus, Users, Phone, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useApp, api } from './app-provider';
import { Field, Confirm, Empty, Status } from './shared';
export default function Contacts() {
  const { contacts, setContacts, demo, refresh, notify } = useApp();
  const [adding, setAdding] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  return (
    <>
      <div className="section-heading">
        <div>
          <h2>
            Your trusted circle <span className="count">{contacts.length}</span>
          </h2>
          <p>Active contacts receive SMS alerts when distress is detected.</p>
        </div>
        <Button onClick={() => setAdding(!adding)}>
          <Plus /> {adding ? 'Close form' : 'Add contact'}
        </Button>
      </div>
      {adding && (
        <form
          className="card form-grid"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError('');
            const form = new FormData(e.currentTarget),
              body = {
                contacts: form.get('contacts') as string,
                contactNumber: form.get('contactNumber') as string,
                via: 'SMS',
              };
            try {
              if (demo)
                setContacts((items) => [
                  ...items,
                  { ...body, _id: crypto.randomUUID(), isActive: true },
                ]);
              else {
                await api('/contact/create', { method: 'POST', body });
                await refresh();
              }
              setAdding(false);
              notify(
                demo
                  ? 'Demo contact added. Nothing was saved to the backend.'
                  : 'Contact added.',
              );
            } catch (err) {
              setError((err as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <Field label="Relationship">
            <select name="contacts">
              {[
                'Family',
                'Father',
                'Mother',
                'Brother',
                'Sister',
                'Local Police Station',
                'Other Contacts',
              ].map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </Field>
          <Field label="Indian mobile number (10 digits)">
            <Input
              name="contactNumber"
              type="tel"
              pattern="[6-9][0-9]{9}"
              inputMode="numeric"
              maxLength={10}
              required
              placeholder="Enter mobile number"
            />
          </Field>
          <div className="full">
            <p className="fine">
              Delivery channel: SMS. Use a consenting contact&apos;s mobile
              number.
            </p>
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
            <Button type="submit" disabled={busy}>
              {busy ? 'Saving...' : demo ? 'Add demo contact' : 'Save contact'}
            </Button>
          </div>
        </form>
      )}
      {contacts.length === 0 ? (
        <div className="card">
          <Empty
            title="Your circle starts with one person."
            text="Add a trusted contact before preparing your first SOS."
          />
        </div>
      ) : (
        <div className="contact-grid">
          {contacts.map((c) => (
            <article className="card contact-card" key={c._id}>
              <div className="section-heading">
                <span className="contact-avatar">
                  <Users />
                </span>
                <Status value={c.isActive ? 'active' : 'paused'} />
              </div>
              <h2>{c.contacts}</h2>
              <p>
                <Phone size={13} /> {c.contactNumber}
              </p>
              <div className="contact-channel">
                SMS alerts{' '}
                <span>
                  {c.isActive
                    ? 'Included in your safety circle'
                    : 'Alerts paused'}
                </span>
              </div>
              <div className="actions">
                <Button
                  variant="outline"
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    try {
                      if (demo)
                        setContacts((items) =>
                          items.map((x) =>
                            x._id === c._id
                              ? { ...x, isActive: !x.isActive }
                              : x,
                          ),
                        );
                      else {
                        await api(`/contact/toggle/${c._id}`, {
                          method: 'PATCH',
                        });
                        await refresh();
                      }
                    } catch (e) {
                      notify((e as Error).message);
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  {c.isActive ? 'Pause alerts' : 'Activate alerts'}
                </Button>
                <Confirm
                  title="Remove this contact?"
                  description={`${c.contacts} will no longer receive new SOS alerts from your account.`}
                  label="Remove contact"
                  onConfirm={async () => {
                    if (demo)
                      setContacts((items) =>
                        items.filter((x) => x._id !== c._id),
                      );
                    else {
                      await api(`/contact/delete/${c._id}`, {
                        method: 'DELETE',
                      });
                      await refresh();
                    }
                  }}
                >
                  <Trash2 /> Remove
                </Confirm>
              </div>
            </article>
          ))}
        </div>
      )}
    </>
  );
}
