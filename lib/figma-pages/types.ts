/* Content model for the "REDESIGN / … — Homepage Style" pages of the Figma file
   qjuAqpLbKBpRwAg5ZP3Q8R. Each page is a list of sections; components/figma-page
   renders them. Prices are never written here as numbers: a PriceRef points at the
   catalog / approved pricing record that owns the amount. */

export type IconName =
  | 'armchair' | 'wifi' | 'coffee' | 'users' | 'monitor' | 'clock' | 'shield-check' | 'mail'
  | 'presentation' | 'calendar-check' | 'map-pin' | 'lock-keyhole' | 'arrow-up-right' | 'mic'
  | 'camera' | 'headphones' | 'package' | 'send' | 'bell' | 'scan-line' | 'book-open'
  | 'handshake' | 'globe' | 'laptop' | 'printer' | 'briefcase-business' | 'scale' | 'megaphone'
  | 'chart-no-axes-combined' | 'palette' | 'code-xml' | 'workflow' | 'newspaper'
  | 'graduation-cap' | 'file-check' | 'pen-tool';

export interface Img { src: string; alt: string }

/** href: a link. book: opens the booking dialog for that service. */
export interface Action { label: string; href?: string; book?: string; plan?: string }

export interface Item { icon?: IconName; image?: Img; title: string; text?: string; href?: string; tag?: string; meta?: string; action?: Action }

/** Points at the record that owns a price. `plan` matches a catalog plan / approved
 *  record by name; `period` narrows approved records (e.g. "half day"). */
export interface PriceRef { service: string; plan: string; period?: string }

export type Bg = 'cream' | 'white' | 'sage';

interface Head { id?: string; eyebrow?: string; title: string; lead?: string; bg?: Bg }

export interface HeroSection extends Head {
  kind: 'hero';
  chips?: { icon: IconName; label: string }[];
  actions: Action[];
  image: Img;
  /** text under the divider; `price` renders "<prefix><amount><suffix>" from the catalog. */
  strip?: { text?: string; price?: PriceRef; prefix?: string; suffix?: string };
  crumbs?: string;
  size?: 'xl' | 'lg' | 'md';
}

/** Photo + copy split (04 / What is …). */
export interface IntroSection extends Head { kind: 'intro'; icon?: IconName; image: Img; imageSide: 'left' | 'right'; checks: string[] }

/** Copy + sage highlight list (04 / About …). */
export interface AboutSection extends Head { kind: 'about'; icon: IconName; highlights: Item[] }

export interface GridSection extends Head {
  kind: 'grid';
  cols: 2 | 3 | 4;
  /** card: white card with icon badge; photo: photo card; value: numbered card. */
  variant: 'card' | 'photo' | 'value';
  /** heading and lead side by side (homepage style) instead of stacked */
  split?: boolean;
  items: Item[];
  tiles?: Item[];
}

/** Two images render 740/484 wide; `smallFirst` puts the 484 image first. */
export interface GallerySection extends Head { kind: 'gallery'; images: Img[]; captions?: Item[]; wide?: boolean; smallFirst?: boolean }

export interface MediaSection extends Head { kind: 'media'; image: Img; imageSide: 'left' | 'right'; items: Item[] }

export interface ChecksSection extends Head { kind: 'checks'; items: Item[] }

export interface BandSection extends Head { kind: 'band'; heading: string; text: string; note?: string; action?: Action }

export interface StorySection extends Head { kind: 'story'; body: string[]; image: Img }

export interface BannerSection extends Head { kind: 'banner'; image: Img; action: Action }

export interface FaqSection extends Head { kind: 'faq'; items: { q: string; a?: string }[]; open?: boolean }

export interface SeriesSection extends Head { kind: 'series'; filters: string[]; notice: { title: string; text: string }; items: Item[] }

export interface InquirySection extends Head { kind: 'inquiry'; formEyebrow: string; formTitle: string; asideTitle: string; asideText: string; notice: { title: string; text: string } }

export interface PlanCard {
  label: string;
  name: string;
  price?: PriceRef;
  /** a quoted range ("$750–$1,200") for services that have no catalog record */
  quote?: string;
  unit?: string;
  /** second price row (e.g. non-member rate) */
  alt?: { price: PriceRef; unit: string };
  desc?: string;
  features?: string[];
  note?: string;
  image?: Img;
  featured?: boolean;
  cta?: Action;
}

export interface PricingSection extends Head {
  kind: 'pricing';
  service: string;
  layout: 'cards' | 'rooms' | 'feature' | 'matrix' | 'quote' | 'location';
  plans?: PlanCard[];
  /** matrix */
  columns?: string[];
  rows?: { name: string; cells: (PriceRef | string)[] }[];
  notes?: Item[];
  included?: { title: string; items: string[] };
  aside?: { icon: IconName; title: string; items: Item[] };
  location?: { image: Img; eyebrow: string; lines: string[] };
  quote?: { eyebrow: string; title: string; text: string; action: Action };
  perk?: { eyebrow: string; title: string; text: string; action: Action };
  footnote?: string;
  cta?: Action;
}

export interface ClosingSection extends Head { kind: 'closing'; actions: Action[]; centered?: boolean }

export type Section =
  | HeroSection | IntroSection | AboutSection | GridSection | GallerySection | MediaSection
  | ChecksSection | BandSection | StorySection | BannerSection | FaqSection | SeriesSection
  | InquirySection | PricingSection | ClosingSection;

export interface FigmaPage {
  /** Figma frame node id, for traceability */
  node: string;
  title: string;
  description: string;
  sections: Section[];
}
