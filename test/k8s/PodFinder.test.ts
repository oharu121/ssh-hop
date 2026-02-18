import { describe, it, expect, vi, beforeEach } from "vitest";
import { PodFinder } from "../../src/k8s/PodFinder";

describe("PodFinder", () => {
  let mockOrchestrator: any;
  let podFinder: PodFinder;

  beforeEach(() => {
    mockOrchestrator = {
      execRemote: vi.fn(),
    };
    podFinder = new PodFinder(mockOrchestrator);
  });

  describe("searchPods", () => {
    it("should search for pods matching a pattern", async () => {
      const mockOutput = `utility-abc123-xyz   1/1   Running   0   2d
utility-def456-uvw   1/1   Running   0   1d`;

      mockOrchestrator.execRemote.mockResolvedValue(mockOutput);

      const pods = await podFinder.searchPods("utility");

      expect(mockOrchestrator.execRemote).toHaveBeenCalledWith(
        expect.stringContaining('grep "utility"')
      );
      expect(pods).toHaveLength(2);
      expect(pods[0].name).toBe("utility-abc123-xyz");
      expect(pods[0].status).toBe("Running");
      expect(pods[1].name).toBe("utility-def456-uvw");
    });

    it("should include namespace flag when provided", async () => {
      mockOrchestrator.execRemote.mockResolvedValue("");

      await podFinder.searchPods("test", "my-namespace");

      expect(mockOrchestrator.execRemote).toHaveBeenCalledWith(
        expect.stringContaining("-n my-namespace")
      );
    });

    it("should return empty array when no pods match", async () => {
      mockOrchestrator.execRemote.mockResolvedValue("");

      const pods = await podFinder.searchPods("nonexistent");

      expect(pods).toHaveLength(0);
    });

    it("should parse all pod output columns correctly", async () => {
      const mockOutput = `my-pod-123   2/2   Running   5   10h`;
      mockOrchestrator.execRemote.mockResolvedValue(mockOutput);

      const pods = await podFinder.searchPods("my-pod");

      expect(pods[0]).toEqual({
        name: "my-pod-123",
        ready: "2/2",
        status: "Running",
        restarts: "5",
        age: "10h",
      });
    });
  });

  describe("getAllPods", () => {
    it("should get all pods in namespace", async () => {
      const mockOutput = `pod1   1/1   Running   0   1d
pod2   1/1   Pending   0   2h`;

      mockOrchestrator.execRemote.mockResolvedValue(mockOutput);

      const pods = await podFinder.getAllPods();

      expect(mockOrchestrator.execRemote).toHaveBeenCalledWith(
        expect.stringContaining("kubectl get pods")
      );
      expect(pods).toHaveLength(2);
    });
  });

  describe("getRunningPods", () => {
    it("should filter to only running pods", async () => {
      const mockOutput = `pod1   1/1   Running   0   1d
pod2   0/1   Pending   0   2h
pod3   1/1   Running   0   3h
pod4   0/1   CrashLoopBackOff   5   1h`;

      mockOrchestrator.execRemote.mockResolvedValue(mockOutput);

      const pods = await podFinder.getRunningPods("pod");

      expect(pods).toHaveLength(2);
      expect(pods[0].name).toBe("pod1");
      expect(pods[1].name).toBe("pod3");
      expect(pods.every((p) => p.status === "Running")).toBe(true);
    });
  });

  describe("findFirstRunningPod", () => {
    it("should return first running pod", async () => {
      const mockOutput = `utility-pending   0/1   Pending   0   1h
utility-running   1/1   Running   0   2h`;

      mockOrchestrator.execRemote.mockResolvedValue(mockOutput);

      const pod = await podFinder.findFirstRunningPod("utility");

      expect(pod).not.toBeNull();
      expect(pod!.name).toBe("utility-running");
      expect(pod!.status).toBe("Running");
    });

    it("should return null when no running pods found", async () => {
      const mockOutput = `utility-pending   0/1   Pending   0   1h`;
      mockOrchestrator.execRemote.mockResolvedValue(mockOutput);

      const pod = await podFinder.findFirstRunningPod("utility");

      expect(pod).toBeNull();
    });

    it("should return null when no pods match pattern", async () => {
      mockOrchestrator.execRemote.mockResolvedValue("");

      const pod = await podFinder.findFirstRunningPod("nonexistent");

      expect(pod).toBeNull();
    });
  });

  describe("getPodIP", () => {
    it("should get pod IP address", async () => {
      mockOrchestrator.execRemote.mockResolvedValue("'10.0.1.50'");

      const ip = await podFinder.getPodIP("my-pod");

      expect(mockOrchestrator.execRemote).toHaveBeenCalledWith(
        expect.stringContaining("jsonpath='{.status.podIP}'")
      );
      expect(ip).toBe("10.0.1.50");
    });

    it("should include namespace in command when provided", async () => {
      mockOrchestrator.execRemote.mockResolvedValue("'10.0.1.50'");

      await podFinder.getPodIP("my-pod", "my-namespace");

      expect(mockOrchestrator.execRemote).toHaveBeenCalledWith(
        expect.stringContaining("-n my-namespace")
      );
    });

    it("should return empty string when pod not found", async () => {
      mockOrchestrator.execRemote.mockResolvedValue("");

      const ip = await podFinder.getPodIP("nonexistent");

      expect(ip).toBe("");
    });
  });

  describe("searchPodsWithIP", () => {
    it("should return pods with IP addresses populated", async () => {
      const mockOutput = `pod1   1/1   Running   0   1d
pod2   1/1   Running   0   2d`;

      mockOrchestrator.execRemote
        .mockResolvedValueOnce(mockOutput)
        .mockResolvedValueOnce("'10.0.1.1'")
        .mockResolvedValueOnce("'10.0.1.2'");

      const pods = await podFinder.searchPodsWithIP("pod");

      expect(pods).toHaveLength(2);
      expect(pods[0].ip).toBe("10.0.1.1");
      expect(pods[1].ip).toBe("10.0.1.2");
    });
  });

  describe("isPodRunning", () => {
    it("should return true for running pod", async () => {
      mockOrchestrator.execRemote.mockResolvedValue("'Running'");

      const isRunning = await podFinder.isPodRunning("my-pod");

      expect(isRunning).toBe(true);
    });

    it("should return false for non-running pod", async () => {
      mockOrchestrator.execRemote.mockResolvedValue("'Pending'");

      const isRunning = await podFinder.isPodRunning("my-pod");

      expect(isRunning).toBe(false);
    });

    it("should return false when pod not found", async () => {
      mockOrchestrator.execRemote.mockResolvedValue("");

      const isRunning = await podFinder.isPodRunning("nonexistent");

      expect(isRunning).toBe(false);
    });
  });
});
