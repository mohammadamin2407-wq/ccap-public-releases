import { cp, copyFile, mkdir, rm } from 'node:fs/promises';

await rm('public', { recursive: true, force: true });
await mkdir('public/icons', { recursive: true });
for (const file of ['sw.js', 'signal-performance.js', 'manifest.webmanifest']) {
  await copyFile(file, 'public/' + file);
}
await cp('icons', 'public/icons', { recursive: true });
