import axios from 'axios';
import { Iconv } from 'iconv';
import { JSDOM } from 'jsdom';
import {
  ShippingStatus,
  ShippingInformation,
  CarrierModule,
  TrackingError,
} from '../../types/carrier';

const iconv = new Iconv('EUC-KR', 'UTF-8//TRANSLIT//IGNORE');

interface StatusIdMap {
  [key: string]: 'out_for_delivery' | 'delivered';
}

const STATUS_ID_MAP: StatusIdMap = {
  '직원 배송중': 'out_for_delivery',
  배달완료: 'delivered',
};

function getTrack(trackId: string): Promise<ShippingInformation> {
  const trimString = (s: string): string => {
    return s.replace(/([\n\t]{1,}|\s{2,})/g, ' ').trim();
  };

  return new Promise<ShippingInformation>((resolve, reject) => {
    axios
      .get('http://www.ilyanglogis.com/functionality/popup_result.asp', {
        params: {
          hawb_no: trackId,
        },
        responseType: 'arraybuffer',
      })
      .then(res => {
        const dom = new JSDOM(iconv.convert(res.data).toString('utf-8'));
        const { document } = dom.window;

        if (!document.querySelector('dd')) {
          reject({
            code: 404,
            message:
              '운송장이 등록되지 않았거나 업체에서 상품을 준비중이니 업체로 문의해주시기 바랍니다.',
          } as TrackingError);
          return;
        }

        const infoElements = document.querySelectorAll('dd');
        const progressElements =
          document.querySelector('tbody')?.querySelectorAll('tr') || [];
        return {
          info: infoElements,
          progresses: progressElements,
        };
      })
      .then(({ info, progresses }) => {
        const shippingInformation: ShippingInformation = {
          from: {
            name: trimString(info[1]?.textContent || ''),
          },
          to: {
            name: trimString(info[2]?.textContent || ''),
          },
          state: { id: 'information_received', text: '접수' },
          progresses: [],
        };

        progresses.forEach(element => {
          const tds = element.querySelectorAll('td');

          shippingInformation.progresses.push({
            time: `${trimString(tds[0]?.textContent || '')}T${trimString(
              tds[1]?.textContent || ''
            )}:00+09:00`,
            location: { name: trimString(tds[3]?.textContent || '') },
            description: trimString(tds[4]?.textContent || '')
              ? `연락처: ${trimString(tds[4].textContent)}`
              : undefined,
            status: {
              id:
                STATUS_ID_MAP[trimString(tds[2]?.textContent || '')] ||
                'in_transit',
              text: trimString(tds[2]?.textContent || ''),
            },
          });
        });

        const lastProgress =
          shippingInformation.progresses[
            shippingInformation.progresses.length - 1
          ];
        if (lastProgress) {
          shippingInformation.state = lastProgress.status;
          if (lastProgress.status.id === 'delivered' && shippingInformation.to)
            shippingInformation.to.time = lastProgress.time;
        }

        resolve(shippingInformation);
      })
      .catch((err: Error) => reject(err));
  });
}

const carrierModule: CarrierModule = {
  info: {
    name: '일양로지스',
    tel: '+8215880002',
  },
  getTrack,
};

export = carrierModule;
