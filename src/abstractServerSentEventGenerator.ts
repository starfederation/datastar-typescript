import {
  DatastarEventOptions,
  DefaultMapping,
  EventType,
  PatchElementsOptions,
  PatchSignalsOptions,
  Jsonifiable,
  ElementPatchMode,
} from "./types.ts";

import {
  DatastarDatalineElements,
  DatastarDatalinePatchMode,
  DatastarDatalineSelector,
  DatastarDatalineSignals,
  DefaultSseRetryDurationMs,
  ElementPatchModes,
} from "./consts.ts";

/**
 * Abstract ServerSentEventGenerator class, responsible for initializing and handling
 * server-sent events (SSE) as well as reading signals sent by the client.
 *
 * The concrete implementation must override the send and constructor methods as well
 * as implement readSignals and stream static methods.
 */
export abstract class ServerSentEventGenerator<T = string[]> {
  protected constructor() {}

  /**
   * Validates that the provided mode is a valid ElementPatchMode.
   * @param mode - The mode to validate
   * @throws {Error} If the mode is invalid
   */
  private validateElementPatchMode(mode: string): asserts mode is ElementPatchMode {
    if (!ElementPatchModes.includes(mode as ElementPatchMode)) {
      throw new Error(`Invalid ElementPatchMode: "${mode}". Valid modes are: ${ElementPatchModes.join(', ')}`);
    }
  }


  /**
   * Validates required parameters are not empty or undefined.
   * @param value - The value to validate
   * @param paramName - The parameter name for error messages
   * @throws {Error} If the value is empty or undefined
   */
  private validateRequired(value: string | undefined, paramName: string): asserts value is string {
    if (!value || value.trim() === '') {
      throw new Error(`${paramName} is required and cannot be empty`);
    }
  }

  /**
   * Sends a server-sent event (SSE) to the client.
   *
   * Runtimes should override this method by calling the parent function
   *  with `super.send(event, dataLines, options)`. That will return all the
   * datalines as an array of strings that should be streamed to the client.
   *
   * @param eventType - The type of the event.
   * @param dataLines - Lines of data to send.
   * @param [sendOptions] - Additional options for sending events.
   */
  protected send(
    event: EventType,
    dataLines: string[],
    options: DatastarEventOptions,
  ): T | string[] {
    const { eventId, retryDuration } = options || {};

    const typeLine = [`event: ${event}\n`];
    const idLine = eventId ? [`id: ${eventId}\n`] : [];
    const retryLine = !retryDuration || retryDuration === 1000 ? [] : [
      `retry: ${retryDuration ?? DefaultSseRetryDurationMs}\n`,
    ];

    return typeLine.concat(
      idLine,
      retryLine,
      dataLines.map((data) => {
        return `data: ${data}\n`;
      }),
      ["\n"],
    );
  }

  /**
   * Closes the server-sent event stream.
   *
   * Use this method to manually close the stream when `keepalive: true` is set.
   * This is required when you want to close the stream before the client disconnects.
   *
   * Concrete implementations must override this method to close the underlying stream.
   */
  public abstract close(): void;

  private eachNewlineIsADataLine(prefix: string, data: string) {
    return data.split("\n").map((line) => {
      return `${prefix} ${line}`;
    });
  }

  private eachOptionIsADataLine(
    options: Record<string, Jsonifiable>,
  ): string[] {
    return Object.keys(options).filter((key) => {
      return !this.hasDefaultValue(key, options[key as keyof typeof options]);
    }).flatMap((key) => {
      return this.eachNewlineIsADataLine(
        key,
        options[key as keyof typeof options]!.toString(),
      );
    });
  }

  private hasDefaultValue(key: string, val: unknown): boolean {
    if (key in DefaultMapping) {
      return val === (DefaultMapping as Record<string, unknown>)[key];
    }

    return false;
  }

