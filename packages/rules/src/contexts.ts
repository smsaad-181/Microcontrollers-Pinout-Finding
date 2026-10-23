import type { Fact } from './types.js';

/** R1: volts. Receiver abs max is either fixed or `VDDIO + offset`. */
export interface R1Context {
  /** Max voltage the driver can apply to the net (V). */
  readonly driverMaxV: Fact;
  readonly receiverAbsMax:
    | { readonly kind: 'fixed'; readonly volts: Fact }
    | { readonly kind: 'vddio-plus'; readonly vddio: Fact; readonly offsetV: Fact };
}

/** R2: volts (ratios of VDD already resolved by the caller, e.g. with ratioToVolts). */
export interface R2Context {
  readonly driverVohMinV: Fact;
  readonly driverVolMaxV: Fact;
  readonly receiverVihMinV: Fact;
  readonly receiverVilMaxV: Fact;
}

/** R3: I2C pull-ups. */
export interface R3Context {
  /** Every pull-up on the line (ohms), module + board + added. */
  readonly pullUpsOhm: readonly Fact[];
  readonly vddV: Fact;
  readonly volMaxV: Fact;
  readonly iolMa: Fact;
  /** Chosen bus clock (user/engine choice, not a datasheet fact). */
  readonly speedHz: number;
  /** Total bus capacitance estimate (pF). */
  readonly cbPf: Fact;
  /** Spec limit on Cb for the mode (pF); optional, skipped when omitted. */
  readonly cbMaxPf?: Fact | undefined;
}

/** R4: milliamps. */
export interface R4Context {
  readonly pin: { readonly loadMa: Fact; readonly limitMa: Fact };
  readonly groups?: readonly {
    readonly name: string;
    readonly loadsMa: readonly Fact[];
    readonly limitMa: Fact;
  }[];
}

/** R5: 5 V signal into a 3.3 V input through R1 (top) / R2 (bottom). */
export interface R5Context {
  readonly vinNomV: Fact;
  readonly r1Ohm: Fact;
  readonly r2Ohm: Fact;
  /** Receiver supply used for the upper limit (V; its minimum when rail tolerance is known). */
  readonly receiverVddV: Fact;
  /** Receiver VIH,min (V) evaluated per the trace assumption. */
  readonly receiverVihMinV: Fact;
  readonly receiverAbsMaxV?: Fact | undefined;
  /** Fractional tolerance on Vin; defaults to DIVIDER_VIN_TOLERANCE (0.05). */
  readonly tolerance?: number | undefined;
}

export type StrapLevel = 'high' | 'low';
export type RestingLevel = 'high' | 'low' | 'float' | 'driven-high' | 'driven-low' | 'unknown';
export type StrapEffect = 'boot-mode' | 'flash-voltage' | 'other';

/** R6 */
export interface R6Context {
  readonly requiredLevel: StrapLevel | 'any';
  /** Level the strap takes by itself when the net floats (internal pull). */
  readonly defaultLevel: StrapLevel;
  readonly restingLevel: RestingLevel;
  /** What a wrong level changes. */
  readonly effect: StrapEffect;
  readonly evidence?: readonly string[];
}

/** R7: milliamps. */
export interface R7Context {
  readonly rails: readonly {
    readonly name: string;
    readonly loadsMa: readonly Fact[];
    readonly regulatorMa: Fact;
  }[];
  readonly usbLimitMa?: Fact | undefined;
}

/** R8: volts. Divider is optional (ratio 1 when omitted). */
export interface R8Context {
  readonly sensorMaxV: Fact;
  readonly sensorMinV?: Fact | undefined;
  readonly adcMinEffV: Fact;
  readonly adcMaxEffV: Fact;
  readonly divider?: { readonly r1Ohm: Fact; readonly r2Ohm: Fact } | undefined;
  /** Whether the project uses the radio. */
  readonly radioActive: boolean;
  /** Whether the chosen ADC unit works while the radio is active (a catalog fact, boolean). */
  readonly unitRadioCompatible: boolean | undefined;
}
