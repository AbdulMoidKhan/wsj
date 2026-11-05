'use client';

import Image from '@/components/consistent-image';
import {useState} from 'react';
import {Camera} from 'lucide-react';

/*
  Art-Directed Architectural Gallery Showcase
  - Interactive filterable categories (All, Workspace, Studios, Meeting, Community)
  - Editorial masonry / asymmetric composition with luxury captions
  - Subtle hover zoom and frosted glass caption overlays
  - 100% authentic photography preserved
*/

type PhotoItem = {
  src: string;
  category: 'workspace' | 'meeting' | 'studios' | 'community';
  categoryLabel: string;
  label: string;
  room: string;
  alt: string;
  featured?: boolean;
};

const VENUE_COLLECTION: PhotoItem[] = [
  {
    src: '/media/3675f6dc28-slide-1.png',
    category: 'meeting',
    categoryLabel: 'Boardrooms',
    label: 'Executive Boardroom Suite',
    room: 'Room E1 • Up to 14 Seats • 4K Telepresence',
    alt: 'Executive boardroom table with conference presentation display',
    featured: true,
  },
  {
    src: '/media/0313d864c2-wj36.webp',
    category: 'workspace',
    categoryLabel: 'Coworking',
    label: 'Open Collaborative Workspace',
    room: 'Zone A • Sit/Stand Desks • Natural Light',
    alt: 'Shared workstations and ergonomic seating at Workspace Junction',
    featured: false,
  },
  {
    src: '/media/d101922042-podcast-banner.webp',
    category: 'studios',
    categoryLabel: 'Podcast Studio',
    label: 'Chicagoland Broadcast Studio',
    room: 'Studio 1 • Multi-Cam 4K • Acoustic Isolation',
    alt: 'Podcast recording table with professional microphones and studio lighting',
    featured: false,
  },
  {
    src: '/media/0d8f715bc8-Meeting-Rooms-1536x1024.jpg.webp',
    category: 'meeting',
    categoryLabel: 'Meeting Rooms',
    label: 'Strategy & Collaboration Suite',
    room: 'Room E2 • 8–10 Seats • Whiteboard Wall',
    alt: 'Conference room with executive chairs and video conference screen',
    featured: false,
  },
  {
    src: '/media/2b124bae06-Rectangle-5527.png',
    category: 'community',
    categoryLabel: 'Events Space',
    label: 'Main Presentation & Workshop Hall',
    room: 'Grand Hall • Up to 50 Guests • AV & Kitchen Access',
    alt: 'Audience seated in the Workspace Junction workshop venue',
    featured: true,
  },
  {
    src: '/media/e765b41151-wj34.webp',
    category: 'workspace',
    categoryLabel: 'Dedicated Desks',
    label: 'Dedicated Focus Workstations',
    room: 'Quiet Wing • Lockable Storage • Dual Monitors',
    alt: 'Dedicated desks with ergonomic monitor arms and storage',
    featured: false,
  },
  {
    src: '/media/ec32287da6-slide-2.png',
    category: 'studios',
    categoryLabel: 'Creator Studio',
    label: 'Two-Host Interview Studio',
    room: 'Studio 2 • Live Streaming • Shure SM7B Audio',
    alt: 'Two podcast hosts recording in the interview studio',
    featured: false,
  },
  {
    src: '/media/8c1d7fc86a-1-3.png',
    category: 'studios',
    categoryLabel: 'Photo Studio',
    label: 'Professional Photography Studio',
    room: 'Studio 3 • Cyclorama & Seamless Backdrops • Softbox Lighting',
    alt: 'Photo studio setup with lighting rigs and backdrops',
    featured: false,
  },
  {
    src: '/media/085206a488-Rectangle-5668.png',
    category: 'community',
    categoryLabel: 'Lounge',
    label: 'Member Networking Lounge',
    room: 'Central Atrium • Espresso Bar • Fireside Seating',
    alt: 'Professionals networking in the Workspace Junction lounge',
    featured: false,
  },
  {
    src: '/media/039e4b8f9e-Business-Address-2048x975.jpg',
    category: 'workspace',
    categoryLabel: 'Reception',
    label: 'Executive Welcome Reception & Lobby',
    room: 'Entrance • Concierge & Mail Center • Guest Check-in',
    alt: 'Modern entrance and reception desk at Workspace Junction',
    featured: false,
  },
];

