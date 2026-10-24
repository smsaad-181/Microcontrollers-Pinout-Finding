// Module categories for the picker. Display-only grouping, kept in the app (the catalog schema has no
// category field); a part not listed falls under "Other".
export interface Category {
  id: string;
  label: string;
}

export const CATEGORIES: readonly Category[] = [
  { id: 'temperature', label: 'Temperature / Humidity / Pressure' },
  { id: 'motion', label: 'Motion / Gyro / Compass' },
  { id: 'distance', label: 'Distance / Proximity' },
  { id: 'display', label: 'Displays' },
  { id: 'rfid', label: 'RFID / Wireless tags' },
  { id: 'relay', label: 'Relays / Switching' },
  { id: 'analog', label: 'Analog inputs / ADC' },
  { id: 'input', label: 'Buttons / Knobs' },
  { id: 'other', label: 'Other' },
];

const BY_IC: Record<string, string> = {
  bme280: 'temperature',
  dht11: 'temperature',
  'mpu-6050': 'motion',
  'hc-sr04': 'distance',
  ssd1306: 'display',
  st7735s: 'display',
  mfrc522: 'rfid',
  'srd-05vdc-sl-c': 'relay',
  ads1115: 'analog',
  'potentiometer-10k': 'analog',
  'push-button': 'input',
};

export const categoryOf = (ic: string): string => BY_IC[ic] ?? 'other';
