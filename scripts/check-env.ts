import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';

async function main() {
  const p = new PrismaClient();
  const users = await p.user.count();
  const cities = await p.city.count();
  const industries = await p.industry.count();
  const titles = await p.jobTitle.count();
  const admin = await p.user.findFirst({ where: { role: 'ADMIN' } });
  const plans = await p.plan.count();
  console.log(
    JSON.stringify({
      users,
      cities,
      industries,
      titles,
      plans,
      admin: admin ? { name: admin.name, phone: admin.phone, role: admin.role } : null,
    })
  );
  await p.$disconnect();

  let redisOk = false;
  try {
    const r = new Redis('redis://localhost:6379', { lazyConnect: true });
    await r.connect();
    redisOk = (await r.ping()) === 'PONG';
    await r.quit();
  } catch {
    redisOk = false;
  }
  console.log(JSON.stringify({ redis: redisOk ? 'UP' : 'DOWN' }));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
