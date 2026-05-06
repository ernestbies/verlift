import * as fs from 'fs';
import * as path from 'path';

interface PackageJson {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

interface PackageInfo {
  license?: string | LicenseObject | LicenseEntry[];
  licenses?: string | LicenseObject | LicenseEntry[];
  version?: string;
}

interface LicenseObject {
  type?: string;
}

type LicenseEntry = string | LicenseObject;

export interface ScanOptions {
  cwd?: string;
  includeDev?: boolean;
  output?: string;
  includeVersion?: boolean;
}

interface ScanResult {
  package: string;
  version?: string;
  license: string;
  url: string;
}

function resolveLicense(pkgInfo: PackageInfo): string {
  const license = pkgInfo.license ?? pkgInfo.licenses;
  if (!license) return '';
  if (typeof license === 'string') return license;
  if (Array.isArray(license)) {
    return license.map((l) => (typeof l === 'string' ? l : (l.type ?? ''))).join(', ');
  }
  if (typeof license === 'object') return license.type ?? '';
  return '';
}

export function scan(options: ScanOptions = {}): void {
  const cwd = options.cwd ?? process.cwd();
  const includeDev = options.includeDev ?? false;
  const output = options.output ?? 'licenses.json';
  const includeVersion = options.includeVersion ?? false;

  const packageJsonPath = path.resolve(cwd, 'package.json');

  if (!fs.existsSync(packageJsonPath)) {
    console.error(`Error: Could not find package.json at ${packageJsonPath}`);
    process.exit(1);
  }

  const nodeModulesPath = path.resolve(cwd, 'node_modules');
  if (!fs.existsSync(nodeModulesPath)) {
    console.error(
      `Error: node_modules not found at ${nodeModulesPath}. Run yarn install or npm install first.`
    );
    process.exit(1);
  }

  const packageJson: PackageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

  const dependencies: Record<string, string> = {
    ...(packageJson.dependencies ?? {}),
  };
  if (includeDev) {
    Object.assign(dependencies, packageJson.devDependencies ?? {});
  }

  const results: ScanResult[] = Object.keys(dependencies).map((pkg) => {
    let license = '';
    let version = '';

    try {
      const pkgInfoPath = path.resolve(cwd, 'node_modules', pkg, 'package.json');
      const pkgInfo: PackageInfo = JSON.parse(fs.readFileSync(pkgInfoPath, 'utf8'));
      license = resolveLicense(pkgInfo);
      version = pkgInfo.version ?? '';
    } catch {
      console.warn(`Could not read license for ${pkg}.`);
    }

    const entry: ScanResult = {
      package: pkg,
      ...(includeVersion ? { version } : {}),
      license,
      url: `https://www.npmjs.com/package/${pkg}`,
    };

    return entry;
  });

  const outputPath = path.resolve(cwd, output);
  fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
  console.log(`Done! Saved ${results.length} packages to ${output}`);
}
