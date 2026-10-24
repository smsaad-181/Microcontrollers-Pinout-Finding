// Photos of Modules (see images.ts for the rules). Keys are ids; files live in ../assets/photos/.
import type { Photo } from './images';

import adafruitBme280Img from '../assets/photos/adafruit-bme280.jpg';
import ads1115BreakoutImg from '../assets/photos/ads1115-breakout.jpg';
import gyBme2804pinImg from '../assets/photos/gy-bme280-4pin.jpg';
import gyBme2806pinImg from '../assets/photos/gy-bme280-6pin.jpg';
import dht114pinImg from '../assets/photos/dht11-4pin.jpg';
import relay4chOptoImg from '../assets/photos/relay-board-4ch-opto-jdvcc.jpg';
import relay4chTransistorImg from '../assets/photos/relay-board-4ch-transistor.jpg';
import ssd1306Img from '../assets/photos/ssd1306-128x64-i2c-4pin.jpg';
import st7735sImg from '../assets/photos/st7735s-1.8-spi-tft.jpg';

const LIC = 'Product image, used with credit';

export const PHOTOS_MODULES: Record<string, Photo> = {
  'adafruit-bme280': {
    src: adafruitBme280Img,
    credit: 'Adafruit Industries (product image)',
    license: LIC,
    page: 'https://www.adafruit.com/product/2652',
  },
  'ads1115-breakout': {
    src: ads1115BreakoutImg,
    credit: 'Adafruit Industries (product image)',
    license: LIC,
    page: 'https://www.adafruit.com/product/1085',
  },
  'gy-bme280-4pin': {
    src: gyBme2804pinImg,
    credit: 'ProtoSupplies (product image)',
    license: LIC,
    page: 'https://protosupplies.com/product/bme280-i2c-pressure-humidity-temperature-sensor-module/',
  },
  'gy-bme280-6pin': {
    src: gyBme2806pinImg,
    credit: 'ProtoSupplies (product image)',
    license: LIC,
    page: 'https://protosupplies.com/product/gy-bme280-pressure-humidity-temperature-sensor-module/',
  },
  'dht11-4pin': {
    src: dht114pinImg,
    credit: 'Adafruit Industries (product image)',
    license: LIC,
    page: 'https://www.adafruit.com/product/386',
  },
  'relay-board-4ch-opto-jdvcc': {
    src: relay4chOptoImg,
    credit: 'ProtoSupplies (product image)',
    license: LIC,
    page: 'https://protosupplies.com/product/relay-module-5v-x-4-relay-w-opto-isolation/',
  },
  'relay-board-4ch-transistor': {
    src: relay4chTransistorImg,
    credit: 'Keyestudio (product image)',
    license: LIC,
    page: 'https://www.keyestudio.com/products/free-shipping-2016-new-keyestudio-4-channel-5v-relay-module-for-arduino',
  },
  'ssd1306-128x64-i2c-4pin': {
    src: ssd1306Img,
    credit: 'Controllerstech (product image)',
    license: LIC,
    page: 'https://shop.controllerstech.com/products/0-96-inch-128-64-i2c-4pin-oled-display-module-white',
  },
  'st7735s-1.8-spi-tft': {
    src: st7735sImg,
    credit: 'Controllerstech (product image)',
    license: LIC,
    page: 'https://shop.controllerstech.com/products/1-8-inch-tft-lcd-module-128x160-st7735',
  },
};