  /**
   * Patches HTML elements into the DOM.
   *
   * Use this to insert, update, or remove elements in the client DOM. Supports various patch modes and options.
   *
   * Examples:
   * ```
   * // Insert new element inside #container
   * patchElements('<div id="new">Hello</div>', { selector: '#container', mode: 'append' });
   *
   * // Replace element by ID
   * patchElements('<div id="replaceMe">Replaced</div>');
   *
   * // Remove by selector, note that you can also use removeElements
   * patchElements('', { selector: '#toRemove', mode: 'remove' });
   *
   * // Remove by elements with IDs, note that you can also use removeElements
   * patchElements('<div id="first"></div><div id="second"></div>', { mode: 'remove' });
   * ```
   *
   * @param elements - HTML string of elements to patch (must have IDs unless using selector).
   * @param options - Patch options: selector, mode, useViewTransition, eventId, retryDuration.
   * @returns The SSE lines to send.
   */
  public patchElements(
    elements: string,
    options?: PatchElementsOptions,
  ): ReturnType<typeof this.send> {
    const { eventId, retryDuration, ...renderOptions } = options ||
      {} as Partial<PatchElementsOptions>;

    // Validate patch mode if provided
    const patchMode = (renderOptions as Record<string, unknown>)[DatastarDatalinePatchMode] as string;
    if (patchMode) {
      this.validateElementPatchMode(patchMode);
    }

    // Check if we're in remove mode with a selector
    const selector = (renderOptions as Record<string, unknown>)[DatastarDatalineSelector] as string;
    const isRemoveWithSelector = patchMode === 'remove' && selector;

    // Validate required parameters - elements only required when not removing with selector
    if (!isRemoveWithSelector) {
      this.validateRequired(elements, 'elements');
    }

    // Per spec: If no selector specified, elements must have IDs (this validation would be complex
    // and is better handled client-side, but we ensure elements is not empty)
    if (!selector && patchMode === 'remove') {
      // For remove mode, elements parameter may be omitted when selector is supplied
      // but since we have no selector, we need elements with IDs
      if (!elements || elements.trim() === '') {
        throw new Error('For remove mode without selector, elements parameter with IDs is required');
      }
    }

    // Build data lines - skip elements data line if empty in remove mode with selector
    const dataLines = this.eachOptionIsADataLine(renderOptions);
    if (!isRemoveWithSelector || elements.trim() !== '') {
      dataLines.push(...this.eachNewlineIsADataLine(DatastarDatalineElements, elements));
    }

    return this.send("datastar-patch-elements", dataLines, {
      eventId,
      retryDuration,
    });
  }

  /**
   * Patches signals into the signal store.
   *
   * Use this to update client-side signals using RFC 7386 JSON Merge Patch semantics.
   *
   * Examples:
   * ```
   * // Patch a single signal
   * patchSignals('{"show": true}');
   *
   * // Patch multiple signals with onlyIfMissing option
   * patchSignals('{"output": "Test", "user": {"name": "Alice"}}', { onlyIfMissing: true });
   * ```
   *
   * @param signals - JSON string containing signal data to patch.
   * @param options - Patch options: onlyIfMissing, eventId, retryDuration.
   * @returns The SSE lines to send.
   */
  public patchSignals(
    signals: string,
    options?: PatchSignalsOptions,
  ): ReturnType<typeof this.send> {
    // Validate required parameters
    this.validateRequired(signals, 'signals');
    

    const { eventId, retryDuration, ...eventOptions } = options ||
      {} as Partial<PatchSignalsOptions>;

    const dataLines = this.eachOptionIsADataLine(eventOptions)
      .concat(this.eachNewlineIsADataLine(DatastarDatalineSignals, signals));

    return this.send("datastar-patch-signals", dataLines, {
      eventId,
      retryDuration,
    });
  }

