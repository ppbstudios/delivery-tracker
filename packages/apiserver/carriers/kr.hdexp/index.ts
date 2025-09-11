import axios from 'axios';
import {
  ShippingStatus,
  ShippingInformation,
  CarrierModule,
  TrackingError,
} from '../../types/carrier';

interface StatusIdMap {
  [key: string]: 'at_pickup' | 'out_for_delivery' | 'delivered' | 'in_transit';
}

const STATUS_ID_MAP: StatusIdMap = {
  집하입고: 'at_pickup',
  영업소상차: 'at_pickup',
  배송출발: 'out_for_delivery',
  배송완료: 'delivered',
  배달완료: 'delivered',
};

interface HDExpProgress {
  reg_date: string;
  stat: string;
  location: string;
  tel: string;
}

interface HDExpResponse {
  result: string;
  info: {
    send_name: string;
    re_name: string;
    prod: string;
  };
  items: HDExpProgress[];
}

function getTrack(trackId: string): Promise<ShippingInformation> {
  return new Promise<ShippingInformation>((resolve, reject) => {
    axios
      .get<HDExpResponse>('https://hdexp.co.kr/deliverySearch2.hd', {
        params: {
          barcode: trackId,
        },
      })
      .then(res => {
        if (res.data.result !== 'suc') {
          reject({
            code: 404,
            message:
              '운송장이 등록되지 않았거나 업체에서 상품을 준비중이니 업체로 문의해주시기 바랍니다.',
          } as TrackingError);
          return;
        }

        const { info } = res.data;

        const shippingInformation: ShippingInformation = {
          from: {
            name: info.send_name,
          },
          to: {
            name: info.re_name,
          },
          state: { id: 'information_received', text: '접수완료' },
          item: info.prod,
          progresses: [],
        };

        res.data.items.forEach(progress => {
          shippingInformation.progresses.push({
            time:
              progress.reg_date !== '알수없음'
                ? `${progress.reg_date.replace(' ', 'T')}+09:00`
                : undefined,
            status: {
              id: STATUS_ID_MAP[progress.stat] || 'in_transit',
              text: progress.stat,
            },
            location: { name: progress.location },
            description: `연락처: ${progress.tel}`,
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
            shippingInformation.to &&
            lastProgress.time
          )
            shippingInformation.to.time = lastProgress.time;
        }

        resolve(shippingInformation);
      })
      .catch((err: Error) => reject(err));
  });
}

const carrierModule: CarrierModule = {
  info: {
    name: '합동택배',
    tel: '+8218993392',
  },
  getTrack,
};

export = carrierModule;
