const { prisma: prismaClient } = require("../lib/server/prisma") as typeof import("../lib/server/prisma")

async function main() {
  const rows = await prismaClient.user.findMany({
    select: { id: true, email: true, role: true, createdAt: true },
    take: 10,
    orderBy: { createdAt: "desc" }
  })
  console.log(rows)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prismaClient.$disconnect()
  })
