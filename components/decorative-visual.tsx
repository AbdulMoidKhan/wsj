import type {HTMLAttributes} from 'react';

type MotifVariant = 'route' | 'network' | 'studio' | 'meeting' | 'mail';

export function SectionMotif({variant = 'route', className = '', ...props}: {variant?: MotifVariant; className?: string} & HTMLAttributes<HTMLDivElement>) {
  const paths: Record<MotifVariant, string> = {
    route: 'M0 78 C160 14 270 142 430 72 S710 14 900 78',
    network: 'M0 92 C180 20 250 170 430 86 S700 24 900 92',
    studio: 'M0 96 C145 26 275 156 450 82 S720 24 900 96',
    meeting: 'M0 86 C180 18 260 150 440 80 S710 22 900 86',
    mail: 'M0 100 C160 28 280 160 460 92 S730 20 900 100',
  };
  const accents: Record<MotifVariant, string> = {
    route: 'M120 20v34M104 37h32',
    network: 'M190 53l20-20 26 12 22-25M210 33v-18M236 45l18 15',
    studio: 'M520 42l16-16 16 16-16 16zM560 64h50',
    meeting: 'M520 27h46v34h-46zM520 44h46M543 27v34',
    mail: 'M540 35h54v38h-54zM540 38l27 20 27-20',
  };
  return (
    <div className={`wj-section-motif wj-section-motif-${variant} ${className}`} aria-hidden="true" {...props}>
      <svg viewBox="0 0 900 120" preserveAspectRatio="none" focusable="false">
        <path className="wj-motif-track" d={paths[variant]} />
        <path className="wj-motif-accent" d={accents[variant]} />
        <circle className="wj-motif-node" cx="450" cy="80" r="4" />
      </svg>
    </div>
  );
}

export function CornerMark({label = 'Workspace Junction'}: {label?: string}) {
  return <span className="wj-corner-mark" aria-hidden="true"><span>{label}</span><i /></span>;
}


/* ──────────────────────────────────────────────────────────────────────────
   Page decoration layer.

   A purely ornamental SVG layer that sits behind the page content inside
   .wj-route-stage. It scrolls with the page, never receives pointer events,
   and is hidden from assistive technology. Each route family gets its own set
   of line-art objects so a studio page is decorated with microphones and a
   mailbox page with envelopes and pins, while the dot grids, rings and
   connector curves stay common so the whole site reads as one brand system.

   Nothing here affects layout: every piece is absolutely positioned inside a
   layer that is itself absolutely positioned over the route stage.
   ────────────────────────────────────────────────────────────────────────── */

export type DecorVariant = 'home' | 'coworking' | 'studio' | 'meeting' | 'mail' | 'community' | 'editorial';

/* Line-art objects, drawn on a 100x100 canvas so they can be scaled freely. */
const objects: Record<DecorVariant, {d: string; label: string}[]> = {
  home: [
    {label: 'laptop', d: 'M22 30h56v36H22zM14 72h72l-6-6H20zM44 72h12'},
    {label: 'chair', d: 'M30 20h40v34H30zM34 54v26M66 54v26M24 80h52M38 62h24'},
    {label: 'pin', d: 'M50 16c-11 0-20 9-20 20 0 15 20 36 20 36s20-21 20-36c0-11-9-20-20-20zM50 29a7 7 0 1 0 0 14 7 7 0 0 0 0-14z'},
  ],
  coworking: [
    {label: 'desk', d: 'M10 44h80M18 44v34M82 44v34M30 44v12h40V44'},
    {label: 'laptop', d: 'M22 30h56v36H22zM14 72h72l-6-6H20zM44 72h12'},
    {label: 'chair', d: 'M30 20h40v34H30zM34 54v26M66 54v26M24 80h52M38 62h24'},
    {label: 'cup', d: 'M28 34h40v30a14 14 0 0 1-14 14H42a14 14 0 0 1-14-14zM68 42h8a8 8 0 0 1 0 16h-8M24 88h52'},
  ],
  studio: [
    {label: 'microphone', d: 'M50 14a10 10 0 0 1 10 10v22a10 10 0 0 1-20 0V24a10 10 0 0 1 10-10zM32 44a18 18 0 0 0 36 0M50 62v20M38 86h24'},
    {label: 'headphones', d: 'M22 58V48a28 28 0 0 1 56 0v10M14 58h14v24H14zM72 58h14v24H72z'},
    {label: 'waveform', d: 'M8 50h10M24 34v32M38 22v56M52 38v24M66 28v44M80 44v12M92 50h4'},
  ],
  meeting: [
    {label: 'board', d: 'M14 18h72v44H14zM50 62v12M32 86l18-12 18 12M26 32h30M26 42h44'},
    {label: 'table', d: 'M18 46h64v10H18zM28 56v20M72 56v20M14 34h16M70 34h16'},
    {label: 'chair', d: 'M30 20h40v34H30zM34 54v26M66 54v26M24 80h52M38 62h24'},
  ],
  mail: [
    {label: 'envelope', d: 'M12 26h76v48H12zM12 30l38 28 38-28'},
    {label: 'pin', d: 'M50 16c-11 0-20 9-20 20 0 15 20 36 20 36s20-21 20-36c0-11-9-20-20-20zM50 29a7 7 0 1 0 0 14 7 7 0 0 0 0-14z'},
    {label: 'document', d: 'M24 10h38l16 16v64H24zM62 10v16h16M34 44h32M34 56h32M34 68h20'},
  ],
  community: [
    {label: 'network', d: 'M20 24h0M50 50h0M80 24h0M28 78h0M74 76h0M20 24L50 50 80 24M50 50l-22 28M50 50l24 26'},
    {label: 'rings', d: 'M50 20a30 30 0 1 0 0 60 30 30 0 0 0 0-60zM50 34a16 16 0 1 0 0 32 16 16 0 0 0 0-32z'},
    {label: 'cup', d: 'M28 34h40v30a14 14 0 0 1-14 14H42a14 14 0 0 1-14-14zM68 42h8a8 8 0 0 1 0 16h-8M24 88h52'},
  ],
  editorial: [
    {label: 'frame', d: 'M14 14h72v72H14zM14 34h72M34 34v52'},
    {label: 'pin', d: 'M50 16c-11 0-20 9-20 20 0 15 20 36 20 36s20-21 20-36c0-11-9-20-20-20zM50 29a7 7 0 1 0 0 14 7 7 0 0 0 0-14z'},
    {label: 'document', d: 'M24 10h38l16 16v64H24zM62 10v16h16M34 44h32M34 56h32M34 68h20'},
  ],
};

