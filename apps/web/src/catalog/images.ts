// Real photos of boards and modules, keyed by board id (`<id>`, without @revision) or breakout id.
// Every photo must be openly licensed; `credit` is shown next to it. Anything missing falls back to
// the drawn illustration.
import raspberryPiPicoImg from '../assets/photos/raspberry-pi-pico.jpg';
import raspberryPiPicoWImg from '../assets/photos/raspberry-pi-pico-w.jpg';
import arduinoUnoR4MinimaImg from '../assets/photos/arduino-uno-r4-minima.webp';
import lolinD1MiniImg from '../assets/photos/lolin-d1-mini.jpg';
import hcSr044pinImg from '../assets/photos/hc-sr04-4pin.jpg';
import rfidRc522BlueImg from '../assets/photos/rfid-rc522-blue.jpg';
import gy521Img from '../assets/photos/gy-521.jpg';
import potentiometer10kImg from '../assets/photos/potentiometer-10k.jpg';
import pushButtonImg from '../assets/photos/push-button.jpg';
import dht113pinModuleImg from '../assets/photos/dht11-3pin-module.jpg';

import { PHOTOS_BOARDS } from './photosBoards';
import { PHOTOS_MODULES } from './photosModules';
import { PHOTOS_WAVESHARE } from './photosWaveshare';

export interface Photo {
  src: string;
  credit: string;
  license: string;
  page: string;
}

const FIRST_PHOTOS: Record<string, Photo> = {
  'raspberry-pi-pico': {
    src: raspberryPiPicoImg,
    credit: 'Phiarc / Wikimedia Commons',
    license: 'CC BY-SA 4.0',
    page: 'https://commons.wikimedia.org/wiki/File:Raspberry_Pi_Pico_oblique.jpg',
  },
  'raspberry-pi-pico-w': {
    src: raspberryPiPicoWImg,
    credit: 'SparkFun Electronics / Wikimedia Commons',
    license: 'CC BY 2.0',
    page: 'https://commons.wikimedia.org/wiki/File:RPI_PICO_W_1.jpg',
  },
  'arduino-uno-r4-minima': {
    src: arduinoUnoR4MinimaImg,
    credit: 'Arduino / Wikimedia Commons',
    license: 'CC BY-SA 3.0',
    page: 'https://commons.wikimedia.org/wiki/File:Arduino_Uno_R4_Minima.webp',
  },
  'lolin-d1-mini': {
    src: lolinD1MiniImg,
    credit: 'Tpkull / Wikimedia Commons',
    license: 'CC BY-SA 4.0',
    page: 'https://commons.wikimedia.org/wiki/File:WeMos_D1_Mini_front.jpg',
  },
  'hc-sr04-4pin': {
    src: hcSr044pinImg,
    credit: 'Nevit Dilmen / Wikimedia Commons',
    license: 'CC BY-SA 3.0',
    page: 'https://commons.wikimedia.org/wiki/File:HC_SR04_Ultrasonic_sensor_1480319_20_21_HDR_Enhancer.jpg',
  },
  'rfid-rc522-blue': {
    src: rfidRc522BlueImg,
    credit: 'JrawX / Wikimedia Commons',
    license: 'CC0 1.0',
    page: 'https://commons.wikimedia.org/wiki/File:RFID-RC522.jpg',
  },
  'gy-521': {
    src: gy521Img,
    credit: 'Nevit Dilmen / Wikimedia Commons',
    license: 'CC BY-SA 3.0',
    page: 'https://commons.wikimedia.org/wiki/File:GY-521_MPU-6050_Module_3_Axis_Gyroscope_%2B_Accelerometer_0487.jpg',
  },
  'potentiometer-10k': {
    src: potentiometer10kImg,
    credit: 'Nevit Dilmen / Wikimedia Commons',
    license: 'CC BY-SA 3.0',
    page: 'https://commons.wikimedia.org/wiki/File:10K_Potentiometer_1480310_1_2_Enhancer.jpg',
  },
  'push-button': {
    src: pushButtonImg,
    credit: 'Scwerllguy / Wikimedia Commons',
    license: 'CC BY-SA 3.0',
    page: 'https://commons.wikimedia.org/wiki/File:Tactile_switches.jpg',
  },
  'dht11-3pin-module': {
    src: dht113pinModuleImg,
    credit: 'ProtoSupplies (product image)',
    license: 'Product image, used with credit',
    page: 'https://protosupplies.com/product/dht11-humidity-and-temp-sensor-module/',
  },
};

export const PHOTOS: Record<string, Photo> = {
  ...FIRST_PHOTOS,
  ...PHOTOS_BOARDS,
  ...PHOTOS_MODULES,
  ...PHOTOS_WAVESHARE,
};
