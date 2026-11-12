'use strict';
function mergeOfficial(supplement,official={}){
 const events=new Map((supplement.events||[]).map(e=>[e.url,e]));
 for(const doc of official.documents||[]){
  if(!doc.publishedAt||!doc.firstSeenAt||!doc.symbols?.length||!['communiques','notations','assemblees','resolutions','dirigeants','seuils','avis'].includes(doc.kind))continue;
  let url;try{url=new URL(doc.url);}catch{continue;}
  if(url.protocol!=='https:'||!['www.brvm.org','bfin.brvm.org'].includes(url.hostname))continue;
  const prior=events.get(doc.url);
  events.set(doc.url,{...doc,...prior,provider:'BRVM',type:'publication',firstSeenAt:prior?.firstSeenAt<doc.firstSeenAt?prior.firstSeenAt:doc.firstSeenAt});
 }
 return {...supplement,events:[...events.values()]};
}
module.exports={mergeOfficial};
