import { promises as fs } from "fs"
import path from "path"

export type UserRecord = {
  id: string
  name: string
  email: string
  password: string
  role?: string
}

type UsersData = { users: UserRecord[] }

const USERS_PATH = path.join(process.cwd(), "data", "users.json")

async function ensureUsersFile() {
  const dir = path.dirname(USERS_PATH)
  await fs.mkdir(dir, { recursive: true })
  try {
    await fs.access(USERS_PATH)
  } catch {
    const initial: UsersData = { users: [] }
    await fs.writeFile(USERS_PATH, JSON.stringify(initial, null, 2), "utf8")
  }
}

export async function readUsers(): Promise<UsersData> {
  await ensureUsersFile()
  const raw = await fs.readFile(USERS_PATH, "utf8")
  try {
    return JSON.parse(raw) as UsersData
  } catch {
    return { users: [] }
  }
}

export async function writeUsers(data: UsersData) {
  await ensureUsersFile()
  await fs.writeFile(USERS_PATH, JSON.stringify(data, null, 2), "utf8")
}
