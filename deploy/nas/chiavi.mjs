// Le chiavi del Supabase del NAS, una volta sola: password del database,
// segreto dei JWT e le due chiavi firmate con quel segreto (anon per l'app,
// service_role per nessuno: serve solo a Storage). Si stampano righe da .env.
import { createHmac, randomBytes } from "node:crypto";

const b64 = (b) => Buffer.from(b).toString("base64url");
const segreto = randomBytes(32).toString("hex");
const dieciAnni = 10 * 365 * 86400;
const ora = Math.floor(Date.now() / 1000);

function firma(role) {
  const testa = b64(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const corpo = b64(JSON.stringify({ role, iss: "supabase", iat: ora, exp: ora + dieciAnni }));
  const sig = createHmac("sha256", segreto).update(`${testa}.${corpo}`).digest("base64url");
  return `${testa}.${corpo}.${sig}`;
}

console.log(`POSTGRES_PASSWORD=${randomBytes(24).toString("hex")}`);
console.log(`JWT_SECRET=${segreto}`);
console.log(`ANON_KEY=${firma("anon")}`);
console.log(`SERVICE_ROLE_KEY=${firma("service_role")}`);
