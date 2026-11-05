/**
 * Data fix: imported scheduled plans were marked as requiring a resource, but no
 * resource inventory exists yet, so checkout failed closed for them. The API rule
 * stays in place; this only clears the flag on existing rows. Re-enable it per
 * plan in admin once rooms, desks and studios are modelled.
 */
import 'dotenv/config';
import {PrismaClient} from '@prisma/client';

const db = new PrismaClient();

async function main() {
  const result = await db.plan.updateMany({where: {requiresResource: true}, data: {requiresResource: false}});
  console.log('Cleared the resource requirement on ' + result.count + ' plans.');
}

main()
  .catch(error => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
