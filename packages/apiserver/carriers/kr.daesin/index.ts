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

const iconv = new Iconv('EUC-KR', 'UTF-8//TRANSLIT//IGNORE');

function getTrack(trackId: string): Promise<ShippingInformation> {
  const trimString = (s: string): string => {
    return s.replace(/([\n\t]{1,}|\s{2,})/g, ' ').trim();
  };

  return new Promise<ShippingInformation>((resolve, reject) => {
    axios
      .post(
        'http://www.ds3211.co.kr/freight/internalFreightSearch.kins',
        qs.stringify({
          freightNo: trackId,
        }),
        {
          responseType: 'arraybuffer',
        }
      )
      .then(res => {
        const dom = new JSDOM(iconv.convert(res.data).toString('utf-8'));
        const { document } = dom.window;

        const tables = document.querySelectorAll('table.bd');
        if (tables.length < 2) {
          reject({
            code: 404,
            message: '운송장이 등록되지 않았거나 업체로 문의바랍니다.',
          } as TrackingError);
          return;
        }

        return {
          informationTable: tables[0],
          progressTable: tables[1],
        };
      })
      .then(({ informationTable, progressTable }) => {
        const informationTds = informationTable.querySelectorAll('td');

        const shippingInformation: ShippingInformation = {
          from: {
            name: trimString(informationTds[3]?.textContent || ''),
            time: undefined,
          },
          to: {
            name: trimString(informationTds[7]?.textContent || ''),
            time: undefined,
          },
          state: { id: 'information_received', text: '상품준비중' },
          progresses: [],
        };

        const progressTrs = progressTable.querySelectorAll(
          'tr:not(:first-child)'
        );
        progressTrs.forEach(element => {
          const insideTds = element.querySelectorAll('td');

          const timeText = insideTds[0]?.textContent?.trim() || '';
          const time = `${timeText.replace(/\./g, '-').replace(' ', 'T')}:00+09:00`;

          const statusText = insideTds[2]?.textContent?.trim() || '';
          let status: ShippingStatus;

          if (statusText.includes('인수')) {
            status = { id: 'at_pickup', text: '상품인수' };
          } else if (statusText.includes('배송출발')) {
            status = { id: 'out_for_delivery', text: '배송출발' };
          } else if (
            statusText.includes('배송완료') ||
            statusText.includes('배달완료')
          ) {
            status = { id: 'delivered', text: '배송완료' };
          } else {
            status = { id: 'in_transit', text: '이동중' };
          }

          shippingInformation.progresses.push({
            time,
            location: { name: trimString(insideTds[1]?.textContent || '') },
            status,
            description: statusText,
          });
        });

        if (shippingInformation.progresses.length > 0) {
          shippingInformation.state =
            shippingInformation.progresses[
              shippingInformation.progresses.length - 1
            ].status;

          if (shippingInformation.from) {
            shippingInformation.from.time =
              shippingInformation.progresses[0].time;
          }

          if (
            shippingInformation.progresses[
              shippingInformation.progresses.length - 1
            ].status.id === 'delivered' &&
            shippingInformation.to
          ) {
            shippingInformation.to.time =
              shippingInformation.progresses[
                shippingInformation.progresses.length - 1
              ].time;
          }
        }

        resolve(shippingInformation);
      })
      .catch((err: Error) => reject(err));
  });
}

const carrierModule: CarrierModule = {
  info: {
    name: '대신택배',
    tel: '+8218111900',
  },
  getTrack,
};

export = carrierModule;
