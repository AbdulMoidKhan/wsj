/** Only exact, catalog-backed coworking intents may enter checkout.
 * Unknown offers are requests, never inferred from shared words like mail/desk.
 */
export function resolveServiceIntent(service?:string):{mode:'booking'|'inquiry';workspaceType:string;planId:string}{
 const key=(service||'').trim().toLowerCase();
 const coworking=['','coworking','coworking space','coworking-space'];
 if(coworking.includes(key))return{mode:'booking',workspaceType:'coworking-space',planId:''};
 const plans:Record<string,string>={
  'coworking - bronze':'bronze','bronze - coworking':'bronze',
  'coworking - silver':'silver','silver - coworking':'silver',
  'coworking - gold':'gold','gold - coworking':'gold',
  'coworking - platinum':'platinum','platinum - coworking':'platinum',
 };
 return plans[key]?{mode:'booking',workspaceType:'coworking-space',planId:plans[key]}:{mode:'inquiry',workspaceType:'',planId:''};
}
export function requestedIntentMessage(service?:string,plan?:string,interval?:string):string{
 return [service?`Requested service / offer: ${service}`:'',plan?`Requested plan: ${plan}`:'',interval?`Requested interval: ${interval}`:''].filter(Boolean).join('\n');
}
