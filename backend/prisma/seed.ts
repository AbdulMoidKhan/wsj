import {cleanContent} from '../src/content-safety';
import 'dotenv/config';
import {PrismaClient} from '@prisma/client';
import {hash} from 'bcryptjs';
import {existsSync,readFileSync} from 'node:fs';
import path from 'node:path';
const db=new PrismaClient();
async function main(){const email=process.env.ADMIN_EMAIL,password=process.env.ADMIN_PASSWORD;if(!email||!password||password.length<12)throw new Error('Configure ADMIN_EMAIL and ADMIN_PASSWORD in ignored .env');await db.user.upsert({where:{email},update:{},create:{email,name:'Workspace Junction Administrator',passwordHash:await hash(password,12),role:'ADMIN'}});
const useCaseFile=path.resolve('../data/use-cases.json');if(existsSync(useCaseFile)){for(const row of JSON.parse(readFileSync(useCaseFile,'utf8')) as any[]){if(!row?.slug||!row?.title)continue;await db.content.upsert({where:{kind_slug:{kind:'use-cases',slug:row.slug}},update:{},create:{kind:'use-cases',slug:row.slug,title:row.title,status:row.status||'PUBLISHED',excerpt:row.excerpt,content:cleanContent(row.content||{}),metadata:cleanContent(row.metadata||{}),sortOrder:row.sortOrder||0}});}}
const testimonialFile=path.resolve('../data/testimonials.json');if(existsSync(testimonialFile)){let order=0;for(const row of JSON.parse(readFileSync(testimonialFile,'utf8')) as any[]){if(!row?.slug||!row?.name||!row?.quote)continue;order+=1;await db.content.upsert({where:{kind_slug:{kind:'testimonials',slug:row.slug}},update:{},create:{kind:'testimonials',slug:row.slug,title:row.name,status:'PUBLISHED',excerpt:row.quote,content:{},metadata:cleanContent({role:row.role||'',company:row.company||'',avatar:row.avatar||'',enabled:true}),sortOrder:order}});}}
const file=path.resolve('../data/migration-content.json');if(existsSync(file)){const records=JSON.parse(readFileSync(file,'utf8'));for(const row of (Array.isArray(records)?records:records.items||[])){if(!['pages','services','pricing','blog','categories','tags','popups','settings','use-cases'].includes(row.kind)||!row.slug||!row.title)continue;await db.content.upsert({where:{kind_slug:{kind:row.kind,slug:row.slug}},update:{},create:{kind:row.kind,slug:row.slug,title:row.title,status:row.status||'PUBLISHED',excerpt:row.excerpt,content:cleanContent(row.content||{}),metadata:cleanContent(row.metadata||{}),sortOrder:row.sortOrder||0}});}}
console.log('Seed complete. Existing data and credentials preserved.');}
main().finally(()=>db.$disconnect());

