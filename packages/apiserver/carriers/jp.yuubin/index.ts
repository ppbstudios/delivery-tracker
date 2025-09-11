import axios from 'axios';
import { JSDOM } from 'jsdom';
import {
  ShippingStatus,
  ShippingInformation,
  CarrierModule,
  TrackingError,
} from '../../types/carrier';

const parseStatusId = (
  s: string
): 'at_pickup' | 'out_for_delivery' | 'delivered' | 'in_transit' => {
  if (s.includes('Posting/Collection')) return 'at_pickup';
  if (s.includes('Final delivery')) return 'delivered';
  return 'in_transit';
};

// "06/20/2019 16:33"
function getTime(location: string, time: string): string {
  // WARNING : Timezone is ignored.
  const dateObj = new Date(time);

  const year = dateObj.getFullYear();
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
      .get('http://tracking.post.japanpost.jp/service/singleSearch.do', {
        params: {
          'org.apache.struts.taglib.html.TOKEN': '',
          searchKind: 5002,
          locale: 'ja', // en, ja
          SVID: '',
          reqCodeNo1: trackId,
        },
      })
      .then(res => {
        const dom = new JSDOM(res.data);
        const progresses = dom.window.document.querySelector(
          'table[summary="履歴情報"]'
        );
        if (!progresses) {
          const errorElement =
            dom.window.document.querySelectorAll('td ,txt_l')[1];
          reject({
            code: 404,
            message:
              errorElement?.textContent || 'Tracking information not found',
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

        for (let i = 2; i < history.length; i += 2) {
          const [time, status, , office, location] =
            history[i].querySelectorAll('td');
          if (!time || !status || !office || !location) continue;

          shippingInformation.progresses.push({
            time: getTime(location.textContent || '', time.textContent || ''),
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
    name: 'Japan Post',
    tel: '+810570046111',
  },
  getTrack,
};

export = carrierModule;
