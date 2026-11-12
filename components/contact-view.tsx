import Image from '@/components/consistent-image';
import Link from 'next/link';
import {ArrowUpRight, Mail, MapPin, MessageSquare, Phone, Send} from 'lucide-react';
import {InquiryForm} from '@/components/lazy-client';
import {address, loadBusiness} from '@/lib/site';
// Contact-only sheet (scoped to #main.figma-contact); kept off other routes.
import '@/app/contact-page.css';

/* Contact page built from the Figma frame "REDESIGN / Contact Us — Homepage Style" (node 6157:2031).
   The form is the shared InquiryForm, so every message is stored through POST /api/inquiries and
   appears under Lead inquiries in the admin portal. No contact detail is written here twice: the
   address, phone and email come from the business settings. */
export async function ContactView() {
  const business = await loadBusiness();
  const directions = 'https://maps.google.com/?q=' + encodeURIComponent(business.address || address);

  return (
    <main id="main" className="figma-contact">
      <section className="fc-hero" aria-labelledby="fc-title">
        <div className="fc-shell">
          <nav className="fc-crumbs" aria-label="Breadcrumb">
            <Link href="/">Home</Link>
            <span aria-hidden="true">/</span>
            <span aria-current="page">Contact us</span>
          </nav>
          <div className="fc-hero-grid">
            <div>
              <p className="fc-eyebrow fc-eyebrow-amber">LET&rsquo;S CONNECT</p>
              <h1 id="fc-title" className="fc-display">
                A conversation.
                <br />A new possibility.
              </h1>
            </div>
            <div className="fc-hero-side">
              <span className="fc-chip" aria-hidden="true"><MessageSquare size={20} /></span>
              <p>
                Looking for your next workspace, planning an event, or ready to create something?
                Tell us what you have in mind. We&rsquo;d love to hear from you.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="fc-details" aria-labelledby="fc-details-title">
        <div className="fc-shell">
          <div className="fc-section-head">
            <div>
              <p className="fc-eyebrow">YOUR NEXT CHAPTER STARTS HERE</p>
              <h2 id="fc-details-title" className="fc-heading">Come say hello.</h2>
            </div>
            <p className="fc-lead">
              Find us in Oakbrook Terrace, Illinois. Reach out about a tour, membership, studio
              session, or service quote.
            </p>
          </div>
          <div className="fc-cards">
            <article className="fc-card">
              <span className="fc-chip" aria-hidden="true"><MapPin size={20} /></span>
              <h3>Visit the Junction</h3>
              <p>{business.address || address}</p>
              <a href={directions} target="_blank" rel="noreferrer" className="fc-link">
                Get directions <ArrowUpRight size={15} aria-hidden="true" />
              </a>
            </article>
            <article className="fc-card">
              <span className="fc-chip" aria-hidden="true"><Phone size={20} /></span>
              <h3>Give us a call</h3>
              <p>{business.phone}</p>
              <a href={'tel:' + business.phoneHref} className="fc-link">
                Call our team <ArrowUpRight size={15} aria-hidden="true" />
              </a>
            </article>
            <article className="fc-card">
              <span className="fc-chip" aria-hidden="true"><Mail size={20} /></span>
              <h3>Send an email</h3>
              <p>{business.email}</p>
              <a href={'mailto:' + business.email} className="fc-link">
                Send an email <ArrowUpRight size={15} aria-hidden="true" />
              </a>
            </article>
          </div>
        </div>
      </section>

      <section className="fc-message" aria-labelledby="fc-form-title">
        <div className="fc-shell fc-message-grid">
          <div className="fc-gallery">
            <figure className="fc-photo">
              <Image src="/media/figma-contact/lounge.webp" alt="Lounge seating in the Workspace Junction community area" fill sizes="(max-width: 900px) 100vw, 480px" className="fc-cover" />
            </figure>
            <figure className="fc-photo">
              <Image src="/media/figma-contact/boardroom.webp" alt="A private meeting room with a wall display" fill sizes="(max-width: 900px) 100vw, 480px" className="fc-cover" />
            </figure>
            <p className="fc-gallery-note">
              <span>A LITTLE INSPIRATION FIRST?</span>
              <Link href="/gallery/" className="fc-link">Take a look around <ArrowUpRight size={15} aria-hidden="true" /></Link>
            </p>
          </div>

          <div className="fc-form-card">
            <span className="fc-chip fc-chip-light" aria-hidden="true"><Send size={18} /></span>
            <p className="fc-eyebrow">TELL US WHAT&rsquo;S NEXT</p>
            <h2 id="fc-form-title" className="fc-heading">Send us a message.</h2>
            <p className="fc-lead">Share your plans below. We aim to respond within 1&ndash;2 business days.</p>
            <InquiryForm />
          </div>
        </div>
      </section>

      <section className="fc-place" aria-labelledby="fc-place-title">
        <div className="fc-shell fc-place-grid">
          <figure className="fc-photo fc-photo-wide">
            <Image src="/media/figma-contact/reception.webp" alt="Members reading in the Workspace Junction reception area" fill sizes="(max-width: 900px) 100vw, 640px" className="fc-cover" />
          </figure>
          <div className="fc-place-copy">
            <p className="fc-pin"><MapPin size={16} aria-hidden="true" /> OAKBROOK TERRACE, ILLINOIS</p>
            <h2 id="fc-place-title" className="fc-display fc-display-ink">
              A place to work.
              <br />A place to belong.
            </h2>
            <a href={directions} target="_blank" rel="noreferrer" className="fc-btn">
              Find your way here <ArrowUpRight size={16} aria-hidden="true" />
            </a>
          </div>
        </div>
      </section>

    </main>
  );
}
