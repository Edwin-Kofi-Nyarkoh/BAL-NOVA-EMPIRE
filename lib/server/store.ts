import { promises as fs } from "fs"
import path from "path"

type StoreData = {
  inventory: any[]
  orders: any[]
  chats: any[]
}

const STORE_PATH = path.join(process.cwd(), "data", "store.json")

async function ensureStoreFile() {
  const dir = path.dirname(STORE_PATH)
  await fs.mkdir(dir, { recursive: true })
  try {
    await fs.access(STORE_PATH)
  } catch {
    const initial: StoreData = { inventory: [], orders: [], chats: [] }
    await fs.writeFile(STORE_PATH, JSON.stringify(initial, null, 2), "utf8")
  }
}

export async function readStore(): Promise<StoreData> {
  await ensureStoreFile()
  const raw = await fs.readFile(STORE_PATH, "utf8")
  try {
    return JSON.parse(raw) as StoreData
  } catch {
    return { inventory: [], orders: [], chats: [] }
  }
}

export async function writeStore(data: StoreData) {
  await ensureStoreFile()
  await fs.writeFile(STORE_PATH, JSON.stringify(data, null, 2), "utf8")
}
