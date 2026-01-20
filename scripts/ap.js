#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import Database from 'better-sqlite3'

const PLAN_DIR = process.env.AGENT_PLAYGROUND_PLAN_DIR ?? 'docs/plans'

const args = process.argv.slice(2)

function exitWithError(message) {
  console.error(message)
  process.exit(1)
}

function getDbPath() {
  const dbPath = process.env.AGENT_PLAYGROUND_DB_PATH
  if (!dbPath) {
    exitWithError('AGENT_PLAYGROUND_DB_PATH is required.')
  }
  return dbPath
}

function getRepoId(db) {
  const rawRepoId = process.env.AGENT_PLAYGROUND_REPO_ID
  if (rawRepoId) {
    const parsed = Number(rawRepoId)
    if (Number.isNaN(parsed)) {
      exitWithError('AGENT_PLAYGROUND_REPO_ID must be a number.')
    }
    return parsed
  }
  const repoPath = process.env.AGENT_PLAYGROUND_REPO_PATH
  if (!repoPath) {
    exitWithError('AGENT_PLAYGROUND_REPO_ID or AGENT_PLAYGROUND_REPO_PATH is required.')
  }
  const row = db.prepare('SELECT id FROM repos WHERE path = ?').get(repoPath)
  if (!row) {
    exitWithError(`Repo not found for path: ${repoPath}`)
  }
  return row.id
}

function getRepoPath(db, repoId) {
  const repoPath = process.env.AGENT_PLAYGROUND_REPO_PATH
  if (repoPath) return repoPath
  const row = db.prepare('SELECT path FROM repos WHERE id = ?').get(repoId)
  if (!row) {
    exitWithError(`Repo not found for id: ${repoId}`)
  }
  return row.path
}

function parseFlag(flag) {
  const index = args.indexOf(flag)
  if (index === -1) return null
  const value = args[index + 1]
  args.splice(index, value ? 2 : 1)
  return value ?? ''
}

function hasFlag(flag) {
  const index = args.indexOf(flag)
  if (index === -1) return false
  args.splice(index, 1)
  return true
}

function printUsage() {
  console.log(`Usage:
  ap tasks list
  ap tasks add "Title" [--status proposed|backlog|in_progress|done]
  ap plan save <taskId> [path]

Environment:
  AGENT_PLAYGROUND_DB_PATH
  AGENT_PLAYGROUND_REPO_ID or AGENT_PLAYGROUND_REPO_PATH
  AGENT_PLAYGROUND_PLAN_DIR (default: ${PLAN_DIR})
`)
}

async function readStdin() {
  if (process.stdin.isTTY) return ''
  return new Promise((resolve, reject) => {
    let data = ''
    process.stdin.setEncoding('utf8')
    process.stdin.on('data', (chunk) => {
      data += chunk
    })
    process.stdin.on('end', () => resolve(data))
    process.stdin.on('error', reject)
  })
}

function ensureInsideRepo(repoPath, filePath) {
  const resolved = path.resolve(repoPath, filePath)
  const root = path.resolve(repoPath)
  if (resolved !== root && !resolved.startsWith(root + path.sep)) {
    exitWithError(`Refusing to write outside repo: ${filePath}`)
  }
  return resolved
}

async function main() {
  if (args.length === 0 || hasFlag('--help') || hasFlag('-h')) {
    printUsage()
    return
  }

  const db = new Database(getDbPath())
  const repoId = getRepoId(db)
  const repoPath = getRepoPath(db, repoId)

  const [group, action] = args

  if (group === 'tasks' && action === 'list') {
    const rows = db
      .prepare('SELECT id, repo_id, title, status, created_at FROM tasks WHERE repo_id = ? ORDER BY created_at DESC')
      .all(repoId)
    console.log(JSON.stringify(rows, null, 2))
    return
  }

  if (group === 'tasks' && action === 'add') {
    const status = parseFlag('--status') ?? 'proposed'
    const allowedStatuses = new Set(['proposed', 'backlog', 'in_progress', 'blocked', 'failed', 'canceled', 'done'])
    if (!allowedStatuses.has(status)) {
      exitWithError(`Invalid status: ${status}`)
    }
    const title = args.slice(2).join(' ').trim()
    if (!title) {
      exitWithError('Task title is required.')
    }
    const info = db
      .prepare('INSERT INTO tasks (repo_id, title, status) VALUES (?, ?, ?)')
      .run(repoId, title, status)
    const row = db
      .prepare('SELECT id, repo_id, title, status, created_at FROM tasks WHERE id = ?')
      .get(info.lastInsertRowid)
    console.log(JSON.stringify(row, null, 2))
    return
  }

  if (group === 'plan' && action === 'save') {
    const contentFlag = parseFlag('--content')
    const [taskIdRaw, pathOverride] = args.slice(2)
    if (!taskIdRaw) {
      exitWithError('Task ID is required.')
    }
    const taskId = Number(taskIdRaw)
    if (Number.isNaN(taskId)) {
      exitWithError('Task ID must be a number.')
    }
    const taskRow = db.prepare('SELECT id FROM tasks WHERE id = ? AND repo_id = ?').get(taskId, repoId)
    if (!taskRow) {
      exitWithError(`Task ${taskId} not found for repo ${repoId}.`)
    }
    const relativePath = pathOverride ?? path.join(PLAN_DIR, `task-${taskId}.md`)
    const stdinContent = contentFlag ?? (await readStdin())
    const content = stdinContent.trim()
    if (!content) {
      exitWithError('Plan content is required (use stdin or --content).')
    }
    const resolvedPath = ensureInsideRepo(repoPath, relativePath)
    fs.mkdirSync(path.dirname(resolvedPath), { recursive: true })
    fs.writeFileSync(resolvedPath, `${content.trim()}\n`, 'utf8')

    const noteContent = `Plan doc: ${relativePath}\n\n${content.trim()}`
    db.prepare(
      "INSERT INTO task_notes (task_id, content, updated_at) VALUES (?, ?, datetime('now')) ON CONFLICT(task_id) DO UPDATE SET content = excluded.content, updated_at = datetime('now')"
    ).run(taskId, noteContent)

    console.log(
      JSON.stringify(
        {
          taskId,
          path: relativePath,
          noteUpdated: true,
        },
        null,
        2
      )
    )
    return
  }

  exitWithError(`Unknown command: ${args.join(' ')}`)
}

main().catch((error) => {
  exitWithError(error instanceof Error ? error.message : 'Unexpected error')
})
