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
  // SRS-compliant streak-based achievement system
  // Each badge awards +20 bonus points on unlock
  // criteria format: "<field> <operator> <value>"
  // fields: wins | currentStreak | totalMatches
  // operators: >= | > | <= | < | ===

  const achievements = [
    {
      name:        'Water Badge',
      description: 'Win 3 matches in a row. Bonus: +20 points',
      iconUrl:     'https://web3arena.com/badges/water-badge.png',
      criteria:    'currentStreak >= 3',
    },
    {
      name:        'Fire Badge',
      description: 'Win 5 matches in a row. Bonus: +20 points',
      iconUrl:     'https://web3arena.com/badges/fire-badge.png',
      criteria:    'currentStreak >= 5',
    },
    {
      name:        'Gold Badge',
      description: 'Win 7 matches in a row. Bonus: +20 points',
      iconUrl:     'https://web3arena.com/badges/gold-badge.png',
      criteria:    'currentStreak >= 7',
    },
    {
      name:        'Diamond Badge',
      description: 'Win 10 matches in a row. Bonus: +20 points',
      iconUrl:     'https://web3arena.com/badges/diamond-badge.png',
      criteria:    'currentStreak >= 10',
    },
    {
      name:        'Platinum Badge',
      description: 'Win 15 matches in a row. Bonus: +20 points',
      iconUrl:     'https://web3arena.com/badges/platinum-badge.png',
      criteria:    'currentStreak >= 15',
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
