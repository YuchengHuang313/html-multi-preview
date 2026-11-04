/** This private fork never sends usage data to Microsoft or another service. */
export class TelemetryReporter {
    constructor(..._args: unknown[]) {}
    sendTelemetryEvent(..._args: unknown[]): void {}
    sendTelemetryErrorEvent(..._args: unknown[]): void {}
    dispose(): void {}
}

export type TelemetryEventProperties = Record<string, string>;
export type TelemetryEventMeasurements = Record<string, number>;
