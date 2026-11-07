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
