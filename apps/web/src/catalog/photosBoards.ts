// Photos of Boards (see images.ts for the rules). Keys are ids; files live in ../assets/photos/.
import type { Photo } from './images';
import adafruitHuzzah32FeatherImg from '../assets/photos/adafruit-huzzah32-feather.jpg';
import doitEsp32DevkitV130pinImg from '../assets/photos/doit-esp32-devkit-v1-30pin.jpg';
import doitEsp32DevkitV136pinImg from '../assets/photos/doit-esp32-devkit-v1-36pin.jpg';
import espWroverKitImg from '../assets/photos/esp-wrover-kit.jpg';
import esp32C3Devkitm1Img from '../assets/photos/esp32-c3-devkitm-1.jpg';
import esp32C6Devkitc1Img from '../assets/photos/esp32-c6-devkitc-1.jpg';
import esp32DevkitcV4Img from '../assets/photos/esp32-devkitc-v4.jpg';
import esp32S2Saola1Img from '../assets/photos/esp32-s2-saola-1.jpg';
import esp32S3Devkitc1Img from '../assets/photos/esp32-s3-devkitc-1.jpg';
import lolin32Img from '../assets/photos/lolin32.jpg';
import nodemcu32sImg from '../assets/photos/nodemcu-32s.jpg';
import ttgoTDisplayImg from '../assets/photos/ttgo-t-display.jpg';

export const PHOTOS_BOARDS: Record<string, Photo> = {
  'adafruit-huzzah32-feather': {
    src: adafruitHuzzah32FeatherImg,
    credit: 'Adafruit Industries',
    license: 'Product image, used with credit',
    page: 'https://www.adafruit.com/product/3405',
  },
  'doit-esp32-devkit-v1-30pin': {
    src: doitEsp32DevkitV130pinImg,
    credit: 'Kunkune (product listing photo, 30-pin DOIT-style DevKit V1)',
    license: 'Product image, used with credit',
    page: 'https://kunkune.co.uk/shop/esp32-esp8266/esp32-unsoldered-30-pins-nodemcu-development-board-wifi-bluetooth/',
  },
  'doit-esp32-devkit-v1-36pin': {
    src: doitEsp32DevkitV136pinImg,
    credit: 'Kunkune (same 30-pin DOIT-style photo reused; no 36-pin photo found)',
    license: 'Product image, used with credit',
    page: 'https://kunkune.co.uk/shop/esp32-esp8266/esp32-unsoldered-30-pins-nodemcu-development-board-wifi-bluetooth/',
  },
  'esp-wrover-kit': {
    src: espWroverKitImg,
    credit: 'Espressif Systems (ESP-WROVER-KIT v3 photo via 52Pi wiki)',
    license: 'Product image, used with credit',
    page: 'https://wiki.52pi.com/index.php/ESP32_WROVER_KIT_SKU:_EP-0090',
  },
  'esp32-c3-devkitm-1': {
    src: esp32C3Devkitm1Img,
    credit: 'Espressif Systems',
    license: 'Product image, used with credit',
    page: 'https://docs.espressif.com/projects/esp-dev-kits/en/latest/esp32c3/esp32-c3-devkitm-1/user_guide.html',
  },
  'esp32-c6-devkitc-1': {
    src: esp32C6Devkitc1Img,
    credit: 'Espressif Systems',
    license: 'Product image, used with credit',
    page: 'https://docs.espressif.com/projects/esp-dev-kits/en/latest/esp32c6/esp32-c6-devkitc-1/user_guide.html',
  },
  'esp32-devkitc-v4': {
    src: esp32DevkitcV4Img,
    credit: 'Adafruit Industries / CircuitPython.org',
    license: 'Product image, used with credit',
    page: 'https://circuitpython.org/board/espressif_esp32_devkitc_v4_wroom_32e/',
  },
  'esp32-s2-saola-1': {
    src: esp32S2Saola1Img,
    credit: 'Espressif Systems',
    license: 'Product image, used with credit',
    page: 'https://docs.espressif.com/projects/esp-dev-kits/en/latest/esp32s2/esp32-s2-saola-1/index.html',
  },
  'esp32-s3-devkitc-1': {
    src: esp32S3Devkitc1Img,
    credit: 'Espressif Systems',
    license: 'Product image, used with credit',
    page: 'https://docs.espressif.com/projects/esp-dev-kits/en/latest/esp32s3/esp32-s3-devkitc-1/user_guide_v1.1.html',
  },
  'lolin32': {
    src: lolin32Img,
    credit: 'Zbotic',
    license: 'Product image, used with credit',
    page: 'https://zbotic.in/product/wemos-lolin32-v1-0-0-based-on-esp32-rev1-wifi-bluetooth-board/',
  },
  'nodemcu-32s': {
    src: nodemcu32sImg,
    credit: 'ProtoSupplies',
    license: 'Product image, used with credit',
    page: 'https://protosupplies.com/product/esp32-s-development-board/',
  },
  'ttgo-t-display': {
    src: ttgoTDisplayImg,
    credit: 'LilyGO',
    license: 'Product image, used with credit',
    page: 'https://www.lilygo.cc/products/lilygo%C2%AE-ttgo-t-display-1-14-inch-lcd-esp32-control-board',
  },
};
