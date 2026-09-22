import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';

export function parseEnvironment(source) {
  const values = {};
  for (const line of source.split(/\r?\n/)) {
    const match = line.match(/^([A-Z][A-Z0-9_]*)=(.*)$/);
    if (match) values[match[1]] = match[2].trim().replace(/^['"]|['"]$/g, '');
  }
  return values;
}

export function validateEnvironment(env) {
  const issues = [];
  let database;
  try { database = new URL(env.DATABASE_URL); } catch { issues.push('DATABASE_URL inválida'); }
  if (database && (database.protocol !== 'postgresql:' && database.protocol !== 'postgres:')) issues.push('DATABASE_URL debe usar PostgreSQL');
  if (database && !['localhost', '127.0.0.1', '::1'].includes(database.hostname)) issues.push('DATABASE_URL debe apuntar a PostgreSQL privado en esta VM');
  if (database && (!database.password || /^(password|change-me|example)$/i.test(database.password))) issues.push('DATABASE_URL contiene contraseña de ejemplo');
  if (!env.JWT_SECRET || env.JWT_SECRET.length < 32 || /change-me|your-super-secret/i.test(env.JWT_SECRET)) issues.push('JWT_SECRET debe ser aleatorio y tener al menos 32 caracteres');
  if (env.AI_PROVIDER === 'gemini' && (!env.GEMINI_API_KEY || /replace|example|change-me/i.test(env.GEMINI_API_KEY))) issues.push('GEMINI_API_KEY no configurada');
  if (env.AI_PROVIDER === 'groq' && (!env.GROQ_API_KEY || /replace|example|change-me/i.test(env.GROQ_API_KEY))) issues.push('GROQ_API_KEY no configurada');
  if (env.AI_PROVIDER === 'anthropic' && !env.ANTHROPIC_API_KEY) issues.push('ANTHROPIC_API_KEY no configurada');
  if (!['gemini', 'groq', 'anthropic'].includes(env.AI_PROVIDER)) issues.push('AI_PROVIDER inválido');
  for (const key of ['CORS_ORIGIN', 'FRONTEND_URL']) {
    if (!env[key]?.startsWith('https://') || env[key]?.includes('localhost')) issues.push(`${key} debe usar el dominio HTTPS público`);
  }
  if (env.CORS_ORIGIN !== env.FRONTEND_URL) issues.push('CORS_ORIGIN y FRONTEND_URL deben coincidir');
  if (env.PORT !== '3002') issues.push('PORT debe ser 3002 para la configuración de Caddy');
  for (const key of ['GENERATED_PROJECTS_PATH', 'ARTIFACT_STORAGE_PATH']) {
    if (!env[key]?.startsWith('/var/lib/proyecto-software1/')) issues.push(`${key} debe estar en el disco persistente`);
  }
  return issues;
}

export function scanSensitiveContent(entries) {
  const pattern = /AQ\.[A-Za-z0-9_-]{35,}|AIza[A-Za-z0-9_-]{20,}|gsk_[A-Za-z0-9_-]{35,}|sk-ant-[A-Za-z0-9_-]{20,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/;
  return entries.filter(([, content]) => pattern.test(content)).map(([filename]) => filename);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const file = process.argv[2];
  if (file === '--scan-tracked') {
    const names = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' }).split('\0').filter(Boolean);
    const entries = names.filter((name) => !/\.(pdf|png|jpg|jpeg|gif|zip|ico|woff2?)$/i.test(name))
      .map((name) => [name, readFileSync(name, 'utf8')]);
    const findings = scanSensitiveContent(entries);
    for (const name of findings) process.stderr.write(`- Posible secreto en ${name}\n`);
    process.stdout.write(findings.length ? `${findings.length} archivo(s) requieren revisión\n` : 'Sin patrones de secretos en archivos rastreados\n');
    if (findings.length) process.exitCode = 1;
  } else if (!file) {
    process.stderr.write('Uso: node preflight.mjs /etc/proyecto-software1/backend.env\n');
    process.exitCode = 2;
  } else {
    const issues = validateEnvironment(parseEnvironment(readFileSync(file, 'utf8')));
    for (const issue of issues) process.stderr.write(`- ${issue}\n`);
    process.stdout.write(issues.length ? `${issues.length} requisito(s) pendientes\n` : 'Configuración local apta para pruebas de despliegue\n');
    if (issues.length) process.exitCode = 1;
  }
}
