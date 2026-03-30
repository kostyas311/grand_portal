import { PrismaClient, UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@company.ru';
  const adminPassword = process.env.ADMIN_PASSWORD || 'Admin123!';
  const adminName = process.env.ADMIN_FULL_NAME || 'Администратор системы';

  // Create admin user if not exists
  const existing = await prisma.user.findUnique({ where: { email: adminEmail } });
  if (!existing) {
    const passwordHash = await bcrypt.hash(adminPassword, 12);
    await prisma.user.create({
      data: {
        fullName: adminName,
        email: adminEmail,
        passwordHash,
        role: UserRole.ADMIN,
        isActive: true,
      },
    });
    console.log(`✅ Admin created: ${adminEmail}`);
  } else {
    console.log(`ℹ️  Admin already exists: ${adminEmail}`);
  }

  // Create sample data sources
  const admin = await prisma.user.findUnique({ where: { email: adminEmail } });
  if (!admin) return;

  const sources = [
    { name: 'Индексы РЖД', description: 'Данные по индексам железнодорожных перевозок' },
    { name: 'Росстат', description: 'Данные Федеральной службы государственной статистики' },
    { name: 'Минстрой', description: 'Данные Министерства строительства и ЖКХ' },
    { name: 'ФАС', description: 'Данные Федеральной антимонопольной службы' },
    { name: 'Банк России', description: 'Данные Центрального банка Российской Федерации' },
  ];

  for (const source of sources) {
    const exists = await prisma.dataSource.findFirst({ where: { name: source.name } });
    if (!exists) {
      await prisma.dataSource.create({
        data: { ...source, createdById: admin.id },
      });
      console.log(`✅ Source created: ${source.name}`);
    }
  }

  console.log('\n🚀 Seed completed successfully!');
  console.log(`\nLogin credentials:`);
  console.log(`  Email: ${adminEmail}`);
  console.log(`  Password: ${adminPassword}`);
}

main()
  .catch((e) => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
