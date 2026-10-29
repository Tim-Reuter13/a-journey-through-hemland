// Tiny local endpoint so a Blockbench script can write its exports into the
// project: POST http://127.0.0.1:5299/save?file=public/models/wanderer.gltf
// Only public/models/, art/blockbench/ and work/screens/ are writable. Run: node art/blockbench/receiver.mjs
import { createServer } from 'node:http';
import { writeFile, mkdir } from 'node:fs/promises';
import { resolve, dirname, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const allowed = ['public/models', 'art/blockbench', 'work/screens'].map(dir => resolve(root, dir));
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' };

createServer(async (request, response) => {
  if (request.method === 'OPTIONS') { response.writeHead(204, cors); response.end(); return; }
  const url = new URL(request.url, 'http://127.0.0.1');
  const target = resolve(root, url.searchParams.get('file') || '');
  if (request.method !== 'POST' || url.pathname !== '/save' || !allowed.some(dir => target.startsWith(dir + sep))) {
    response.writeHead(403, cors); response.end('forbidden'); return;
  }
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, Buffer.concat(chunks));
  console.log('saved', relative(root, target), Buffer.concat(chunks).length, 'bytes');
  response.writeHead(200, cors); response.end('ok');
}).listen(5299, '127.0.0.1', () => console.log('Blockbench receiver on http://127.0.0.1:5299'));
