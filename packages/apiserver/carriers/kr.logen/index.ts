import axios from 'axios';
import * as cheerio from 'cheerio';
import {
  ShippingStatus,
  ShippingInformation,
  CarrierModule,
  TrackingError,
} from '../../types/carrier';

function parseStatus(s: string): ShippingStatus {
  if (s.includes('터미널입고')) return { id: 'at_pickup', text: '상품인수' };
  if (s.includes('배송출고'))
    return { id: 'out_for_delivery', text: '배송출발' };
  if (s.includes('배송완료')) return { id: 'delivered', text: '배송완료' };
  return { id: 'in_transit', text: '이동중' };
}

function getTrack(trackId: string): Promise<ShippingInformation> {
  const tdToDescription = (td: any[], $: cheerio.CheerioAPI): string => {
    const headers = [
      '발송점',
      '도착점',
      '담당직원',
      '인수자',
      '영업소',
      '연락처',
    ];
    return headers
      .map((header, i) => {
        return $(td[i + 2])
          .text()
          .trim() !== ''
          ? `${header}: ${$(td[i + 2])
              .text()
              .trim()}`
          : null;
      })
      .filter(obj => obj !== null)
      .join(', ');
  };

  return new Promise<ShippingInformation>((resolve, reject) => {
    axios
      .get(`https://www.ilogen.com/web/personal/trace/${encodeURI(trackId)}`, {
        responseType: 'arraybuffer',
      })
      .then(res => {
        const $ = cheerio.load(res.data.toString('utf-8'));

        const tables = $('tbody');
        const informationTable = tables[0];
        const progressTable = tables[1];

        if (!progressTable) {
          reject({
            code: 404,
            message: '운송장 정보를 찾을 수 없습니다.',
          } as TrackingError);
          return;
        }

        const infoTable = $(informationTable);
        const progTable = $(progressTable);
        return {
          informationTable: infoTable,
          progressTable: progTable,
          $,
        };
      })
      .then(({ informationTable, progressTable, $ }) => {
        const shippingInformation: ShippingInformation = {
          from: {
            name: informationTable
              .children('tr')
              .eq(3)
              .children('td')
              .eq(1)
              .text()
              .trim(),
            time: undefined,
          },
          to: {
            name: informationTable
              .children('tr')
              .eq(3)
              .children('td')
              .eq(3)
              .text()
              .trim(),
            time: undefined,
          },
          state: { id: 'information_received', text: '접수' },
          progresses: [],
        };

        progressTable.children('tr').each((index, element) => {
          const td = $(element).children('td');
          if (td.eq(0).text().trim() === '') {
            return;
          }
          shippingInformation.progresses.push({
            time: `${td.eq(0).text().replace(' ', 'T').replace(/\./g, '-')}:00+09:00`,
            location: {
              name: td.eq(1).text(),
            },
            status: parseStatus(td.eq(2).text()),
            description: tdToDescription(td.toArray(), $ as any),
          });
        });

        const lastProgress =
          shippingInformation.progresses[
            shippingInformation.progresses.length - 1
          ];

        if (lastProgress) {
          shippingInformation.state = lastProgress.status;
        }

        if (
          shippingInformation.progresses.length > 0 &&
          shippingInformation.from
        ) {
          shippingInformation.from.time =
            shippingInformation.progresses[0].time;
        }

        if (
          shippingInformation.progresses.length > 0 &&
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

        resolve(shippingInformation);
      })
      .catch((err: Error) => reject(err));
  });
}

const carrierModule: CarrierModule = {
  info: {
    name: '로젠택배',
    tel: '+8215889988',
  },
  getTrack,
};

export = carrierModule;
