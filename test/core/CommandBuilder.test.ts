import { describe, it, expect, beforeEach } from "vitest";
import { CommandBuilder } from "../../src/core/CommandBuilder";

describe("CommandBuilder", () => {
  let builder: CommandBuilder;

  beforeEach(() => {
    builder = new CommandBuilder();
  });

  describe("Basic Command Building", () => {
    it("should build a basic kubectl exec curl command", () => {
      const cmd = builder.pod("test-pod").api("http://localhost:8080").create();

      expect(cmd).toContain("kubectl exec test-pod");
      expect(cmd).toContain("curl -Lgskv");
      expect(cmd).toContain('"http://localhost:8080"');
    });

    it("should include the -- separator", () => {
      const cmd = builder.pod("test-pod").api("http://api").create();

      expect(cmd).toContain(" -- ");
    });

    it("should reset when pod() is called", () => {
      builder.pod("pod1").token("token1");
      const cmd = builder.pod("pod2").api("http://api").create();

      expect(cmd).toContain("pod2");
      expect(cmd).not.toContain("pod1");
      expect(cmd).not.toContain("token1");
    });
  });

  describe("HTTP Methods", () => {
    it("should add PATCH method flag", () => {
      const cmd = builder
        .pod("test-pod")
        .patch()
        .api("http://localhost:8080")
        .create();

      expect(cmd).toContain("-X PATCH");
    });
  });

  describe("Headers", () => {
    it("should add authorization header with token", () => {
      const cmd = builder
        .pod("test-pod")
        .token("my-bearer-token")
        .api("http://localhost:8080")
        .create();

      expect(cmd).toContain('-H "Authorization: Bearer my-bearer-token"');
    });

    it("should add custom headers", () => {
      const cmd = builder
        .pod("test-pod")
        .header("X-Custom-Header: value")
        .api("http://localhost:8080")
        .create();

      expect(cmd).toContain('-H "X-Custom-Header: value"');
    });

    it("should add multiple headers", () => {
      const cmd = builder
        .pod("test-pod")
        .header("X-Header-1: value1")
        .header("X-Header-2: value2")
        .api("http://localhost:8080")
        .create();

      expect(cmd).toContain('-H "X-Header-1: value1"');
      expect(cmd).toContain('-H "X-Header-2: value2"');
    });
  });

  describe("Content Types", () => {
    it("should add JSON content type by default", () => {
      const cmd = builder
        .pod("test-pod")
        .content()
        .api("http://localhost:8080")
        .create();

      expect(cmd).toContain('-H "Content-Type: application/json"');
    });

    it("should add JSON content type explicitly", () => {
      const cmd = builder
        .pod("test-pod")
        .content("json")
        .api("http://localhost:8080")
        .create();

      expect(cmd).toContain('-H "Content-Type: application/json"');
    });

    it("should add form content type", () => {
      const cmd = builder
        .pod("test-pod")
        .content("form")
        .api("http://localhost:8080")
        .create();

      expect(cmd).toContain('-H "Content-Type: multipart/form-data"');
    });

    it("should add JSON patch content type", () => {
      const cmd = builder
        .pod("test-pod")
        .content("patch")
        .api("http://localhost:8080")
        .create();

      expect(cmd).toContain('-H "Content-Type: application/json-patch+json"');
    });
  });

  describe("Payload", () => {
    it("should add JSON payload with proper escaping", () => {
      const cmd = builder
        .pod("test-pod")
        .payload({ key: "value", number: 123 })
        .api("http://localhost:8080")
        .create();

      expect(cmd).toContain('-d \'{"key":"value","number":123}\'');
    });

    it("should escape single quotes in payload", () => {
      const cmd = builder
        .pod("test-pod")
        .payload({ message: "it's working" })
        .api("http://localhost:8080")
        .create();

      expect(cmd).toContain("it'\\''s working");
    });

    it("should handle complex nested objects", () => {
      const payload = {
        user: {
          name: "John",
          age: 30,
        },
        items: ["item1", "item2"],
      };

      const cmd = builder
        .pod("test-pod")
        .payload(payload)
        .api("http://localhost:8080")
        .create();

      expect(cmd).toContain('"user"');
      expect(cmd).toContain('"name":"John"');
      expect(cmd).toContain('"items"');
    });
  });

  describe("Form Data", () => {
    it("should add form metadata field", () => {
      const cmd = builder
        .pod("test-pod")
        .formMeta('metadata={"key":"value"}')
        .api("http://localhost:8080")
        .create();

      expect(cmd).toContain('-F "metadata={"key":"value"};type=application/json"');
    });

    it("should add form file field", () => {
      const cmd = builder
        .pod("test-pod")
        .formFile("file=@/path/to/file.pdf")
        .api("http://localhost:8080")
        .create();

      expect(cmd).toContain('-F "file=@/path/to/file.pdf;type=application/pdf"');
    });

    it("should support multiple form fields", () => {
      const cmd = builder
        .pod("test-pod")
        .formMeta('meta={"id":1}')
        .formFile("file=@/path/to/doc.pdf")
        .api("http://localhost:8080")
        .create();

      expect(cmd).toContain('-F "meta=');
      expect(cmd).toContain('-F "file=');
    });
  });

  describe("API Endpoint", () => {
    it("should wrap API endpoint in quotes", () => {
      const cmd = builder.pod("test-pod").api("http://localhost:8080/api/v1").create();

      expect(cmd).toContain('"http://localhost:8080/api/v1"');
    });

    it("should handle complex URLs", () => {
      const url = "http://api.example.com:8080/v1/resource?param=value&other=123";
      const cmd = builder.pod("test-pod").api(url).create();

      expect(cmd).toContain(`"${url}"`);
    });
  });

  describe("Method Chaining", () => {
    it("should support full method chaining", () => {
      const cmd = builder
        .pod("my-pod")
        .patch()
        .token("auth-token")
        .header("X-Custom: value")
        .content("json")
        .payload({ data: "test" })
        .api("http://localhost:8080/endpoint")
        .create();

      expect(cmd).toContain("kubectl");
      expect(cmd).toContain("my-pod");
      expect(cmd).toContain("-X PATCH");
      expect(cmd).toContain("auth-token");
      expect(cmd).toContain("X-Custom");
      expect(cmd).toContain("application/json");
      expect(cmd).toContain("data");
      expect(cmd).toContain("localhost:8080");
    });

    it("should allow building multiple commands with same instance", () => {
      const cmd1 = builder.pod("pod1").api("http://api1").create();
      const cmd2 = builder.pod("pod2").api("http://api2").create();

      expect(cmd1).toContain("pod1");
      expect(cmd1).toContain("api1");
      expect(cmd1).not.toContain("pod2");
      expect(cmd1).not.toContain("api2");

      expect(cmd2).toContain("pod2");
      expect(cmd2).toContain("api2");
      expect(cmd2).not.toContain("pod1");
      expect(cmd2).not.toContain("api1");
    });
  });

  describe("Reset Functionality", () => {
    it("should reset command parts manually", () => {
      builder.pod("pod1").token("token1");
      builder.reset();
      const cmd = builder.pod("pod2").api("http://api").create();

      expect(cmd).toContain("pod2");
      expect(cmd).not.toContain("pod1");
      expect(cmd).not.toContain("token1");
    });
  });

  describe("Edge Cases", () => {
    it("should handle empty payload", () => {
      const cmd = builder.pod("test-pod").payload({}).api("http://api").create();

      expect(cmd).toContain("-d '{}'");
    });

    it("should handle special characters in URLs", () => {
      const url = "http://api.com/path?q=test&filter[status]=active";
      const cmd = builder.pod("pod").api(url).create();

      expect(cmd).toContain(`"${url}"`);
    });

    it("should handle all curl flags", () => {
      const cmd = builder.pod("pod").api("http://api").create();

      expect(cmd).toContain("curl -Lgskv");
    });
  });
});
