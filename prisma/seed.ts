import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...');

  // ─── Clean existing data (order matters for FK constraints) ──────────────
  await prisma.userAchievement.deleteMany();
  await prisma.friendship.deleteMany();
  await prisma.matchMove.deleteMany();
  await prisma.match.deleteMany();
  await prisma.achievement.deleteMany();
  await prisma.user.deleteMany();

  // ─── Users ────────────────────────────────────────────────────────────────

  const admin = await prisma.user.create({
    data: {
      email:    'abenezerted3@gmail.com',
      username: 'Abenezer',
      password: await bcrypt.hash('Admin@1234', 10),
      role:     'ADMIN',
      isActive: true,
    },
  });

  const player = await prisma.user.create({
    data: {
      email:    'player@arena.com',
      username: 'SamplePlayer',
      password: await bcrypt.hash('Player@1234', 10),
      role:     'USER',
      isActive: true,
    },
  });

  console.log('✅ Seeded users:');
  console.log(`   Admin  → ${admin.email}  / Admin@1234`);
  console.log(`   Player → ${player.email} / Player@1234`);

  // ─── Achievement Badges ───────────────────────────────────────────────────
  // criteria format: "<field> <operator> <value>"
  // fields: wins | currentStreak | totalMatches
  // operators: >= | > | <= | < | ===

  const achievements = [
    {
      name:        'First Victory',
      description: 'Win your very first match.',
      iconUrl:     'https://web3arena.com/badges/first-victory.png',
      criteria:    'wins >= 1',
    },
    {
      name:        'Ten Victories',
      description: 'Win 10 matches.',
      iconUrl:     'https://web3arena.com/badges/ten-victories.png',
      criteria:    'wins >= 10',
    },
    {
      name:        'Fifty Victories',
      description: 'Win 50 matches.',
      iconUrl:     'https://web3arena.com/badges/fifty-victories.png',
      criteria:    'wins >= 50',
    },
    {
      name:        'On Fire',
      description: 'Win 5 matches in a row.',
      iconUrl:     'https://web3arena.com/badges/on-fire.png',
      criteria:    'currentStreak >= 5',
    },
    {
      name:        'Legendary',
      description: 'Win 10 matches in a row.',
      iconUrl:     'https://web3arena.com/badges/legendary.png',
      criteria:    'currentStreak >= 10',
    },
    {
      name:        'Veteran',
      description: 'Play 100 matches.',
      iconUrl:     'https://web3arena.com/badges/veteran.png',
      criteria:    'totalMatches >= 100',
    },
    {
      name:        'Centurion',
      description: 'Win 100 matches.',
      iconUrl:     'https://web3arena.com/badges/centurion.png',
      criteria:    'wins >= 100',
    },
  ];

  for (const a of achievements) {
    await prisma.achievement.create({ data: a });
  }

  console.log(`\n✅ Seeded ${achievements.length} achievement badges:`);
  achievements.forEach((a) => console.log(`   🏅 ${a.name} — ${a.criteria}`));

  console.log('\n📋 Credentials:');
  console.log('   Admin  → abenezerted3@gmail.com  / Admin@1234');
  console.log('   Player → player@arena.com        / Player@1234');

  console.log('\n🎉 Seeding complete.');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