/* Fixed placements, expressed as a share of the route height. They sit in the
   outer margins so they frame the reading column instead of crossing it. */
const slots = [
  {top: '4%', side: 'right', size: 150, rotate: -8},
  {top: '12%', side: 'left', size: 120, rotate: 10},
  {top: '21%', side: 'right', size: 132, rotate: 6},
  {top: '29%', side: 'left', size: 142, rotate: -12},
  {top: '38%', side: 'right', size: 118, rotate: 14},
  {top: '46%', side: 'left', size: 136, rotate: -6},
  {top: '55%', side: 'right', size: 126, rotate: 9},
  {top: '63%', side: 'left', size: 148, rotate: -14},
  {top: '72%', side: 'right', size: 120, rotate: 7},
  {top: '80%', side: 'left', size: 134, rotate: -9},
  {top: '89%', side: 'right', size: 128, rotate: 12},
] as const;

function DotGrid({id}: {id: string}) {
  return (
    <svg className="wj-decor-dots" viewBox="0 0 120 120" focusable="false" aria-hidden="true">
      <defs>
        <pattern id={id} width="14" height="14" patternUnits="userSpaceOnUse">
          <circle cx="2" cy="2" r="1.6" />
        </pattern>
      </defs>
      <rect width="120" height="120" fill={`url(#${id})`} />
    </svg>
  );
}

function Curve({d}: {d: string}) {
  return (
    <svg className="wj-decor-curve" viewBox="0 0 400 200" preserveAspectRatio="none" focusable="false" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

export function PageDecor({variant = 'editorial'}: {variant?: DecorVariant}) {
  const kit = objects[variant] || objects.editorial;
  return (
    <div className={`wj-decor wj-decor-${variant}`} aria-hidden="true">
      <DotGrid id={`wj-dot-${variant}-a`} />
      <span className="wj-decor-ring wj-decor-ring-a" />
      <span className="wj-decor-ring wj-decor-ring-b" />
      <Curve d="M-10 150 C90 40 200 190 410 60" />
      {slots.map((slot, index) => {
        const object = kit[index % kit.length];
        return (
          <span
            key={slot.top + object.label}
            className={`wj-decor-object wj-decor-${slot.side}`}
            style={{top: slot.top, ['--wj-decor-size' as string]: slot.size + 'px', ['--wj-decor-rotate' as string]: slot.rotate + 'deg'}}
          >
            <svg viewBox="0 0 100 100" focusable="false" aria-hidden="true"><path d={object.d} /></svg>
          </span>
        );
      })}
      <span className="wj-decor-spark wj-decor-spark-a" />
      <span className="wj-decor-spark wj-decor-spark-b" />
      <span className="wj-decor-spark wj-decor-spark-c" />
    </div>
  );
}

/* Route families map to a motif kit. Unknown routes fall back to editorial. */
export function decorVariantFor(pathname: string): DecorVariant {
  const path = pathname.toLowerCase();
  if (path === '/' || path === '') return 'home';
  if (/podcast|photo-studio|studio|webinar/.test(path)) return 'studio';
  if (/meeting|boardroom|event|workshop|trade/.test(path)) return 'meeting';
  if (/mail|business-address|virtual-office|notary|llc|printed|digital|bpo/.test(path)) return 'mail';
  if (/community|partner|use-cases|gallery|blog/.test(path)) return 'community';
  if (/cowork|dedicated|membership|desk/.test(path)) return 'coworking';
  return 'editorial';
}
