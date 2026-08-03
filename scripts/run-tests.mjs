import { readdir } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { join } from 'node:path';

async function discover(directory) {
  const files=[];
  for(const entry of await readdir(directory,{withFileTypes:true})){
    const path=join(directory,entry.name);
    if(entry.isDirectory()) files.push(...await discover(path));
    else if(entry.isFile()&&entry.name.endsWith('.test.js')) files.push(path);
  }
  return files;
}
const files=(await Promise.all(['tests','src/annexes'].map(discover))).flat().sort();
const child=spawn(process.execPath,['--test',...files],{stdio:'inherit'});
child.on('exit',(code,signal)=>signal?process.kill(process.pid,signal):process.exit(code??1));
