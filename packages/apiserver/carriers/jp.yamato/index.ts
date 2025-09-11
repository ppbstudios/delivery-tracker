import axios from 'axios';
import { Iconv } from 'iconv';
import { JSDOM } from 'jsdom';
import * as qs from 'querystring';
import {
  ShippingStatus,
  ShippingInformation,
  CarrierModule,
  TrackingError,
} from '../../types/carrier';

const iconv = new Iconv('SHIFT_JIS', 'UTF-8//TRANSLIT//IGNORE');

const parseStatusId = (s: string): 'at_pickup' | 'delivered' | 'in_transit' => {
  if (s.includes('荷物受付')) return 'at_pickup';
  if (s.includes('保管中')) return 'delivered';
  return 'in_transit';
};

// 02/01 12:19
function getTime(time: string): string {
  const dateObj = new Date(time);

  const year = new Date().getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const day = String(dateObj.getDate()).padStart(2, '0');

  const hours = String(dateObj.getHours()).padStart(2, '0');
  const minutes = String(dateObj.getMinutes()).padStart(2, '0');
  const seconds = String(dateObj.getSeconds()).padStart(2, '0');

  // TODO : timezone convert
  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}+09:00`;
}

function getTrack(trackId: string): Promise<ShippingInformation> {
  return new Promise<ShippingInformation>((resolve, reject) => {
    axios
      .post(
        'http://toi.kuronekoyamato.co.jp/cgi-bin/tneko',
        qs.stringify({
          number00: 1,
          number01: trackId,
        }),
        {
          responseType: 'arraybuffer',
        }
      )
      .then(res => {
        const dom = new JSDOM(iconv.convert(res.data).toString('utf-8'));
        const progresses = dom.window.document.querySelector('table.meisai');
        if (!progresses) {
          const info = dom.window.document.querySelectorAll('table.saisin tr');
          const errorMessage =
            info.length >= 4
              ? `${info[2]?.textContent?.trim()} ${info[3]?.textContent?.trim()}`
              : 'Tracking information not found';
          reject({
            code: 404,
            message: errorMessage,
          } as TrackingError);
          return;
        }
        return { progresses };
      })
      .then(({ progresses }) => {
        if (!progresses) {
          reject({
            code: 404,
            message: 'Tracking information not found',
          } as TrackingError);
          return;
        }

        const shippingInformation: ShippingInformation = {
          state: { id: 'information_received', text: 'information received' },
          progresses: [],
        };

        const history = progresses.querySelectorAll('tr');

        for (let i = 1; i < history.length; i += 1) {
          const [, status, date, time, office] =
            history[i].querySelectorAll('td');
          if (!status || !date || !time || !office) continue;

          shippingInformation.progresses.push({
            time: getTime(`${date.textContent} ${time.textContent}`),
            location: { name: office.textContent || '' },
            status: {
              id: parseStatusId(status.textContent || ''),
              text: status.textContent || '',
            },
          });
        }

        // const lastProgress =
        //   shippingInformation.progresses[
        //     shippingInformation.progresses.length - 1
        //   ];
        // if (lastProgress) {
        //   shippingInformation.state = lastProgress.status;
        //   if (lastProgress.status.id === 'delivered')
        //     shippingInformation.to = { time: lastProgress.time };
        // }

        resolve(shippingInformation);
      })
      .catch((err: Error) => reject(err));
  });
}

const carrierModule: CarrierModule = {
  info: {
    name: 'Kuroneko Yamato',
    tel: '+810120189595',
  },
  getTrack,
};

export = carrierModule;
