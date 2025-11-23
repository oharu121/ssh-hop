/**
 * Fluent API for building kubectl exec curl commands
 *
 * @example
 * ```typescript
 * const cmd = new CommandBuilder()
 *   .pod('my-pod')
 *   .token('my-token')
 *   .content('json')
 *   .payload({ key: 'value' })
 *   .api('http://localhost:8080/api/v1/resource')
 *   .create();
 * ```
 */
export class CommandBuilder {
  private commandParts: string[] = [];

  /**
   * Resets the builder to its initial state.
   * Call this before building a new command.
   * @returns {CommandBuilder} The current instance for chaining.
   */
  public reset(): CommandBuilder {
    this.commandParts = [];
    return this;
  }

  /**
   * Sets the initial `kubectl exec` part of the command.
   * This should be the first method called when building a new command.
   * @param {string} podName - The name of the Kubernetes pod.
   * @returns {CommandBuilder} The current instance for chaining.
   */
  public pod(podName: string): CommandBuilder {
    this.reset();
    this.commandParts.push(
      "kubectl",
      "exec",
      podName,
      "--", // Crucial separator for commands executed inside the pod
      "curl",
      "-Lgskv" // Standard curl flags
    );
    return this;
  }

  /**
   * Adds the PATCH method flag.
   * @returns {CommandBuilder} The current instance for chaining.
   */
  public patch(): CommandBuilder {
    this.commandParts.push("-X PATCH");
    return this;
  }

  /**
   * Adds the Authorization header with a Bearer token.
   * @param {string} token - The authentication token.
   * @returns {CommandBuilder} The current instance for chaining.
   */
  public token(token: string): CommandBuilder {
    this.commandParts.push(`-H "Authorization: Bearer ${token}"`);
    return this;
  }

  /**
   * Adds a generic header.
   * @param {string} header - The full header string (e.g., "X-Custom-Header: value").
   * @returns {CommandBuilder} The current instance for chaining.
   */
  public header(header: string): CommandBuilder {
    this.commandParts.push(`-H "${header}"`);
    return this;
  }

  /**
   * Adds the Content-Type header based on the content type.
   * @param {"json" | "form" | "patch"} [type="json"] - The type of content.
   * @returns {CommandBuilder} The current instance for chaining.
   */
  public content(type: "json" | "form" | "patch" = "json"): CommandBuilder {
    let contentType: string;
    switch (type) {
      case "form":
        contentType = "multipart/form-data";
        break;
      case "patch":
        contentType = "application/json-patch+json";
        break;
      default:
        contentType = "application/json";
    }
    this.commandParts.push(`-H "Content-Type: ${contentType}"`);
    return this;
  }

  /**
   * Adds the JSON payload. The payload is properly escaped for shell safety.
   * @param {object} payload - The JSON object to be sent as the body.
   * @returns {CommandBuilder} The current instance for chaining.
   */
  public payload(payload: object): CommandBuilder {
    const jsonString = JSON.stringify(payload);
    // Use single quotes and escape any single quotes within the JSON
    const escapedPayload = jsonString.replace(/'/g, "'\\''");
    this.commandParts.push(`-d '${escapedPayload}'`);
    return this;
  }

  /**
   * Adds the target API endpoint URL.
   * @param {string} api - The API path (e.g., "/api/v1/resource").
   * @returns {CommandBuilder} The current instance for chaining.
   */
  public api(api: string): CommandBuilder {
    this.commandParts.push(`"${api}"`);
    return this;
  }

  /**
   * Adds a form field for metadata.
   * @param {string} meta - The form metadata string.
   * @returns {CommandBuilder} The current instance for chaining.
   */
  public formMeta(meta: string): CommandBuilder {
    this.commandParts.push(`-F "${meta};type=application/json"`);
    return this;
  }

  /**
   * Adds a form field for a file.
   * @param {string} file - The file path string for the form.
   * @returns {CommandBuilder} The current instance for chaining.
   */
  public formFile(file: string): CommandBuilder {
    this.commandParts.push(`-F "${file};type=application/pdf"`);
    return this;
  }

  /**
   * Joins all parts of the command into a single, executable string.
   * @returns {string} The final command string.
   */
  public create(): string {
    return this.commandParts.join(" ");
  }
}
