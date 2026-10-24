// Photos of Waveshare boards (see images.ts for the rules). Keys are ids; files live in ../assets/photos/.
import type { Photo } from './images';
import s3zeroImg from '../assets/photos/waveshare-esp32-s3-zero.jpg';
import c3zeroImg from '../assets/photos/waveshare-esp32-c3-zero.jpg';
import c6zeroImg from '../assets/photos/waveshare-esp32-c6-zero.jpg';
import s3picoImg from '../assets/photos/waveshare-esp32-s3-pico.jpg';
import s3tinyImg from '../assets/photos/waveshare-esp32-s3-tiny.jpg';
import s3devkitn8r8Img from '../assets/photos/waveshare-esp32-s3-dev-kit-n8r8.jpg';

const credit = 'Waveshare (product image)';
const license = 'Product image, used with credit';

export const PHOTOS_WAVESHARE: Record<string, Photo> = {
  'waveshare-esp32-s3-zero': {
    src: s3zeroImg,
    credit,
    license,
    page: 'https://www.waveshare.com/wiki/ESP32-S3-Zero',
  },
  'waveshare-esp32-c3-zero': {
    src: c3zeroImg,
    credit,
    license,
    page: 'https://www.waveshare.com/wiki/ESP32-C3-Zero',
  },
  'waveshare-esp32-c6-zero': {
    src: c6zeroImg,
    credit,
    license,
    page: 'https://www.waveshare.com/wiki/ESP32-C6-Zero',
  },
  'waveshare-esp32-s3-pico': {
    src: s3picoImg,
    credit,
    license,
    page: 'https://www.waveshare.com/wiki/ESP32-S3-Pico',
  },
  'waveshare-esp32-s3-tiny': {
    src: s3tinyImg,
    credit,
    license,
    page: 'https://www.waveshare.com/wiki/ESP32-S3-Tiny',
  },
  'waveshare-esp32-s3-dev-kit-n8r8': {
    src: s3devkitn8r8Img,
    credit,
    license,
    page: 'https://www.waveshare.com/wiki/ESP32-S3-DEV-KIT-N8R8',
  },
};
