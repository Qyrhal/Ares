/**
 * Filter sensitive environment variables before passing to child processes.
 * Prevents accidental leakage of API keys, tokens, and credentials to
 * spawned terminals, hooks, MCP servers, and git subprocesses.
 */

const SENSITIVE_PATTERNS = [
  // API keys and tokens
  /API_KEY/i,
  /API_SECRET/i,
  /SECRET_KEY/i,
  /ACCESS_KEY/i,
  /AUTH_TOKEN/i,
  /BEARER/i,
  // Cloud provider credentials
  /AWS_/i,
  /AZURE_/i,
  /GOOGLE_/i,
  /GCP_/i,
  // Service-specific tokens
  /OPENAI/i,
  /ANTHROPIC/i,
  /GITHUB_TOKEN/i,
  /GH_TOKEN/i,
  /GITLAB_TOKEN/i,
  /HEROKU_/i,
  /SLACK_TOKEN/i,
  /DISCORD_TOKEN/i,
  /TELEGRAM_TOKEN/i,
  // Generic credential patterns
  /PASSWORD/i,
  /CREDENTIAL/i,
  /PRIVATE_KEY/i,
  /CLIENT_SECRET/i,
  // NPM/Node
  /NPM_TOKEN/i,
  /NODE_AUTH_TOKEN/i,
]

// Exact env var names that are always sensitive (not matched by pattern)
const SENSITIVE_EXACT = new Set([
  'HOMEBREW_GITHUB_API_TOKEN',
])

/**
 * Returns a copy of process.env with sensitive variables removed.
 * Safe to spread into child process spawn options.
 */
export function sanitizeEnv(extra?: Record<string, string>): Record<string, string> {
  const env: Record<string, string> = {}
  for (const [key, value] of Object.entries(process.env)) {
    if (value === undefined) continue
    if (SENSITIVE_EXACT.has(key)) continue
    if (SENSITIVE_PATTERNS.some((re) => re.test(key))) continue
    env[key] = value
  }
  if (extra) Object.assign(env, extra)
  return env
}
