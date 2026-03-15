export {}
const { readUsers } = require("../lib/server/users") as typeof import("../lib/server/users")
const { prisma } = require("../lib/server/prisma") as typeof import("../lib/server/prisma")
const bcrypt = require("bcryptjs") as typeof import("bcryptjs")

async function main() {
  const data = await readUsers()
  if (!data.users.length) {
    console.log("No users found in data/users.json")
    return
  }

  for (const u of data.users) {
    const exists = await prisma.user.findUnique({ where: { email: u.email.toLowerCase() } })
    if (exists) continue
    const passwordHash = await bcrypt.hash(u.password, 10)
    await prisma.user.create({
      data: {
        name: u.name,
        email: u.email.toLowerCase(),
        password: passwordHash,
        role: u.role || "user"
      }
    })
  }

  console.log("Migration complete")
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
