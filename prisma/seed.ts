import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...');

  // Clean existing data
  await prisma.userAchievement.deleteMany();
  await prisma.friendship.deleteMany();
  await prisma.matchMove.deleteMany();
  await prisma.match.deleteMany();
  await prisma.achievement.deleteMany();
  await prisma.user.deleteMany();

  const password = await bcrypt.hash('Admin@1234', 10);

  // ─── Admin User ───────────────────────────────────────────────────────────
  const admin = await prisma.user.create({
    data: {
      email: 'abenezerted3@gmail.com',
      username: 'Abenezer',
      password,
      role: 'ADMIN',
      isActive: true,
    },
  });

  // ─── Sample Player ────────────────────────────────────────────────────────
  const player = await prisma.user.create({
    data: {
      email: 'player@arena.com',
      username: 'SamplePlayer',
      password: await bcrypt.hash('Player@1234', 10),
      role: 'USER',
      isActive: true,
    },
  });

  console.log('✅ Seeded users:');
  console.log(`   Admin  → ${admin.email} (role: ${admin.role})`);
  console.log(`   Player → ${player.email} (role: ${player.role})`);

  console.log('\n📋 Credentials:');
  console.log('   Admin  → abenezerted3@gmail.com  / Admin@1234');
  console.log('   Player → player@arena.com        / Player@1234');

  console.log('\n🎉 Seeding completed.');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