  /**
   * Executes a script on the client by sending a <script> tag via SSE.
   *
   * Use this to run JavaScript in the client browser. By default, the script tag will auto-remove after execution.
   *
   * Examples:
   * ```
   * // Execute a simple script
   * executeScript('console.log("Hello from server!")');
   *
   * // Execute a script and keep it in the DOM
   * executeScript('alert("Persistent!")', { autoRemove: false });
   *
   * // Execute with custom attributes (object form preferred)
   * executeScript('doSomething()', { attributes: { type: "module", async: "true" } });
   *
   * // (Advanced) Execute with custom attributes as array of strings
   * executeScript('doSomething()', { attributes: ['type="module"', 'async'] });
   * ```
   *
   * @param script - The JavaScript code to execute.
   * @param options - Options: autoRemove, attributes (object preferred), eventId, retryDuration.
   * @returns The SSE lines to send.
   */
  public executeScript(
    script: string,
    options?: {
      autoRemove?: boolean;
      attributes?: string[] | Record<string, string>;
      eventId?: string;
      retryDuration?: number;
    }
  ): ReturnType<typeof this.send> {
    const {
      autoRemove = true,
      attributes = {},
      eventId,
      retryDuration,
    } = options || {};

    let attrString = "";

    // Handle attributes as object (preferred by test)
    if (attributes && typeof attributes === "object" && !Array.isArray(attributes)) {
      attrString = Object.entries(attributes)
        .map(([k, v]) => ` ${k}="${v}"`)
        .join("");
    } else if (Array.isArray(attributes)) {
      attrString = attributes.length > 0 ? " " + attributes.join(" ") : "";
    }

    // Only add data-effect if autoRemove is true
    if (autoRemove) {
      attrString += ' data-effect="el.remove()"';
    }

    const scriptTag = `<script${attrString}>${script}</script>`;

    const dataLines = [
      ...this.eachNewlineIsADataLine("mode", "append"),
      ...this.eachNewlineIsADataLine("selector", "body"),
      ...this.eachNewlineIsADataLine("elements", scriptTag),
    ];

    return this.send("datastar-patch-elements", dataLines, {
      eventId,
      retryDuration,
    });
  }

  /**
   * Convenience method to remove elements from the DOM.
   *
   * Provide either a CSS selector (to remove all matching elements) OR an HTML string of elements with IDs (to remove specific elements by ID).
   *
   * - If `selector` is provided, it will be used to target elements for removal (elements param is ignored).
   * - If `selector` is not provided, `elements` must be a non-empty HTML string where each top-level element has an ID.
   *
   * Examples:
   * ```
   *   // Remove by selector
   *   removeElements('#feed, #otherid');
   *   // Remove by HTML elements with IDs
   *   removeElements(undefined, '<div id="first"></div><div id="second"></div>');
   * ```
   * @param selector - CSS selector for elements to remove (optional; mutually exclusive with elements).
   * @param elements - HTML string of elements with IDs to remove (optional; required if selector is not provided).
   * @param options - Additional options: eventId, retryDuration.
   * @returns The SSE lines to send.
   */
  public removeElements(
    selector?: string,
    elements?: string,
    options?: {
      eventId?: string;
      retryDuration?: number;
    }
  ): ReturnType<typeof this.send> {
    // If selector is not provided, elements must be present and non-empty
    if (!selector && (!elements || elements.trim() === '')) {
      throw new Error('Either selector or elements (with IDs) must be provided to remove elements.');
    }
    return this.patchElements(elements ?? '', {
      selector,
      mode: 'remove',
      eventId: options?.eventId,
      retryDuration: options?.retryDuration,
    });
  }

  /**
   * Convenience method to remove one or more signals from the client signal store.
   *
   * This sends a JSON Merge Patch where each specified key is set to null, per RFC 7386 and the Datastar spec.
   *
   * Examples:
   * ```
   * // Remove a single signal
   * removeSignals('foo');
   *
   * // Remove multiple signals
   * removeSignals(['foo', 'bar']);
   *
   * // Remove with options
   * removeSignals('foo', { eventId: '123' });
   * ```
   *
   * @param signalKeys - The signal key or array of keys to remove.
   * @param options - Patch options: onlyIfMissing, eventId, retryDuration.
   * @returns The SSE lines to send.
   */
  public removeSignals(
    signalKeys: string | string[],
    options?: {
      onlyIfMissing?: boolean;
      eventId?: string;
      retryDuration?: number;
    }
  ): ReturnType<typeof this.send> {
    const keys = Array.isArray(signalKeys) ? signalKeys : [signalKeys];
    const patch: Record<string, null> = {};
    for (const key of keys) {
      patch[key] = null;
    }
    return this.patchSignals(JSON.stringify(patch), options);
  }
}
