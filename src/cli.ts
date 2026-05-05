#!/usr/bin/env node

import { bump, BumpType } from './commands/bump';
import { scan } from './commands/scan';

const args = process.argv.slice(2);

function printHelp(): void {
  console.log(`
Usage: verlift <command> [options]

Commands:
  scan      Scan dependencies for license information
  bump      Bump project version

Scan options:
  --includeDev        Include devDependencies (default: false)
  --output <file>     Output file path (default: licenses.json)
  --includeVersion    Include version field in output (default: false)

Bump options (Web project):
  verlift bump <patch|minor|major> [options]

Bump options (React Native project – auto-detected):
  verlift bump <patch|minor|major|code> [options]

  patch|minor|major   Bump semver AND increment build codes
  code                Increment build codes only (Android versionCode, iOS CURRENT_PROJECT_VERSION)

  --output <file>      Version file name (default: version.json)
  --gradlePath <path>  Explicit path to android/app/build.gradle
  --pbxprojPath <path> Explicit path to ios/.xcodeproj/project.pbxproj

Examples:
  verlift bump patch
  verlift bump minor --output app-version.json
  verlift bump code
  verlift bump major --gradlePath ./android/app/build.gradle
`);
}

if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
  printHelp();
  process.exit(0);
}

const command = args[0];

if (command === 'scan') {
  const options: { includeDev?: boolean; includeVersion?: boolean; output?: string } = {};

  for (let i = 1; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--includeDev') {
      options.includeDev = true;
    } else if (arg === '--includeVersion') {
      options.includeVersion = true;
    } else if (arg === '--output') {
      const next = args[i + 1];
      if (!next || next.startsWith('--')) {
        console.error('Error: --output requires a file path argument.');
        process.exit(1);
      }
      options.output = next;
      i++;
    } else {
      console.error(`Unknown option: ${arg}`);
      printHelp();
      process.exit(1);
    }
  }

  scan(options);
} else if (command === 'bump') {
  const subcommand = args[1];
  const validTypes = ['patch', 'minor', 'major', 'code'];

  if (!subcommand || !validTypes.includes(subcommand)) {
    console.error(
      `Error: bump requires a type argument: patch | minor | major | code\n` +
        `  Example: verlift bump patch`
    );
    process.exit(1);
  }

  const options: {
    type?: BumpType;
    bumpCodeOnly?: boolean;
    output?: string;
    gradlePath?: string;
    pbxprojPath?: string;
  } = {};

  const bumpCodeOnly = subcommand === 'code';

  if (!bumpCodeOnly) {
    options.type = subcommand as BumpType;
  }
  options.bumpCodeOnly = bumpCodeOnly;

  for (let i = 2; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--output') {
      const next = args[i + 1];
      if (!next || next.startsWith('--')) {
        console.error('Error: --output requires a file name argument.');
        process.exit(1);
      }
      options.output = next;
      i++;
    } else if (arg === '--gradlePath') {
      const next = args[i + 1];
      if (!next || next.startsWith('--')) {
        console.error('Error: --gradlePath requires a path argument.');
        process.exit(1);
      }
      options.gradlePath = next;
      i++;
    } else if (arg === '--pbxprojPath') {
      const next = args[i + 1];
      if (!next || next.startsWith('--')) {
        console.error('Error: --pbxprojPath requires a path argument.');
        process.exit(1);
      }
      options.pbxprojPath = next;
      i++;
    } else {
      console.error(`Unknown option: ${arg}`);
      printHelp();
      process.exit(1);
    }
  }

  try {
    bump(options);
  } catch (err) {
    console.error(`Error: ${(err as Error).message}`);
    process.exit(1);
  }
} else {
  console.error(`Unknown command: ${command}`);
  printHelp();
  process.exit(1);
}
