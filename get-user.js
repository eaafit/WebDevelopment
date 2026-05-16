const { PrismaClient } = require('./generated/prisma');
const prisma = new PrismaClient();
prisma.user.findFirst().then(u => console.log('Valid user ID:', u?.id)).finally(()=>prisma.$disconnect());
