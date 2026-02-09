// launcher.js - Dex-Nova Auto Setup & Restart Script

const { spawnSync, spawn } = require('child_process');
const { existsSync, writeFileSync } = require('fs');
const path = require('path');

const SESSION_ID = 'updateThis'; // ←←← YAHAN APNA SESSION_ID PASTE KAR (don't remove quotes or symbol)

let nodeRestartCount = 0;
const maxNodeRestarts = 5;
const restartWindow = 30000; // 30 seconds
let lastRestartTime = Date.now();

function startNode() {
  const child = spawn('node', ['index.js'], {
    cwd: 'levanter',
    stdio: 'inherit'
  });

  child.on('exit', (code) => {
    if (code !== 0) {
      const currentTime = Date.now();
      if (currentTime - lastRestartTime > restartWindow) {
        nodeRestartCount = 0;
      }
      lastRestartTime = currentTime;
      nodeRestartCount++;

      if (nodeRestartCount > maxNodeRestarts) {
        console.error('Node.js is restarting too frequently. Stopping...');
        return;
      }

      console.log(`Node exited with code ${code}. Restarting... (Attempt \( {nodeRestartCount}/ \){maxNodeRestarts})`);
      startNode();
    }
  });
}

function startPm2() {
  const pm2 = spawn('yarn', ['pm2', 'start', 'index.js', '--name', 'dex-nova', '--attach'], {
    cwd: 'levanter',
    stdio: ['pipe', 'pipe', 'pipe']
  });

  let restartCount = 0;
  const maxRestarts = 5;

  pm2.on('exit', (code) => {
    if (code !== 0) {
      console.log('PM2 failed, falling back to node...');
      startNode();
    }
  });

  pm2.on('error', (error) => {
    console.error(`PM2 error: ${error.message}`);
    startNode();
  });

  // Detect infinite restarts via stderr
  if (pm2.stderr) {
    pm2.stderr.on('data', (data) => {
      const output = data.toString();
      if (output.includes('restart')) {
        restartCount++;
        if (restartCount > maxRestarts) {
          console.log('PM2 restarting too much, switching to node...');
          spawnSync('yarn', ['pm2', 'delete', 'dex-nova'], { cwd: 'levanter', stdio: 'inherit' });
          startNode();
        }
      }
    });
  }

  if (pm2.stdout) {
    pm2.stdout.on('data', (data) => {
      console.log(data.toString());
    });
  }
}

function installDependencies() {
  console.log('Installing dependencies in levanter folder...');
  const installResult = spawnSync(
    'yarn',
    ['install', '--force', '--non-interactive', '--network-concurrency', '3'],
    {
      cwd: 'levanter',
      stdio: 'inherit',
      env: { ...process.env, CI: 'true' }
    }
  );

  if (installResult.error || installResult.status !== 0) {
    console.error('Dependency installation failed!');
    process.exit(1);
  }
  console.log('Dependencies installed.');
}

function checkDependencies() {
  if (!existsSync(path.resolve('levanter/package.json'))) {
    console.error('levanter/package.json not found!');
    process.exit(1);
  }

  const result = spawnSync('yarn', ['check', '--verify-tree'], {
    cwd: 'levanter',
    stdio: 'inherit'
  });

  if (result.status !== 0) {
    console.log('Dependencies missing or corrupted. Reinstalling...');
    installDependencies();
  } else {
    console.log('Dependencies are up to date.');
  }
}

function cloneRepository() {
  console.log('Cloning Dex-Nova (Levanter fork) repository...');
  const cloneResult = spawnSync(
    'git',
    ['clone', 'https://github.com/Dexsam07/Dex-nova.git', 'levanter'],
    { stdio: 'inherit' }
  );

  if (cloneResult.error || cloneResult.status !== 0) {
    console.error('Git clone failed!');
    process.exit(1);
  }

  const configPath = path.join('levanter', 'config.env');
  try {
    console.log('Creating config.env with SESSION_ID...');
    writeFileSync(configPath, `VPS=true\nSESSION_ID=${SESSION_ID}\n`);
    console.log('config.env created.');
  } catch (err) {
    console.error('Failed to write config.env:', err.message);
    process.exit(1);
  }

  installDependencies();
}

// Main logic
if (!existsSync('levanter')) {
  cloneRepository();
  checkDependencies();
} else {
  checkDependencies();
}

// Start the bot
console.log('Starting Dex-Nova bot...');
startPm2();