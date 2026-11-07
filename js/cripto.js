// Criptografia feita no navegador (Web Crypto). O servidor só recebe dados cifrados.
//
// Da senha saem duas "filhas":
//   filha A -> usada como senha de login no Firebase (o servidor nunca vê a senha original)
//   filha B -> chave que tranca a "chave de dados" (nunca sai do aparelho)
// A chave de dados (aleatória) é quem cifra os registros. Ela fica guardada no banco
// trancada duas vezes: pela filha B e pela chave de recuperação impressa.
import { ITERACOES_PBKDF2 } from "./config.js";

const enc = new TextEncoder(), dec = new TextDecoder();
export const rnd = n => crypto.getRandomValues(new Uint8Array(n));

export function b64(u8){ u8 = new Uint8Array(u8); let s = ""; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode(...u8.subarray(i, i + 0x8000)); return btoa(s); }
export function unb64(s){ const b = atob(s); const u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; }
export async function sha256(d){ return new Uint8Array(await crypto.subtle.digest("SHA-256", typeof d === "string" ? enc.encode(d) : d)); }

async function hkdfKey(bytes){ return crypto.subtle.importKey("raw", bytes, "HKDF", false, ["deriveBits", "deriveKey"]); }
const aesParams = { name: "AES-GCM", length: 256 };

export async function derivarFilhas(email, senha){
  const t0 = performance.now();
  const sal = await sha256("mylife-v1:" + email.trim().toLowerCase());
  const base = await crypto.subtle.importKey("raw", enc.encode(senha), "PBKDF2", false, ["deriveBits"]);
  const mestre = await crypto.subtle.deriveBits({ name: "PBKDF2", salt: sal, iterations: ITERACOES_PBKDF2, hash: "SHA-256" }, base, 256);
  const hk = await hkdfKey(mestre);
  const filhaA = new Uint8Array(await crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt: new Uint8Array(0), info: enc.encode("login") }, hk, 256));
  const kek = await crypto.subtle.deriveKey({ name: "HKDF", hash: "SHA-256", salt: new Uint8Array(0), info: enc.encode("cofre") }, hk, aesParams, false, ["encrypt", "decrypt"]);
  return { senhaLogin: b64(filhaA), kek, ms: Math.round(performance.now() - t0) };
}

export async function chaveDaRecuperacao(bytes){
  const hk = await hkdfKey(bytes);
  return crypto.subtle.deriveKey({ name: "HKDF", hash: "SHA-256", salt: new Uint8Array(0), info: enc.encode("recuperacao") }, hk, aesParams, false, ["encrypt", "decrypt"]);
}

export async function cifrarBytes(key, bytes){ const iv = rnd(12); const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, bytes); return b64(iv) + "." + b64(new Uint8Array(ct)); }
export async function decifrarBytes(key, s){ const [iv, ct] = s.split("."); return new Uint8Array(await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64(iv) }, key, unb64(ct))); }
export async function novaChaveDados(){ return crypto.subtle.generateKey(aesParams, true, ["encrypt", "decrypt"]); }
export async function exportarChave(k){ return new Uint8Array(await crypto.subtle.exportKey("raw", k)); }
export async function importarChave(raw){ return crypto.subtle.importKey("raw", raw, { name: "AES-GCM" }, true, ["encrypt", "decrypt"]); }
export async function cifrarJSON(k, obj){ return "v1:" + await cifrarBytes(k, enc.encode(JSON.stringify(obj))); }
export async function decifrarJSON(k, s){ return JSON.parse(dec.decode(await decifrarBytes(k, s.slice(3)))); }

// Chave de recuperação: 20 bytes aleatórios em base32 (8 blocos de 4 caracteres).
const B32 = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
export function paraB32(u8){ let bits = 0, val = 0, out = ""; for (const b of u8){ val = (val << 8) | b; bits += 8; while (bits >= 5){ out += B32[(val >>> (bits - 5)) & 31]; bits -= 5; } val &= (1 << bits) - 1; } if (bits > 0) out += B32[(val << (5 - bits)) & 31]; return out; }
export function deB32(str){
  const limpo = String(str).toUpperCase().replace(/[^0-9A-Z]/g, "").replace(/O/g, "0").replace(/[IL]/g, "1").replace(/U/g, "V");
  if (limpo.length !== 32) return null;
  let bits = 0, val = 0; const out = [];
  for (const c of limpo){ const i = B32.indexOf(c); if (i < 0) return null; val = (val << 5) | i; bits += 5; if (bits >= 8){ out.push((val >>> (bits - 8)) & 255); bits -= 8; } val &= (1 << bits) - 1; }
  return new Uint8Array(out);
}
export const formatarChave = s => s.match(/.{1,4}/g).join("-");
export function novaChaveRecuperacao(){ const bytes = rnd(20); return { bytes, texto: formatarChave(paraB32(bytes)) }; }

// Backup: arquivo cifrado com uma senha escolhida na exportação.
export async function chaveDeBackup(senha, sal){
  const base = await crypto.subtle.importKey("raw", enc.encode(senha), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey({ name: "PBKDF2", salt: sal, iterations: ITERACOES_PBKDF2, hash: "SHA-256" }, base, aesParams, false, ["encrypt", "decrypt"]);
}

export function forcaSenha(s){
  const palavras = s.split(/[\s\-_.]+/).filter(p => p.length >= 3).length;
  let classes = 0; if (/[a-z]/.test(s)) classes++; if (/[A-Z]/.test(s)) classes++; if (/\d/.test(s)) classes++; if (/[^A-Za-z0-9]/.test(s)) classes++;
  const forte = s.length >= 14 || (palavras >= 5 && s.length >= 20);
  let pontos = Math.min(100, s.length * 5 + classes * 6 + palavras * 6);
  if (!forte) pontos = Math.min(pontos, 60);
  return { forte, pontos, texto: forte ? "Forte o bastante" : s.length < 8 ? "Fraca" : "Média: use 14 caracteres ou 5 palavras" };
}
const PALAVRAS = ["janela","caneca","vento","laranja","bicicleta","nuvem","farol","caderno","pedra","girassol","tapete","montanha","escada","ponte","mochila","pipoca","cacto","ancora","violao","areia","trevo","relogio","cometa","bambu","caju","coruja","tijolo","limao","pintura","sereno","fogueira","canela","abacaxi","goiaba","jabuti","sabia","ipe","cajado","moinho","bussola","lanterna","quintal","varanda","rede","pomar","garoa","neblina","orvalho","cachoeira","vagalume"];
export function gerarFraseSenha(){ return [...rnd(6)].map(b => PALAVRAS[b % PALAVRAS.length]).join("-"); }
