import axios from 'axios';
import { JSDOM } from 'jsdom';
import {
  ShippingStatus,
  ShippingInformation,
  CarrierModule,
  TrackingError,
} from '../../types/carrier';

interface StatusMap {
  [key: number]: ShippingStatus;
}

const STATUS_MAP: StatusMap = {
  0: { id: 'information_received', text: '방문예정' },
  1: { id: 'at_pickup', text: '상품인수' },
  2: { id: 'in_transit', text: '이동중' },
  3: { id: 'out_for_delivery', text: '배송출발' },
  4: { id: 'delivered', text: '배송완료' },
};

interface StrToStatus {
  [key: string]: number;
}

const STR_TO_STATUS: StrToStatus = {
  집화처리: 1,
  배달출발: 3,
  배달완료: 4,
};

function getTrack(trackId: string): Promise<ShippingInformation> {
  return new Promise<ShippingInformation>((resolve, reject) => {
    axios
      .get('http://www.cvsnet.co.kr/web/service/popup/tracking.jsp', {
        params: {
          invoice_no: trackId,
        },
      })
      .then(res => {
        const dom = new JSDOM(res.data);
        const { document } = dom.window;
        const tables = document.querySelectorAll('table');

        if (tables.length < 5) {
          reject({
            code: 404,
            message: '해당 운송장이 존재하지 않습니다.',
          } as TrackingError);
          return;
        }

        return {
          informationTable: tables[1],
          progressTable: tables[4],
        };
      })
      .then(({ informationTable, progressTable }) => {
        const informationTds = informationTable.querySelectorAll('td');

        const shippingInformation: ShippingInformation = {
          from: {
            name: informationTds[3]?.textContent?.trim() || '',
            time: undefined,
          },
          to: {
            name: informationTds[1]?.textContent?.trim() || '',
            time: undefined,
          },
          state: { id: 'information_received', text: '방문예정' },
          progresses: [],
        };

        const progressTrs = progressTable.querySelectorAll('tr');
        for (let i = 1; i < progressTrs.length; i += 1) {
          const insideTds = progressTrs[i].querySelectorAll('td');
          if (insideTds.length < 4) continue;

          // TODO: year 검증 필요
          const year = new Date().getFullYear();
          const time = insideTds[0]?.textContent?.replace(/\./g, '-') || '';

          let statusIndex = 2;
          if (insideTds[2]?.textContent?.trim()) {
            statusIndex = STR_TO_STATUS[insideTds[2].textContent.trim()] || 2;
          }

          shippingInformation.progresses.unshift({
            time: `${year}-${time}T00:00:00+09:00`,
            location: { name: insideTds[1]?.textContent?.trim() || '' },
            status: STATUS_MAP[statusIndex],
            description: insideTds[3]?.textContent?.trim() || '',
          });
        }

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
    name: 'CVSnet 편의점택배',
    tel: '+8215884131',
  },
  getTrack,
};

export = carrierModule;
