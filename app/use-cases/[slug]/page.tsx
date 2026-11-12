import Link from 'next/link';
import Image from '@/components/consistent-image';
import {notFound} from 'next/navigation';
import type {Metadata} from 'next';
import {ArrowUpRight} from 'lucide-react';
import {PublicLayout} from '@/components/public-layout';
import {BookingButton} from '@/components/booking';
import {TestimonialsSection} from '@/components/testimonials-section';
import {jsonLd, safeContent, text} from '@/lib/site';
import {fetchUseCase, fetchUseCases} from '@/lib/use-cases';
import '@/components/use-cases-view.css';
import {FigmaPageView} from '@/components/figma-page/figma-page-view';
import {figmaPageFor} from '@/lib/figma-pages';

export const revalidate = 60;

type Props = {params: Promise<{slug: string}>};

export async function generateMetadata({params}: Props): Promise<Metadata> {
  const {slug} = await params;
  const figma = figmaPageFor('/use-cases/' + slug + '/');
  if (figma) return {title: {absolute: figma.title + ' | Workspace Junction'}, description: figma.description, alternates: {canonical: '/use-cases/' + slug + '/'}, openGraph: {title: figma.title, description: figma.description, type: 'website'}};
  const item = await fetchUseCase(slug);
  if (!item) return {title: 'Use case not found', robots: {index: false}};
  const description = item.description || ('How ' + item.title.toLowerCase() + ' work at Workspace Junction in Oakbrook Terrace.');
  return {
    title: {absolute: item.title + ' | Workspace Junction'},
    description: description.slice(0, 160),
    alternates: {canonical: '/use-cases/' + item.slug + '/'},
    openGraph: {title: item.title, description: description.slice(0, 160), images: item.image ? [item.image] : [], type: 'article'},
  };
}

export default async function UseCaseDetailPage({params}: Props) {
  const {slug} = await params;
  /* Industry pages redesigned in Figma render from lib/figma-pages; other use cases stay CMS-driven. */
  const figma = figmaPageFor('/use-cases/' + slug + '/');
  if (figma) return <PublicLayout><FigmaPageView page={figma} /></PublicLayout>;
  const item = await fetchUseCase(slug);
  if (!item) notFound();

  const {items} = await fetchUseCases();
  const more = items.filter(other => other.slug !== item.slug).slice(0, 3);
  const body = safeContent(item.body);
  const crumbs = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {'@type': 'ListItem', position: 1, name: 'Home', item: 'https://workspacejunction.com/'},
      {'@type': 'ListItem', position: 2, name: 'Use cases', item: 'https://workspacejunction.com/use-cases/'},
      {'@type': 'ListItem', position: 3, name: text(item.title), item: 'https://workspacejunction.com/use-cases/' + item.slug + '/'},
    ],
  };

  return <PublicLayout>
    <main id="main" className="uc-page uc-detail">
      <div className="uc-wrap">
        <nav className="uc-crumb" aria-label="Breadcrumb">
          <Link href="/">Home</Link>
          <span aria-hidden="true">/</span>
          <Link href="/use-cases/">Use cases</Link>
          <span aria-hidden="true">/</span>
          <span aria-current="page">{item.title}</span>
        </nav>

        <header className="uc-detail-hero">
          <div>
            <span className="uc-eyebrow">{item.number} / USE CASE</span>
            <h1>{item.title}</h1>
          </div>
          <div>
            {item.description && <p className="uc-detail-lead">{item.description}</p>}
            <div className="uc-detail-actions">
              <BookingButton service={item.title} className="uc-button wj-button-yellow">
                Schedule a tour <ArrowUpRight size={18} aria-hidden="true"/>
              </BookingButton>
              {item.serviceHref && <Link className="uc-button wj-button-green" href={item.serviceHref}>
                Explore the matching service <ArrowUpRight size={17} aria-hidden="true"/>
              </Link>}
            </div>
          </div>
        </header>

        {item.image && <figure className="uc-feature uc-detail-feature">
          <Image src={item.image} alt={item.alt} width={1170} height={520} preload sizes="(max-width: 700px) 100vw, 1200px"/>
        </figure>}

        <section className="uc-detail-body" aria-label="About this use case">
          {body
            ? <div className="uc-prose" dangerouslySetInnerHTML={{__html: body}}/>
            : <div className="uc-prose">
                <p>{item.description || 'Tell us how you work and our team will match you with the right space, setup and services at Workspace Junction.'}</p>
                <p>Flexible desks, private offices, bookable meeting rooms, studios and business support sit under one roof in Oakbrook Terrace, so you can scale up or down without changing address.</p>
              </div>}
          <aside className="uc-detail-aside">
            <h2>What you get</h2>
            <ul>
              <li>Flexible terms with no long-term commitment</li>
              <li>Meeting rooms, studios and event space on demand</li>
              <li>Business address, mail handling and concierge support</li>
              <li>24/7 access in Oakbrook Terrace / Lombard / Villa Park</li>
            </ul>
            <Link className="uc-link" href="/contact-us/">Talk to our team <ArrowUpRight size={17} aria-hidden="true"/></Link>
          </aside>
        </section>

        {more.length > 0 && <section className="uc-section uc-detail-more" aria-labelledby="uc-more-title">
          <div className="uc-intro">
            <span className="uc-eyebrow">KEEP EXPLORING</span>
            <h2 id="uc-more-title">More ways people use the Junction.</h2>
            <p>Every use case shares the same flexible space and support, shaped around a different way of working.</p>
          </div>
          <div className="uc-grid">
            {more.map(other => (
              <article className="uc-card" key={other.id}>
                {other.image && <Link href={other.href} className="uc-card-image">
                  <Image src={other.image} alt={other.alt} width={600} height={390} sizes="(max-width: 700px) 100vw, 50vw"/>
                </Link>}
                <div className="uc-card-copy">
                  <span className="uc-eyebrow">{other.number} / USE CASE</span>
                  <h3><Link href={other.href}>{other.title}</Link></h3>
                  {other.description && <p>{other.description}</p>}
                  <Link className="uc-link" href={other.href}>Explore this use case <ArrowUpRight size={17} aria-hidden="true"/></Link>
                </div>
              </article>
            ))}
          </div>
        </section>}
      </div>

      <TestimonialsSection slug="use-cases"/>

      <div className="uc-wrap">
        <section className="uc-closing" aria-labelledby="uc-detail-closing">
          <span className="uc-eyebrow">YOUR NEXT CHAPTER STARTS HERE</span>
          <h2 id="uc-detail-closing">Let&rsquo;s find the right workspace<br/>package for your goals.</h2>
          <p>Tell us what you need. We will help you find the right space, setup, and services.</p>
          <div className="uc-closing-actions">
            <BookingButton service={item.title} className="uc-button wj-button-yellow">
              Schedule a Consultation <ArrowUpRight size={18} aria-hidden="true"/>
            </BookingButton>
            <Link href="/contact-us/" className="uc-button wj-button-green">
              Talk to Our Team <ArrowUpRight size={17} aria-hidden="true"/>
            </Link>
          </div>
        </section>
      </div>
    </main>
    <script type="application/ld+json" dangerouslySetInnerHTML={{__html: jsonLd(crumbs)}}/>
  </PublicLayout>;
}
