
<p align="center"><img width="200" height="200" src="https://data-star.dev/static/images/rocket-512x512.png"></p>

# Datastar TypeScript SDK 

[![Version](https://img.shields.io/badge/version-1.0.0–RC.3-orange)](https://github.com/starfederation/datastar-typescript/releases) ![Static Badge](https://img.shields.io/badge/run_time-node_js-2a682d?logo=nodedotjs&labelColor=black) ![Static Badge](https://img.shields.io/badge/run_time-deno-6affaf?logo=deno&labelColor=black) ![Static Badge](https://img.shields.io/badge/run_time-bun-f672b6?logo=bun&labelColor=black)

A TypeScript SDK for building reactive web applications with [Datastar](https://github.com/starfederation/datastar).

Implements the [SDK spec](https://github.com/starfederation/datastar/blob/develop/sdk/README.md) and exposes an abstract ServerSentEventGenerator class that can be used to implement runtime specific classes. NodeJS and web standard runtimes are currently implemented.

Currently it only exposes an http1 server, if you want http2 I recommend you use a reverse proxy until http2 support is added.

## Features

- **Multi-runtime support**: Works with Node.js, Deno, and Bun
- **TypeScript support**: Full type safety and IntelliSense

## Quick Start

### Installation & Import

**Node.js:**
```bash
npm install @starfederation/datastar-sdk
```
```javascript
import { ServerSentEventGenerator } from "@starfederation/datastar-sdk/node";
```

**Deno:**
```typescript
// No installation needed, import directly from npm
import { ServerSentEventGenerator } from "npm:@starfederation/datastar-sdk/web";
```

**Bun:**
```bash
bun add @starfederation/datastar-sdk
```
```javascript
import { ServerSentEventGenerator } from "@starfederation/datastar-sdk/web";
```

### Basic Usage

Here's a simple example in Node showing how to read client signals and send back element patches:

```javascript
import { ServerSentEventGenerator } from "@starfederation/datastar-sdk/node";

// Read signals from the client request
const reader = await ServerSentEventGenerator.readSignals(req);

if (!reader.success) {
    console.error('Error reading signals:', reader.error);
    return;
}

// Stream updates back to the client
ServerSentEventGenerator.stream(req, res, (stream) => {
    // Patch signals
    stream.patchSignals(JSON.stringify({ foo: reader.signals.foo }));
    
    // Patch DOM elements
    stream.patchElements(`<div id="toMerge">Hello <span data-text="$foo">${reader.signals.foo}</span></div>`);
});
```

See examples for other runtimes below.

## Examples

### Runtime-Specific Examples

| Runtime | Example Location | How to Run | Try Online |
|---------|-----------------|------------|------------|
| **Node.js** | `examples/node/node.js` | [Instructions](examples/node/README.md) | [StackBlitz](https://stackblitz.com/edit/node-datastar) |
| **Deno** | `examples/deno/deno.ts` | [Instructions](examples/deno/README.md) | [Val.town](https://www.val.town/x/eduwass/datastar-deno/code/main.tsx) |
| **Bun** | `examples/bun/bun.ts` | [Instructions](examples/bun/README.md) | [Replit](https://replit.com/@eduwass/Bun-Datastar) |

Each example creates a simple web server demonstrating:
- Signal handling from client requests
- Element patching for DOM updates
- Real-time communication via Server-Sent Events

### Running Examples

1. Clone the repository
2. Navigate to the specific example directory (e.g., `examples/node/`)
3. Follow the instructions in the example's README file
4. Visit `http://localhost:3000` in your browser

> [!NOTE]
> The `npm run serve-*` and `deno task serve-*` commands in the root directory are for SDK development and testing, not for running the user examples.

## API Reference

### ServerSentEventGenerator

The main class for handling Datastar communication.

#### Static Methods

##### `readSignals(request)`
Reads signals from a client request.

**Parameters:**
- `request`: HTTP request object

**Returns:**
```typescript
{
    success: boolean;
    signals?: Record<string, any>;
    error?: string;
}
```

##### `stream(request, response, callback, options?)`
Creates a Server-Sent Event stream for real-time communication.

**Parameters:**
- `request`: HTTP request object
- `response`: HTTP response object
- `callback`: Function that receives a stream instance
- `options`: Optional configuration object

**Options:**
```typescript
{
    onError?: (error: Error) => void;
    onAbort?: () => void;
    keepalive?: boolean;
}
```

> [!IMPORTANT]
> When `keepalive: true` is set, the stream will not be closed automatically after the callback finishes. You are responsible for calling `stream.close()` to end the stream.

#### Stream Instance Methods

##### `patchSignals(signals, options?)`
Patches signals into the client signal store.

**Parameters:**
- `signals`: JSON string containing signal data to patch
- `options`: Optional configuration object with `onlyIfMissing` boolean

**Example:**
```javascript
stream.patchSignals(JSON.stringify({ foo: "bar", count: 42 }));
```

##### `patchElements(elements, options?)`
Patches HTML elements into the client DOM.

**Parameters:**
- `elements`: HTML string containing elements to patch
- `options`: Optional configuration object with `mode` and `selector`

**Options:**
- `mode`: Patch mode - "outer", "inner", "replace", "prepend", "append", "before", "after", "remove"
- `selector`: CSS selector for targeting elements (required for some modes)
- `useViewTransition`: Whether to use View Transition API

**Example:**
```javascript
stream.patchElements('<div id="myDiv">Updated content</div>');
```

##### `removeElements(selector?, elements?, options?)`
Removes elements from the client DOM by selector or by HTML string with IDs.

**Parameters:**
- `selector`: CSS selector for elements to remove (optional; mutually exclusive with elements)
- `elements`: HTML string of elements with IDs to remove (optional; required if selector is not provided)
- `options`: Optional configuration object with `eventId`, `retryDuration`

**Examples:**
```javascript
// Remove by selector
stream.removeElements('#feed, #otherid');
// Remove by HTML elements with IDs
stream.removeElements(undefined, '<div id="first"></div><div id="second"></div>');
```

##### `removeSignals(signalKeys, options?)`
Removes one or more signals from the client signal store.

**Parameters:**
- `signalKeys`: The signal key or array of keys to remove
- `options`: Optional configuration object with `onlyIfMissing`, `eventId`, `retryDuration`

**Examples:**
```javascript
// Remove a single signal
stream.removeSignals('foo');
// Remove multiple signals
stream.removeSignals(['foo', 'bar']);
```

##### `executeScript(script, options?)`
Executes a script on the client by sending a <script> tag via SSE.

**Parameters:**
- `script`: The JavaScript code to execute
- `options`: Optional configuration object:
  - `autoRemove`: If true (default), adds data-effect="el.remove()" to the script tag
  - `attributes`: Object of script tag attributes (preferred)
  - `eventId`, `retryDuration`

**Examples:**
```javascript
// Execute a simple script
stream.executeScript('console.log("Hello from server!")');

// Execute a script and keep it in the DOM
stream.executeScript('alert("Persistent!")', { autoRemove: false });

// Execute with custom attributes (object form preferred)
stream.executeScript('doSomething()', { attributes: { type: "module", async: "true" } });
```

## Development

### Prerequisites

To develop or contribute to this SDK, you'll need:
- [Deno](https://deno.land/) (primary development environment)
- [Node.js](https://nodejs.org/) (for Node.js compatibility testing)
- [Bun](https://bun.sh/) (for Bun compatibility testing)
- [Go](https://golang.org/) (required for running the Go test suite)

### Building

Build the npm package:
```bash
deno run -A build.ts
```

The above will pick the version from the [src/consts.ts](src/consts.ts) file. If you want to specify the version, use:
```bash
deno run -A build.ts VERSION
```

> [!NOTE]
> **For Developers:** The build process includes test files in the `npm/` directory for local testing, but they are excluded from the published npm package via `.npmignore`. Test files are built into `npm/esm/test/` and `npm/script/test/` directories to support the test scripts (`npm run test-node`, etc.), but these directories are not included when publishing to the npm registry.

### Testing

To run all tests for Node.js, Deno, and Bun (mirroring CI):

```bash
bash test/run-all.sh
```

- This script will:
  - Check for required tools (`deno`, `node`, `bun`, `go`, `git`)
  - Clone or update the core datastar repo for test files (in `/datastar/`, which is gitignored)
  - Build the SDK
  - Start test servers for each runtime
  - Run the Go test suite against each server
  - Print results and logs

> **Note:** This is the same script used by GitHub Actions for CI.

### Project Structure

```
typescript/
├── src/                  # SDK source code
│   ├── node/             # Node.js-specific implementation
│   ├── web/              # Web standards implementation (Deno/Bun)
│   └── abstract/         # Abstract base classes
├── examples/             # Example apps for each runtime
│   ├── node/
│   ├── deno/
│   └── bun/
├── test/                 # Unified test runner and test entrypoints
└── datastar/             # (gitignored) Cloned core repo for Go test files (used by test/run-all.sh)
```

## Runtime Support

### Node.js
- Import: `@starfederation/datastar-sdk/node`
- Requires: Node.js 18+
- Uses Node.js-specific HTTP APIs

### Deno
- Import: `npm:@starfederation/datastar-sdk/web`
- Requires: Deno 1.30+
- Uses Web Standards APIs

### Bun
- Import: `@starfederation/datastar-sdk/web`
- Requires: Bun 1.0+
- Uses Web Standards APIs

## Custom Implementations

To support additional runtimes or frameworks, extend the abstract `ServerSentEventGenerator` class from `./src/abstractServerSentEventGenerator.ts`.

You'll need to implement:
- `constructor`: Initialize runtime-specific components
- `readSignals`: Parse signals from requests  
- `stream`: Create SSE streams
- `send`: Send data to clients

The abstract class provides these public methods:
- `patchElements(elements, options?)`: Patch HTML elements
- `patchSignals(signals, options?)`: Patch signal data
- `removeElements(selector?, elements?, options?)`: Remove elements by selector or HTML string
- `removeSignals(signalKeys, options?)`: Remove one or more signals
- `executeScript(script, options?)`: Execute a script on the client
