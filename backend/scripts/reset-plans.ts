/**
 * Development helper: removes Plan rows that no order references yet, so the
 * structured catalog can be re-imported cleanly. Referenced plans are kept so
 * historical orders never lose their catalog link.
 */
import 'dotenv/config';
import {PrismaClient} from '@prisma/client';

const db = new PrismaClient();

async function main() {
  const referenced = await db.orderItem.findMany({where: {planId: {not: null}}, select: {planId: true}});
  const keep = new Set(referenced.map(row => row.planId as string));
  const all = await db.plan.findMany({select: {id: true}});
  const removable = all.filter(plan => !keep.has(plan.id)).map(plan => plan.id);
  const result = await db.plan.deleteMany({where: {id: {in: removable}}});
  console.log('Removed ' + result.count + ' unreferenced plans; kept ' + keep.size + ' referenced.');
}

main()
  .catch(error => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
