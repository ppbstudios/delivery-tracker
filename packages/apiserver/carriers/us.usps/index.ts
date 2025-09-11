import axios from 'axios';
import { JSDOM } from 'jsdom';
import {
  ShippingStatus,
  ShippingInformation,
  CarrierModule,
  TrackingError,
} from '../../types/carrier';

const parseStatusId = (s: string): 'at_pickup' | 'delivered' | 'in_transit' => {
  if (s.includes('USPS in possession of item')) return 'at_pickup';
  if (s.includes('Delivered')) return 'delivered';
  return 'in_transit';
};

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
  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}-05:00`;
}

function getTrack(trackId: string): Promise<ShippingInformation> {
  const trimString = (s: string): string => {
    return s.replace(/([\n\t]{1,}|\s{2,})/g, ' ').trim();
  };

  return new Promise<ShippingInformation>((resolve, reject) => {
    axios
      .get('https://tools.usps.com/go/TrackConfirmAction', {
        params: {
          tLabels: trackId,
        },
      })
      .then(res => {
        const shippingInformation: ShippingInformation = {
          state: { id: 'information_received', text: 'information received' },
          progresses: [],
        };

        const dom = new JSDOM(res.data);
        const { document } = dom.window;

        const history = document.querySelectorAll('#trackingHistory_1 span');

        if (history.length === 0) {
          reject({
            code: 404,
            message: trimString(
              document.querySelector('.delivery_status')?.textContent || 'Error'
            ),
          } as TrackingError);
          return;
        }

        for (let i = 0; i < history.length; i += 3) {
          const [time, status, location] = [
            trimString(history[i]?.textContent || ''),
            trimString(history[i + 1]?.textContent || ''),
            trimString(history[i + 2]?.textContent || ''),
          ];

          shippingInformation.progresses.unshift({
            time: getTime(location, time),
            location: { name: location },
            status: { id: parseStatusId(status), text: status },
          });
        }

        const lastProgress =
          shippingInformation.progresses[
            shippingInformation.progresses.length - 1
          ];
        if (lastProgress) {
          shippingInformation.state = lastProgress.status;
          if (lastProgress.status.id === 'delivered')
            shippingInformation.to = { time: lastProgress.time };
        }

        resolve(shippingInformation);
      })
      .catch((err: Error) => reject(err));
  });
}

const carrierModule: CarrierModule = {
  info: {
    name: 'USPS',
  },
  getTrack,
};

export = carrierModule;
