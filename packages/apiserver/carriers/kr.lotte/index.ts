import axios from 'axios';
import { JSDOM } from 'jsdom';
import * as qs from 'querystring';
import {
  ShippingStatus,
  ShippingInformation,
  CarrierModule,
  TrackingError,
} from '../../types/carrier';

const parseStatus = (s: string): ShippingStatus => {
  if (s.includes('상품접수')) return { id: 'at_pickup', text: '상품인수' };
  if (s.includes('배송 출발'))
    return { id: 'out_for_delivery', text: '배송출발' };
  if (s.includes('배달 완료')) return { id: 'delivered', text: '배송완료' };
  return { id: 'in_transit', text: '이동중' };
};

function getTrack(trackId: string): Promise<ShippingInformation> {
  return new Promise<ShippingInformation>((resolve, reject) => {
    axios
      .post(
        'https://www.lotteglogis.com/home/reservation/tracking/linkView',
        qs.stringify({
          InvNo: trackId,
        })
      )
      .then(res => {
        const dom = new JSDOM(res.data);
        const { document } = dom.window;

        const tables = document.querySelectorAll('.tblH');

        return {
          informationTable: tables[0],
          progressTable: tables[1],
        };
      })
      .then(({ informationTable, progressTable }) => {
        const information =
          informationTable?.querySelectorAll('tbody > tr > td') || [];

        if (information.length === 1) {
          reject({
            code: 404,
            message:
              information[0]?.innerHTML || '운송장 정보를 찾을 수 없습니다.',
          } as TrackingError);
          return;
        }

        const shippingInformation: ShippingInformation = {
          from: { time: undefined, name: information[1]?.textContent || '' },
          to: { time: undefined, name: information[2]?.textContent || '' },
          state: { id: 'information_received', text: '접수' },
          progresses: [],
        };

        if (progressTable) {
          progressTable.querySelectorAll('tbody > tr').forEach(element => {
            const tds = element.querySelectorAll('td');
            if (tds.length < 4) return;
            if (tds[1]?.textContent?.indexOf('--:--') !== -1) return;

            shippingInformation.progresses.push({
              status: parseStatus(tds[0]?.textContent || ''),
              time: `${tds[1]?.textContent?.replace(/\s+/g, 'T') || ''}:00+09:00`,
              location: {
                name: tds[2]?.textContent || '',
              },
              description: tds[3]?.textContent || '',
            });
          });
        }

        if (shippingInformation.progresses.length < 1) {
          const errorTd = progressTable?.querySelector('tbody > tr > td');
          reject({
            code: 404,
            message: errorTd
              ? errorTd.textContent || ''
              : '화물추적 내역이 없습니다.',
          } as TrackingError);
          return;
        }

        shippingInformation.state =
          shippingInformation.progresses[
            shippingInformation.progresses.length - 1
          ].status;

        if (shippingInformation.from) {
          shippingInformation.from.time =
            shippingInformation.progresses[0]?.time;
        }

        if (
          shippingInformation.progresses[
            shippingInformation.progresses.length - 1
          ]?.status.id === 'delivered' &&
          shippingInformation.to
        ) {
          shippingInformation.to.time =
            shippingInformation.progresses[
              shippingInformation.progresses.length - 1
            ].time;
        }

        resolve(shippingInformation);
      })
      .catch((err: Error) => reject(err));
  });
}

const carrierModule: CarrierModule = {
  info: {
    name: '롯데택배',
    tel: '+8215882121',
  },
  getTrack,
};

export = carrierModule;
