// Local current-tree visual sandbox, including untracked generated HD2 frames.
import { cp, mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.join(root, 'output/hd2-dist');
await mkdir(output, {recursive:true});
for (const entry of await readdir(root, {withFileTypes:true})) {
  if (entry.isFile() && /\.(js|html|css)$/.test(entry.name)) await cp(path.join(root,entry.name),path.join(output,entry.name));
}
for (const directory of ['assets','render','online-v3']) await cp(path.join(root,directory),path.join(output,directory),{recursive:true});
const git = args => execFileSync('git',['-c',`safe.directory=${root.replaceAll('\\','/')}`,...args],{cwd:root,encoding:'utf8'}).trim();
let config = await readFile(path.join(root,'config.js'),'utf8');
config += `\nwindow.DUNGEON_BUILD_COMMIT = ${JSON.stringify(git(['rev-parse','--short','HEAD']))};\n`;
config += `window.DUNGEON_BUILD_COMMIT_DATE = ${JSON.stringify(git(['show','-s','--format=%cs','HEAD']))};\n`;
await writeFile(path.join(output,'config.js'),config);
console.log('Local HD2 preview ready: output/hd2-dist/?hd2=1');
