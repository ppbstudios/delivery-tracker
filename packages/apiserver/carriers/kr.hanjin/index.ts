import axios from 'axios';
import { JSDOM } from 'jsdom';
import * as qs from 'querystring';
import {
  ShippingStatus,
  ShippingInformation,
  CarrierModule,
  TrackingError,
} from '../../types/carrier';

function parseStatus(s: string): ShippingStatus {
  if (s.includes('집하')) return { id: 'at_pickup', text: '상품인수' };
  if (s.includes('배송출발'))
    return { id: 'out_for_delivery', text: '배송출발' };
  if (s.includes('배송완료')) return { id: 'delivered', text: '배송완료' };
  return { id: 'in_transit', text: '이동중' };
}

function getTrack(trackId: string): Promise<ShippingInformation> {
  return new Promise<ShippingInformation>((resolve, reject) => {
    if (trackId.length !== 10 && trackId.length !== 12) {
      reject({
        code: 404,
        message: '잘못된 운송장 번호입니다.',
      } as TrackingError);
      return;
    }
    if (
      parseInt(trackId.substring(0, trackId.length - 1), 10) % 7 !==
      parseInt(trackId.substring(trackId.length - 1), 10)
    ) {
      reject({
        code: 404,
        message: '잘못된 운송장 번호입니다.',
      } as TrackingError);
      return;
    }

    axios
      .post(
        'https://m.hanex.hanjin.co.kr/inquiry/incoming/resultWaybill',
        qs.stringify({
          div: 'B',
          show: 'true',
          wblNum: trackId,
        })
      )
      .then(res => {
        const dom = new JSDOM(res.data);
        const tables = dom.window.document.querySelectorAll('table');
        if (tables.length === 0) {
          const noDataElement = dom.window.document.querySelector('.noData');
          reject({
            code: 404,
            message: noDataElement?.textContent || '데이터를 찾을 수 없습니다.',
          } as TrackingError);
          return;
        }

        return { informationTable: tables[0], progressTable: tables[1] };
      })
      .then(({ informationTable, progressTable }) => {
        const td = informationTable.querySelectorAll('td');

        const shippingInformation: ShippingInformation = {
          from: {
            name: td[1]?.textContent || '',
            time: undefined,
          },
          to: {
            name: td[2]?.textContent || '',
            time: undefined,
          },
          state: {
            id: 'information_received',
            text: '방문예정',
          },
          progresses: [],
        };

        progressTable.querySelectorAll('tr').forEach(element => {
          const insideTd = element.querySelectorAll('th, td');
          if (insideTd.length === 0) return;

          // TODO : time 년도 처리 나중에 수정 해야 함 (현재 시간하고 마지막 시간하고 비교해서 마지막 시간이 미래면 작년 껄로 처리)
          const curTime = new Date();
          let time = `${curTime.getFullYear()}-${(insideTd[0]?.innerHTML || '')
            .replace('<br>', 'T')
            .replace(/<[^>]*>/gi, '')
            .replace(/\./gi, '-')}:00+09:00`;

          if (new Date(time) > curTime) {
            time = `${curTime.getFullYear() - 1}${time.substring(4)}`;
          }

          shippingInformation.progresses.unshift({
            time,
            location: {
              name: insideTd[1]?.textContent || '',
            },
            status: parseStatus(insideTd[2]?.textContent || ''),
            description: insideTd[2]?.textContent || '',
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
        } else {
          shippingInformation.state = {
            id: 'information_received',
            text: '방문예정',
          };
        }

        resolve(shippingInformation);
      })
      .catch((err: Error) => reject(err));
  });
}

const carrierModule: CarrierModule = {
  info: {
    name: '한진택배',
    tel: '+8215880011',
  },
  getTrack,
};

export = carrierModule;
