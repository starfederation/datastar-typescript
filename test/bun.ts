import { ServerSentEventGenerator } from "../npm/esm/web/serverSentEventGenerator.js";

// This server is used for testing the Bun web standard based sdk
const server = Bun.serve({
  port: 8001,
  async fetch(req) {
    const url = new URL(req.url);

    if (url.pathname === "/") {
      return new Response(
        `<html><head><script type="module" src="https://cdn.jsdelivr.net/gh/starfederation/datastar@main/bundles/datastar.js"></script></head><body><div id="toMerge" data-signals-foo="'World'" data-on-load="@get('/merge')">Hello</div></body></html>`,
        {
          headers: { "Content-Type": "text/html" },
        },
      );
    } else if (url.pathname.includes("/merge")) {
      const reader = await ServerSentEventGenerator.readSignals(req);

      if (!reader.success) {
        console.error("Error while reading signals", reader.error);
        return new Response(`Error while reading signals`);
      }

      if (!("foo" in reader.signals)) {
        console.error("The foo signal is not present");
        return new Response("The foo signal is not present");
      }

      return ServerSentEventGenerator.stream((stream) => {
        stream.patchElements(
          `<div id="toMerge">Hello ${reader.signals.foo}</div>`,
        );
      });
    } else if (url.pathname.includes("/test")) {
      const reader = await ServerSentEventGenerator.readSignals(req);
      if (reader.success === true) {
        const events = reader.signals.events;
        if (isEventArray(events)) {
          return ServerSentEventGenerator.stream((stream) => {
            testEvents(stream, events);
          });
        }
      }
    } else if (url.pathname.includes("await")) {
      return ServerSentEventGenerator.stream(async (stream) => {
        stream.patchElements('<div id="toMerge">Merged</div>');
        await delay(5000);
        stream.patchElements('<div id="toMerge">After 5 seconds</div>');
      });
    }

    return new Response(`Path not found: ${req.url}`, {
      headers: { "Content-Type": "text/html" },
    });
  },
});

console.log(`Bun server running at http://localhost:${server.port}/`);

function delay(milliseconds) {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

function isEventArray(events) {
  return events instanceof Array && events.every((event) => {
    return typeof event === "object" && event !== null &&
      typeof event.type === "string";
  });
}

function testEvents(stream, events) {
  events.forEach((event) => {
    const { type, ...e } = event;
    switch (type) {
      case "patchElements": {
        const { elements, mode, selector, useViewTransition, ...options } = e;
        const patchOptions = { ...options };
        if (mode && mode !== "outer") patchOptions.mode = mode;
        if (selector) patchOptions.selector = selector;
        if (useViewTransition !== undefined) patchOptions.useViewTransition = useViewTransition;
        stream.patchElements(elements || "", patchOptions);
        break;
      }
      case "removeElements": {
        const { selector, elements, ...options } = e;
        stream.removeElements(selector, elements, options);
        break;
      }
      case "patchSignals": {
        const { signals, "signals-raw": signalsRaw, ...options } = e;
        if (signalsRaw) {
          stream.patchSignals(signalsRaw, options || undefined);
        } else if (signals) {
          stream.patchSignals(JSON.stringify(signals), options || undefined);
        }
        break;
      }
      case "removeSignals": {
        const { paths, ...options } = e;
        stream.removeSignals(paths, options);
        break;
      }
      case "executeScript": {
        const { script, autoRemove = true, attributes, ...options } = e;
        stream.executeScript(script, { autoRemove, attributes, ...options });
        break;
      }
    }
  });
} 