#!/usr/bin/env node

import * as fs from 'fs';
import * as path from 'path';
import { bump, BumpType, Platform } from './commands/bump';
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
  verlift bump [patch|minor|major]   (default: patch)

Bump options (React Native project – auto-detected):
  verlift bump [patch|minor|major|code]   (default: code)

  patch|minor|major   Bump semver AND increment build codes
  code                Increment build codes only – React Native only
                      (Android versionCode, iOS CURRENT_PROJECT_VERSION)

  --output <file>      Version file name (default: version.json)
  --gradlePath <path>  Explicit path to android/app/build.gradle
  --pbxprojPath <path> Explicit path to ios/.xcodeproj/project.pbxproj
  --platforms <list>   Comma-separated platforms to update: web,android,ios
                       Default for web projects: web
                       Default for React Native projects: android,ios

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
  const resolvedSubcommand = validTypes.includes(subcommand) ? subcommand : null;

  if (subcommand && !resolvedSubcommand && !subcommand.startsWith('--')) {
    console.error(
      `Error: bump requires a type argument: patch | minor | major | code\n` +
        `  Note: "code" is only available for React Native projects.\n` +
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
    platforms?: Platform[];
  } = {};

  const argsStartIndex = resolvedSubcommand ? 2 : 1;

  const cwd = process.cwd();
  const pkgPath = path.resolve(cwd, 'package.json');
  if (!fs.existsSync(pkgPath)) {
    console.error(`Error: package.json not found in ${cwd}`);
    process.exit(1);
  }
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  const deps = { ...pkg.dependencies, ...pkg.devDependencies };
  const isRN = Boolean(deps['react-native']);

  if (resolvedSubcommand === 'code' && !isRN) {
    console.error(
      `Error: "code" bump type is only available for React Native projects.\n` +
        `  This project does not have "react-native" in its dependencies.\n` +
        `  Use: verlift bump [patch|minor|major]`
    );
    process.exit(1);
  }

  const effectiveType = resolvedSubcommand ?? (isRN ? 'code' : 'patch');
  const bumpCodeOnly = effectiveType === 'code';

  if (!bumpCodeOnly) {
    options.type = effectiveType as BumpType;
  }
  options.bumpCodeOnly = bumpCodeOnly;

  for (let i = argsStartIndex; i < args.length; i++) {
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
    } else if (arg.startsWith('--platforms=') || arg === '--platforms') {
      let value: string;
      if (arg.startsWith('--platforms=')) {
        value = arg.slice('--platforms='.length);
      } else {
        const next = args[i + 1];
        if (!next || next.startsWith('--')) {
          console.error(
            'Error: --platforms requires a comma-separated list of platforms (web,android,ios).'
          );
          process.exit(1);
        }
        value = next;
        i++;
      }
      const validPlatforms: Platform[] = ['web', 'android', 'ios'];
      const parsed = value.split(',').map((p) => p.trim()) as Platform[];
      const invalid = parsed.filter((p) => !validPlatforms.includes(p));
      if (invalid.length > 0) {
        console.error(
          `Error: Invalid platform(s): ${invalid.join(', ')}. Valid values are: web, android, ios.`
        );
        process.exit(1);
      }
      if (!isRN && parsed.some((p) => p === 'android' || p === 'ios')) {
        console.error(
          `Error: Platforms "android" and "ios" are only available for React Native projects.`
        );
        process.exit(1);
      }
      options.platforms = parsed;
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
