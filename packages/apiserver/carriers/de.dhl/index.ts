import axios from 'axios';
import {
  ShippingStatus,
  ShippingInformation,
  CarrierModule,
  TrackingError,
} from '../../types/carrier';

interface DHLStatusMap {
  [key: string]: ShippingStatus;
}

const STATUS_ID_MAP: DHLStatusMap = {
  'picked up': { id: 'at_pickup', text: '상품인수' },
  delivered: { id: 'delivered', text: '배송완료' },
};

function getTime(location: string, date: string, time: string): string {
  // WARNING : Timezone is ignored.
  const dateObj = new Date(date);

  const year = dateObj.getFullYear();
  const month = (dateObj.getMonth() < 9 ? '0' : '') + (dateObj.getMonth() + 1);
  const day = dateObj.getDate();

  // TODO : timezone convert
  return `${year}-${month}-${day}T${time}:00Z`;
}

function getStatus(description: string): ShippingStatus {
  // eslint-disable-next-line no-restricted-syntax
  for (const key of Object.keys(STATUS_ID_MAP)) {
    if (description.toLowerCase().indexOf(key) !== -1)
      return STATUS_ID_MAP[key];
  }
  return { id: 'in_transit', text: '이동중' };
}

interface DHLCheckpoint {
  location: string;
  date: string;
  time: string;
  description: string;
}

interface DHLResponse {
  errors?: Array<{ message: string }>;
  results?: Array<{
    origin: { value: string };
    destination: { value: string };
    checkpoints: DHLCheckpoint[];
  }>;
}

function getTrack(trackId: string): Promise<ShippingInformation> {
  const trimString = (s: string): string => {
    return s.replace(/([\n\t]{1,}|\s{2,})/g, ' ').trim();
  };

  return new Promise<ShippingInformation>((resolve, reject) => {
    axios
      .get<DHLResponse>('https://www.logistics.dhl/shipmentTracking', {
        params: {
          AWB: trackId,
          countryCode: 'g0',
          languageCode: 'en', // TODO :i18n
        },
      })
      .then(res => {
        if (res.data.errors) {
          reject({
            code: 404,
            message: res.data.errors[0].message,
          } as TrackingError);
          return;
        }

        const info = res.data.results?.[0];
        if (!info) {
          reject({
            code: 404,
            message: 'Tracking information not found',
          } as TrackingError);
          return;
        }

        const shippingInformation: ShippingInformation = {
          from: {
            name: info.origin.value,
          },
          to: {
            name: info.destination.value,
          },
          state: { id: 'information_received', text: '접수완료' },
          progresses: [],
        };

        info.checkpoints.forEach(checkpoint => {
          shippingInformation.progresses.unshift({
            time: getTime(
              trimString(checkpoint.location),
              checkpoint.date,
              checkpoint.time
            ),
            status: getStatus(checkpoint.description),
            location: { name: trimString(checkpoint.location) },
            description: checkpoint.description,
          });
        });

        const lastProgress =
          shippingInformation.progresses[
            shippingInformation.progresses.length - 1
          ];
        if (lastProgress) {
          shippingInformation.state = lastProgress.status;
          if (
            lastProgress.status.id === 'delivered' &&
            shippingInformation.to
          ) {
            shippingInformation.to.time = lastProgress.time;
          }
        }

        resolve(shippingInformation);
      })
      .catch((err: Error) => reject(err));
  });
}

const carrierModule: CarrierModule = {
  info: {
    name: 'DHL',
    tel: '+8215880001',
  },
  getTrack,
};

export = carrierModule;
