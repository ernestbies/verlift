import * as fs from 'fs';
import * as path from 'path';

export type BumpType = 'patch' | 'minor' | 'major';

export interface BumpOptions {
  type?: BumpType;
  bumpCodeOnly?: boolean;
  cwd?: string;
  output?: string;
  gradlePath?: string;
  pbxprojPath?: string;
}

interface PackageJson {
  version: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  [key: string]: unknown;
}

interface GradleCodeResult {
  updated: string;
  current: number;
  next: number;
}

interface WebVersionData {
  version: string;
}

interface RNVersionData {
  android: { versionName: string; versionCode: number };
  ios: { versionName: string; versionCode: number };
}

function parseDecimal(str: string): number {
  return parseInt(str, 10);
}

function parseSemVer(version: string): [number, number, number] {
  const [major, minor, patch] = version.split('.').map(parseDecimal);
  return [major, minor, patch];
}

function incrementSemVer(current: string, type: BumpType): string {
  const [major, minor, patch] = parseSemVer(current);
  if (type === 'major') return [major + 1, 0, 0].join('.');
  if (type === 'minor') return [major, minor + 1, 0].join('.');
  if (type === 'patch') return [major, minor, patch + 1].join('.');
  throw new Error(`'${type}' is not a valid semver type (major|minor|patch)`);
}

function readFile(filePath: string): string {
  return fs.readFileSync(filePath, 'utf8');
}

function writeFile(filePath: string, content: string): void {
  fs.writeFileSync(filePath, content, 'utf8');
}

function gradleGetVersionName(content: string): string {
  const m = content.match(/versionName\s+['"]([^'"]+)['"]/);
  if (!m) throw new Error('Could not find versionName in build.gradle');
  return m[1];
}

function gradleGetVersionCode(content: string): number {
  const m = content.match(/versionCode\s+(\d+)/);
  if (!m) throw new Error('Could not find versionCode in build.gradle');
  return parseDecimal(m[1]);
}

