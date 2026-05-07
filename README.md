<p align="center">
  <img src="https://raw.githubusercontent.com/ernestbies/verlift/main/assets/verlift.png" width="300" alt="verlift logo" />
</p>

<p align="center">
  CLI tool for scanning package licenses and bumping project versions.<br/>
  Supports both web and React Native projects.
</p>

<br/>

## Installation

**Global installation:**

```sh
# npm
npm install -g verlift

# yarn
yarn global add verlift
```

**As a dev dependency:**

```sh
# npm
npm install --save-dev verlift

# yarn
yarn add --dev verlift
```

**Using npx / yarn dlx:**

```sh
# npx
npx verlift <command>

# yarn
yarn dlx verlift <command>
```

## Requirements

- Node.js >= 14

---

## Commands

### `scan`

Crawls your project's `node_modules`, reads each package's license metadata, and writes the results to a JSON file.

```sh
verlift scan [options]
```

**Options:**

| Flag               | Default         | Description                                  |
| ------------------ | --------------- | -------------------------------------------- |
| `--includeDev`     | `false`         | Include `devDependencies` in the scan        |
| `--output <file>`  | `licenses.json` | Output file path                             |
| `--includeVersion` | `false`         | Include each package's version in the output |

**Examples:**

```sh
# Basic scan of production dependencies
verlift scan

# Include dev dependencies and package versions
verlift scan --includeDev --includeVersion

# Write output to a custom file
verlift scan --output third-party-licenses.json
```

**Output format (`licenses.json`):**

```json
[
  {
    "package": "express",
    "license": "MIT",
    "url": "https://www.npmjs.com/package/express"
  },
  {
    "package": "lodash",
    "version": "4.17.21",
    "license": "MIT",
    "url": "https://www.npmjs.com/package/lodash"
  }
]
```

> The `version` field only appears when `--includeVersion` is used.

---

### `bump`

Increments the project's semantic version (`patch`, `minor`, or `major`). Automatically detects React Native projects and updates Android and iOS build files accordingly.

```sh
verlift bump <type> [options]
```

**Arguments:**

| Argument | Description                                    |
| -------- | ---------------------------------------------- |
| `patch`  | Increment patch version: `1.2.3` → `1.2.4`     |
| `minor`  | Increment minor version: `1.2.3` → `1.3.0`     |
| `major`  | Increment major version: `1.2.3` → `2.0.0`     |
| `code`   | Bump only Android/iOS build codes, skip semver |

**Options:**

| Flag                   | Default        | Description                               |
| ---------------------- | -------------- | ----------------------------------------- |
| `--output <file>`      | `version.json` | Output file for version snapshot          |
| `--gradlePath <path>`  | Auto-detected  | Path to `android/app/build.gradle`        |
| `--pbxprojPath <path>` | Auto-detected  | Path to `ios/*.xcodeproj/project.pbxproj` |
| `--platforms <list>`   | See below      | Comma-separated platforms to update       |

**`--platforms` defaults:**

| Project type  | Default platforms |
| ------------- | ----------------- |
| Web           | `web`             |
| React Native  | `android,ios`     |

**Examples:**

```sh
# Bump patch version
verlift bump patch

# Bump minor version
verlift bump minor

# Bump major version
verlift bump major

# Only increment Android versionCode and iOS CURRENT_PROJECT_VERSION (no semver change)
verlift bump code

# Use custom native file paths
verlift bump minor --gradlePath ./android/app/build.gradle --pbxprojPath ./ios/MyApp.xcodeproj/project.pbxproj

# React Native: only bump Android
verlift bump patch --platforms=android

# React Native: only bump iOS
verlift bump patch --platforms=ios

# React Native: bump both platforms (default for RN)
verlift bump patch --platforms=android,ios
```

#### Web projects

For standard web/Node.js projects, `bump` updates the `version` field in `package.json` and writes a snapshot file:

```json
{ "version": "1.3.0" }
```

#### React Native projects

When `react-native` is detected in your dependencies, `bump` additionally patches native project files:

- **Android** (`android/app/build.gradle`): increments `versionCode` and updates `versionName`
- **iOS** (`ios/*.xcodeproj/project.pbxproj`): increments `CURRENT_PROJECT_VERSION` and updates `MARKETING_VERSION`

The output snapshot (`version.json`) includes all platform versions:

```json
{
  "android": {
    "versionName": "1.3.0",
    "versionCode": 42
  },
  "ios": {
    "versionName": "1.3.0",
    "versionCode": 42
  }
}
```

Using `verlift bump code` only increments the native build codes (`versionCode` / `CURRENT_PROJECT_VERSION`) without changing the semver string — useful for re-releasing the same version to app stores.

---

## Help

```sh
verlift --help
```

---

## License

MIT © [Ernest Bieś](https://github.com/ernestbies)
