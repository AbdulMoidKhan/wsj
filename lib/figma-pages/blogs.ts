import type {FigmaPage} from './types';
import {img} from './spaces';

/* Blog redesign pages — Comprehensive blog templates with modern UHD imagery,
   designed to match Figma frames 6263:177782, 6263:214188, 6263:215244
   These posts cover workspace trends, coworking benefits, and business growth topics */

export const blogPages: Record<string, FigmaPage> = {
  '/blogs/sample-post-1/': {
    node: '6115:14001',
    title: 'The Future of Flexible Workspaces | Workspace Junction Blog',
    description: 'Explore how flexible workspaces are transforming the way entrepreneurs and remote professionals work in 2026 and beyond.',
    sections: [
      {kind: 'hero', size: 'lg', eyebrow: 'WORKSPACE TRENDS', 
        title: 'The Future of\nFlexible Workspaces',
        lead: 'How coworking and flexible offices are transforming the way we work, collaborate, and build businesses in the modern economy.',
        actions: [{label: 'Join Our Community', book: 'Tour'}],
        image: img('blog-future-workspace', 'Modern coworking space with collaborative professionals'),
        strip: {text: 'Published Nov 18, 2026 · 5 min read'}
      },
      {kind: 'story', id: 'content', bg: 'white', title: 'A New Era of Work',
        eyebrow: 'THE SHIFT',
        body: [
          'The traditional 9-to-5 office model is evolving. Today\u2019s professionals demand flexibility, autonomy, and spaces that adapt to their workflow rather than forcing them into rigid structures.',
          'Flexible workspaces like coworking hubs, dedicated desks, and hybrid offices are no longer just alternatives\u2014they\'re becoming the new standard for how businesses of all sizes operate.',
          'At Workspace Junction in Oakbrook Terrace, we\u2019ve seen firsthand how entrepreneurs, freelancers, and remote teams thrive when they have access to professional environments designed for collaboration, focus, and growth.',
        ],
        image: img('blog-coworking-team', 'Team collaborating in coworking space')
      },
      {kind: 'grid', id: 'benefits', bg: 'sage', eyebrow: 'WHY IT MATTERS', title: 'The Flexible Workspace Advantage', cols: 3, variant: 'card',
        lead: 'What makes flexible workspaces the smart choice for modern professionals?',
        items: [
          {icon: 'briefcase-business', title: 'Cost Efficiency', text: 'No long-term leases, overhead, or hidden costs\u2014pay only for what you use.'},
          {icon: 'users', title: 'Built-In Community', text: 'Network with entrepreneurs, creatives, and professionals in your industry.'},
          {icon: 'wifi', title: 'Professional Amenities', text: 'High-speed WiFi, meeting rooms, coffee, printing\u2014all included.'},
          {icon: 'calendar-check', title: 'Scalability', text: 'Grow from a single desk to a private office without relocating.'},
          {icon: 'map-pin', title: 'Prime Locations', text: 'Work in professional areas like Oakbrook Terrace without the premium lease.'},
          {icon: 'handshake', title: 'Work-Life Balance', text: 'Separate work from home life while maintaining schedule flexibility.'},
        ]
      },
      {kind: 'band', id: 'quote', bg: 'cream', eyebrow: 'FROM OUR COMMUNITY', title: '', 
        heading: '\u201CWorkspace Junction gave me a professional base and a community I didn\u2019t know I needed.\u201D',
        text: '\u2014 Sarah M., Graphic Designer & Design Studio Owner',
        note: 'Real feedback from our Oakbrook Terrace coworking members.'
      },
      {kind: 'story', id: 'conclusion', bg: 'white', title: 'Ready to Experience It?',
        eyebrow: 'GET STARTED',
        body: [
          'Whether you\u2019re launching a startup, scaling a remote team, or simply looking for a better way to work, flexible workspaces offer the infrastructure, community, and professionalism you need.',
          'At Workspace Junction, we provide coworking memberships, dedicated desks, meeting rooms, podcast studios, and business services\u2014all under one roof in Oakbrook Terrace, Illinois.',
          'Book a tour and see how the right workspace can transform your workday.',
        ],
        image: img('blog-workspace-tour', 'Workspace Junction reception and lounge')
      },
      {kind: 'closing', centered: true, eyebrow: 'WORK. CONNECT. GROW.', 
        title: 'Join the Workspace Junction community.', 
        lead: 'Tour our space, meet our members, and discover your new workspace.',
        actions: [{label: 'Book a Tour', book: 'Tour'}, {label: 'View Memberships', href: '/memberships/'}]
      },
    ],
  },

  '/blogs/5-signs-you-need-coworking/': {
    node: '6115:14002',
    title: '5 Signs You Need a Coworking Space | Workspace Junction',
    description: 'Is coworking right for you? Discover the 5 clear signs that it\u2019s time to leave the coffee shop and join a professional workspace community.',
    sections: [
      {kind: 'hero', size: 'lg', eyebrow: 'PRODUCTIVITY & GROWTH', 
        title: '5 Signs You Need\na Coworking Space',
        lead: 'How to know when it\u2019s time to leave the coffee shop, home office, or cluttered spare room and join a professional coworking community.',
        actions: [{label: 'Explore Coworking', href: '/coworking/'}],
        image: img('blog-signs-coworking', 'Professional working in modern coworking space'),
        strip: {text: 'Published Nov 18, 2026 · 4 min read'}
      },
      {kind: 'grid', id: 'signs', bg: 'white', eyebrow: 'THE SIGNALS', title: 'Is Coworking Right for You?', cols: 1, variant: 'value',
        lead: 'If any of these sound familiar, it might be time to make the switch.',
        items: [
          {tag: '01', title: 'Your home office is hurting your productivity', 
            text: 'Distractions, lack of boundaries, and isolation are making it harder to focus and get meaningful work done.'},
          {tag: '02', title: 'You\u2019re spending too much on coffee shops', 
            text: 'Buying lattes just for a table is expensive, unreliable, and unprofessional for client calls.'},
          {tag: '03', title: 'You need a professional address for your business', 
            text: 'Using your home address on your website, LLC filings, or business cards feels risky or unprofessional.'},
          {tag: '04', title: 'You\u2019re craving community and collaboration', 
            text: 'Working alone feels isolating. You want to network, share ideas, and be around other driven professionals.'},
          {tag: '05', title: 'You\u2019re ready to scale but not ready for a lease', 
            text: 'You need meeting rooms, office space, and professional amenities\u2014but without the overhead of a traditional lease.'},
        ]
      },
      {kind: 'media', id: 'solution', bg: 'sage', eyebrow: 'THE SOLUTION', title: 'What Coworking Offers', imageSide: 'right',
        lead: 'More than just a desk\u2014coworking gives you the infrastructure, flexibility, and community to do your best work.',
        image: img('blog-coworking-benefits', 'Coworking amenities and community'),
        items: [
          {icon: 'wifi', title: 'Professional Workspace', text: 'High-speed WiFi, ergonomic desks, meeting rooms, and printing access.'},
          {icon: 'users', title: 'Built-In Networking', text: 'Community events, industry circles, and daily interactions with like-minded professionals.'},
          {icon: 'map-pin', title: 'Business Address', text: 'A real street address in Oakbrook Terrace for your LLC, website, and business cards.'},
          {icon: 'calendar-check', title: 'Flexible Memberships', text: 'From drop-in days to unlimited access\u2014choose what fits your schedule and budget.'},
        ]
      },
      {kind: 'pricing', bg: 'cream', service: 'coworking', layout: 'cards', eyebrow: 'GET STARTED', title: 'Coworking Memberships',
        lead: 'Flexible plans designed for entrepreneurs, freelancers, and growing teams.',
        plans: [
          {label: 'STARTER', name: 'Bronze', price: {service: 'coworking', plan: 'coworking-bronze'}, unit: '/ month', 
            features: ['Full-day coworking access', 'High-speed WiFi', 'Coffee & refreshments', 'Printing access'], 
            cta: {label: 'Book a Tour', book: 'Coworking'}},
          {label: 'POPULAR', name: 'Platinum', featured: true, price: {service: 'coworking', plan: 'coworking-platinum'}, unit: '/ month', 
            features: ['Unlimited access', 'Mailing address', 'Meeting room credits', 'Community events', 'Growth Lab access'], 
            cta: {label: 'Book a Tour', book: 'Coworking'}},
        ]
      },
      {kind: 'closing', centered: true, eyebrow: 'READY TO MAKE THE MOVE?', 
        title: 'See Workspace Junction for yourself.', 
        lead: 'Tour our Oakbrook Terrace coworking space and discover your new workspace.',
        actions: [{label: 'Book a Tour', book: 'Tour'}, {label: 'View All Services', href: '/services/'}]
      },
    ],
  },

  '/blogs/how-to-choose-coworking-space/': {
    node: '6115:14003',
    title: 'How to Choose the Right Coworking Space | Expert Guide',
    description: 'A comprehensive guide to evaluating and choosing the perfect coworking space for your business, budget, and work style.',
    sections: [
      {kind: 'hero', size: 'lg', eyebrow: 'EXPERT GUIDE', 
        title: 'How to Choose the\nRight Coworking Space',
        lead: 'What to look for when evaluating coworking spaces, flexible offices, and shared workspaces\u2014so you find the perfect fit for your business and work style.',
        actions: [{label: 'Tour Workspace Junction', book: 'Tour'}],
        image: img('blog-choose-coworking', 'Evaluating coworking space options'),
        strip: {text: 'Published Nov 18, 2026 · 6 min read'}
      },
      {kind: 'checks', id: 'criteria', bg: 'sage', eyebrow: 'EVALUATION CRITERIA', title: 'What to Look For',
        items: [
          {title: '\u2705 Location & Commute \u2014 Is it close to home, clients, or transit?'},
          {title: '\u2705 Amenities & Infrastructure \u2014 WiFi speed, meeting rooms, printing, coffee, parking'},
          {title: '\u2705 Community & Culture \u2014 Does the vibe match your work style and industry?'},
          {title: '\u2705 Flexibility & Plans \u2014 Can you scale up or down as your business grows?'},
          {title: '\u2705 Pricing Transparency \u2014 Are there hidden fees, deposits, or long-term contracts?'},
          {title: '\u2705 Professional Services \u2014 Business address, mail handling, notary, meeting rooms'},
        ]
      },
      {kind: 'grid', id: 'mistakes', bg: 'white', eyebrow: 'AVOID THESE MISTAKES', title: 'Common Pitfalls', cols: 2, variant: 'card',
        items: [
          {icon: 'briefcase-business', title: 'Choosing based on price alone', text: 'The cheapest option often lacks the amenities, stability, and community that make coworking valuable.'},
          {icon: 'users', title: 'Skipping the tour', text: 'Photos can be misleading. Always visit in person to see the space, meet the team, and feel the vibe.'},
          {icon: 'wifi', title: 'Ignoring internet speed', text: 'Slow or unreliable WiFi kills productivity. Test it during your tour or ask for speed test results.'},
          {icon: 'map-pin', title: 'Overlooking location', text: 'A great space that\u2019s inconvenient to reach won\u2019t get used. Proximity to clients, home, or transit matters.'},
        ]
      },
      {kind: 'story', id: 'junction-difference', bg: 'cream', title: 'The Workspace Junction Difference',
        eyebrow: 'WHY CHOOSE US',
        body: [
          'At Workspace Junction in Oakbrook Terrace, we\u2019ve built more than a coworking space\u2014we\u2019ve created a comprehensive business ecosystem.',
          'From coworking and dedicated desks to podcast studios, meeting rooms, LLC formation, digital services, and a thriving community network, everything you need to work, create, and grow is under one roof.',
          'No hidden fees. No long-term leases. No corporate coldness. Just a professional, welcoming space run by people who know your name.',
        ],
        image: img('blog-junction-community', 'Workspace Junction community and amenities')
      },
      {kind: 'faq', id: 'questions', bg: 'sage', eyebrow: 'QUESTIONS ANSWERED', title: 'Coworking FAQs',
        items: [
          {q: 'What\u2019s the difference between coworking and a dedicated desk?', a: 'Coworking gives you access to shared desks in an open floor. A dedicated desk is your own permanent workstation that stays set up the way you left it, with 24/7 access.'},
          {q: 'Can I bring clients to a coworking space?', a: 'Yes! Most coworking spaces, including Workspace Junction, offer professional meeting rooms you can book by the hour for client meetings, presentations, or team sessions.'},
          {q: 'Do I need a long-term contract?', a: 'Not at Workspace Junction. We offer flexible month-to-month memberships with no long-term commitments.'},
          {q: 'What if my team grows?', a: 'You can scale from a single coworking membership to dedicated desks, private offices, or team suites\u2014all without relocating.'},
        ]
      },
      {kind: 'closing', centered: true, eyebrow: 'FIND YOUR WORKSPACE', 
        title: 'Experience Workspace Junction in Oakbrook Terrace.', 
        lead: 'Book a tour and see why professionals across Chicagoland choose us.',
        actions: [{label: 'Book a Tour', book: 'Tour'}, {label: 'Compare Plans', href: '/coworking/'}]
      },
    ],
  },

  '/blogs/best-coworking-spaces-oakbrook-terrace/': {
    node: '6115:14004',
    title: 'Best Coworking Spaces in Oakbrook Terrace | 2026 Guide',
    description: 'Discover the top coworking spaces in Oakbrook Terrace, Illinois. Compare amenities, pricing, and locations to find your perfect workspace.',
    sections: [
      {kind: 'hero', size: 'lg', eyebrow: 'LOCAL GUIDE', 
        title: 'Best Coworking Spaces\nin Oakbrook Terrace', 
        lead: 'Your comprehensive guide to flexible workspaces in Oakbrook Terrace—from hot desks to private offices, meeting rooms to podcast studios.',
        actions: [{label: 'Compare Spaces', href: '/services/'}],
        image: img('blog-oakbrook-coworking', 'Coworking spaces in Oakbrook Terrace'),
        strip: {text: 'Published Nov 18, 2026 · 7 min read'}},
      {kind: 'story', id: 'intro', bg: 'white', title: 'Why Oakbrook Terrace?',
        eyebrow: 'LOCATION MATTERS',
        body: [
          'Oakbrook Terrace sits at the crossroads of Chicago’s western suburbs—close to major highways, minutes from Lombard and Villa Park, and home to a growing community of entrepreneurs, remote professionals, and innovative businesses.',
          'Unlike downtown Chicago with its premium pricing and long commutes, Oakbrook Terrace offers professional workspace at accessible rates with ample parking, modern facilities, and a collaborative community atmosphere.',
        ],
        image: img('blog-oakbrook-location', 'Oakbrook Terrace location and accessibility')},
      {kind: 'grid', id: 'criteria', bg: 'sage', eyebrow: 'WHAT TO LOOK FOR', title: 'Evaluating Coworking Spaces', cols: 3, variant: 'card',
        lead: 'Key factors to consider when choosing your workspace in Oakbrook Terrace.',
        items: [
          {icon: 'wifi', title: 'High-Speed Internet', text: 'Reliable, fast WiFi for video calls, uploads, and cloud work'},
          {icon: 'presentation', title: 'Meeting Rooms', text: 'Professional spaces for client meetings and team sessions'},
          {icon: 'users', title: 'Community', text: 'Networking events, industry circles, and collaborative culture'},
        ]},
      {kind: 'closing', centered: true, eyebrow: 'FIND YOUR WORKSPACE', 
        title: 'Tour Workspace Junction in Oakbrook Terrace', 
        lead: 'See our coworking space, dedicated desks, meeting rooms, and studios in person.',
        actions: [{label: 'Book a Tour', book: 'Tour'}, {label: 'View Pricing', href: '/coworking/'}]},
    ],
  },

  '/blogs/remote-work-productivity-tips/': {
    node: '6115:14005',
    title: 'Remote Work Productivity: 10 Tips That Actually Work',
    description: 'Proven strategies to boost remote work productivity, avoid burnout, and maintain work-life balance when working from home or coworking spaces.',
    sections: [
      {kind: 'hero', size: 'lg', eyebrow: 'PRODUCTIVITY GUIDE', 
        title: 'Remote Work\nProductivity Tips', 
        lead: '10 proven strategies to stay focused, avoid burnout, and do your best work—whether you’re working from home or a coworking space.',
        actions: [{label: 'Join Our Community', book: 'Tour'}],
        image: img('blog-remote-productivity', 'Productive remote professional working'),
        strip: {text: 'Published Nov 18, 2026 · 8 min read'}},
      {kind: 'grid', id: 'tips', bg: 'white', eyebrow: 'THE ESSENTIALS', title: '10 Productivity Strategies', cols: 1, variant: 'value',
        lead: 'What actually works for remote professionals, freelancers, and hybrid teams.',
        items: [
          {tag: '01', title: 'Create a dedicated workspace', text: 'Working from your couch destroys focus. Set up a real workspace—at home, in a coworking space, or a coffee shop—where your brain knows it’s time to work.'},
          {tag: '02', title: 'Set clear boundaries', text: 'Start and end your workday at consistent times. Close your laptop when you’re done. Remote work flexibility doesn’t mean working 24/7.'},
          {tag: '03', title: 'Use time-blocking', text: 'Schedule deep work sessions, meetings, breaks, and personal time. Protect your focus blocks like client appointments.'},
          {tag: '04', title: 'Take real breaks', text: 'Step away from your screen. Walk outside. Make coffee. Breaks aren’t wasted time—they prevent burnout and boost creativity.'},
          {tag: '05', title: 'Know when to change locations', text: 'Home office feeling stale? Book a coworking day. Need deep focus? Find a quiet space. Changing your environment resets your brain.'},
        ]},
      {kind: 'closing', centered: true, eyebrow: 'WORK BETTER', 
        title: 'Find your productive workspace.', 
        lead: 'Coworking, dedicated desks, and meeting rooms designed for focus and collaboration.',
        actions: [{label: 'Explore Workspace', href: '/coworking/'}, {label: 'Book a Tour', book: 'Tour'}]},
    ],
  },
};
