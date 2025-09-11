import axios from 'axios';
import { JSDOM } from 'jsdom';
import {
  ShippingStatus,
  ShippingInformation,
  CarrierModule,
  TrackingError,
} from '../../types/carrier';

const parseStatusId = (s: string): 'at_pickup' | 'delivered' | 'in_transit' => {
  if (s.includes('集荷')) return 'at_pickup';
  if (s.includes('保管中')) return 'delivered';
  return 'in_transit';
};

// "02/01 16:59"
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
      .get('http://k2k.sagawa-exp.co.jp/p/web/okurijosearch.do', {
        params: {
          okurijoNo: trackId,
        },
      })
      .then(res => {
        const dom = new JSDOM(res.data);
        const [info, progresses] = dom.window.document.querySelectorAll(
          'table.table_basic.table_okurijo_detail2'
        );
        if (!info || !progresses || info.querySelectorAll('tr').length !== 5) {
          const errorMessage =
            info?.querySelectorAll('tr')[5]?.textContent ||
            'Invalid tracking number';
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
          const [status, time, office] = history[i].querySelectorAll('td');
          if (!status || !time || !office) continue;

          shippingInformation.progresses.push({
            time: getTime(time.textContent || ''),
            location: { name: office.textContent || '' },
            status: {
              id: parseStatusId(status.textContent || ''),
              text: status.textContent || '',
            },
          });
        }

        const lastProgress =
          shippingInformation.progresses[
            shippingInformation.progresses.length - 1
          ];
        if (lastProgress) {
          shippingInformation.state = lastProgress.status;
          if (lastProgress.status.id === 'delivered') {
            shippingInformation.to = { time: lastProgress.time };
          }
        }

        resolve(shippingInformation);
      })
      .catch((err: Error) => reject(err));
  });
}

const carrierModule: CarrierModule = {
  info: {
    name: 'Sagawa',
    tel: '+810120189595',
  },
  getTrack,
};

export = carrierModule;
