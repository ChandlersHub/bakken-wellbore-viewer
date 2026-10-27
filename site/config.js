// Deployment and price-test settings for the marketing site. Every price here is an experiment
// (see the GTM playbook); change it here rather than in the page markup.
export const SITE={
  brand:'Bakken Subsurface Analytics',
  // Where demo/pilot requests are POSTed as JSON (for example a Formspree, Basin or own API URL).
  // Empty means the form falls back to opening an email to contactEmail.
  leadEndpoint:'',
  contactEmail:'',
  // Privacy-friendly analytics. Set to the site's domain to load Plausible; empty disables it.
  plausibleDomain:'',
  // Free Explorer entry. The hosted copy must ship viewer/data/showcase/ for the tour to load.
  explorerUrl:'../viewer/?showcase=tour',
  // Counts of the current prepared survey snapshot (README). Update with each data refresh.
  snapshot:{date:'October 17, 2026',branches:'48,929',wells:'22,498',stations:'5.5M'},
  plans:[
    {id:'explorer',name:'Free Explorer',price:'$0',period:'',status:'available',cta:'Open the explorer',href:'explorer',
      features:['Public 3D viewer and statewide tour','Survey paths, operators and monthly oil playback','Shareable view links','Limited exports']},
    {id:'pilot',name:'Founder Pilot',price:'From $199',period:'/mo · 60 days',status:'available',featured:true,cta:'Apply for a pilot',href:'#request',
      features:['A research brief on one area you already evaluate','1:1 onboarding and walkthrough of the source-backed findings','Refreshed briefs during the pilot','1 user']},
    {id:'report',name:'Custom area report',price:'$500–$1,500',period:' flat',status:'available',cta:'Request a report',href:'#request',
      features:['Fixed deliverable for one area','3D well paths, production coverage and nearby development','Source table with snapshot dates','Explicit limitations section']}
  ],
  plannedPlans:[
    {name:'Researcher',price:'$99/user/mo',note:'Saved research and basic exports'},
    {name:'Professional',price:'$299/user/mo',note:'Advanced report, comparison, alerts, export'},
    {name:'Business',price:'$799/workspace/mo',note:'Three users, sharing and monitoring'},
    {name:'Enterprise',price:'From $2,500/mo',note:'Negotiated coverage, security and integrations'}
  ]
};