const CATEGORIES = [
  {id: 'all', label: 'All Spaces'},
  {id: 'workspace', label: 'Coworking & Desks'},
  {id: 'meeting', label: 'Meeting Rooms & Boardrooms'},
  {id: 'studios', label: 'Podcast & Media Studios'},
  {id: 'community', label: 'Event Spaces & Lounges'},
] as const;

export function VenueGallery({images}: {images?: string[]}) {
  const [activeCategory, setActiveCategory] = useState<string>('all');

  const customItems: PhotoItem[] = (images || [])
    .filter(src => /^\/(?:media|uploads)\//.test(src) && /\.(?:webp|avif|jpe?g|png)(?:\?|$)/i.test(src))
    .map((src, i) => ({
      src,
      category: 'workspace' as const,
      categoryLabel: 'Workspace',
      label: 'The Junction Space ' + String(i + 1).padStart(2, '0'),
      room: 'Workspace Suite',
      alt: 'Workspace Junction space image ' + (i + 1),
      featured: i === 0,
    }));

  const collection = customItems.length ? customItems : VENUE_COLLECTION;

  const filtered = activeCategory === 'all'
    ? collection
    : collection.filter(p => p.category === activeCategory);

  return (
    <section className="ip-wrap ip-gallery vg-showcase" aria-labelledby="ip-gallery-title">
      <div className="ip-section-heading vg-head">
        <div>
          <p className="ip-eyebrow" data-anim="fade-up">
            <Camera size={13} aria-hidden="true" />
            <span>ARCHITECTURAL PHOTOGRAPHY &amp; SPACES</span>
          </p>
          <h2 id="ip-gallery-title" data-anim="split-lines">Take an Inside Look at The Junction.</h2>
        </div>
        <p className="vg-intro" data-anim="fade-up" data-anim-delay="0.1">
          Tour our executive boardrooms, dedicated creator podcast studios, ergonomic sit-stand workstations, and dynamic gathering spaces in Oakbrook Terrace, IL.
        </p>
      </div>

      {/* Filter Tabs */}
      <div className="vg-filters" role="tablist" aria-label="Filter gallery by space type" data-anim="fade-up" data-anim-delay="0.15">
        {CATEGORIES.map(cat => (
          <button
            key={cat.id}
            type="button"
            role="tab"
            aria-selected={activeCategory === cat.id}
            onClick={() => setActiveCategory(cat.id)}
            className={'vg-filter-btn' + (activeCategory === cat.id ? ' is-active' : '')}
          >
            <span>{cat.label}</span>
          </button>
        ))}
      </div>

      {/* Asymmetric Gallery Grid */}
      <div className="ip-gallery-grid vg-grid" data-anim-stagger-group="true" data-anim-stagger="0.05">
        {filtered.map((photo, i) => (
          <figure
            key={photo.src}
            className={'vg-card' + (photo.featured ? ' is-featured' : '')}
            style={{animationDelay: `${i * 0.08}s`}}
            data-tilt="4"
          >
            <div className="vg-photo-frame" data-anim="mask-reveal">
              <Image
                src={photo.src}
                alt={photo.alt}
                fill
                sizes={photo.featured ? '(max-width: 900px) 100vw, 66vw' : '(max-width: 900px) 100vw, 33vw'}
                className="vg-photo"
              />
              <div className="vg-overlay" />
              <div className="vg-card-pill">
                <span>{photo.categoryLabel}</span>
              </div>
            </div>

            <figcaption className="vg-caption">
              <div className="vg-caption-info">
                <h3>{photo.label}</h3>
                <p>{photo.room}</p>
              </div>
              <span className="vg-counter" aria-hidden="true">
                0{i + 1}
              </span>
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}
