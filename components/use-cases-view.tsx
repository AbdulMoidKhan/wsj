import Link from 'next/link';
import Image from '@/components/consistent-image';
import {Suspense} from 'react';
import {ArrowUpRight} from 'lucide-react';
import {BookingButton} from '@/components/booking';
import {TestimonialsSection} from '@/components/testimonials-section';
import {fetchUseCases, type UseCase} from '@/lib/use-cases';
import './use-cases-view.css';

/** Placeholder while published use cases are fetched from the content API. */
function UseCasesSkeleton(){
  return (
    <div className="uc-grid" aria-hidden="true">
      {[0,1,2,3].map(key=>(
        <article className="uc-card uc-card-skeleton" key={key}>
          <span className="uc-skeleton uc-skeleton-image"/>
          <div className="uc-card-copy">
            <span className="uc-skeleton uc-skeleton-line uc-skeleton-eyebrow"/>
            <span className="uc-skeleton uc-skeleton-line uc-skeleton-title"/>
            <span className="uc-skeleton uc-skeleton-line"/>
            <span className="uc-skeleton uc-skeleton-line uc-skeleton-short"/>
          </div>
        </article>
      ))}
    </div>
  );
}

function UseCaseCard({item}:{item:UseCase}){
  return (
    <article className="uc-card" data-tilt="5">
      {item.image&&<Link href={item.href} className="uc-card-image" data-anim="mask-reveal">
        <Image src={item.image} alt={item.alt} width={600} height={390} sizes="(max-width: 700px) 100vw, 50vw"/>
      </Link>}
      <div className="uc-card-copy">
        <span className="uc-eyebrow">{item.number} / USE CASE</span>
        <h3><Link href={item.href}>{item.title}</Link></h3>
        {item.description&&<p>{item.description}</p>}
        <Link className="uc-link" href={item.href}>
          Explore this use case <ArrowUpRight size={17}/>
        </Link>
      </div>
    </article>
  );
}

/** Published records from /api/public/use-cases, in the order set in the admin studio. */
async function UseCasesGrid(){
  const {items}=await fetchUseCases();
  if(items.length===0)return (
    <div className="uc-empty" role="status">
      <h3>New use cases are on the way.</h3>
      <p>We are preparing the stories of how teams use the Junction. In the meantime, tell us what you need and our team will point you to the right space.</p>
      <Link className="uc-link" href="/contact-us/">Talk to our team <ArrowUpRight size={17}/></Link>
    </div>
  );
  return <div className="uc-grid" data-anim-stagger-group="true" data-anim-stagger="0.06">{items.map(item=><UseCaseCard key={item.id} item={item}/>)}</div>;
}

export function UseCasesView(){
  return (
    <main id="main" className="uc-page">
      <div className="uc-wrap">
        <nav className="uc-crumb" aria-label="Breadcrumb">
          <Link href="/">Home</Link>
          <span>/</span>
          <span aria-current="page">Use cases</span>
        </nav>
        <header className="uc-hero">
          <div>
            <span className="uc-eyebrow" data-anim="fade-up">MADE FOR THE WAY YOU WORK</span>
            <h1 data-anim="split-lines">One space.<br/><em>Many possibilities.</em></h1>
          </div>
          <div data-anim="fade-up" data-anim-delay="0.15">
            <p>Whether you are building a business, making something new, or bringing a team together, find a place and the support that fit your next move.</p>
            <Link className="uc-button wj-button-yellow" href="#explore-cases" data-magnetic="0.25">
              Explore use cases <ArrowUpRight size={18}/>
            </Link>
          </div>
        </header>
        <figure className="uc-feature" data-parallax="0.08" data-lag="0.1" data-skew="true">
          <Image src="/media/af55bc8a2b-image-17-1.png" alt="Flexible shared workspace at Workspace Junction" width={1170} height={406} priority sizes="(max-width: 700px) 100vw, 1200px"/>
        </figure>
        <section id="explore-cases" className="uc-section" aria-labelledby="uc-title">
          <div className="uc-intro" data-anim="fade-up">
            <span className="uc-eyebrow">FIND YOUR FIT</span>
            <h2 id="uc-title" data-anim="split-lines">Built around what you do.</h2>
            <p>Explore the ways our workspace, studios and business services can support you.</p>
          </div>
          <Suspense fallback={<UseCasesSkeleton/>}>
            <UseCasesGrid/>
          </Suspense>
        </section>
      </div>

      {/* Testimonials */}
      <TestimonialsSection slug="use-cases" />

      {/* Closing CTA */}
      <div className="uc-wrap">
        <section className="uc-closing" aria-labelledby="uc-closing-title" data-anim="fade-up">
          <span className="uc-eyebrow">YOUR NEXT CHAPTER STARTS HERE</span>
          <h2 id="uc-closing-title" data-anim="split-lines">
            Let’s find the right workspace<br />
            package for your goals.
          </h2>
          <p>
            Tell us what you need. We will help you find the right space, setup, and services.
          </p>
          <div className="uc-closing-actions">
            <BookingButton service="Use Cases Consultation" className="uc-button wj-button-yellow" data-magnetic="0.25">
              Schedule a Consultation <ArrowUpRight size={18} aria-hidden="true" />
            </BookingButton>
            <Link href="/contact-us/" className="uc-button wj-button-green" data-magnetic="0.25">
              Talk to Our Team <ArrowUpRight size={17} aria-hidden="true" />
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