function gradleSetVersionName(content: string, next: string): string {
  return content.replace(/versionName\s+(['"])([^'"]+)['"]/, `versionName $1${next}$1`);
}

function gradleBumpVersionCode(content: string): GradleCodeResult {
  const current = gradleGetVersionCode(content);
  const next = current + 1;
  const updated = content.replace(/versionCode\s+\d+/, `versionCode ${next}`);
  return { updated, current, next };
}

function pbxGetMarketingVersion(content: string): string {
  const m = content.match(/MARKETING_VERSION\s*=\s*([^;]+);/);
  if (!m) throw new Error('Could not find MARKETING_VERSION in project.pbxproj');
  return m[1].trim();
}

function pbxGetProjectVersion(content: string): number {
  const m = content.match(/CURRENT_PROJECT_VERSION\s*=\s*(\d+);/);
  if (!m) throw new Error('Could not find CURRENT_PROJECT_VERSION in project.pbxproj');
  return parseDecimal(m[1]);
}

function pbxSetMarketingVersion(content: string, next: string): string {
  return content.replace(/MARKETING_VERSION\s*=\s*[^;]+;/g, `MARKETING_VERSION = ${next};`);
}

function pbxBumpProjectVersion(content: string): GradleCodeResult {
  const current = pbxGetProjectVersion(content);
  const next = current + 1;
  const updated = content.replace(
    /CURRENT_PROJECT_VERSION\s*=\s*\d+;/g,
    `CURRENT_PROJECT_VERSION = ${next};`
  );
  return { updated, current, next };
}

function isReactNativeProject(cwd: string): boolean {
  const pkgPath = path.resolve(cwd, 'package.json');
  if (!fs.existsSync(pkgPath)) return false;
  const pkg: PackageJson = JSON.parse(readFile(pkgPath));
  const deps = { ...pkg.dependencies, ...pkg.devDependencies };
  return Boolean(deps['react-native']);
}

function findBuildGradlePath(cwd: string): string {
  const standard = path.resolve(cwd, 'android', 'app', 'build.gradle');
  if (fs.existsSync(standard)) return standard;
  throw new Error(
    `Could not find android/app/build.gradle under ${cwd}. ` +
      'Pass the path explicitly via --gradlePath.'
  );
}

function findPbxprojPath(cwd: string): string {
  const iosDir = path.resolve(cwd, 'ios');
  if (!fs.existsSync(iosDir)) {
    throw new Error(
      `Could not find ios/ directory under ${cwd}. ` + 'Pass the path explicitly via --pbxprojPath.'
    );
  }
  const entries = fs.readdirSync(iosDir);
  for (const entry of entries) {
    if (entry.endsWith('.xcodeproj')) {
      const candidate = path.join(iosDir, entry, 'project.pbxproj');
      if (fs.existsSync(candidate)) return candidate;
    }
  }
  throw new Error(
    `Could not find project.pbxproj inside ios/*.xcodeproj under ${cwd}. ` +
      'Pass the path explicitly via --pbxprojPath.'
  );
}

export function bump(options: BumpOptions = {}): void {
  const cwd = options.cwd ?? process.cwd();
  const outputFile = options.output ?? 'version.json';
  const bumpCodeOnly = options.bumpCodeOnly ?? false;
  const type = options.type;

  if (!bumpCodeOnly && !type) {
    throw new Error('Bump type (patch|minor|major) is required.');
  }

  if (isReactNativeProject(cwd)) {
    bumpReactNative({ cwd, type, bumpCodeOnly, outputFile, options });
  } else {
    bumpWeb({ cwd, type: type!, outputFile });
  }
}

function bumpWeb({
  cwd,
  type,
  outputFile,
}: {
  cwd: string;
  type: BumpType;
  outputFile: string;
}): void {
  const pkgPath = path.resolve(cwd, 'package.json');
  if (!fs.existsSync(pkgPath)) {
    throw new Error(`package.json not found at ${pkgPath}`);
  }

  const pkg: PackageJson = JSON.parse(readFile(pkgPath));
  const current = pkg.version;
  const next = incrementSemVer(current, type);

  pkg.version = next;
  writeFile(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
  console.log(`package.json: ${current} -> ${next}`);

  const versionData: WebVersionData = { version: next };
  const outputPath = path.resolve(cwd, outputFile);
  writeFile(outputPath, JSON.stringify(versionData, null, 2) + '\n');
  console.log(`Version file saved: ${outputPath}`);
}

function bumpReactNative({
  cwd,
  type,
  bumpCodeOnly,
  outputFile,
  options,
}: {
  cwd: string;
  type: BumpType | undefined;
  bumpCodeOnly: boolean;
  outputFile: string;
  options: BumpOptions;
}): void {
  const gradlePath = options.gradlePath ?? findBuildGradlePath(cwd);
  const pbxprojPath = options.pbxprojPath ?? findPbxprojPath(cwd);
  const pkgPath = path.resolve(cwd, 'package.json');

  let gradleContent = readFile(gradlePath);
  let pbxContent = readFile(pbxprojPath);
  const pkg: PackageJson = JSON.parse(readFile(pkgPath));

  let nextVersion: string | undefined;
  if (!bumpCodeOnly && type) {
    nextVersion = incrementSemVer(pkg.version, type);
  }

  const gradleCode = gradleBumpVersionCode(gradleContent);
  gradleContent = gradleCode.updated;
  console.log(`Android versionCode: ${gradleCode.current} -> ${gradleCode.next}`);

  const pbxCode = pbxBumpProjectVersion(pbxContent);
  pbxContent = pbxCode.updated;
  console.log(`iOS CURRENT_PROJECT_VERSION: ${pbxCode.current} -> ${pbxCode.next}`);

  if (!bumpCodeOnly && nextVersion) {
    const currentVersion = pkg.version;

    gradleContent = gradleSetVersionName(gradleContent, nextVersion);
    console.log(`Android versionName: ${currentVersion} -> ${nextVersion}`);

    pbxContent = pbxSetMarketingVersion(pbxContent, nextVersion);
    console.log(`iOS MARKETING_VERSION: ${currentVersion} -> ${nextVersion}`);

    pkg.version = nextVersion;
    console.log(`package.json: ${currentVersion} -> ${nextVersion}`);
  }

  writeFile(gradlePath, gradleContent);
  writeFile(pbxprojPath, pbxContent);
  writeFile(pkgPath, JSON.stringify(pkg, null, 2) + '\n');

  const versionData: RNVersionData = {
    android: {
      versionName: gradleGetVersionName(gradleContent),
      versionCode: gradleGetVersionCode(gradleContent),
    },
    ios: {
      versionName: pbxGetMarketingVersion(pbxContent),
      versionCode: pbxGetProjectVersion(pbxContent),
    },
  };

  const outputPath = path.resolve(cwd, outputFile);
  writeFile(outputPath, JSON.stringify(versionData, null, 2) + '\n');
  console.log(`Version file saved: ${outputPath}`);
}
