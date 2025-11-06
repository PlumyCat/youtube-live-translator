/**
 * Latency Monitor for tracking pipeline performance
 */
import { createComponentLogger } from './logger';
import type { LatencyMetrics } from '@shared/types/pipeline';

const logger = createComponentLogger('LatencyMonitor');

interface StageTimestamp {
  startTime: number;
  endTime?: number;
  duration?: number;
}

/**
 * Monitor latency across pipeline stages
 */
export class LatencyMonitor {
  private stages: Map<string, StageTimestamp> = new Map();
  private targetLatency: number;
  private history: LatencyMetrics[] = [];
  private maxHistorySize = 100;

  constructor(targetLatency: number = 2000) {
    this.targetLatency = targetLatency;
  }

  /**
   * Mark the start of a pipeline stage
   */
  startStage(stage: string): void {
    this.stages.set(stage, {
      startTime: Date.now(),
    });
    logger.debug({ stage }, `Stage started: ${stage}`);
  }

  /**
   * Mark the end of a pipeline stage
   */
  endStage(stage: string): number {
    const stageData = this.stages.get(stage);
    if (!stageData) {
      logger.warn({ stage }, `Stage not found: ${stage}`);
      return 0;
    }

    const endTime = Date.now();
    const duration = endTime - stageData.startTime;

    stageData.endTime = endTime;
    stageData.duration = duration;

    logger.debug({ stage, duration }, `Stage completed: ${stage} (${duration}ms)`);

    return duration;
  }

  /**
   * Calculate total latency and generate metrics
   */
  calculateMetrics(): LatencyMetrics {
    const captureData = this.stages.get('capture');
    const sttData = this.stages.get('stt');
    const translationData = this.stages.get('translation');
    const ttsData = this.stages.get('tts');
    const outputData = this.stages.get('output');

    const metrics: LatencyMetrics = {
      total: 0,
      capture: captureData?.duration || 0,
      stt: sttData?.duration || 0,
      translation: translationData?.duration || 0,
      tts: ttsData?.duration || 0,
      output: outputData?.duration || 0,
      timestamp: Date.now(),
    };

    metrics.total =
      metrics.capture + metrics.stt + metrics.translation + metrics.tts + metrics.output;

    // Add to history
    this.history.push(metrics);
    if (this.history.length > this.maxHistorySize) {
      this.history.shift();
    }

    // Log warning if above target
    if (metrics.total > this.targetLatency) {
      logger.warn(
        {
          total: metrics.total,
          target: this.targetLatency,
          breakdown: metrics,
        },
        `Latency above target: ${metrics.total}ms > ${this.targetLatency}ms`
      );
    }

    return metrics;
  }

  /**
   * Get average latency from history
   */
  getAverageLatency(): {
    total: number;
    capture: number;
    stt: number;
    translation: number;
    tts: number;
    output: number;
  } {
    if (this.history.length === 0) {
      return { total: 0, capture: 0, stt: 0, translation: 0, tts: 0, output: 0 };
    }

    const sum = this.history.reduce(
      (acc, metrics) => ({
        total: acc.total + metrics.total,
        capture: acc.capture + metrics.capture,
        stt: acc.stt + metrics.stt,
        translation: acc.translation + metrics.translation,
        tts: acc.tts + metrics.tts,
        output: acc.output + metrics.output,
      }),
      { total: 0, capture: 0, stt: 0, translation: 0, tts: 0, output: 0 }
    );

    const count = this.history.length;

    return {
      total: Math.round(sum.total / count),
      capture: Math.round(sum.capture / count),
      stt: Math.round(sum.stt / count),
      translation: Math.round(sum.translation / count),
      tts: Math.round(sum.tts / count),
      output: Math.round(sum.output / count),
    };
  }

  /**
   * Get percentile latency from history
   */
  getPercentileLatency(percentile: number): number {
    if (this.history.length === 0) return 0;

    const sorted = [...this.history].map(m => m.total).sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)] || 0;
  }

  /**
   * Check if latency is within target
   */
  isWithinTarget(): boolean {
    if (this.history.length === 0) return true;
    const latest = this.history[this.history.length - 1];
    return latest ? latest.total <= this.targetLatency : true;
  }

  /**
   * Reset all stages
   */
  reset(): void {
    this.stages.clear();
  }

  /**
   * Clear history
   */
  clearHistory(): void {
    this.history = [];
  }

  /**
   * Get statistics
   */
  getStats(): {
    average: {
      total: number;
      capture: number;
      stt: number;
      translation: number;
      tts: number;
      output: number;
    };
    p50: number;
    p95: number;
    p99: number;
    sampleCount: number;
    withinTarget: boolean;
  } {
    return {
      average: this.getAverageLatency(),
      p50: this.getPercentileLatency(50),
      p95: this.getPercentileLatency(95),
      p99: this.getPercentileLatency(99),
      sampleCount: this.history.length,
      withinTarget: this.isWithinTarget(),
    };
  }
}
